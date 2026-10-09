import { ArrowLeftIcon, FolderIcon, GitForkIcon, MessageSquareIcon, PlusIcon, RotateCwIcon, TerminalIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TranscriptThread } from "@/components/conversation/transcript-thread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tip } from "@/components/tip";
import { type Client } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { localAgentName, localApi, type LocalAgent, type LocalComputer, type LocalConversation, type LocalHistoryPage, type LocalSession } from "@/lib/local-computer";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ViewHeader } from "@/views/view-header";
import { LocalTerminal } from "@/views/local-terminal";
import { LocalChat } from "@/views/local-chat";

const EMPTY: LocalHistoryPage["items"] = [];

type Selection = { kind: "history"; conversation: LocalConversation } | { kind: "session"; session: LocalSession } | { kind: "new" };

export function LocalComputerView() {
  const client = useStore((s) => s.client)!;
  const [local, setLocal] = useState<LocalComputer>();
  const [conversations, setConversations] = useState<LocalConversation[]>([]);
  const [selection, select] = useState<Selection>();
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

  return <div className="@container/local flex h-full min-w-0 flex-col">
    <ViewHeader title={local?.name || "This computer"} description="This computer" actions={<>
      <Tip label="Refresh local conversations"><Button size="icon-sm" variant="ghost" aria-label="Refresh local conversations" disabled={loading} onClick={() => void refresh()}><RotateCwIcon className={cn("size-4", loading && "animate-spin")} /></Button></Tip>
      <Button size="sm" disabled={!local?.supported} onClick={() => select({ kind: "new" })}><PlusIcon />New agent</Button>
    </>} />
    {error && <div role="alert" className="border-b px-4 py-2 text-sm text-destructive">{error}</div>}
    {local && !local.supported ? <p className="p-6 text-sm text-muted-foreground">Local agents are unavailable on this computer.</p> : <div className="flex min-h-0 flex-1">
      <aside aria-label="Local conversations" className={cn("w-full shrink-0 overflow-y-auto border-r @min-[600px]/local:w-64 @min-[900px]/local:w-72", selection && "hidden @min-[600px]/local:block")}>
        <div className="p-3"><Input aria-label="Search local conversations" placeholder="Search conversations" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {!!local?.sessions?.length && <section className="pb-3">
          <h2 className="px-3 py-1 text-xs font-medium text-muted-foreground">Started in Burf</h2>
          {local.sessions.map((s) => <button key={s.id} type="button" onClick={() => select({ kind: "session", session: s })} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent", selection?.kind === "session" && selection.session.id === s.id && "bg-accent")}>
            {s.mode === "chat" ? <MessageSquareIcon className="size-4 shrink-0" /> : <TerminalIcon className="size-4 shrink-0" />}<span className="min-w-0 flex-1"><span className="block truncate">{localAgentName(s.agent)}</span><span className="block truncate text-muted-foreground" title={s.cwd}>{s.cwd}</span></span><span className="text-muted-foreground">{s.state}</span>
          </button>)}
        </section>}
        <h2 className="px-3 py-1 text-xs font-medium text-muted-foreground">Existing conversations</h2>
        {projects.map(([cwd, chats]) => <section key={cwd} className="pb-3">
          <h3 className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground"><FolderIcon className="size-3.5 shrink-0" /><span className="truncate" title={cwd}>{cwd || "Unknown project"}</span></h3>
          {chats.map((c) => <button type="button" key={c.id} onClick={() => select({ kind: "history", conversation: c })} className={cn("flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-accent", selection?.kind === "history" && selection.conversation.id === c.id && "bg-accent")}>
            <MessageSquareIcon className="mt-0.5 size-3.5 shrink-0" /><span className="min-w-0"><span className="block truncate">{c.title || "Untitled conversation"}</span><span className="block text-muted-foreground">{localAgentName(c.source)} <time dateTime={c.updated_at}>{new Date(c.updated_at).toLocaleDateString()}</time></span></span>
          </button>)}
        </section>)}
        {!loading && !projects.length && <p className="px-3 py-4 text-xs text-muted-foreground">{search ? "No matching conversations." : "No local conversations found."}</p>}
      </aside>
      <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !selection && "hidden @min-[600px]/local:flex")}>
        {selection && <div className="border-b px-3 py-1 @min-[600px]/local:hidden"><Button size="sm" variant="ghost" onClick={() => select(undefined)}><ArrowLeftIcon />Conversations</Button></div>}
        {selection?.kind === "history" && <LocalHistory key={selection.conversation.id} client={client} conversation={selection.conversation} canFork={!!local?.agents.find((a) => a.id === selection.conversation.source)?.can_fork} onStart={(session, conversationID) => {
          changeSession(session);
          select((current) => current?.kind === "history" && current.conversation.id === conversationID ? { kind: "session", session } : current);
        }} />}
        {selection?.kind === "session" && (selection.session.mode === "chat" ? <LocalChat key={selection.session.id} client={client} session={selection.session} onChange={changeSession} /> : <LocalTerminal key={selection.session.id} client={client} session={selection.session} onChange={changeSession} />)}
        {selection?.kind === "new" && local && <NewLocalAgent client={client} local={local} onStart={(session) => { changeSession(session); select({ kind: "session", session }); }} />}
        {!selection && <div className="m-auto px-6 text-sm text-muted-foreground">Select a conversation or start an agent.</div>}
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
  return <>
    <div className="flex min-w-0 flex-wrap items-center gap-3 border-b px-4 py-3"><h2 className="min-w-0 flex-1 truncate text-sm font-medium" title={conversation.title}>{conversation.title}</h2><span className="shrink-0 text-xs text-muted-foreground">Read-only</span></div>
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      <Tip label={canFork ? "Continue as a new chat; the original stays unchanged" : "Installed CLI does not support continuing a copy"}>
        <Button size="sm" variant="outline" disabled={!canFork || starting} onClick={async () => {
          if (startingRef.current) return;
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
      {page?.more && before !== undefined && <Button size="sm" variant="outline" disabled={loading} onClick={() => void load(before)}>Load older messages</Button>}
      <Tip label="Refresh conversation"><Button size="icon-sm" variant="ghost" aria-label="Refresh conversation" disabled={loading} onClick={() => void load()}><RotateCwIcon className="size-4" /></Button></Tip>
      {loading && <span role="status" className="text-xs text-muted-foreground">Loading conversation...</span>}
    </div>
    {error && <p role="alert" className="px-4 py-2 text-sm text-destructive">{error}</p>}
    {startError && <p role="alert" className="px-4 py-2 text-sm text-destructive">{startError}</p>}
    <div className="min-h-0 flex-1" data-testid="local-history"><TranscriptThread items={page?.items ?? EMPTY} who={localAgentName(conversation.source)} readOnly /></div>
  </>;
}

function NewLocalAgent({ client, local, onStart }: { client: Client; local: LocalComputer; onStart(session: LocalSession): void }) {
  const [agent, setAgent] = useState<LocalAgent | "">(local.agents.find((a) => a.available && a.can_chat)?.id ?? local.agents.find((a) => a.available)?.id ?? "");
  const [cwd, setCwd] = useState(local.home);
  const [busy, setBusy] = useState(false);
  const structured = agent === "codex" && !!local.agents.find((a) => a.id === agent)?.can_chat;
  const [error, setError] = useState("");
  const launch = useRef<AbortController | null>(null);
  useEffect(() => () => launch.current?.abort(), [client]);
  return <form className="w-full max-w-xl space-y-4 p-6" onSubmit={async (e) => {
    e.preventDefault();
    if (!agent || !cwd.trim() || busy || launch.current && !launch.current.signal.aborted) return;
    const controller = new AbortController();
    launch.current = controller;
    setBusy(true); setError("");
    try {
      const session = structured ? await localApi.startChat(client, cwd.trim(), controller.signal) : await localApi.start(client, agent, cwd.trim(), controller.signal);
      if (!controller.signal.aborted) onStart(session);
    }
    catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (launch.current === controller) launch.current = null; setBusy(false); }
  }}>
    <h2 className="text-base font-medium">New local agent</h2>
    <label className="block space-y-1.5 text-sm"><span>Project directory</span><Input value={cwd} onChange={(e) => setCwd(e.target.value)} required disabled={busy} /></label>
    <label className="block space-y-1.5 text-sm"><span>Agent</span><select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={agent} onChange={(e) => setAgent(e.target.value as LocalAgent)} disabled={busy}>
      {!agent && <option value="">No installed agent available</option>}
      {local.agents.map((a) => <option key={a.id} value={a.id} disabled={!a.available}>{localAgentName(a.id)}{!a.available && " (not installed)"}</option>)}
    </select></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy || !agent || !cwd.trim()}>{structured ? <MessageSquareIcon /> : <TerminalIcon />}{busy ? "Starting..." : structured ? "Start chat" : "Start agent"}</Button>
  </form>;
}
