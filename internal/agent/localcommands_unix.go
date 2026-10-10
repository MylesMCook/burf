//go:build !windows && !darwin

package agent

import "github.com/MylesMCook/burf/internal/localagent"

func localAgentCommands() map[string]localagent.Command { return map[string]localagent.Command{} }
func localClientSupported() bool                        { return false }
func localTerminalSupported() bool                      { return false }
