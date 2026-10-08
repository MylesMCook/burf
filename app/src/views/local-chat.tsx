import { ArrowUpIcon, RotateCwIcon, SquareIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "@/components/conversation/markdown";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";
import type { Client } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { BASE_PERMISSIONS, chatPermissions, localApi, savedChatPermission, saveChatPermission, type LocalChat as Chat, type LocalSession, type ChatOptions, type ChatModel, type ChatDecision } from "@/lib/local-computer";

export function LocalChat({ client, session, onChange }: { client: Client; session: LocalSession; onChange(session: LocalSession): void }) {
  const transport = useMemo(() => ({
    read: (signal?: AbortSignal) => localApi.chat(client, session.id, signal),
    message: (text: string, options?: ChatOptions) => localApi.message(client, session.id, text, options),
    models: () => localApi.models(client, session.id),
    stop: () => localApi.stopChat(client, session.id),
    interrupt: () => localApi.interruptChat(client, session.id),
    approve: (id: string, decision: ChatDecision) => localApi.approveChat(client, session.id, id, decision),
  }), [client, session.id]);
  return <StructuredChat transport={transport} session={session} onChange={onChange} />;
}

export interface ChatTransport {
  read(signal?: AbortSignal): Promise<Chat>;
  message(text: string, options?: ChatOptions): Promise<unknown>;
  models?(): Promise<ChatModel[]>;
  stop(): Promise<unknown>;
  interrupt(): Promise<unknown>;
  approve(id: string, decision: ChatDecision): Promise<unknown>;
}

export function StructuredChat({ transport, session, onChange, testId = "local-chat", initialDraft = "", onDraftChange, initialOptions, onOptionsChange }: { transport: ChatTransport; session: LocalSession; onChange(session: LocalSession): void; testId?: string; initialDraft?: string; onDraftChange?(text: string): void; initialOptions?: ChatOptions; onOptionsChange?(options: ChatOptions): void }) {
  const [chat, setChat] = useState<Chat>();
  // Choices for the next message only. A confirmed send makes them the chat's own, shown from chat.options.
  const [options, setOptionState] = useState<ChatOptions>(initialOptions ?? {});
  const setOptions = (change: (current: ChatOptions) => ChatOptions) => { const next = change(options); setOptionState(next); onOptionsChange?.(next); };
  const [models, setModels] = useState<ChatModel[]>();
  const [modelsError, setModelsError] = useState("");
  const [submitted, setSubmitted] = useState("");
  const submittedItems = useRef(new Set<string>());
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
  // Once the provider has answered its handshake: its model list, and for a chat with no messages yet, the permission last chosen.
  const prepared = useRef(false);
  const ready = !!chat?.composer && chat.state !== "starting" && chat.state !== "exited";
  useEffect(() => {
    if (!ready || !chat || prepared.current) return;
    prepared.current = true;
    if (transport.models) void transport.models().then((list) => { if (alive.current) setModels(Array.isArray(list) ? list : []); }).catch(() => { if (alive.current) setModelsError("Model choices are unavailable. Current settings are unchanged."); });
    const saved = savedChatPermission();
    if (saved && (chat.permissions ?? BASE_PERMISSIONS).includes(saved) && !chat.items.length && !options.permission && saved !== (chat.options?.permission ?? "strict")) setOptions((o) => ({ ...o, permission: saved }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const mutate = async (action: () => Promise<unknown>) => {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError("");
    try { await action(); return true; }
    catch (e) { if (alive.current) setError(errorMessage(e)); return false; }
    finally { if (alive.current) await load(); pending.current = false; if (alive.current) setBusy(false); }
  };
  const running = chat?.state === "running" || chat?.state === "waiting";
  const accepted = chat?.options?.permission ?? "strict";
  const permission = options.permission ?? accepted;
  const pickPermission = (next: NonNullable<ChatOptions["permission"]>) => { saveChatPermission(next); setOptions((o) => ({ ...o, permission: next === accepted ? undefined : next })); };
  const model = options.model ?? chat?.options?.model ?? "";
  const effort = options.effort ?? chat?.options?.effort ?? "";
  const efforts = models?.find((m) => m.model === model)?.supportedReasoningEfforts?.map((e) => e.reasoningEffort) ?? [];
  // A saved effort may not exist on another model: keep it only when the new one lists it.
  const pickModel = (next: string) => setOptions((o) => {
    const m = models?.find((x) => x.model === next);
    const listed = m?.supportedReasoningEfforts?.map((e) => e.reasoningEffort) ?? [];
    return { ...o, model: next || undefined, effort: m ? (listed.includes(effort) ? effort : m.defaultReasoningEffort || listed[0]) || undefined : undefined };
  });
  const changed = !!(options.model || options.effort || options.permission);
  const groups: Chat["items"][] = [];
  for (const item of chat?.items ?? []) {
    const last = groups[groups.length - 1];
    if (item.kind === "tool" && last?.[0].kind === "tool") last.push(item); else groups.push([item]);
  }
  return <div data-testid={testId} className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-sm">
      <h2 className="font-medium">Codex</h2><span role="status" className="text-xs text-muted-foreground">{offline ? "Disconnected" : chat?.state === "running" ? "Working" : chat?.state === "waiting" ? `Waiting for approval (${chat.approvals.length})` : chat?.state === "idle" ? "Ready" : chat?.state === "exited" ? "Stopped" : "Starting"}</span><span className={accepted === "full-access" ? "text-xs font-medium text-warning" : "text-xs text-muted-foreground"}>{chatPermissions[accepted].label}</span>{(chat?.options?.model || chat?.options?.effort) && <span className="text-xs text-muted-foreground">{[chat.options.model, chat.options.effort].filter(Boolean).join(" · ")}</span>}
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={session.cwd}>{session.cwd}</span>
      <Tip label="Refresh chat"><Button size="icon-sm" variant="ghost" aria-label="Refresh chat" disabled={busy} onClick={() => void load()}><RotateCwIcon /></Button></Tip>
      {chat?.state !== "exited" && <Tip label="Stop chat"><Button size="icon-sm" variant="ghost" aria-label="Stop chat" disabled={busy || !chat} onClick={() => void mutate(() => transport.stop())}><XIcon /></Button></Tip>}
    </header>
    {(error || chat?.error || readError) && <p role="alert" className="shrink-0 px-4 py-2 text-sm text-destructive">{error || chat?.error || readError}</p>}
    <div ref={scroll} onScroll={() => { const el = scroll.current; if (el) following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-(--berth-chat-w) space-y-5 text-sm leading-relaxed text-foreground">
        {chat?.truncated && <p className="text-xs text-muted-foreground">Earlier output is no longer in this live view.</p>}
        {chat?.items.length === 0 && !submitted && <h3 className="py-8 text-center text-lg font-medium">{running ? "Codex is working…" : chat.state === "starting" ? "Starting Codex…" : "New chat"}</h3>}
        {groups.map((group) => group[0].kind === "tool" ? <details key={group[0].id} className="min-w-0 text-xs"><summary className="cursor-pointer text-muted-foreground">Tool activity · {group.length}{group.some((i) => i.status === "inProgress") ? " · working" : ""}</summary>{group.map((item) => <pre key={item.id} className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words border-l pl-3">{item.text}</pre>)}</details> : <article key={group[0].id} className="min-w-0" aria-label={group[0].kind === "user" ? "You" : "Codex"}><h3 className="mb-2 text-xs font-medium text-muted-foreground">{group[0].kind === "user" ? "You" : "Codex"}</h3><Markdown text={group[0].text} /></article>)}
        {submitted && !chat?.items.some((item) => item.kind === "user" && !submittedItems.current.has(item.id)) && <article aria-label="Sending message"><h3 className="mb-2 text-xs text-muted-foreground">You · sending</h3><Markdown text={submitted} /></article>}
        {!!chat?.approvals.length && <p className="text-xs font-medium text-warning">{chat.approvals.length} pending {chat.approvals.length === 1 ? "approval" : "approvals"}</p>}
        {chat?.approvals.map((approval, index) => <section key={approval.id} aria-label="Approval required" className="border-l-2 border-warning pl-3">
          <details open={index === 0}><summary className="cursor-pointer truncate text-xs font-medium">{approval.kind === "files" ? "File changes" : approval.detail.split("\n")[0]}</summary>
          <h3 className="text-sm font-medium">{approval.kind === "files" ? "Allow file changes?" : "Allow this command?"}</h3>
          {approval.reason && <p className="mt-2 text-sm">{approval.reason}</p>}
          <pre className="my-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{approval.detail}</pre>
          {approval.execpolicy?.length ? <p className="mb-2 break-words text-xs text-muted-foreground">Allow always saves this command prefix to the Codex account's rules, including other chats and projects: <code>{JSON.stringify(approval.execpolicy)}</code></p> : null}
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || offline} onClick={() => void mutate(() => transport.approve(approval.id, "decline"))}>Deny</Button><Button size="sm" disabled={busy || offline} onClick={() => void mutate(() => transport.approve(approval.id, "accept"))}>Allow once</Button>{approval.session_allowed && <Button size="sm" variant="outline" disabled={busy || offline} onClick={() => void mutate(() => transport.approve(approval.id, "acceptForSession"))}>Always in this chat</Button>}{!!approval.execpolicy?.length && <Button size="sm" variant="outline" disabled={busy || offline} onClick={() => void mutate(() => transport.approve(approval.id, "acceptAlways"))}>Allow always</Button>}</div>
          {approval.session_allowed && <p className="mt-2 text-xs text-muted-foreground">Chat-only approval applies to {approval.kind === "files" ? "these files" : "matching commands in Codex's approval cache"}, until this chat stops.</p>}
          </details>
        </section>)}
      </div>
    </div>
    <form className="shrink-0 px-4 pb-4 pt-2 sm:px-6" onSubmit={(event) => {
      event.preventDefault(); if (!draft.trim() || busy || offline || chat?.state !== "idle") return;
      const text = draft; following.current = true;
      submittedItems.current = new Set(chat.items.map((item) => item.id)); setSubmitted(text);
      void mutate(async () => { await transport.message(text, chat.composer ? options : undefined); if (!alive.current) return; if (draftRef.current === text) updateDraft(""); setOptions(() => ({})); }).finally(() => { if (alive.current) setSubmitted(""); });
    }}>
      <div className="mx-auto w-full max-w-(--berth-chat-w)">
        <div className="rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
          <textarea aria-label="Message Codex" placeholder="Message Codex" value={draft} disabled={!chat || busy} readOnly={chat?.state === "exited"} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={3} className="block max-h-48 min-h-20 w-full resize-y bg-transparent p-3 text-sm outline-none disabled:opacity-50" />
          <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
            {chat?.composer && <>
              <select aria-label="Chat permissions" title={chatPermissions[permission].hint} className="h-7 min-w-0 rounded border-0 bg-transparent px-1 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-w-40" disabled={busy || chat.state === "exited"} value={permission} onChange={(e) => pickPermission(e.target.value as NonNullable<ChatOptions["permission"]>)}>{Object.entries(chatPermissions).filter(([id]) => (chat.permissions ?? BASE_PERMISSIONS).includes(id) || id === permission).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}</select>
              <select aria-label="Chat model" className="h-7 min-w-0 rounded border-0 bg-transparent px-1 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-w-48" disabled={busy || chat.state === "exited"} value={model} onChange={(e) => pickModel(e.target.value)}><option value="">Default model</option>{model && !models?.some((m) => m.model === model) && <option value={model}>{model}</option>}{models?.map((m) => <option key={m.model} value={m.model}>{m.displayName || m.model}</option>)}</select>
              {(effort || efforts.length > 0) && <select aria-label="Chat reasoning" className="h-7 min-w-0 rounded border-0 bg-transparent px-1 text-xs text-muted-foreground outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-w-36" disabled={busy || chat.state === "exited"} value={effort} onChange={(e) => setOptions((o) => ({ ...o, effort: e.target.value || undefined }))}><option value="">Default reasoning</option>{[...new Set([effort, ...efforts].filter(Boolean))].map((e) => <option key={e} value={e}>{e}</option>)}</select>}
            </>}
            <span className="flex-1" />
            {running ? <Tip label="Interrupt turn"><Button type="button" size="icon-sm" variant="outline" aria-label="Interrupt turn" disabled={busy || offline || !chat?.turn_id} onClick={() => void mutate(() => transport.interrupt())}><SquareIcon /></Button></Tip> : <Tip label="Send message"><Button type="submit" size="icon-sm" aria-label="Send message" disabled={busy || offline || chat?.state !== "idle" || !draft.trim()}><ArrowUpIcon /></Button></Tip>}
          </div>
        </div>
        {chat?.composer && changed && <p className={options.permission === "full-access" ? "mt-1 text-xs font-medium text-warning" : "mt-1 text-xs text-muted-foreground"}>From your next message{options.permission ? `: ${chatPermissions[options.permission].hint}` : "."}</p>}
        {modelsError && <p role="alert" className="mt-1 text-xs text-destructive">{modelsError}</p>}
      </div>
    </form>
  </div>;
}
