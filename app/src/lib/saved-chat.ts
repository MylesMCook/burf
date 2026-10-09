import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ToolCall, TranscriptItem } from "./transcript";

// Current history supplies summaries only. Preserve results when a page
// supplies them, without making a missing result look like a live call.
export type SavedTranscriptItem = Exclude<TranscriptItem, { kind: "tools" }> | {
  kind: "tools"; id: string; verb: string; done?: boolean;
  items?: (ToolCall & { output?: string; error?: boolean })[];
};
type Part = Exclude<ThreadMessageLike["content"], string>[number];
const complete = { type: "complete", reason: "stop" } as const;
const line = (...words: (string | undefined)[]) => words.filter(Boolean).join(" · ").replace(/\s+/g, " ");

function parts(item: SavedTranscriptItem): Part[] {
  const text = (value: string): Part[] => [{ type: "text", text: value }];
  switch (item.kind) {
    case "user":
    case "text": return text(item.text);
    case "tools": return item.items?.length ? item.items.map((call, index) => ({
      type: "tool-call", toolCallId: call.id || `${item.id}:${index}`,
      toolName: call.verb || item.verb, args: { summary: call.target }, argsText: JSON.stringify({ summary: call.target }),
      result: call.output ?? "Tool output is unavailable in this saved conversation.", isError: call.error,
    })) : text(line("Tool activity", item.verb));
    case "thinking": return [{ type: "reasoning", text: line(item.label || "Thinking", item.step && `${item.step.verb} ${item.step.target}`, item.elapsed, item.meta) }];
    case "ask": {
      const answer = item.choices?.find((choice) => choice.key === item.decided)?.label ?? item.decided;
      return text(line("Recorded permission", item.tool, item.detail, item.why, answer ? `Answered: ${answer}` : "Not answered"));
    }
    case "edit": return text(line("File edit", item.file, `+${item.added} -${item.removed}`));
    case "command": return text(line("Command", item.command, item.args, item.text, item.error ? "Failed" : undefined));
    case "crew": return text(line("Helpers", item.names.join(", ")));
    case "notice": return text(line("Notice", item.notice, item.text));
    case "artifact": return text(line("Artifact", item.text, item.description, item.url || item.file || item.local, item.error ? "Failed" : undefined));
    case "question": return text(line("Recorded question", ...item.questions.map((q, i) => `${q.question} · ${item.answers?.[i] ?? "Not answered"}`), item.error ? "Failed" : undefined));
    case "report": return text(line("Work report", item.report.title, item.report.status, item.report.summary, item.report.answer, item.report.needs));
    case "agent-message":
    case "ping": return text(line(item.kind === "ping" ? "Status" : "Agent message", item.msg.from.name, item.msg.title, item.msg.status, item.msg.body || item.msg.summary));
    default: {
      const other = item as { kind: string; text?: string };
      return text(line("Recorded item", other.kind, other.text));
    }
  }
}

// Adjacent agent items share a message so stock tool and reasoning groups
// fold naturally. Every saved message is complete, even an unanswered ask.
export function savedChatMessages(items: readonly SavedTranscriptItem[]): ThreadMessageLike[] {
  const messages: ThreadMessageLike[] = [];
  for (const item of items) {
    const role = item.kind === "user" ? "user" : "assistant";
    const previous = messages.at(-1);
    const message = role === "assistant" && previous?.role === role ? previous : undefined;
    const content = parts(item);
    if (message && Array.isArray(message.content)) {
      const offset = message.content.length;
      message.content.push(...content);
      const transcript = message.metadata!.custom!.transcript as Record<number, SavedTranscriptItem>;
      content.forEach((_, index) => { transcript[offset + index] = item; });
    } else messages.push({
      id: item.id, role, content, ...(role === "assistant" ? { status: complete } : {}),
      metadata: { custom: { transcript: Object.fromEntries(content.map((_, index) => [index, item])) } },
    });
  }
  return messages;
}
