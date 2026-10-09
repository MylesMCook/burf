import { RotateCwIcon, SquareIcon, XIcon } from "lucide-react";
import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { ApprovalCard } from "@/components/assistant-ui/elements/approval-card";
import { Composer, ComposerBar, ComposerToolbar, ComposerActions, ComposerSend, ComposerMenu, ComposerMenuItem, ComposerCommandItem, ComposerVoice, ComposerVoiceButton, useSlashMatches } from "@/components/assistant-ui/elements/composer";
import { ModelSelectorRoot, ModelSelectorTrigger, ModelSelectorValue, ModelSelectorContent, ModelSelectorList, ModelSelectorEffort } from "@/components/assistant-ui/elements/model-selector";
import { MessageQueue } from "@/components/assistant-ui/elements/message-queue";
import { ComposerAttachments, ComposerAddAttachment } from "@/components/assistant-ui/elements/attachment.aui";
import { StructuredAttachmentState, useWorktreeAttachments, type StructuredAttachmentControl } from "@/components/conversation/structured-attachments";
import type { Attachment } from "@assistant-ui/react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { withAttachments, pastedFiles } from "@/lib/attachments";
import { ChatQueue, fileMention, insertFileMention, attachmentPaths } from "@/lib/chat-composer";
import { filesApi } from "@/lib/files";
import { useStore } from "@/lib/store";
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
import { refFor, useWorktreeRef } from "@/lib/workspaces";
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
  box?: string;
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
  const optionRef = useRef(options);
  optionRef.current = options;
  const setOptions = (change: (current: ChatOptions) => ChatOptions) => { const next = change(optionRef.current); optionRef.current = next; setOptionState(next); onOptionsChange?.(next); };
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
  const ready = !!chat && chat.state !== "starting" && chat.state !== "exited";
  useEffect(() => {
    if (!ready || !chat || prepared.current) return;
    prepared.current = true;
    if (transport.models) void transport.models().then((list) => { if (alive.current) setModels(Array.isArray(list) ? list : []); }).catch(() => { if (alive.current) setModelsError("Model choices are unavailable. Current settings are unchanged."); });
    const saved = savedChatPermission();
    if (chat.composer && saved && (chat.permissions ?? BASE_PERMISSIONS).includes(saved) && !chat.items.length && !options.permission && saved !== (chat.options?.permission ?? "strict")) setOptions((o) => ({ ...o, permission: saved }));
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
  const client = useStore((s) => s.client);
  const paneRef = useWorktreeRef(worktree);
  // The pane must belong to this chat's box and folder before a file goes there.
  const target = paneRef && paneRef.box === transport.box && paneRef.path === chat?.cwd ? paneRef : undefined;
  const attachmentAdapter = useWorktreeAttachments(client, target);
  const attachmentControl = useRef<StructuredAttachmentControl>(null);
  const [attachmentItems, setAttachmentItems] = useState<readonly Attachment[]>([]);
  const paths = attachmentPaths(attachmentItems);
  const attachmentBlocker = attachmentItems.some((item) => item.status.type === "running") ? "Uploading attachments. You can write your message meanwhile." : attachmentItems.some((item) => item.status.type === "incomplete") ? "An attachment did not upload. Remove it and attach it again." : undefined;
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceInput((text) => { if (text.trim()) updateDraft([draftRef.current, text].filter(Boolean).join(" ")); }, !!chat && chat.state !== "exited");
  const queue = useRef(new ChatQueue<ChatOptions>());
  const [queued, setQueued] = useState(queue.current.items);
  const [queuePaused, setQueuePaused] = useState(false);
  const showQueue = () => { setQueued([...queue.current.items]); setQueuePaused(queue.current.paused); };
  const submit = async (text: string, choices: ChatOptions) => {
    if (!chat || pending.current) return false;
    submittedItems.current = new Set(chat.items.map((item) => item.id)); setSubmitted(text);
    const sent = await mutate(() => transport.message(text, chat.composer ? choices : undefined));
    if (alive.current) setSubmitted("");
    return sent;
  };
  const send = () => {
    const items = attachmentControl.current?.items() ?? [];
    const text = withAttachments(draftRef.current, attachmentPaths(items));
    if (!text.trim() || pending.current || offline || items.some((item) => item.status.type === "running" || item.status.type === "incomplete") || voice.recording || !chat || !(running || chat.state === "idle")) return;
    if (running || queued.length && !queuePaused) {
      queue.current.add(text, { ...options }); showQueue(); updateDraft(""); attachmentControl.current?.clear();
      return;
    }
    const ids = items.map((item) => item.id);
    const kept = draftRef.current;
    void submit(text, { ...options }).then((sent) => {
      if (!sent || !alive.current) return;
      if (draftRef.current === kept) updateDraft("");
      ids.forEach((id) => attachmentControl.current?.remove(id)); setOptions(() => ({}));
      queue.current.resume(); showQueue();
    });
  };
  useEffect(() => {
    if (!chat || chat.state !== "idle" || busy || pending.current || offline || chat.error) return;
    const next = queue.current.take();
    if (!next) return;
    showQueue();
    void submit(next.text, next.options).then((sent) => {
      queue.current.finish(sent);
      if (!alive.current) return;
      if (!sent) { updateDraft([next.text, draftRef.current].filter(Boolean).join("\n\n")); setOptions(() => next.options); }
      else if ((["model", "effort", "permission"] as const).every((key) => optionRef.current[key] === next.options[key])) setOptions(() => ({}));
      showQueue();
    });
    // A fresh read and the queue changing are the only drain triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, busy, offline, queued]);
  const [caret, setCaret] = useState(initialDraft.length);
  const menuId = useId();
  const [menuIndex, setMenuIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const mention = fileMention(draft, caret);
  const query = mention?.query;
  useEffect(() => {
    setFiles([]);
    if (!target || !client || query === undefined) return;
    const abort = new AbortController();
    const timer = setTimeout(() => void filesApi.list(client, target, query, 8, abort.signal).then((result) => { if (!abort.signal.aborted) setFiles(result.files ?? []); }).catch(() => {}), 150);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [client, target, query]);
  const commands = !offline && !busy && chat?.state !== "exited" ? [
    ...(running && chat?.turn_id ? [{ name: "interrupt", description: "Interrupt this turn", icon: SquareIcon }] : []),
    ...(chat ? [{ name: "stop", description: "Stop this chat", icon: XIcon }] : []),
  ] : [];
  const slash = useSlashMatches(draft, commands);
  const entries = slash.length ? slash.map((command) => command.name) : mention ? files : [];
  const menuOpen = !dismissed && entries.length > 0;
  const activeIndex = Math.min(menuIndex, entries.length - 1);
  const choose = (index: number) => {
    const entry = entries[index];
    if (!entry) return;
    if (slash.length) {
      updateDraft("");
      void mutate(() => entry === "interrupt" ? transport.interrupt() : transport.stop());
    } else {
      const text = insertFileMention(draft, caret, entry);
      updateDraft(text);
      const end = (mention?.start ?? 0) + entry.length + 1;
      setCaret(end);
      requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(end, end); });
    }
    setDismissed(true);
  };
  const choicesReason = !chat?.composer ? "This chat cannot change model, reasoning or permissions. Its backend does not support chat options." : offline ? "Reconnect to change settings." : chat.state === "exited" ? "This chat has stopped." : busy ? "A request is in progress." : "";
  const choicesDisabled = !!choicesReason;
  const modelDisabled = choicesDisabled || !models?.length;
  const reasoningChoices = [...new Set([effort, ...efforts].filter(Boolean))];
  const modelChoices = [
    { id: "", name: "Default model" },
    ...(model && !models?.some((m) => m.model === model) ? [{ id: model, name: model }] : []),
    ...(models ?? []).map((m) => ({ id: m.model, name: m.displayName || m.model })),
  ].map((m) => ({ ...m, disabled: modelDisabled, efforts: m.id === model ? [{ id: "", name: "Default reasoning" }, ...reasoningChoices.map((id) => ({ id, name: id }))] : undefined }));
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
      attachments={attachmentAdapter}
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
      composer={<Composer className="max-w-none" onDragOver={(event) => { if (target && !busy && chat?.state !== "exited" && event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={(event) => { setDragging(false); if (!target || busy || chat?.state === "exited") return; const files = pastedFiles(event.dataTransfer); if (files.length) { event.preventDefault(); attachmentControl.current?.add(files); } }}>
        <StructuredAttachmentState control={attachmentControl} onChange={setAttachmentItems} />
        {queued.length > 0 && <MessageQueue className="mb-2 max-w-none" running={queuePaused ? "Queue held after a failed send" : "Codex"} paused={queuePaused || offline || chat?.state === "exited"} queued={queued} onCancel={(id) => { queue.current.cancel(id); showQueue(); }} />}
        {menuOpen && <ComposerMenu id={menuId} open role="listbox" aria-label={slash.length ? "Chat commands" : "Worktree files"}>
          {slash.length ? slash.map((command, index) => <ComposerCommandItem key={command.name} id={`${menuId}-${index}`} command={command} active={activeIndex === index} role="option" aria-selected={activeIndex === index} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)} />) : files.map((path, index) => <ComposerMenuItem key={path} id={`${menuId}-${index}`} active={activeIndex === index} role="option" aria-selected={activeIndex === index} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>{path}</ComposerMenuItem>)}
        </ComposerMenu>}
        <ComposerBar dragActive={dragging}>
          <ComposerAttachments />
          {voice.recording && <ComposerVoice recording seconds={voice.seconds} />}
          <textarea ref={input} data-autofocus aria-autocomplete="list" aria-controls={menuOpen ? menuId : undefined} aria-activedescendant={menuOpen ? `${menuId}-${activeIndex}` : undefined} aria-label="Message Codex" placeholder={running ? "Message Codex, queued until this turn ends" : "Message Codex"} value={draft} disabled={!chat || busy} readOnly={chat?.state === "exited"} onPaste={(event) => { if (!target) return; const files = pastedFiles(event.clipboardData); if (files.length) { event.preventDefault(); attachmentControl.current?.add(files); } }} onChange={(event) => { updateDraft(event.target.value); setCaret(event.target.selectionStart); setMenuIndex(0); setDismissed(false); }} onSelect={(event) => setCaret(event.currentTarget.selectionStart)} onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (menuOpen && ["ArrowDown", "ArrowUp", "Escape", "Enter", "Tab"].includes(event.key) && !event.shiftKey) {
              event.preventDefault();
              if (event.key === "Escape") setDismissed(true);
              else if (event.key === "Enter" || event.key === "Tab") choose(activeIndex);
              else setMenuIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length);
              return;
            }
            if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
          }} rows={3} className="field-sizing-content block max-h-48 min-h-12 w-full resize-none bg-transparent p-3 text-sm outline-none disabled:opacity-50" />
          <ComposerToolbar>
            <div className="min-w-0 flex-1">
            <ComposerActions className="flex-wrap">
              {target && !busy && chat?.state !== "exited" && <ComposerAddAttachment />}
              {voice.available && <ComposerVoiceButton active={voice.recording} disabled={!voice.recording && (busy || !chat || chat.state === "exited")} onClick={voice.toggle} />}
              {chat && <fieldset disabled={choicesDisabled} className="contents">
                <Select value={permission} disabled={choicesDisabled} onValueChange={(value) => { if (value) pickPermission(value as NonNullable<ChatOptions["permission"]>); }}>
                  <SelectTrigger aria-label="Chat permissions" size="sm" className="w-auto min-w-0 shrink"><SelectValue>{chatPermissions[permission].label}</SelectValue></SelectTrigger>
                  <SelectPopup>{Object.entries(chatPermissions).filter(([id]) => (chat.permissions ?? BASE_PERMISSIONS).includes(id) || id === permission).map(([id, p]) => <SelectItem key={id} value={id}>{p.label}</SelectItem>)}</SelectPopup>
                </Select>
                <ModelSelectorRoot models={modelChoices} value={model} onValueChange={pickModel} effort={effort} onEffortChange={(value) => { if (!choicesDisabled) setOptions((o) => ({ ...o, effort: value || undefined })); }}>
                  <ModelSelectorTrigger aria-label="Chat model" disabled={modelDisabled}><ModelSelectorValue showEffort={false} /></ModelSelectorTrigger>
                  <ModelSelectorContent searchable={false}><ModelSelectorList /></ModelSelectorContent>
                  <ModelSelectorEffort label="Chat reasoning" disabled={choicesDisabled || !reasoningChoices.length} />
                </ModelSelectorRoot>
              </fieldset>}
            </ComposerActions>
            </div>
            {running && <ComposerSend aria-label="Queue message" streaming={false} idle={!draft.trim() && !paths.length} disabled={busy || offline || attachmentBlocker !== undefined || voice.recording || !draft.trim() && !paths.length} onClick={send} />}
            <ComposerSend aria-label={running ? "Interrupt turn" : "Send message"} streaming={running} idle={!draft.trim() && !paths.length} disabled={running ? busy || offline || !chat?.turn_id : busy || offline || chat?.state !== "idle" || !draft.trim() && !paths.length || !!attachmentBlocker || voice.recording} onClick={running ? () => void mutate(() => transport.interrupt()) : send} />
          </ComposerToolbar>
        </ComposerBar>
        {chat?.composer && changed && <p className={options.permission === "full-access" ? "mt-1 text-xs font-medium text-warning" : "mt-1 text-xs text-muted-foreground"}>From your next message{options.permission ? `: ${chatPermissions[options.permission].hint}` : "."}</p>}
        {choicesReason && chat && <p className="mt-1 text-xs text-muted-foreground">{choicesReason}</p>}
        {!choicesDisabled && !models?.length && !modelsError && <p className="mt-1 text-xs text-muted-foreground">{models ? "This chat has no model choices." : "Loading model choices."}</p>}
        {!choicesDisabled && !reasoningChoices.length && <p className="mt-1 text-xs text-muted-foreground">Select a model with reasoning choices to change reasoning.</p>}
        {attachmentBlocker && <p role="status" className="mt-1 text-xs text-muted-foreground">{attachmentBlocker}</p>}
        {queuePaused && <p className="mt-1 text-xs text-muted-foreground">Remaining messages are held. Cancel them or send a message to continue.</p>}
        {voice.error && <p role="alert" className="mt-1 text-xs text-destructive">{voice.error}</p>}
        {modelsError && <p role="alert" className="mt-1 text-xs text-destructive">{modelsError}</p>}
      </Composer>}
    />
  </div>;
}
