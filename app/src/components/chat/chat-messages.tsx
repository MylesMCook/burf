import { MessagePrimitive, useAui, useAuiState, type ThreadMessageLike, type TextMessagePartProps } from "@assistant-ui/react";
import { createContext, useContext, type PropsWithChildren, type ReactNode } from "react";

import { AssistantMessage, UserMessage, type ThreadGroupPart } from "@/components/assistant-ui/elements/thread.aui";
import { ToolGroupRoot, ToolGroupTrigger, ToolGroupContent } from "@/components/assistant-ui/elements/tool-group.aui";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import type { ThreadTurn } from "@/lib/chat-thread";
import type { TranscriptItem } from "@/lib/transcript";

// Burf supplies the turns and the controls; assistant-ui draws the thread.

export interface ChatExtras {
  // Under a tool call: the artifacts it made, say.
  tool?(id: string): ReactNode;
  // Burf's report of work the chat started, by its item.
  report?(id: string, text: string): ReactNode;
}
const ExtrasContext = createContext<ChatExtras>({});

const done = { type: "complete", reason: "stop" } as const;

export function chatMessage(turn: ThreadTurn): ThreadMessageLike {
  if (turn.role === "user") return { id: turn.id, role: "user", content: turn.parts.map((p) => ({ type: "text" as const, text: p.type === "text" ? p.text : p.command })) };
  if (turn.role === "report") {
    const text = turn.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n");
    return { id: turn.id, role: "assistant", content: [{ type: "text", text }], status: done, metadata: { custom: { report: turn.id, text } } };
  }
  return {
    id: turn.id,
    role: "assistant",
    status: turn.running ? { type: "running" } : done,
    content: turn.parts.map((p) =>
      p.type === "text"
        ? { type: "text" as const, text: p.text }
        : { type: "tool-call" as const, toolCallId: p.id, toolName: p.command, args: { command: p.command }, argsText: p.command, result: p.running ? undefined : p.output },
    ),
  };
}

// Artifacts stay outside the stock group's fold, as they did before.
function CallsWithArtifacts({ group, children }: PropsWithChildren<{ group: ThreadGroupPart }>) {
  const extras = useContext(ExtrasContext);
  const parts = useAuiState((s) => s.message.parts);
  return (
    <>
      <ToolGroupRoot variant="ghost">
        <ToolGroupTrigger count={group.indices.length} active={group.status.type === "running"} />
        <ToolGroupContent>{children}</ToolGroupContent>
      </ToolGroupRoot>
      {group.indices.map((i) => {
        const part = parts[i];
        return part?.type === "tool-call" ? extras.tool?.(part.toolCallId) : null;
      })}
    </>
  );
}

// Burf's own report of work the chat started is not something Codex said:
// it stands apart from the agent's messages, under Burf's name.
function Message() {
  const extras = useContext(ExtrasContext);
  const custom = useAuiState((s) => s.message.metadata.custom) as { report?: string; text?: string; own?: boolean } | undefined;
  if (custom?.own) return <MessagePrimitive.Root><MessagePrimitive.Parts /></MessagePrimitive.Root>;
  if (!custom?.report) return <AssistantMessage />;
  return (
    <section aria-label="From Burf" className="flex min-w-0 flex-col gap-2 px-2">
      <h3 className="text-xs font-medium text-muted-foreground">Burf · work this chat started</h3>
      {extras.report?.(custom.report, custom.text ?? "") ?? <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{custom.text}</p>}
    </section>
  );
}

function useTranscriptItem() {
  const query = useAui().part.query;
  const index = query && "index" in query ? query.index : undefined;
  const custom = useAuiState((s) => s.message.metadata.custom) as { transcript?: Record<number, TranscriptItem> };
  return index === undefined ? undefined : custom?.transcript?.[index];
}
function TranscriptText({ item, user, children }: PropsWithChildren<{ item?: TranscriptItem; user?: boolean }>) {
  if (!item) return children;
  const live = item.kind === "text" && item.live;
  return <div data-item-id={item.id} data-testid="chat-item" data-kind={item.kind} data-draft={live ? "" : undefined} data-selectable data-prompt-text={user ? "" : undefined}>
    <div aria-busy={live || undefined}>
      {live && item.clipped && <p className="cv-clipped"><span aria-hidden>…</span> Its start is above the agent's screen: the whole reply shows once it's written</p>}
      {children}
    </div>
  </div>;
}
function Text(props: TextMessagePartProps) {
  const item = useTranscriptItem();
  return <TranscriptText item={item}><MarkdownText {...props} containerProps={item?.kind === "text" ? { "data-status": item.live ? "running" : "complete" } : undefined} /></TranscriptText>;
}
function UserText({ text }: TextMessagePartProps) { return <TranscriptText item={useTranscriptItem()} user><span className="whitespace-pre-wrap">{text}</span></TranscriptText>; }

const components = { UserMessage, UserText, Text, AssistantMessage: Message, ToolGroup: CallsWithArtifacts };

export function ChatMessages({ extras, children }: PropsWithChildren<{ extras: ChatExtras }>) {
  return <ExtrasContext.Provider value={extras}>{children}</ExtrasContext.Provider>;
}
ChatMessages.components = components;
