import type { AgentPreset, BoxInfo } from "./api";
import type { LocalComputer } from "./local-computer";
import { supportsStructuredChat } from "./structured-chat.ts";

export interface AgentReadiness {
  installed: boolean;
  mode: "chat" | "terminal" | "unavailable" | "unknown";
  canContinueChat?: boolean;
}

// These are launch capabilities. Provider authentication is checked by its CLI.
export function localAgentReadiness(local: LocalComputer | undefined, id: string): AgentReadiness {
  if (!local) return { installed: false, mode: "unknown" };
  const agent = local.agents.find((a) => a.id === id);
  if (!agent) return { installed: false, mode: "unknown" };
  const installed = agent.available;
  const mode = !local.supported || !installed ? "unavailable"
    : agent?.can_chat ? "chat" : agent?.can_terminal ? "terminal" : "unavailable";
  return { installed, mode, canContinueChat: local.supported && installed && agent?.can_continue_chat === true };
}

export function remoteAgentReadiness(info: Pick<BoxInfo, "agents" | "capabilities"> | undefined, id: string): AgentReadiness {
  if (!info) return { installed: false, mode: "unknown" };
  const agent: AgentPreset | undefined = info.agents?.find((a) => a.id === id);
  if (!agent) return { installed: false, mode: "unavailable" };
  return { installed: true, mode: supportsStructuredChat(agent.id, agent.command, info.capabilities) ? "chat" : "terminal" };
}
