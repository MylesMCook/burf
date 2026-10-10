import * as stylex from "@stylexjs/stylex";
import { ArrowLeftIcon, FolderIcon, GitForkIcon, MessageSquareIcon, PlusIcon, RotateCwIcon, TerminalIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chat } from "@/components/chat/chat";
import type { ChatTransport } from "@/components/chat/chat-transport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tip } from "@/components/tip";
import { type Client } from "@/lib/api";
import { openComposer } from "@/lib/composer";
import { errorMessage } from "@/lib/format";
import { localAgentName, localApi, type LocalComputer, type LocalConversation, type LocalHistoryPage, type LocalSession } from "@/lib/local-computer";
import { useStore } from "@/lib/store";
import { savedChatMessages } from "@/lib/saved-chat";
import { ViewHeader } from "@/views/view-header";
import { LocalTerminal } from "@/views/local-terminal";
import { LocalChat } from "@/views/local-chat";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s1: {
    "width": "16px",
    "height": "16px",
  },
  s2: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "color": "var(--destructive)",
  },
  s3: {
    "padding": "24px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s5: {
    "width": "100%",
    "flexShrink": 0,
    "overflowY": "auto",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s6: {
    "display": "none",
  },
  s7: {
    "padding": "12px",
  },
  s8: {
    "paddingBottom": "12px",
  },
  s9: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
  },
  s10: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "fontSize": "12px",
    "lineHeight": "16px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s11: {
    "backgroundColor": "var(--accent)",
  },
  s12: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s13: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s14: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s15: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s16: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s17: {
    "color": "var(--muted-foreground)",
  },
  s18: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
  },
  s19: {
    "paddingBottom": "12px",
  },
  s20: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s21: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s22: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s23: {
    "display": "flex",
    "width": "100%",
    "alignItems": "flex-start",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "fontSize": "12px",
    "lineHeight": "16px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s24: {
    "backgroundColor": "var(--accent)",
  },
  s25: {
    "marginTop": "2px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s26: {
    "minWidth": "0px",
  },
  s27: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s28: {
    "display": "block",
    "color": "var(--muted-foreground)",
  },
  s29: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s30: {
    "display": "flex",
    "minHeight": "0px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s31: {
    "display": "none",
  },
  s32: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s33: {
    "margin": "auto",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "color": "var(--muted-foreground)",
  },
  s34: {
    "display": "flex",
    "minWidth": "0px",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s35: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "14px",
    "lineHeight": "20px",
    "fontWeight": 500,
  },
  s36: {
    "flexShrink": 0,
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s37: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s38: {
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s39: {
    "width": "16px",
    "height": "16px",
  },
  s40: {
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--muted-foreground)",
  },
  s41: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "color": "var(--destructive)",
  },
  s42: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "color": "var(--destructive)",
  },

  s43: {
    containerType: "inline-size",
    containerName: "local",
  },
  s44: {
    "@container local (min-width: 600px)": {
      width: 256,
    },
    "@container local (min-width: 900px)": {
      width: 288,
    },
  },
  s45: {
    "@container local (min-width: 600px)": {
      display: "block",
    },
  },
  s46: {
    "@container local (min-width: 600px)": {
      display: "flex",
    },
  },
  s47: {
    "@container local (min-width: 600px)": {
      display: "none",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const EMPTY: LocalHistoryPage["items"] = [];

type Selection = { kind: "history"; conversation: LocalConversation } | { kind: "session"; session: LocalSession };

export function LocalComputerView() {
  const client = useStore((s) => s.client)!;
  const [local, setLocal] = useState<LocalComputer>();
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const view = useStore((s) => s.view);
  const opened = view.kind === "local" ? view.session : undefined;
  const [selection, select] = useState<Selection | undefined>(() => opened ? { kind: "session", session: opened } : undefined);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const value = await localApi.status(client, controller.signal);
      if (controller.signal.aborted) return;
      setLocal(value);
      const history = value.supported ? await localApi.conversations(client, controller.signal) : [];
      if (controller.signal.aborted) return;
      setConversations(history ?? []);
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [client]);
  useEffect(() => { void refresh(); return () => request.current?.abort(); }, [refresh]);
  const projects = useMemo(() => {
    const grouped = new Map<string, LocalConversation[]>();
    for (const c of conversations) {
      if (search && !`${c.title} ${c.cwd} ${c.source}`.toLowerCase().includes(search.toLowerCase())) continue;
      const group = grouped.get(c.cwd) ?? [];
      group.push(c);
      grouped.set(c.cwd, group);
    }
    return [...grouped.entries()];
  }, [conversations, search]);
  const changeSession = useCallback((session: LocalSession) => {
    setLocal((value) => value ? { ...value, sessions: [session, ...(value.sessions ?? []).filter((s) => s.id !== session.id)] } : value);
    select((current) => current?.kind === "session" && current.session.id === session.id ? { kind: "session", session } : current);
  }, []);
  useEffect(() => {
    if (!opened) return;
    changeSession(opened);
    select({ kind: "session", session: opened });
  }, [opened, changeSession]);

  return <div className={[sx(paint.s0), sx(paint.s43)].filter(Boolean).join(" ")}>
    <ViewHeader title={local?.name || "This computer"} description="This computer" actions={<>
      <Tip label="Refresh local conversations"><Button size="icon-sm" variant="ghost" aria-label="Refresh local conversations" disabled={loading} onClick={() => void refresh()}><RotateCwIcon className={[sx(paint.s1), loading && "burf-spin"].filter(Boolean).join(" ")} /></Button></Tip>
      <Button size="sm" disabled={!local?.supported} onClick={() => { select(undefined); openComposer({ place: { kind: "local" } }); }}><PlusIcon />New agent</Button>
    </>} />
    {error && <div role="alert" className={sx(paint.s2)}>{error}</div>}
    {local && !local.supported ? <p className={sx(paint.s3)}>Local agents are unavailable on this computer.</p> : <div className={sx(paint.s4)}>
      <aside aria-label="Local conversations" className={[[sx(paint.s5), sx(paint.s44)].filter(Boolean).join(" "), selection && [sx(paint.s6), sx(paint.s45)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
        <div className={sx(paint.s7)}><Input aria-label="Search local conversations" placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {!!local?.sessions?.length && <section className={sx(paint.s8)}>
          <h2 className={sx(paint.s9)}>Started in Burf</h2>
          {local.sessions.map((s) => <Tip key={s.id} label={s.cwd} width="lg"><button type="button" onClick={() => select({ kind: "session", session: s })} className={[sx(paint.s10), selection?.kind === "session" && selection.session.id === s.id && sx(paint.s11)].filter(Boolean).join(" ")}>
            {s.mode === "chat" ? <MessageSquareIcon className={sx(paint.s12)} /> : <TerminalIcon className={sx(paint.s13)} />}<span className={sx(paint.s14)}><span className={sx(paint.s15)}>{localAgentName(s.agent)}</span><span className={sx(paint.s16)}>{s.cwd}</span></span><span className={sx(paint.s17)}>{s.state}</span>
          </button></Tip>)}
        </section>}
        <h2 className={sx(paint.s18)}>Existing conversations</h2>
        {projects.map(([cwd, chats]) => <section key={cwd} className={sx(paint.s19)}>
          <h3 className={sx(paint.s20)}><FolderIcon className={sx(paint.s21)} /><Tip label={cwd || undefined} width="lg"><span className={sx(paint.s22)}>{cwd || "Unknown project"}</span></Tip></h3>
          {chats.map((c) => <button type="button" key={c.id} onClick={() => select({ kind: "history", conversation: c })} className={[sx(paint.s23), selection?.kind === "history" && selection.conversation.id === c.id && sx(paint.s24)].filter(Boolean).join(" ")}>
            <MessageSquareIcon className={sx(paint.s25)} /><span className={sx(paint.s26)}><span className={sx(paint.s27)}>{c.title || "Untitled conversation"}</span><span className={sx(paint.s28)}>{localAgentName(c.source)} <time dateTime={c.updated_at}>{new Date(c.updated_at).toLocaleDateString()}</time></span></span>
          </button>)}
        </section>)}
        {!loading && !projects.length && <p className={sx(paint.s29)}>{search ? "No matching conversations." : "No local conversations found."}</p>}
      </aside>
      <section className={[sx(paint.s30), !selection && [sx(paint.s31), sx(paint.s46)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
        {selection && <div className={[sx(paint.s32), sx(paint.s47)].filter(Boolean).join(" ")}><Button size="sm" variant="ghost" onClick={() => select(undefined)}><ArrowLeftIcon />Conversations</Button></div>}
        {selection?.kind === "history" && <LocalHistory key={selection.conversation.id} client={client} conversation={conversations.find((c) => c.id === selection.conversation.id) ?? selection.conversation} canFork={!!local?.agents.find((a) => a.id === selection.conversation.source)?.can_fork} onStart={(session, conversationID) => {
          changeSession(session);
          select((current) => current?.kind === "history" && current.conversation.id === conversationID ? { kind: "session", session } : current);
        }} />}
        {selection?.kind === "session" && (selection.session.mode === "chat" ? <LocalChat key={selection.session.id} client={client} session={selection.session} onChange={changeSession} /> : <LocalTerminal key={selection.session.id} client={client} session={selection.session} onChange={changeSession} />)}
        {!selection && <div className={sx(paint.s33)}>Select a conversation or start an agent.</div>}
      </section>
    </div>}
  </div>;
}

function LocalHistory({ client, conversation, canFork, onStart }: { client: Client; conversation: LocalConversation; canFork: boolean; onStart(session: LocalSession, conversationID: string): void }) {
  const [page, setPage] = useState<LocalHistoryPage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const startingRef = useRef(false);
  const launch = useRef<AbortController | null>(null);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async (before?: number) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await localApi.history(client, conversation.id, before, controller.signal);
      if (controller.signal.aborted) return;
      setPage((old) => {
        const items = result.items ?? [];
        const ids = new Set(items.map((it) => it.id));
        return { ...result, items: before === undefined ? items : [...items, ...(old?.items ?? []).filter((it) => !ids.has(it.id))].slice(0, 5000) };
      });
    } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [client, conversation.id]);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  useEffect(() => () => launch.current?.abort(), [client, conversation.id]);
  const before = page?.start ?? page?.items[0]?.off;
  const usable = conversation.can_continue !== false;
  const canContinue = canFork && usable;
  const continueReason = usable ? undefined : conversation.continue_reason;
  const messages = useMemo(() => savedChatMessages(page?.items ?? EMPTY), [page?.items]);
  const transport = useMemo<ChatTransport>(() => {
    const session = { id: conversation.id, agent: conversation.source, cwd: conversation.cwd, state: "idle" as const, started_at: conversation.updated_at };
    const snapshot = { ...session, thread_id: conversation.id, items: [], approvals: [], messages };
    return {
      session, snapshot, agentName: localAgentName(conversation.source), testId: "local-history", readOnly: true,
      loading: loading && !page, hasEarlier: !!page?.more && before !== undefined,
      loadEarlier: async () => { if (!loading && before !== undefined) await load(before); },
      read: async () => snapshot,
    };
  }, [conversation, messages, loading, page, before, load]);
  return <>
    <div className={sx(paint.s34)}><Tip label={conversation.title || undefined} width="lg"><h2 className={sx(paint.s35)}>{conversation.title}</h2></Tip><span className={sx(paint.s36)}>Read-only</span></div>
    <div className={sx(paint.s37)}>
      <Tip label={canFork ? "Continue as a new chat; the original stays unchanged" : "Installed CLI does not support continuing a copy"}>
        <Button size="sm" variant="outline" disabled={!canContinue || starting} aria-describedby={continueReason ? "local-continue-reason" : undefined} onClick={async () => {
          if (!canContinue || startingRef.current) return;
          startingRef.current = true;
          const controller = new AbortController();
          launch.current = controller;
          setStarting(true); setStartError("");
          try {
            const session = await localApi.fork(client, conversation.id, controller.signal);
            if (!controller.signal.aborted) onStart(session, conversation.id);
          }
          catch (e) { if (!controller.signal.aborted) setStartError(errorMessage(e)); }
          finally { startingRef.current = false; setStarting(false); }
        }}><GitForkIcon />{starting ? "Starting..." : "Continue in Burf"}</Button>
      </Tip>
      {continueReason && <p id="local-continue-reason" role="status" className={sx(paint.s38)}>{continueReason}</p>}
      <Tip label="Refresh conversation"><Button size="icon-sm" variant="ghost" aria-label="Refresh conversation" disabled={loading} onClick={() => void load()}><RotateCwIcon className={sx(paint.s39)} /></Button></Tip>
      {loading && <span role="status" className={sx(paint.s40)}>Loading conversation...</span>}
    </div>
    {error && <p role="alert" className={sx(paint.s41)}>{error}</p>}
    {startError && <p role="alert" className={sx(paint.s42)}>{startError}</p>}
    <Chat transport={transport} />
  </>;
}
