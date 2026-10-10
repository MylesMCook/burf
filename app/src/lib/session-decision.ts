import { type Choice, permissionChoices } from "./screen.ts";

// The hook ask (packages/plugin-sdk Session.ask). Kept local so this module
// stays a plain Node test, the same as the other files in lib/.
interface Ask {
  tool?: string;
  input?: string;
  why?: string;
  message?: string;
}

// A question's tools are answered in the agent's own form, not with Allow
// or Deny. The thread and the status bar share this so a waiting agent is
// the same decision wherever you meet it.
const QUESTION_TOOLS = /^(AskUserQuestion|request_user_input|ExitPlanMode)$/;

export function isQuestionAsk(ask?: Ask): boolean {
  return !ask?.tool || QUESTION_TOOLS.test(ask.tool);
}

export type SessionDecision =
  | { kind: "permission"; title: string; command?: string; allow: Choice; deny: Choice; always?: Choice }
  | { kind: "pending"; title: string; command?: string }
  | { kind: "choices"; title: string; command?: string; choices: Choice[] }
  | { kind: "question"; title: string };

// sessionDecision is what a waiting agent is asking, from its hook ask and
// the numbered options on its screen. No options yet is pending: the
// command is known, the buttons are not.
export function sessionDecision(session: { agent_state?: string; ask?: Ask }, choices: Choice[]): SessionDecision | undefined {
  if (session.agent_state !== "waiting") return undefined;
  const ask = session.ask;
  if (isQuestionAsk(ask)) return { kind: "question", title: ask?.message?.trim() || "Waiting for your answer" };
  const command = [ask?.tool === "Bash" ? "" : ask?.tool, ask?.input].filter(Boolean).join(" ").trim() || undefined;
  const title = ask?.why?.trim() || "Allow this?";
  const mapped = permissionChoices(choices);
  const allow = mapped?.find((c) => c.label === "Allow");
  const deny = mapped?.find((c) => c.label === "Deny");
  const always = mapped?.find((c) => c.label === "Always allow");
  if (allow && deny) return { kind: "permission", title, command, allow, deny, always };
  if (choices.length >= 2) return { kind: "choices", title, command, choices: choices.slice(0, 4) };
  return { kind: "pending", title, command };
}

export interface Attention {
  box: string;
  name: string;
  dir?: string;
  since?: string;
}

// attentionTarget is the agent a count in the status bar opens. One in the
// worktree in front comes first, unless that pane is already it; then the
// one that has waited longest, and the one already open is skipped so a
// second click moves on.
export function attentionTarget(entries: Attention[], here?: { box: string; dir: string }, focused?: { box: string; name: string }): Attention | undefined {
  if (!entries.length) return undefined;
  const byAge = [...entries].sort((a, b) => (a.since ?? "").localeCompare(b.since ?? ""));
  const same = (e: Attention) => !!focused && e.box === focused.box && e.name === focused.name;
  const local = here ? byAge.filter((e) => e.box === here.box && e.dir === here.dir && !same(e)) : [];
  if (local.length) return local[0];
  return byAge.find((e) => !same(e)) ?? byAge[0];
}
