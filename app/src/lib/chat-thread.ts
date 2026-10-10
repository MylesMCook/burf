// A structured chat as assistant-ui draws it (components/assistant-ui): the
// box's flat list of items becomes messages. What the agent said and did
// between two things someone else said is one message, so a run of tool
// calls draws as one group; a person's message, and Burf's own report of
// work the chat started, each stand alone.
//
// Types only from the chat, nothing from assistant-ui: the view hands these
// to its runtime (views/local-chat.tsx), and this file's tests run in Node.

export interface ChatItem {
  id: string;
  kind: "user" | "assistant" | "tool" | "report";
  text: string;
  status?: string;
  presentation?: unknown;
  reasoning?: boolean;
}

export type ThreadPart =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  // A tool's line is the command, then what it printed.
  | { type: "tool"; id: string; command: string; output: string; running: boolean };

export interface ThreadTurn {
  // The first item's id: stable while the turn grows.
  id: string;
  role: "user" | "assistant" | "report";
  parts: ThreadPart[];
  // The agent's turn still under way: the chat's last message while it works.
  running: boolean;
}

const part = (item: ChatItem): ThreadPart => {
  if (item.kind === "assistant" && item.reasoning) return { type: "reasoning", text: item.text };
  if (item.kind !== "tool") return { type: "text", text: item.text };
  const cut = item.text.indexOf("\n");
  return { type: "tool", id: item.id, command: cut < 0 ? item.text : item.text.slice(0, cut), output: cut < 0 ? "" : item.text.slice(cut + 1), running: item.status === "inProgress" };
};

// threadTurns groups items into turns. sending is a message on its way to
// the box, shown at once and until the box lists it: its own items say when
// (the ids the box listed before the send are known).
export function threadTurns(items: readonly ChatItem[], working: boolean, sending?: { text: string; before: ReadonlySet<string> }): ThreadTurn[] {
  const turns: ThreadTurn[] = [];
  for (const item of items) {
    const last = turns[turns.length - 1];
    const assistant = item.kind === "assistant" || item.kind === "tool";
    if (assistant && last?.role === "assistant") last.parts.push(part(item));
    else turns.push({ id: item.id, role: item.kind === "tool" ? "assistant" : item.kind, parts: [part(item)], running: false });
  }
  if (sending && !items.some((item) => item.kind === "user" && !sending.before.has(item.id))) {
    turns.push({ id: "sending", role: "user", parts: [{ type: "text", text: sending.text }], running: false });
  }
  const last = turns[turns.length - 1];
  if (working && last?.role === "assistant") last.running = true;
  return turns;
}
