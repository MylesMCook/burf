import type { LocalAgent } from "./local-computer";

// Only the provider's plain command can use its structured API.
export function supportsStructuredChat(agent: string | undefined, command: string, capabilities: readonly string[] = []): agent is LocalAgent {
  return (agent === "codex" || agent === "claude") && command === agent && capabilities.includes(`chat.${agent}`);
}
