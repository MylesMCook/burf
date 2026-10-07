//go:build !windows

package agent

import "github.com/sean-brydon/berthd/internal/localagent"

func localAgentCommands() map[string]localagent.Command { return map[string]localagent.Command{} }
