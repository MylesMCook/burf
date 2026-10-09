import { AssistantRuntimeProvider, useAuiState, useExternalStoreRuntime, type AttachmentAdapter, type ThreadMessageLike, type ToolCallMessagePartComponent } from "@assistant-ui/react";
import { createContext, useContext, useMemo, type PropsWithChildren, type ReactNode } from "react";

import { AssistantMessage, Thread, type ThreadGroupPart } from "@/components/assistant-ui/elements/thread.aui";
import { TerminalBlock } from "@/components/assistant-ui/elements/terminal-block";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback.aui";
import { ToolGroupRoot, ToolGroupTrigger, ToolGroupContent } from "@/components/assistant-ui/elements/tool-group.aui";
import type { ThreadTurn } from "@/lib/chat-thread";

// Burf supplies the turns and the controls; assistant-ui draws the thread.

interface Extras {
  // Under a tool call: the artifacts it made, say.
  tool?(id: string): ReactNode;
  // Burf's report of work the chat started, by its item.
  report?(id: string, text: string): ReactNode;
}
const ExtrasContext = createContext<Extras>({});

const done = { type: "complete", reason: "stop" } as const;

function message(turn: ThreadTurn): ThreadMessageLike {
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
        : { type: "tool-call" as const, toolCallId: p.id, toolName: "run", args: { command: p.command, output: p.output, running: p.running }, argsText: p.command, result: p.running ? undefined : p.output },
    ),
  };
}

// The runtime tool call has a content slot for the stock terminal block.
const CommandCall: ToolCallMessagePartComponent = ({ args }) => {
  const command = String((args as { command?: unknown }).command ?? "");
  const output = String((args as { output?: unknown }).output ?? "");
  const running = (args as { running?: unknown }).running === true;
  const lines = output ? output.split("\n") : [];
  return <ToolFallback.Root>
    <ToolFallback.Trigger toolName={command} status={running ? { type: "running" } : { type: "complete" }} />
    <ToolFallback.Content>
      {running ? <TerminalBlock command={command} lines={lines} visibleCount={lines.length} done={false} /> : <pre data-testid="chat-tool" className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words border-l pl-3">{output ? `${command}\n${output}` : command}</pre>}
    </ToolFallback.Content>
  </ToolFallback.Root>;
};

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
  const custom = useAuiState((s) => s.message.metadata.custom) as { report?: string; text?: string } | undefined;
  if (!custom?.report) return <AssistantMessage />;
  return (
    <section aria-label="From Burf" className="flex min-w-0 flex-col gap-2 px-2">
      <h3 className="text-xs font-medium text-muted-foreground">Burf · work this chat started</h3>
      {extras.report?.(custom.report, custom.text ?? "") ?? <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{custom.text}</p>}
    </section>
  );
}

const components = { AssistantMessage: Message, ToolFallback: CommandCall, ToolGroup: CallsWithArtifacts };
const sent = async () => {};

export function ChatThread({ turns, working, agent, composer, welcome, after, tool, report, attachments }: { turns: ThreadTurn[]; working: boolean; agent: string; composer: ReactNode; welcome?: ReactNode; after?: ReactNode; attachments?: AttachmentAdapter } & Extras) {
  // The view sends its own messages (its composer is Burf's), so the
  // runtime's own send is never reached.
  // With nothing said yet there is no turn to be under way: the view's own
  // heading says the agent is starting or working.
  const runtime = useExternalStoreRuntime({ messages: turns, isRunning: working && turns.length > 0, convertMessage: message, onNew: sent, adapters: { attachments } });
  const extras = useMemo(() => ({ tool, report }), [tool, report]);
  const speakers = useMemo(() => ({ user: "You", assistant: agent }), [agent]);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ExtrasContext.Provider value={extras}>
        <Thread components={components} autoFocus={false} composer={composer} welcome={welcome} after={after} speakers={speakers} loadEarlier={false} />
      </ExtrasContext.Provider>
    </AssistantRuntimeProvider>
  );
}
