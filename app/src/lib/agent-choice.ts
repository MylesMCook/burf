// Which agent the composer starts. A remembered agent that this box does
// not have stays missing: another provider is not substituted.

export interface AgentSlot {
  models: string[];
  effort: string;
}

export type AgentChoice = Record<string, AgentSlot>;

export function resolveAgentChoice(chosen: AgentChoice, installed: string[]): { sel: AgentChoice; missing?: string } {
  const have = new Set(installed);
  const live = Object.fromEntries(Object.entries(chosen).filter(([id, slot]) => slot.models.length > 0 && have.has(id)));
  if (Object.keys(live).length) return { sel: live };
  const missing = Object.keys(chosen).find((id) => (chosen[id]?.models.length ?? 0) > 0 && !have.has(id));
  if (missing) return { sel: {}, missing };
  const first = installed[0];
  return { sel: first ? { [first]: { models: [""], effort: "" } } : {} };
}
