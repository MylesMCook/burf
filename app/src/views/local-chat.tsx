import { RotateCwIcon, XIcon } from "lucide-react";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApprovalCard } from "@/components/assistant-ui/elements/approval-card";
import { Composer, ComposerBar, ComposerToolbar, ComposerActions, ComposerSend } from "@/components/assistant-ui/elements/composer";
import { ModelSelectorRoot, ModelSelectorTrigger, ModelSelectorValue, ModelSelectorContent, ModelSelectorList, ModelSelectorEffort } from "@/components/assistant-ui/elements/model-selector";
import { ConnectionState } from "@/components/assistant-ui/elements/connection-state";
import { EmptyState, EmptyStateGreeting } from "@/components/assistant-ui/elements/empty-state";
import { ErrorState } from "@/components/assistant-ui/elements/error-state";
import { ThinkingIndicator } from "@/components/assistant-ui/elements/thinking-indicator";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@/components/ui/select";
import { WorktreeArtChip } from "@/components/art/board-buttons";
import { ChatArtifact } from "@/components/conversation/chat-artifact";
import { ChatThread } from "@/components/conversation/chat-thread";
import { ReportCard } from "@/components/conversation/report-card";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";
import type { Client } from "@/lib/api";
import { loadArtifacts, useArt, useHasArtifacts } from "@/lib/art/model";
import { chatArtifacts } from "@/lib/chat-artifacts";
import { threadTurns } from "@/lib/chat-thread";
import { toolAsk } from "@/lib/chat-tools";
import { errorMessage } from "@/lib/format";
import { PaneContext } from "@/lib/pane-context";
import { refFor } from "@/lib/workspaces";
import { useTitleAt } from "@/lib/worktree-names";
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
  // Artifacts belong to the worktree the chat's pane is in. A chat on this computer has no pane, and no artifacts.
  const worktree = useContext(PaneContext)?.worktree;
  const artifacts = useHasArtifacts(worktree?.split(":")[0]) ? worktree : undefined;
  // The name a person gave the worktree stands for its folder here as it does everywhere else.
  const named = useTitleAt(worktree?.split(":")[0], session.cwd);
  const made = useMemo(() => new Map((artifacts ? chat?.items ?? [] : []).filter((item) => item.kind === "tool").map((item) => [item.id, chatArtifacts(item)] as const).filter(([, list]) => list.length)), [artifacts, chat?.items]);
  // The list is read when the pane opens; one made since is read as its line arrives, should the box's event not come.
  const madeIds = [...made.values()].flat().map((a) => `${a.local}@${a.version}`).join(" ");
  useEffect(() => {
    if (!artifacts || !madeIds) return;
    const have = new Map((useArt.getState().byWt[artifacts] ?? []).map((a) => [a.id, a.versions.at(-1)?.n ?? 0]));
    const ref = refFor(artifacts);
    if (ref && madeIds.split(" ").some((key) => { const [id, n] = key.split("@"); return (have.get(id) ?? 0) < Number(n); })) void loadArtifacts(ref);
  }, [artifacts, madeIds]);
  const turns = useMemo(() => threadTurns(chat?.items ?? [], running, submitted ? { text: submitted, before: submittedItems.current } : undefined), [chat?.items, running, submitted]);
  const toolExtra = useCallback((id: string) => made.get(id)?.map((artifact) => <div key={artifact.id} className="mt-2 flex items-center gap-1 text-sm"><ChatArtifact it={artifact} /></div>), [made]);
  const reports = chat?.reports;
  const reportCards = useCallback((id: string) => (reports?.[id]?.length ? reports[id].map((report, index) => <ReportCard key={index} it={{ kind: "report", id: `${id}:${index}`, report }} />) : undefined), [reports]);
  const send = () => {
    if (!draft.trim() || busy || offline || chat?.state !== "idle") return;
    const text = draft;
    submittedItems.current = new Set(chat.items.map((item) => item.id)); setSubmitted(text);
    void mutate(async () => { await transport.message(text, chat.composer ? options : undefined); if (!alive.current) return; if (draftRef.current === text) updateDraft(""); setOptions(() => ({})); }).finally(() => { if (alive.current) setSubmitted(""); });
  };
  const choicesDisabled = busy || chat?.state === "exited";
  const reasoningChoices = [...new Set([effort, ...efforts].filter(Boolean))];
  const modelChoices = [
    { id: "", name: "Default model" },
    ...(model && !models?.some((m) => m.model === model) ? [{ id: model, name: model }] : []),
    ...(models ?? []).map((m) => ({ id: m.model, name: m.displayName || m.model })),
  ].map((m) => ({ ...m, disabled: choicesDisabled, efforts: m.id === model && reasoningChoices.length ? [{ id: "", name: "Default reasoning" }, ...reasoningChoices.map((id) => ({ id, name: id }))] : undefined }));
  return <div data-testid={testId} className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="flex items-center gap-2 px-4 py-2 text-sm">
      <h2 className="sr-only">Codex</h2>
      <span className="min-w-0 truncate text-xs text-muted-foreground" title={session.cwd}>{named ?? session.cwd}</span>
      {offline ? <ConnectionState role="status" phase="dropped" onRetry={() => { if (!busy) void load(); }} /> : running ? <ThinkingIndicator role="status" label={chat?.state === "waiting" ? `Waiting for approval (${chat.approvals.length})` : "Working"} /> : <span role="status" className="text-xs text-muted-foreground">{chat?.state === "idle" ? "Ready" : chat?.state === "exited" ? "Stopped" : "Starting"}</span>}
      <div role="group" aria-label="Accepted chat settings" className="flex min-w-0 flex-1 flex-wrap gap-2 text-xs text-muted-foreground">
        <span className={accepted === "full-access" ? "font-medium text-warning" : undefined}>{chatPermissions[accepted].label}</span>
        {(chat?.options?.model || chat?.options?.effort) && <span>{[chat.options.model, chat.options.effort].filter(Boolean).join(" · ")}</span>}
      </div>
      <WorktreeArtChip wt={artifacts} className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded px-1.5 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring" />
      <Tip label="Refresh chat"><Button data-autofocus={offline && !chat || undefined} size="icon-sm" variant="ghost" aria-label="Refresh chat" disabled={busy} onClick={() => void load()}><RotateCwIcon /></Button></Tip>
      {chat?.state !== "exited" && <Tip label="Stop chat"><Button size="icon-sm" variant="ghost" aria-label="Stop chat" disabled={busy || !chat} onClick={() => void mutate(() => transport.stop())}><XIcon /></Button></Tip>}
    </header>
    {(error || chat?.error || readError) && <ErrorState title="Chat error" detail={error || chat?.error || readError} retrying={false} onRetry={() => { if (!busy) void load(); }} />}
    {chat?.truncated && <p className="shrink-0 px-4 pt-2 text-xs text-muted-foreground sm:px-6">Earlier output is no longer in this live view.</p>}
    <ChatThread
      turns={turns}
      working={running}
      agent="Codex"
      tool={toolExtra}
      report={reportCards}
      welcome={chat ? <EmptyState><EmptyStateGreeting>{running ? "Codex is working…" : chat.state === "starting" ? "Starting Codex…" : "New chat"}</EmptyStateGreeting></EmptyState> : <></>}
      after={<div className="space-y-5 px-2 pb-6 text-sm leading-relaxed text-foreground empty:hidden">
        {!!chat?.approvals.length && <p className="text-xs font-medium text-warning">{chat.approvals.length} pending {chat.approvals.length === 1 ? "approval" : "approvals"}</p>}
        {chat?.approvals.map((approval, index) => {
          const ask = approval.kind === "tool" ? toolAsk(approval.detail) : undefined;
          const detail = ask ? ask.what : approval.detail;
          const preformatted = !!detail && /[\r\n\t]| {2}/.test(detail);
          const notes = [
            ask ? "Codex asked Burf to do this. It runs on the box, outside Codex's sandbox." : "",
            approval.execpolicy?.length ? `Allow always saves this command prefix to the Codex account's rules, including other chats and projects: ${JSON.stringify(approval.execpolicy)}` : "",
            approval.session_allowed ? `Chat-only approval applies to ${approval.kind === "files" ? "these files" : "matching commands in Codex's approval cache"}, until this chat stops.` : "",
          ].filter(Boolean).join(" ");
          return <section key={approval.id} aria-label="Approval required">
            <details open={index === 0}><summary className="cursor-pointer truncate text-xs font-medium text-muted-foreground">{ask ? `Burf · ${ask.tool}` : approval.kind === "files" ? "File changes" : approval.detail.split("\n")[0]}</summary>
            <fieldset disabled={busy || offline}>
              {preformatted && <pre className="my-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{detail}</pre>}
              <ApprovalCard
                state="request"
                title={ask ? ask.question : approval.kind === "files" ? "Allow file changes?" : approval.kind === "browser" ? "Allow this in your browser?" : "Allow this command?"}
                subtitle={ask ? `Burf · ${ask.tool}` : approval.reason || "Approval required"}
                command={preformatted ? undefined : detail}
                details={ask && approval.reason ? [{ label: "Reason", value: approval.reason }] : undefined}
                description={notes || undefined}
                onDeny={() => void mutate(() => transport.approve(approval.id, "decline"))}
                onAllowOnce={() => void mutate(() => transport.approve(approval.id, "accept"))}
                onAlwaysAllow={approval.session_allowed ? () => void mutate(() => transport.approve(approval.id, "acceptForSession")) : approval.execpolicy?.length ? () => void mutate(() => transport.approve(approval.id, "acceptAlways")) : undefined}
                alwaysAllowLabel={approval.session_allowed ? "Allow for chat" : "Allow always"}
              />
              {approval.session_allowed && !!approval.execpolicy?.length && <Button size="sm" variant="outline" onClick={() => void mutate(() => transport.approve(approval.id, "acceptAlways"))}>Allow always</Button>}
            </fieldset>
            </details>
          </section>;
        })}
      </div>}
      composer={<Composer className="max-w-none">
        <ComposerBar>
          <textarea data-autofocus aria-label="Message Codex" placeholder="Message Codex" value={draft} disabled={!chat || busy} readOnly={chat?.state === "exited"} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} rows={3} className="field-sizing-content block max-h-48 min-h-12 w-full resize-none bg-transparent p-3 text-sm outline-none disabled:opacity-50" />
          <ComposerToolbar>
            <div className="min-w-0 flex-1">
            <ComposerActions>
              {chat?.composer && <fieldset disabled={choicesDisabled} className="flex min-w-0 flex-wrap items-center gap-1">
                <Select value={permission} disabled={choicesDisabled} onValueChange={(value) => { if (value) pickPermission(value as NonNullable<ChatOptions["permission"]>); }}>
                  <SelectTrigger aria-label="Chat permissions"><SelectValue>{chatPermissions[permission].label}</SelectValue></SelectTrigger>
                  <SelectPopup>{Object.entries(chatPermissions).filter(([id]) => (chat.permissions ?? BASE_PERMISSIONS).includes(id) || id === permission).map(([id, p]) => <SelectItem key={id} value={id}>{p.label}</SelectItem>)}</SelectPopup>
                </Select>
                <ModelSelectorRoot models={modelChoices} value={model} onValueChange={pickModel} effort={effort} onEffortChange={(value) => { if (!choicesDisabled) setOptions((o) => ({ ...o, effort: value || undefined })); }}>
                  <ModelSelectorTrigger aria-label="Chat model" disabled={choicesDisabled}><ModelSelectorValue showEffort={false} /></ModelSelectorTrigger>
                  <ModelSelectorContent searchable={false}><ModelSelectorList /></ModelSelectorContent>
                  <ModelSelectorEffort label="Chat reasoning" disabled={choicesDisabled} />
                </ModelSelectorRoot>
              </fieldset>}
            </ComposerActions>
            </div>
            <ComposerSend aria-label={running ? "Interrupt turn" : "Send message"} streaming={running} idle={!draft.trim()} disabled={running ? busy || offline || !chat?.turn_id : busy || offline || chat?.state !== "idle" || !draft.trim()} onClick={running ? () => void mutate(() => transport.interrupt()) : send} />
          </ComposerToolbar>
        </ComposerBar>
        {chat?.composer && changed && <p className={options.permission === "full-access" ? "mt-1 text-xs font-medium text-warning" : "mt-1 text-xs text-muted-foreground"}>From your next message{options.permission ? `: ${chatPermissions[options.permission].hint}` : "."}</p>}
        {modelsError && <p role="alert" className="mt-1 text-xs text-destructive">{modelsError}</p>}
      </Composer>}
    />
  </div>;
}
