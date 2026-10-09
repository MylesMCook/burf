import { useAui, useAuiState, unstable_useMentionAdapter, unstable_useSlashCommandAdapter, type Unstable_SlashCommand } from "@assistant-ui/react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject, type KeyboardEvent } from "react";
import { FileIcon, SlashIcon } from "lucide-react";

import { ModelSelector } from "@/components/assistant-ui/elements/model-selector.aui";
import { ComposerTriggerPopover } from "@/components/assistant-ui/elements/composer-trigger-popover.aui";
import { MessageQueue } from "@/components/assistant-ui/elements/message-queue";
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "@/components/ui/select";
import { Tip } from "@/components/tip";
import { chatPermissions, type ChatModel, type ChatOptions } from "@/lib/local-computer";
import { cn } from "@/lib/utils";
import { joinDraft } from "@/lib/chat-quote";
import { usePromptRecall } from "@/lib/history";
import type { ChatTransport } from "./chat-transport";

export function ChatRuntimeState({ initialDraft, onDraftChange, onBlocked, transport, input, keyDown }: { transport: ChatTransport; input: RefObject<HTMLTextAreaElement | null>; keyDown: RefObject<((event: KeyboardEvent<HTMLTextAreaElement>) => void) | undefined>; initialDraft: string; onDraftChange?: (text: string) => void; onBlocked(blocked: boolean): void }) {
  const aui = useAui();
  const text = useAuiState((s) => s.composer.text);
  const blocked = useAuiState((s) => s.composer.dictation != null || s.composer.attachments.some((a) => a.status.type === "running" || a.status.type === "incomplete"));
  const recall = usePromptRecall(transport.recall?.box, transport.recall?.session, text, (value) => aui.composer.setText(value), input);
  keyDown.current = (event) => { recall(event); };
  useEffect(() => transport.subscribeDraft?.((fill) => {
    aui.composer.setText(joinDraft(aui.composer.getState().text, fill.text));
    if (fill.send && aui.composer.getState().canSend) aui.composer.send({ steer: false });
    else requestAnimationFrame(() => { const field = input.current; field?.focus(); field?.setSelectionRange(field.value.length, field.value.length); });
  }), [aui, transport.subscribeDraft, input]);
  const ready = useRef(false);
  useLayoutEffect(() => { aui.composer.setText(initialDraft); ready.current = true; }, [aui, initialDraft]);
  const save = useRef(onDraftChange); save.current = onDraftChange;
  useEffect(() => { if (ready.current) save.current?.(aui.composer.getState().text); }, [aui, text]);
  useEffect(() => onBlocked(blocked), [blocked, onBlocked]);
  return null;
}

export function ChatChoices({ agentName, models, model, effort, permission, accepted, permissions, reason, modelsError, onModel, onEffort, onPermission }: {
  agentName: string; models?: ChatModel[]; model: string; effort: string; permission: NonNullable<ChatOptions["permission"]>; accepted: NonNullable<ChatOptions["permission"]>; permissions: string[]; reason: string; modelsError: string;
  onModel(value: string): void; onEffort(value: string): void; onPermission(value: NonNullable<ChatOptions["permission"]>): void;
}) {
  const efforts = models?.find((m) => m.model === model)?.supportedReasoningEfforts.map((e) => e.reasoningEffort) ?? [];
  const modelReason = reason || (models?.length ? "" : modelsError || (models ? "This chat has no model choices." : "Loading model choices."));
  const choices = [
    { id: "", name: "Default model" },
    ...(model && !models?.some((m) => m.model === model) ? [{ id: model, name: model }] : []),
    ...(models ?? []).map((m) => ({ id: m.model, name: m.displayName || m.model })),
  ].map((m) => ({ ...m, efforts: m.id === model && (effort || efforts.length) ? [{ id: "", name: "Default reasoning" }, ...[...new Set([effort, ...efforts].filter(Boolean))].map((id) => ({ id, name: id }))] : undefined }));
  return <>
    <ModelSelector models={choices} value={model} effort={effort} onValueChange={onModel} onEffortChange={onEffort}
      variant="ghost" size="sm" className="h-7 shrink-0 rounded-full" triggerProps={{ "aria-label": "Chat model", disabled: !!modelReason }} tooltip={modelReason || "Chat model. Applies from your next message."} effortLabel="Chat reasoning" effortDisabled={!!reason} />
    <Select value={permission} disabled={!!reason} onValueChange={(value) => { if (value) onPermission(value as NonNullable<ChatOptions["permission"]>); }}>
      <Tip label={reason || `Current permission: ${chatPermissions[accepted].label}. From your next message: ${agentName} ${chatPermissions[permission].hint}`}>
        <span className="inline-flex shrink-0">
        <SelectTrigger aria-label="Chat permissions" disabled={!!reason} size="sm" className={cn("h-7 w-auto min-w-0 shrink-0 justify-start gap-1 rounded-full border-0 bg-transparent px-2 text-xs shadow-none hover:bg-muted", permission === "full-access" && "text-warning")}><SelectValue>{chatPermissions[permission].label}</SelectValue></SelectTrigger>
        </span>
      </Tip>
      <SelectPopup>{Object.entries(chatPermissions).filter(([id]) => permissions.includes(id) || id === permission).map(([id, p]) => <SelectItem key={id} value={id}>{p.label}</SelectItem>)}</SelectPopup>
    </Select>
  </>;
}

export function ChatTriggers({ searchFiles, commands, catalog }: { searchFiles?: ChatTransport["searchFiles"]; commands: Unstable_SlashCommand[]; catalog?: ChatTransport["commands"] }) {
  const [query, setQuery] = useState<string>();
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setFiles([]);
    if (!searchFiles || query === undefined) return;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => void searchFiles(query, controller.signal).then((paths) => { if (!controller.signal.aborted) setFiles(paths); }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); }), 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchFiles, query]);
  const mention = unstable_useMentionAdapter({ items: files.map((path) => ({ id: path, type: "file", label: path })), includeModelContextTools: false, formatter: { serialize: (item) => item.label, parse: (value) => [{ kind: "text", text: value }] }, fallbackIcon: FileIcon });
  const slash = unstable_useSlashCommandAdapter({ commands: catalog ? catalog.map((command) => ({ id: command.name.slice(1), label: command.name, description: command.description, execute: () => {} })) : commands, removeOnExecute: !catalog, fallbackIcon: SlashIcon });
  return <>
    {searchFiles && <ComposerTriggerPopover char="@" {...mention} isLoading={loading} onQueryChange={setQuery} aria-label="Worktree files" emptyItemsLabel="No matching files" />}
    <ComposerTriggerPopover char="/" {...slash} {...(catalog ? { action: { ...slash.action, formatter: { serialize: (item) => item.label, parse: (value) => [{ kind: "text" as const, text: value }] } } } : {})} aria-label="Chat commands" emptyItemsLabel="No matching commands" />
  </>;
}

export function ChatWaiting({ paused, agent }: { paused: boolean; agent: string }) {
  const aui = useAui();
  const queued = useAuiState((s) => s.composer.queue);
  if (!queued.length) return null;
  return <MessageQueue className="max-w-none" running={paused ? "Remaining messages are held. Cancel them or send a message to continue." : agent} paused={paused} queued={queued.map((item) => ({ id: item.id, text: item.prompt }))} onCancel={(id) => aui.composer.queueItem({ id }).remove()} />;
}
