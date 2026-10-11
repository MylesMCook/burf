package inventory

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"regexp"
	"strings"
	"unicode/utf16"
)

var sshTargetPattern = regexp.MustCompile(`^(?:[a-zA-Z0-9_][a-zA-Z0-9_.-]*@)?(?:[a-zA-Z0-9_][a-zA-Z0-9_.-]*|\[[0-9a-fA-F:]+\]|[0-9a-fA-F:]+)$`)

// ValidateSSHTarget accepts routes interpreted by existing OpenSSH configuration.
// It rejects option injection, shell syntax, URLs, and interactive-only routes.
func ValidateSSHTarget(target string) error {
	if len(target) > 320 || !sshTargetPattern.MatchString(target) {
		return errors.New("invalid SSH route: use a host alias or user@host")
	}
	return nil
}
func sshArgs(target, command string) []string {
	return []string{"-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "UpdateHostKeys=no", "-o", "ClearAllForwardings=yes", "-o", "PermitLocalCommand=no", "-o", "NumberOfPasswordPrompts=0", "-o", "ConnectTimeout=5", "-o", "ConnectionAttempts=1", "-o", "ServerAliveInterval=2", "-o", "ServerAliveCountMax=1", "--", target, command}
}
func shellCommand(name string, args []string) string {
	parts := []string{shellQuote(name)}
	for _, arg := range args {
		parts = append(parts, shellQuote(arg))
	}
	return strings.Join(parts, " ")
}
func shellQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'" }
func powershellEncoded(script string) string {
	chars := utf16.Encode([]rune(script))
	data := make([]byte, len(chars)*2)
	for i, ch := range chars {
		binary.LittleEndian.PutUint16(data[i*2:], ch)
	}
	return base64.StdEncoding.EncodeToString(data)
}
func (c *collector) powershell(ctx context.Context, script string) ([]byte, error) {
	args := []string{"-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", powershellEncoded(`$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);$OutputEncoding=[Console]::OutputEncoding;` + script)}
	ctx, cancel := context.WithTimeout(ctx, collectorTimeout)
	defer cancel()
	if c.target != "" {
		// Windows OpenSSH commonly uses cmd.exe as its login shell. This command
		// contains only a fixed executable, flags, and base64, valid in cmd and PowerShell.
		return c.run(ctx, "ssh", sshArgs(c.target, "powershell.exe "+strings.Join(args, " "))...)
	}
	return c.run(ctx, "powershell.exe", args...)
}
func (c *collector) probeOS(ctx context.Context) (string, error) {
	data, err := c.query(ctx, "uname", "-s")
	if err == nil {
		switch strings.TrimSpace(string(data)) {
		case "Darwin":
			return "darwin", nil
		case "Linux":
			return "linux", nil
		}
	}
	if ctx.Err() != nil {
		return "", ctx.Err()
	}
	data, windowsErr := c.powershell(ctx, `[Console]::Write('Windows')`)
	if windowsErr == nil && strings.TrimSpace(string(data)) == "Windows" {
		return "windows", nil
	}
	if windowsErr != nil {
		return "", windowsErr
	}
	if err != nil {
		return "", err
	}
	return "", errors.New("unsupported operating system")
}
