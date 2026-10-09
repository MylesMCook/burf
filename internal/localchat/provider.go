package localchat

import (
	"context"
	"strings"
)

// A provider speaks its CLI's protocol. The manager owns the registry, pipes,
// lifetime, transcript bounds and the operation gate shared by every chat.
type provider interface {
	start(context.Context, *running, LaunchOptions) error
	send(context.Context, *running, string, TurnOptions, string) error
	interrupt(context.Context, *running, Session) error
	decide(*running, string, string) error
	receive(*running, []byte) error
	models(context.Context, *running) ([]Model, error)
}

type codexProvider struct{}

func processArguments(options LaunchOptions) ([]string, error) {
	if options.Agent == "claude" {
		return claudeArguments(options)
	}
	return []string{"app-server", "--listen", "stdio://"}, nil
}

// ChatCommand is the owned launch shown to the existing session-start gate.
func ChatCommand(agent string) string {
	if agent == "claude" {
		args, _ := claudeArguments(LaunchOptions{})
		return "claude " + strings.Join(args, " ")
	}
	return "codex app-server --listen stdio://"
}
