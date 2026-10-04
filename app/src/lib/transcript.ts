// A session's work as a calm transcript rather than a terminal: what Shore
// mode draws. The agent still runs in its terminal on the box; berthd reads
// the agent's own record of the conversation (Claude's transcript, Codex's
// session file, ACP for the rest) and streams it as these items. Nothing is
// kept by Berth.

export type TranscriptItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "text"; id: string; text: string }
  | { kind: "tools"; id: string; verb: string; items?: ToolCall[]; done?: boolean }
  | { kind: "edit"; id: string; file: string; added: number; removed: number; tool?: string }
  // A question for the person. choices are the agent's own numbered options
  // when it shows some; without them it is yes or no (Allow or Deny for a
  // command). decided is what was answered.
  // A permission the agent's hooks described (structured) names the tool,
  // what it would run or touch (detail) and why, rather than a screen line.
  | { kind: "ask"; id: string; tool: string; detail: string; choices?: { key: string; label: string; title?: string }[]; decided?: string; why?: string; structured?: boolean; reading?: boolean }
  | { kind: "thinking"; id: string; since: number }
  // A command typed to the agent rather than a prompt: one of its own
  // ("/model", with what followed it) or a shell command ("!"), and the
  // output its program printed (Markdown when it wrote it so).
  | { kind: "command"; id: string; command: string; args?: string; text?: string; markdown?: boolean; error?: boolean }
  | { kind: "crew"; id: string; names: string[] }
  // Something the person should know, with one next step: an API error, a
  // usage or rate limit (resets: when, in ms), a hook that failed, a turn
  // they interrupted, an agent that ended (components/conversation/notice-card).
  | { kind: "notice"; id: string; notice: NoticeKind; level?: "error" | "warning" | "info"; text: string; resets?: number };

export type NoticeKind = "api_error" | "limit" | "rate_limit" | "auth" | "billing" | "hook" | "interrupted" | "stop_failure" | "exited";

export interface ToolCall {
  verb: string;
  target: string;
  // Names the call for its details (the full command and output).
  id?: string;
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
  // When it came back, so its time stops.
  until?: number;
}

// The summary line a finished group of tool calls folds to: "Read 5 files",
// "Searched 2 times".
export function toolSummary(t: Extract<TranscriptItem, { kind: "tools" }>): string {
  const n = t.items?.length ?? 0;
  if (t.verb === "Read") return `Read ${n} file${n === 1 ? "" : "s"}`;
  if (t.verb === "Search") return `Searched ${n} time${n === 1 ? "" : "s"}`;
  if (t.verb === "Run") return `Ran ${n} command${n === 1 ? "" : "s"}`;
  return `${t.verb} ${n}`;
}

// ToolDetail is one tool call opened up, as the agent's terminal shows it:
// the full command and its output, an edit's exact change, a new file.
// Fetched only when someone expands the call.
export interface ToolDetail {
  id: string;
  name: string;
  command?: string;
  file?: string;
  pattern?: string;
  old?: string;
  new?: string;
  output?: string;
  truncated?: boolean;
  error?: boolean;
  pending?: boolean;
  // A background shell whose output is still growing.
  live?: boolean;
}
