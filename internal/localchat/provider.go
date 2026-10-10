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
	switch options.Agent {
	case "claude":
		// claude-agent-acp speaks ACP on stdio with no print-mode flags.
		return nil, nil
	case "cursor":
		return []string{"acp"}, nil
	default:
		return []string{"app-server", "--listen", "stdio://"}, nil
	}
}

// ChatCommand is the owned launch shown to the existing session-start gate.
func ChatCommand(agent string) string {
	switch agent {
	case "claude":
		return "claude-agent-acp"
	case "cursor":
		return "agent acp"
	default:
		return "codex app-server --listen stdio://"
	}
}

// AgentLabel is the product name for status and errors.
func AgentLabel(agent string) string {
	switch agent {
	case "claude":
		return "Claude Code"
	case "cursor":
		return "Cursor"
	default:
		return "Codex"
	}
}

func stoppedMessage(agent string) string {
	return AgentLabel(agent) + " chat has stopped"
}

func busyMessage(agent string) string {
	return AgentLabel(agent) + " protocol input is busy"
}

func disconnectedMessage(agent string) string {
	if agent == "codex" || agent == "" {
		return "Codex app-server disconnected"
	}
	return AgentLabel(agent) + " disconnected"
}

func isACPAgent(agent string) bool {
	return agent == "claude" || agent == "cursor"
}

func normalizeAgent(agent string) string {
	agent = strings.TrimSpace(agent)
	if agent == "" {
		return "codex"
	}
	return agent
}
