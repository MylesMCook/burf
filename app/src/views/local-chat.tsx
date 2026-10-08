import { ArrowUpIcon, RotateCwIcon, SquareIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "@/components/conversation/markdown";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";
import type { Client } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { localApi, type LocalChat as Chat, type LocalSession } from "@/lib/local-computer";

export function LocalChat({ client, session, onChange }: { client: Client; session: LocalSession; onChange(session: LocalSession): void }) {
  const transport = useMemo(() => ({
    read: (signal?: AbortSignal) => localApi.chat(client, session.id, signal),
    message: (text: string) => localApi.message(client, session.id, text),
    stop: () => localApi.stopChat(client, session.id),
    interrupt: () => localApi.interruptChat(client, session.id),
    approve: (id: string, decision: "accept" | "decline") => localApi.approveChat(client, session.id, id, decision),
  }), [client, session.id]);
  return <StructuredChat transport={transport} session={session} onChange={onChange} />;
}

export interface ChatTransport {
  read(signal?: AbortSignal): Promise<Chat>;
  message(text: string): Promise<unknown>;
  stop(): Promise<unknown>;
  interrupt(): Promise<unknown>;
  approve(id: string, decision: "accept" | "decline"): Promise<unknown>;
}

export function StructuredChat({ transport, session, onChange, testId = "local-chat", initialDraft = "", onDraftChange }: { transport: ChatTransport; session: LocalSession; onChange(session: LocalSession): void; testId?: string; initialDraft?: string; onDraftChange?(text: string): void }) {
  const [chat, setChat] = useState<Chat>();
  const [draft, setDraft] = useState(initialDraft);
  const draftRef = useRef(initialDraft);
  const updateDraft = (text: string) => { draftRef.current = text; setDraft(text); onDraftChange?.(text); };
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  const state = useRef(session.state);
  const request = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    try {
      const value = await transport.read(controller.signal);
      if (controller.signal.aborted) return;
      setChat(value); setOffline(false); setReadError("");
      if (value.state !== state.current) { state.current = value.state; onChange(value); }
    } catch (e) { if (!controller.signal.aborted) { setOffline(true); setReadError(errorMessage(e)); } }
  }, [transport, onChange]);
  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => { await load(); if (alive.current) timer = setTimeout(() => void poll(), state.current === "running" || state.current === "waiting" ? 700 : 3000); };
    void poll();
    return () => { alive.current = false; clearTimeout(timer); request.current?.abort(); };
  }, [load]);
  useEffect(() => { if (following.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [chat]);
  const mutate = async (action: () => Promise<unknown>) => {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError("");
    try { await action(); return true; }
    catch (e) { if (alive.current) setError(errorMessage(e)); return false; }
    finally { if (alive.current) await load(); pending.current = false; if (alive.current) setBusy(false); }
  };
  const running = chat?.state === "running" || chat?.state === "waiting";
  return <div data-testid={testId} className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm">
      <h2 className="font-medium">Codex</h2><span role="status" className="text-xs text-muted-foreground">{offline ? "Disconnected" : chat?.state ?? "Connecting"}</span><span className="text-xs text-muted-foreground">Read-only sandbox</span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={session.cwd}>{session.cwd}</span>
      <Tip label="Refresh chat"><Button size="icon-sm" variant="ghost" aria-label="Refresh chat" disabled={busy} onClick={() => void load()}><RotateCwIcon /></Button></Tip>
      {chat?.state !== "exited" && <Tip label="Stop chat"><Button size="icon-sm" variant="ghost" aria-label="Stop chat" disabled={busy || !chat} onClick={() => void mutate(() => transport.stop())}><XIcon /></Button></Tip>}
    </header>
    {(error || chat?.error || readError) && <p role="alert" className="shrink-0 px-4 py-2 text-sm text-destructive">{error || chat?.error || readError}</p>}
    <div ref={scroll} onScroll={() => { const el = scroll.current; if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-(--berth-chat-w) space-y-5 text-sm leading-relaxed text-foreground">
        {chat?.truncated && <p className="text-xs text-muted-foreground">Earlier output is no longer in this live view.</p>}
        {chat?.items.length === 0 && <h3 className="py-8 text-center text-lg font-medium">New chat</h3>}
        {chat?.items.map((item) => item.kind === "tool" ? <details key={item.id} className="min-w-0 text-xs"><summary className="cursor-pointer text-muted-foreground">Tool activity{item.status ? ` · ${item.status}` : ""}</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border p-3">{item.text}</pre></details> : <article key={item.id} className="min-w-0" aria-label={item.kind === "user" ? "You" : "Codex"}><h3 className="mb-2 text-xs font-medium text-muted-foreground">{item.kind === "user" ? "You" : "Codex"}</h3><Markdown text={item.text} /></article>)}
        {chat?.approvals.map((approval) => <section key={approval.id} aria-label="Approval required" className="border-l-2 border-warning pl-4">
          <h3 className="text-sm font-medium">{approval.kind === "files" ? "Allow file changes?" : "Allow this command?"}</h3>
          {approval.reason && <p className="mt-2 text-sm">{approval.reason}</p>}
          <pre className="my-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{approval.detail}</pre>
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy || offline} onClick={() => void mutate(() => transport.approve(approval.id, "decline"))}>Deny</Button><Button size="sm" disabled={busy || offline} onClick={() => void mutate(() => transport.approve(approval.id, "accept"))}>Allow once</Button></div>
        </section>)}
      </div>
    </div>
    <form className="shrink-0 px-4 pb-4 pt-2 sm:px-6" onSubmit={(event) => {
      event.preventDefault(); if (!draft.trim() || busy || offline || chat?.state !== "idle") return;
      const text = draft; following.current = true;
      void mutate(async () => { await transport.message(text); if (alive.current && draftRef.current === text) updateDraft(""); });
    }}>
      <div className="mx-auto flex w-full max-w-(--berth-chat-w) items-end gap-2 rounded-md border bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
        <textarea aria-label="Message Codex" placeholder="Message Codex" value={draft} disabled={!chat || busy} readOnly={chat?.state === "exited"} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={3} className="max-h-48 min-h-20 min-w-0 flex-1 resize-y bg-transparent p-2 text-sm outline-none disabled:opacity-50" />
        {running ? <Tip label="Interrupt turn"><Button type="button" size="icon-sm" variant="outline" aria-label="Interrupt turn" disabled={busy || offline || !chat?.turn_id} onClick={() => void mutate(() => transport.interrupt())}><SquareIcon /></Button></Tip> : <Tip label="Send message"><Button type="submit" size="icon-sm" aria-label="Send message" disabled={busy || offline || chat?.state !== "idle" || !draft.trim()}><ArrowUpIcon /></Button></Tip>}
      </div>
    </form>
  </div>;
}
