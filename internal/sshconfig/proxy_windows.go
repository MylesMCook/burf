package sshconfig

import "syscall"

// Windows OpenSSH passes ProxyCommand to CreateProcess without a shell.
func proxyQuote(s string) string { return syscall.EscapeArg(s) }
