import { RotateCwIcon, XIcon } from "lucide-react";
import { AssistantRuntimeProvider, createMessageQueue, useExternalStoreRuntime, WebSpeechDictationAdapter, type AppendMessage, type AssistantRuntime, type DictationAdapter } from "@assistant-ui/react";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, useReducer, type ReactNode, type KeyboardEvent } from "react";
import { ApprovalCard } from "@/components/assistant-ui/elements/approval-card";
import { ErrorState } from "@/components/assistant-ui/elements/error-state";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { ChatRuntimeState, ChatChoices, ChatTriggers, ChatWaiting } from "./chat-composer";
import { ChatMessages, chatMessage, type ChatExtras } from "./chat-messages";
import { WorktreeArtChip } from "@/components/art/board-buttons";
import { ChatArtifact } from "@/components/conversation/chat-artifact";
import { ReportCard } from "@/components/conversation/report-card";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/tip";
import { loadArtifacts, useArt, useHasArtifacts } from "@/lib/art/model";
import { chatArtifacts } from "@/lib/chat-artifacts";
import { threadTurns } from "@/lib/chat-thread";
import { attachmentPaths } from "@/lib/chat-composer";
import { withAttachments } from "@/lib/attachments";
import { toolAsk } from "@/lib/chat-tools";
import { errorMessage } from "@/lib/format";
import { PaneContext } from "@/lib/pane-context";
import { refFor } from "@/lib/workspaces";
import { useTitleAt } from "@/lib/worktree-names";
import { BASE_PERMISSIONS, savedChatPermission, saveChatPermission, type ChatOptions, type ChatModel } from "@/lib/local-computer";
import type { ChatSnapshot, ChatTransport } from "./chat-transport";

