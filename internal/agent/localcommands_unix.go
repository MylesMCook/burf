//go:build !windows

package agent

import "github.com/MylesMCook/burf/internal/localagent"

func localAgentCommands() map[string]localagent.Command { return map[string]localagent.Command{} }
