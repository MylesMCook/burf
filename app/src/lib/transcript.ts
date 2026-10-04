// A session's work as a calm transcript rather than a terminal: what Shore
// mode draws. The agent still runs in its terminal on the box; berthd reads
// the agent's own record of the conversation (Claude's transcript, Codex's
// session file, ACP for the rest) and streams it as these items. Nothing is
// kept by Berth.

export type TranscriptItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "text"; id: string; text: string }
  | { kind: "tools"; id: string; verb: string; items: ToolCall[]; done: boolean }
  | { kind: "edit"; id: string; file: string; added: number; removed: number }
  | { kind: "ask"; id: string; tool: string; detail: string; decided?: "approved" | "denied" }
  | { kind: "thinking"; id: string; since: number }
  | { kind: "crew"; id: string; names: string[] };

export interface ToolCall {
  verb: string;
  target: string;
  // A file the call read or wrote, for its chip.
  file?: boolean;
}

// One helper working beside the agent: a subagent it started, or another
// agent on the same work (an attempt, a reviewer, a loop).
export interface CrewMember {
  id: string;
  name: string;
  kind: "subagent" | "attempt" | "reviewer" | "loop";
  agent: string;
  state: "running" | "waiting" | "finished";
  doing: string;
  since: number;
}

// The summary line a finished group of tool calls folds to: "Read 5 files",
// "Searched 2 times".
export function toolSummary(t: Extract<TranscriptItem, { kind: "tools" }>): string {
  const n = t.items.length;
  if (t.verb === "Read") return `Read ${n} file${n === 1 ? "" : "s"}`;
  if (t.verb === "Search") return `Searched ${n} time${n === 1 ? "" : "s"}`;
  if (t.verb === "Run") return `Ran ${n} command${n === 1 ? "" : "s"}`;
  return `${t.verb} ${n}`;
}
