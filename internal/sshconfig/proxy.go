package sshconfig

import "strings"

// ProxyCommand quotes the literal executable and network for OpenSSH's
// local process, leaving its host and port tokens for SSH to expand.
func ProxyCommand(exe, network string) string {
	return proxyQuote(strings.ReplaceAll(exe, "%", "%%")) + " network proxy " +
		proxyQuote(strings.ReplaceAll(network, "%", "%%")) + " %h %p"
}
