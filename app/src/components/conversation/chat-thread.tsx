import { AssistantRuntimeProvider, useAuiState, useExternalStoreRuntime, type ThreadMessageLike, type ToolCallMessagePartComponent } from "@assistant-ui/react";
import { createContext, useContext, useMemo, type PropsWithChildren, type ReactNode } from "react";

import { AssistantMessage, Thread, type ThreadGroupPart } from "@/components/assistant-ui/elements/thread.aui";
import type { ThreadTurn } from "@/lib/chat-thread";

// A structured chat drawn by assistant-ui's thread (components/assistant-ui):
// its viewport, its messages and its markdown, fed by Burf's own chat rather
// than a model route. The view keeps what is Burf's: the composer with its
// permission, model and effort, the approvals, and what Burf adds to a tool
// call or a report (lib/chat-thread.ts makes the turns).

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
        : { type: "tool-call" as const, toolCallId: p.id, toolName: "run", args: { command: p.command }, argsText: p.command, result: p.running ? undefined : p.output },
    ),
  };
}

// What the agent ran and what it printed, as the box told it: the command,
// then its output, in one block a person can scroll.
const Tool: ToolCallMessagePartComponent = ({ args, result }) => {
  const command = String((args as { command?: unknown }).command ?? "");
  const output = typeof result === "string" ? result : "";
  return <pre data-testid="chat-tool" className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words border-l pl-3">{output ? `${command}\n${output}` : command}</pre>;
};

// A run of tool calls folds into one line that says how many, and whether
// one is still going.
// What Burf adds for a call (an artifact it made) stays in view below the
// fold, whether or not the run is open.
function ToolGroup({ group, children }: PropsWithChildren<{ group: ThreadGroupPart }>) {
  const extras = useContext(ExtrasContext);
  const parts = useAuiState((s) => s.message.parts);
  return (
    <div className="min-w-0 py-1">
      <details className="min-w-0 text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          Tool activity · {group.indices.length}
          {group.status.type === "running" ? " · working" : ""}
        </summary>
        {children}
      </details>
      {group.indices.map((i) => {
        const part = parts[i];
        return part?.type === "tool-call" ? extras.tool?.(part.toolCallId) : null;
      })}
    </div>
  );
}

// Burf's own report stands apart from what the agent said.
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

const components = { AssistantMessage: Message, ToolFallback: Tool, ToolGroup };
const sent = async () => {};

export function ChatThread({ turns, working, agent, composer, welcome, after, tool, report }: { turns: ThreadTurn[]; working: boolean; agent: string; composer: ReactNode; welcome?: ReactNode; after?: ReactNode } & Extras) {
  // The view sends its own messages (its composer is Burf's), so the
  // runtime's own send is never reached.
  // With nothing said yet there is no turn to be under way: the view's own
  // heading says the agent is starting or working.
  const runtime = useExternalStoreRuntime({ messages: turns, isRunning: working && turns.length > 0, convertMessage: message, onNew: sent });
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