export function Chat({ transport, messageList, after, children }: { transport: ChatTransport; messageList?: ReactNode; after?: ReactNode; children?: ReactNode }) {
  const { session, onChange, initialDraft = "", initialOptions, onDraftChange, onOptionsChange } = transport;
  const [readChat, setChat] = useState<ChatSnapshot>();
  const chat = transport.snapshot ?? readChat;
  // Choices for the next message only. A confirmed send makes them the chat's own, shown from chat.options.
  const [options, setOptionState] = useState<ChatOptions>(initialOptions ?? {});
  const optionRef = useRef(options);
  optionRef.current = options;
  const setOptions = (change: (current: ChatOptions) => ChatOptions) => { const next = change(optionRef.current); optionRef.current = next; setOptionState(next); onOptionsChange?.(next); };
  const [models, setModels] = useState<ChatModel[]>();
  const [modelsError, setModelsError] = useState("");
  const [submitted, setSubmitted] = useState("");
  const submittedItems = useRef(new Set<string>());
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
      if (value.state !== state.current) { state.current = value.state; onChange?.(value); }
    } catch (e) { if (!controller.signal.aborted) { setOffline(true); setReadError(errorMessage(e)); } }
  }, [transport, onChange]);
  useEffect(() => {
    alive.current = true;
    if (transport.snapshot) return () => { alive.current = false; };
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
    catch (e) { if (alive.current) { setError(errorMessage(e)); transport.onError?.(e); } return false; }
    finally { if (alive.current) await load(); pending.current = false; if (alive.current) setBusy(false); }
  };
  const running = chat?.state === "running" || chat?.state === "waiting";
  const accepted = chat?.options?.permission ?? "strict";
  const permission = options.permission ?? accepted;
  const pickPermission = (next: NonNullable<ChatOptions["permission"]>) => { saveChatPermission(next); setOptions((o) => ({ ...o, permission: next === accepted ? undefined : next })); };
  const model = options.model ?? chat?.options?.model ?? "";
  const effort = options.effort ?? chat?.options?.effort ?? "";
  // A saved effort may not exist on another model: keep it only when the new one lists it.
  const pickModel = (next: string) => setOptions((o) => {
    const m = models?.find((x) => x.model === next);
    const listed = m?.supportedReasoningEfforts?.map((e) => e.reasoningEffort) ?? [];
    return { ...o, model: next || undefined, effort: m ? (listed.includes(effort) ? effort : m.defaultReasoningEffort || listed[0]) || undefined : undefined };
  });
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
  const input = useRef<HTMLTextAreaElement>(null);
  const keyDown = useRef<((event: KeyboardEvent<HTMLTextAreaElement>) => void) | undefined>(undefined);
  const [composerBlocked, setComposerBlocked] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [queuePaused, setQueuePaused] = useState(false);
  const runtimeRef = useRef<AssistantRuntime | undefined>(undefined);
  const dispatch = useRef<(message: AppendMessage) => Promise<void>>(async () => {});
  const queue = useMemo(() => createMessageQueue({ run: (message) => dispatch.current(message) }), []);
  const queueRunning = useRef(false);
  const pause = () => { queue.hold(); setQueuePaused(true); };
  const send = async (message: AppendMessage) => {
    if (transport.readOnly || !chat || !transport.message || pending.current || offline || chat.state === "exited") return;
    // Retire before the request: a response can be lost after the provider accepted it.
    queue.notifyBusy(); queueRunning.current = true;
    const text = withAttachments(message.content.flatMap((p) => p.type === "text" ? [p.text] : []).join("\n"), attachmentPaths(message.attachments ?? []));
    const choices = (message.runConfig?.custom?.choices ?? {}) as ChatOptions;
    submittedItems.current = new Set(chat.items.map((item) => item.id)); setSubmitted(text);
    const sent = await mutate(() => transport.message!(text, chat.composer ? choices : undefined));
    if (!alive.current) return;
    setSubmitted("");
    if (!sent) {
      pause();
      const composer = runtimeRef.current?.thread.composer;
      if (composer) composer.setText([text, composer.getState().text].filter(Boolean).join("\n\n"));
      setOptions(() => choices);
    } else {
      if ((["model", "effort", "permission"] as const).every((key) => optionRef.current[key] === choices[key])) setOptions(() => ({}));
      setQueuePaused(false);
      queue.release();
    }
  };
  dispatch.current = send;
  const enqueue = (message: AppendMessage) => {
    const next = { ...message, runConfig: { ...message.runConfig, custom: { ...message.runConfig?.custom, choices: { ...optionRef.current } } } };
    // An explicit send resumes held work only after this new message succeeds.
    if (queuePaused && !running) void dispatch.current(next);
    else queue.adapter.enqueue(next);
  };
  const enqueueRef = useRef(enqueue); enqueueRef.current = enqueue;
  const queueAdapter = useMemo(() => ({ ...queue.adapter, get items() { return queue.adapter.items; }, get steerItems() { return queue.adapter.steerItems; }, enqueue: (message: AppendMessage) => enqueueRef.current(message), steer: (message: AppendMessage) => enqueueRef.current(message) }), [queue]);
  const [, refreshQueue] = useReducer((n: number) => n + 1, 0);
  useEffect(() => queue.subscribe(refreshQueue), [queue]);
  useEffect(() => {
    if (offline || busy || !chat || chat.error || chat.state === "exited") { queue.hold(); return; }
    if (running && !queueRunning.current) { queue.notifyBusy(); queueRunning.current = true; }
    if (!running && chat.state === "idle" && queueRunning.current) { queueRunning.current = false; queue.notifyIdle(); }
    if (!queuePaused) queue.release();
  }, [queue, chat, offline, busy, running, queuePaused]);
  const dictation = useMemo<DictationAdapter | undefined>(() => {
    if (typeof window === "undefined" || typeof (window.SpeechRecognition ?? window.webkitSpeechRecognition) !== "function") return;
    const adapter = new WebSpeechDictationAdapter({ continuous: false, interimResults: false });
    return { listen() {
      setVoiceError("");
      try {
        const session = adapter.listen();
        const timer = setInterval(() => {
          if (session.status.type !== "ended") return;
          if (session.status.reason === "error") setVoiceError("Voice input failed. Check microphone access, or type your message.");
          clearInterval(timer);
        }, 100);
        const cancel = session.cancel;
        return { ...session, get status() { return session.status; }, cancel() { clearInterval(timer); cancel(); } };
      } catch (error) { setVoiceError("Voice input failed. Check microphone access, or type your message."); throw error; }
    } };
  }, []);
  const messages = useMemo(() => chat?.messages ?? turns.map(chatMessage), [chat?.messages, turns]);
  const runtime = useExternalStoreRuntime({
    messages, convertMessage: (message) => message,
    isRunning: running, isLoading: transport.loading ?? (!chat && !offline),
    hasEarlier: transport.hasEarlier, onLoadEarlier: transport.loadEarlier,
    isDisabled: transport.readOnly ? false : !chat || !transport.message || chat.state === "exited",
    isSendDisabled: transport.readOnly || busy || offline || transport.sendDisabled || composerBlocked || !chat || !(running || chat.state === "idle"),
    onNew: transport.queueOnServer ? async (message) => { await send(message); } : send,
    onCancel: transport.interrupt ? async () => { if (!transport.queueOnServer) pause(); await mutate(() => transport.interrupt!()); } : undefined,
    queue: transport.message ? (transport.queueOnServer ? { ...queueAdapter, enqueue: (message) => void send({ ...message, runConfig: { ...message.runConfig, custom: { choices: { ...optionRef.current } } } }), steer: (message) => void send({ ...message, runConfig: { ...message.runConfig, custom: { choices: { ...optionRef.current } } } }) } : queueAdapter) : undefined,
    adapters: { attachments: transport.message && chat?.cwd === session.cwd ? transport.attachments : undefined, dictation: transport.message ? dictation : undefined },
  });
  runtimeRef.current = runtime;
  const extras = useMemo<ChatExtras>(() => ({ tool: toolExtra, report: reportCards }), [toolExtra, reportCards]);
  const speakers = useMemo(() => ({ user: "You", assistant: transport.agentName }), [transport.agentName]);
  const choicesReason = !transport.message ? "This conversation is read-only." : !chat?.composer ? "This chat cannot change model, reasoning or permissions. Its backend does not support chat options." : offline ? "Reconnect to change settings." : chat.state === "exited" ? "This chat has stopped." : busy ? "A request is in progress." : "";
  const commands = !offline && !busy && chat?.state !== "exited" ? [
    ...(running && chat?.turn_id && transport.interrupt ? [{ id: "interrupt", description: "Interrupt this turn", execute: () => runtime.thread.cancelRun() }] : []),
    ...(chat && transport.stop ? [{ id: "stop", description: "Stop this chat", execute: () => void mutate(() => transport.stop!()) }] : []),
  ] : [];
  const approvals = !transport.readOnly && transport.approve && chat?.approvals.length ? <div className="space-y-5 px-2 pb-6 text-sm leading-relaxed text-foreground empty:hidden">
        {!!chat?.approvals.length && <p className="text-xs font-medium text-warning">{chat.approvals.length} pending {chat.approvals.length === 1 ? "approval" : "approvals"}</p>}
        {chat?.approvals.map((approval, index) => {
          const ask = approval.kind === "tool" ? toolAsk(approval.detail) : undefined;
          const detail = ask ? ask.what : approval.detail;
          const preformatted = !!detail && /[\r\n\t]| {2}/.test(detail);
          const notes = [
            ask ? `${transport.agentName} asked Burf to do this. It runs on the box, outside ${transport.agentName}'s sandbox.` : "",
            approval.execpolicy?.length ? `Allow always saves this command prefix to the ${transport.agentName} account's rules, including other chats and projects: ${JSON.stringify(approval.execpolicy)}` : "",
            approval.session_allowed ? `Chat-only approval applies to ${approval.kind === "files" ? "these files" : `matching commands in ${transport.agentName}'s approval cache`}, until this chat stops.` : "",
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
                onDeny={() => void mutate(() => transport.approve!(approval.id, "decline"))}
                onAllowOnce={() => void mutate(() => transport.approve!(approval.id, "accept"))}
                onAlwaysAllow={approval.session_allowed ? () => void mutate(() => transport.approve!(approval.id, "acceptForSession")) : approval.execpolicy?.length ? () => void mutate(() => transport.approve!(approval.id, "acceptAlways")) : undefined}
                alwaysAllowLabel={approval.session_allowed ? "Allow for chat" : "Allow always"}
              />
              {approval.session_allowed && !!approval.execpolicy?.length && <Button size="sm" variant="outline" onClick={() => void mutate(() => transport.approve!(approval.id, "acceptAlways"))}>Allow always</Button>}
            </fieldset>
            </details>
          </section>;
        })}
      </div> : undefined;
  return <div data-testid={transport.testId} className="flex min-h-0 min-w-0 flex-1 flex-col">
    {!transport.readOnly && <header className="flex h-12 shrink-0 items-center gap-2 px-4 text-sm">
      <span className="min-w-0 truncate font-medium" title={session.cwd}>{named ?? session.cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? session.cwd}</span>
      <span role="status" className="shrink-0 text-xs text-muted-foreground">{offline ? "Disconnected" : chat?.state === "waiting" ? chat.approvals.length ? `Waiting for approval (${chat.approvals.length})` : "Waiting for your answer" : running ? "Working" : chat?.state === "idle" ? "Ready" : chat?.state === "exited" ? "Stopped" : "Starting"}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <WorktreeArtChip wt={artifacts} className="inline-flex h-7 items-center gap-1.5 rounded px-1.5 text-xs text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring" />
        <Tip label="Refresh chat"><Button data-autofocus={!chat || undefined} size="icon-sm" variant="ghost" aria-label="Refresh chat" disabled={busy} onClick={() => void load()}><RotateCwIcon /></Button></Tip>
        {transport.stop && chat?.state !== "exited" && <Tip label="Stop chat"><Button size="icon-sm" variant="ghost" aria-label="Stop chat" disabled={busy || !chat} onClick={() => void mutate(() => transport.stop!())}><XIcon /></Button></Tip>}
      </div>
    </header>}
    {(error || chat?.error || readError || modelsError || voiceError) && <ErrorState title="Chat error" detail={error || chat?.error || readError || modelsError || voiceError} retrying={false} onRetry={() => { if (!busy) void load(); }} />}
    {chat?.truncated && <p className="shrink-0 px-4 pt-2 text-xs text-muted-foreground">Earlier output is no longer in this live view.</p>}
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
      {!transport.readOnly && <ChatRuntimeState initialDraft={initialDraft} onDraftChange={onDraftChange} onBlocked={setComposerBlocked} transport={transport} input={input} keyDown={keyDown} />}
      <ChatMessages extras={extras}>
        <Thread autoFocus={false} components={ChatMessages.components} after={approvals || after ? <>{approvals}{after}</> : undefined} messageList={messageList} speakers={speakers} readOnly={transport.readOnly} loadEarlier={!!transport.loadEarlier}
          welcome={transport.readOnly ? <p className="text-sm text-muted-foreground">No saved messages.</p> : undefined}
          composerInput={{ ref: input, onKeyDown: (event) => keyDown.current?.(event), "aria-label": transport.inputLabel ?? `Message ${transport.agentName}`, "data-autofocus": true, placeholder: transport.placeholder ?? "Send a message..." }}
          composerControls={<ChatChoices agentName={transport.agentName} models={models} model={model} effort={effort} permission={permission} accepted={accepted} permissions={chat?.permissions ?? BASE_PERMISSIONS} reason={choicesReason} modelsError={modelsError} onModel={pickModel} onEffort={(value) => setOptions((o) => ({ ...o, effort: value || undefined }))} onPermission={pickPermission} />}
          composerTriggers={<ChatTriggers searchFiles={chat?.cwd === session.cwd ? transport.searchFiles : undefined} commands={commands} catalog={transport.commands} />}
          beforeComposer={transport.readOnly ? undefined : <ChatWaiting paused={queuePaused} agent={transport.agentName} />}
        />
      </ChatMessages>
    </AssistantRuntimeProvider>
  </div>;
}
