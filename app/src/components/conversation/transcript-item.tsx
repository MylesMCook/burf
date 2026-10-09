import { CheckIcon, ChevronRightIcon, ClockIcon, CornerDownRightIcon, FileTextIcon, GitCompareArrowsIcon, PencilLineIcon, SearchIcon, SendHorizontalIcon, TerminalIcon, XIcon } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { PixelGrid } from "@/components/pixel-loader";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { QueuedPrompt, SessionDiff } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { LineComments } from "@/lib/git/diff-view";
import { type ToolCall, type ToolDetail, toolSummary, type TranscriptItem } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/conversation/markdown";
import { HARBOUR_WORDS } from "@/lib/screen-status";
import { NoticeCard } from "@/components/conversation/notice-card";
import { ReportCard } from "@/components/conversation/report-card";
import { AgentMessageCard, MidTurnMark, PingLine } from "@/components/conversation/agent-message";
import { withoutReminders } from "@/lib/agent-messages";
import { CommandItem } from "@/components/conversation/command-item";
import { EditChange, EditPanel } from "@/components/conversation/edit-diff";
import { ArtifactCard } from "@/components/conversation/artifacts";
import { QuestionCard } from "@/components/conversation/question-form";
import { PromptActions, PromptActionsContext } from "@/components/conversation/prompt-actions";
import { openHelper } from "@/components/conversation/subagent-view";
import { PaneContext } from "@/lib/pane-context";
import { meta } from "@/lib/history";
import "@/components/conversation/conversation.css";
import "@/components/conversation/history.css";
import { platformKeys } from "@/lib/platform";

// EditActions read an edited file's current diff, keep comments on its
// lines, and open it in Review.
export interface EditActions {
  load(file: string): Promise<SessionDiff>;
  // One tool call opened up: its full command and output, or exact change.
  tool?(id: string): Promise<ToolDetail>;
  comments(file: string): LineComments | undefined;
  review(file: string): void;
}

// What search opens to show a match: folds and tool groups, by id.
export const RevealContext = createContext<Set<string>>(new Set());
export const ReadOnlyContext = createContext(false);

function workSummary(steps: TranscriptItem[]): string {
  let run = 0, read = 0, search = 0, other = 0, helpers = 0;
  for (const s of steps) {
    if (s.kind === "tools") {
      const n = s.items?.length ?? 0;
      if (s.verb === "Run") run += n;
      else if (s.verb === "Read") read += n;
      else if (s.verb === "Search") search += n;
      else other += n;
    } else if (s.kind === "crew") helpers += s.names?.length ?? 1;
  }
  const n = (k: number, one: string, many: string) => (k ? [`${k === 1 ? one.replace("#", "1") : many.replace("#", String(k))}`] : []);
  const parts = [...n(run, "ran # command", "ran # commands"), ...n(read, "read # file", "read # files"), ...n(search, "searched # time", "searched # times"), ...n(helpers, "started # helper", "started # helpers"), ...n(other, "used # tool", "used # tools")];
  return parts.join(", ");
}

export function WorkFold({ id, steps, live, onAnswer, edits, who }: { id: string; steps: TranscriptItem[]; live: boolean; onAnswer(id: string, key: string): void; edits?: EditActions; who: string }) {
  const [opened, setOpen] = useState(false);
  // Search opens it to a match inside.
  const forced = useContext(RevealContext).has(id);
  const open = opened || forced;
  // Its steps are drawn once it has opened: a long chat has hundreds of
  // folds, most never opened.
  const [drawn, setDrawn] = useState(open);
  if (open && !drawn) setDrawn(true);
  const summary = workSummary(steps);
  return (
    <div className="cv-in -my-1">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-muted-foreground text-[0.8125rem] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRightIcon className={cn("size-3.5 transition-transform duration-200", open && "rotate-90")} />
        {live ? <span className="cv-shimmer">Working</span> : "Worked"}
        {summary && <span>· {summary}</span>}
      </button>
      <div className="cv-fold" data-closed={open ? undefined : ""}>
        <div>
          <div className="mt-2 flex flex-col gap-3 border-l pl-4 text-[0.8438rem]">
            {drawn && steps.map((it) => <Item key={it.id} it={it} onAnswer={onAnswer} edits={edits} who={who} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Item is one item, marked with its id for search.
export function Item(props: { it: TranscriptItem; onAnswer(id: string, key: string): void; edits?: EditActions; who: string }) {
  return (
    <div data-item-id={props.it.id} data-testid="chat-item" data-kind={props.it.kind} data-draft={props.it.kind === "text" && props.it.live ? "" : undefined} className="contents">
      <ItemBody {...props} />
    </div>
  );
}

function ItemBody({ it, onAnswer, edits, who }: { it: TranscriptItem; onAnswer(id: string, key: string): void; edits?: EditActions; who: string }) {
  const readOnly = useContext(ReadOnlyContext);
  if (readOnly && it.kind === "ask") return <div className="space-y-1 text-sm text-muted-foreground"><p>{it.tool}: {it.detail}</p><p>{it.decided ? `Recorded answer: ${it.decided}` : "No answer recorded"}</p></div>;
  if (readOnly && it.kind === "question") return <div className="space-y-2 text-sm">{it.questions.map((q, i) => <div key={i}><p>{q.question}</p><p className="text-muted-foreground">{it.answers?.[i] || "No answer recorded"}</p></div>)}</div>;
  switch (it.kind) {
    case "user": {
      const text = withoutReminders(it.text);
      if (!text) return null;
      return (
        <div className="hs-prompt flex w-full flex-col items-end gap-1">
          <div className="flex w-full items-end justify-end gap-1.5">
            {!readOnly && !it.pending && <PromptActions it={it} />}
            <div data-selectable className={cn("cv-in min-w-0 max-w-[80%] whitespace-pre-wrap rounded-2xl bg-muted px-3.5 py-2", it.pending && "opacity-70")}>
              {/* Who speaks, for screen readers; never copied with the words. */}
              <span className="sr-only select-none">You: </span>
              <span data-prompt-text>{text}</span>
            </div>
          </div>
          {/* Sent mid-turn: the agent takes it at its next step, as its own
              terminal shows a queued message. */}
          {it.pending && <span className="pe-1 text-muted-foreground text-xs">Sent · {who} reads it at its next step</span>}
          {it.midTurn && !it.pending && <MidTurnMark who={who} />}
        </div>
      );
    }
    case "text":
      // A draft (the reply as the agent's screen shows it) draws as the
      // message will, so the message replaces it in place.
      return (
        <>
          <span className="sr-only select-none">{who}: </span>
          <Markdown text={it.text} draft={it.live} clipped={it.clipped} />
        </>
      );
    case "thinking":
      return <Thinking since={it.since} label={it.label} elapsed={it.elapsed} meta={it.meta} step={it.step} />;
    case "tools":
      return <Tools it={it} edits={edits} />;
    case "edit":
      return <Edit it={it} edits={edits} />;
    case "notice":
      return <NoticeCard it={it} />;
    case "crew":
      return (
        <div className="cv-in flex flex-wrap items-center gap-1.5 text-muted-foreground">
          <span className="mr-0.5">
            Sent out {it.names.length} helper{it.names.length === 1 ? "" : "s"}
          </span>
          {it.names.map((n) => (
            <HelperChip key={n} name={n} tool={it.names.length === 1 ? meta(it).tool : undefined} />
          ))}
        </div>
      );
    case "command":
      return <CommandItem it={it} who={who} />;
    case "artifact":
      return <ArtifactCard it={it} />;
    case "question":
      return <QuestionCard it={it} who={who} />;
    case "report":
      return <ReportCard it={it} />;
    case "agent-message":
      return <AgentMessageCard it={it} />;
    case "ping":
      return <PingLine it={it} />;
    case "ask":
      return it.structured ? <Permission it={it} onAnswer={onAnswer} who={who} /> : <Ask it={it} onAnswer={onAnswer} />;
  }
}

// HelperChip is a helper the agent sent out; where its own conversation can
// be read, a click opens it as the crew's rows do (a tab, ⌘ a split, ⌥ a
// peek).
function HelperChip({ name, tool }: { name: string; tool?: string }) {
  const ctx = useContext(PromptActionsContext);
  const pane = useContext(PaneContext);
  const label = name.replace(/^Explore:\s*/, "");
  if (!ctx?.claude) return <Badge variant="secondary">{label}</Badge>;
  const from = pane && { wsKey: pane.wsKey, tab: pane.tab, pane: pane.pane };
  return (
    <Tip label={<span className="flex flex-col"><span>Open its conversation in a tab</span><span className="text-muted-foreground">{platformKeys("⌘-click beside the chat · ⌥-click to peek")}</span></span>}>
      <Badge variant="secondary" render={<button type="button" data-helper-chip={label} onClick={(e) => openHelper(ctx.box, ctx.session, tool ?? label, { from, title: label, event: e })} />} className="cursor-pointer outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        {label}
        <ChevronRightIcon className="-mr-0.5 size-3 opacity-60" />
      </Badge>
    </Tip>
  );
}

// What the agent would do, in words: "wants to run", "wants to edit".
export function permissionVerb(tool: string): { verb: string; what?: string; mono: boolean } {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(tool);
  if (mcp) return { verb: "wants to use", what: `${mcp[2].replaceAll("_", " ")} (${mcp[1]})`, mono: false };
  switch (tool) {
    case "Bash":
      return { verb: "wants to run", mono: true };
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return { verb: "wants to edit", mono: true };
    case "Write":
      return { verb: "wants to write", mono: true };
    case "Read":
      return { verb: "wants to read", mono: true };
    case "WebFetch":
      return { verb: "wants to fetch", mono: true };
    case "WebSearch":
      return { verb: "wants to search the web for", mono: false };
    case "AskUserQuestion":
      return { verb: "asks you", mono: false };
    case "ExitPlanMode":
      return { verb: "has a plan ready for your approval", mono: false };
  }
  return { verb: "wants to use", what: tool, mono: false };
}

// Permission is an approval the agent's hooks described: the tool and what
// it would run or touch, matched to the options on its screen.
function Permission({ it, onAnswer, who }: { it: Extract<TranscriptItem, { kind: "ask" }>; onAnswer(id: string, key: string): void; who: string }) {
  const { verb, what, mono } = permissionVerb(it.tool);
  const choices = it.choices ?? [];
  if (it.decided) {
    // What was picked, in its own words unless it was a plain allow or
    // deny: "Tell Claude what to change" didn't allow anything.
    const label = choices.find((x) => x.key === it.decided)?.label ?? "";
    const no = /^(deny|no)\b/i.test(label);
    const yes = /^(allow|always allow|yes)\b/i.test(label);
    return (
      <div className="cv-in flex min-w-0 items-center gap-2 text-muted-foreground">
        {no ? <XIcon className="size-3.5 shrink-0" /> : yes ? <CheckIcon className="size-3.5 shrink-0 text-success" /> : <CornerDownRightIcon className="size-3.5 shrink-0" />}
        <span className="shrink-0">{no ? "Denied" : label === "Always allow" ? "Always allowed" : label === "Allow" ? "Allowed" : label || "Answered"}</span>
        <span className={cn("truncate text-foreground/80", mono && "font-mono text-[0.7812rem]")}>{it.detail || what}</span>
      </div>
    );
  }
  return (
    <Card className="cv-in border-warning/60">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 font-medium">
          <span className="size-2 rounded-full bg-warning" aria-hidden />
          <span>
            {who} {verb}
            {what && <span className="font-normal"> {what}</span>}
          </span>
        </div>
        {it.detail && (mono ? <code className="whitespace-pre-wrap break-all rounded-lg bg-muted/40 px-3 py-2 font-mono text-[0.7812rem]">{it.detail}</code> : <p data-selectable className="whitespace-pre-wrap">{it.detail}</p>)}
        {it.why && <p className="text-muted-foreground text-[0.8125rem]">{it.why}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        {choices.map((c, i) => (
          <Tip key={c.key} label={c.title ? `${c.key}. ${c.title}` : undefined}>
            {/* A plan's first option starts it working on its own: no option is the obvious one there. */}
            <Button size="sm" variant={i === 0 && it.tool !== "ExitPlanMode" ? "default" : "outline"} className="max-w-full" onClick={() => onAnswer(it.id, c.key)}>
              {c.label}
            </Button>
          </Tip>
        ))}
        {!choices.length && (
          <span className="flex items-center gap-2 text-muted-foreground text-sm">
            {it.reading ? (
              <>
                <Spinner className="size-3.5" />
                Reading its options…
              </>
            ) : (
              "Its options aren't on its screen: answer it in the terminal."
            )}
          </span>
        )}
        <span className="ml-auto text-muted-foreground text-xs">{who} waits for you</span>
      </div>
    </Card>
  );
}

function Ask({ it, onAnswer }: { it: Extract<TranscriptItem, { kind: "ask" }>; onAnswer(id: string, key: string): void }) {
  const question = it.tool === "Question";
  const choices = it.choices?.length ? it.choices : question ? [{ key: "yes", label: "Yes" }, { key: "no", label: "No" }] : [{ key: "yes", label: "Allow" }, { key: "no", label: "Deny" }];
  if (it.decided) {
    const c = choices.find((x) => x.key === it.decided);
    const no = it.decided === "no";
    return (
      <div className="cv-in flex min-w-0 items-center gap-2 text-muted-foreground">
        {no ? <XIcon className="size-3.5 shrink-0" /> : <CheckIcon className="size-3.5 shrink-0 text-success" />}
        <span className="shrink-0">{c?.label ?? it.decided}</span>
        <span className={cn("truncate text-foreground/80", !question && "font-mono text-[0.7812rem]")}>{it.detail}</span>
      </div>
    );
  }
  return (
    <Card className="cv-in border-warning/60">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 font-medium">
          <span className="size-2 rounded-full bg-warning" aria-hidden />
          {question ? "Needs your answer" : "Wants to run a command"}
        </div>
        {it.detail && (question ? <p data-selectable className="whitespace-pre-wrap">{it.detail}</p> : <code className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-[0.7812rem]">{it.detail}</code>)}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        {choices.map((c, i) => (
          <Button key={c.key} size="sm" variant={i === 0 ? "default" : "outline"} className="max-w-full" onClick={() => onAnswer(it.id, c.key)}>
            {it.choices?.length ? <span className="font-mono opacity-60">{c.key}</span> : null}
            <span className="truncate">{c.label}</span>
          </Button>
        ))}
        <span className="ml-auto text-muted-foreground text-xs">{it.choices?.length ? "The agent waits for your pick" : question ? "Or reply below" : "The agent waits for you"}</span>
      </div>
    </Card>
  );
}

// Edit is one file the agent changed. With edits, it opens (folded by
// default) to the agent's exact change and the file's current uncommitted
// diff, where lines take comments and Review is a click away
// (conversation/edit-diff).
function Edit({ it, edits }: { it: Extract<TranscriptItem, { kind: "edit" }>; edits?: EditActions }) {
  const [open, setOpen] = useState(false);
  const cut = it.file.lastIndexOf("/");
  const label = (
    <>
      <PencilLineIcon className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Edited</span>
      <span className="min-w-0 truncate font-mono text-[0.7812rem]">
        <span className="text-muted-foreground">{it.file.slice(0, cut + 1)}</span>
        {it.file.slice(cut + 1)}
      </span>
      {!!it.added && <span className="font-medium font-mono text-[0.75rem] text-success-foreground tabular-nums">+{it.added}</span>}
      {!!it.removed && <span className="font-medium font-mono text-[0.75rem] text-destructive-foreground tabular-nums">−{it.removed}</span>}
    </>
  );
  if (!edits) return <div className="cv-in flex min-w-0 items-center gap-2 self-start rounded-lg bg-muted/40 px-2.5 py-1.5 text-[0.8125rem]">{label}</div>;
  return (
    <div className={cn("cv-in flex min-w-0 flex-col", open ? "self-stretch" : "self-start")}>
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-left text-[0.8125rem] outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRightIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-90")} />
          {label}
        </button>
        {open && (
          <Button size="xs" variant="ghost" className="ml-auto shrink-0 text-muted-foreground" onClick={() => edits.review(it.file)}>
            <GitCompareArrowsIcon />
            Open in Review
          </Button>
        )}
      </div>
      {open && <EditPanel file={it.file} tool={it.tool} estimate={it.added + it.removed + 6} loadDiff={edits.load} loadTool={edits.tool} comments={edits.comments(it.file)} />}
    </div>
  );
}

// QueuedBubble is a prompt the box holds until the agent finishes: what it
// says, and the two things to do about it.
export function QueuedBubble({ q, who, onSendNow, onCancel }: { q: QueuedPrompt; who: string; onSendNow(): Promise<void>; onCancel(): Promise<void> }) {
  const [busy, setBusy] = useState<"send" | "cancel">();
  const run = (what: "send" | "cancel", fn: () => Promise<void>) => {
    setBusy(what);
    fn().finally(() => setBusy(undefined));
  };
  return (
    <div data-testid="queued-reply" className="cv-in flex max-w-[80%] flex-col items-end gap-1 self-end">
      <div className="whitespace-pre-wrap rounded-2xl border border-dashed bg-background px-3.5 py-2 text-foreground/80">
        {q.preview}
        {q.length > q.preview.length && <span className="text-muted-foreground"> ({q.length.toLocaleString()} characters in all)</span>}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        <ClockIcon className="size-3" aria-hidden />
        <span className="mr-1">Queued: sends when {who} finishes</span>
        <Button size="xs" variant="ghost" loading={busy === "send"} disabled={!!busy} onClick={() => run("send", onSendNow)}>
          <SendHorizontalIcon />
          Send now
        </Button>
        <Button size="xs" variant="ghost" loading={busy === "cancel"} disabled={!!busy} onClick={() => run("cancel", onCancel)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// A file's mark: its extension, in the colour editors give it.
const EXT: Record<string, string> = { ts: "#3178c6", tsx: "#3178c6", js: "#b8860b", rs: "#d0573a", go: "#00a7d0", md: "#6b7280", json: "#8b5cf6", css: "#2965f1", py: "#3a75b0" };

function Tools({ it, edits }: { it: Extract<TranscriptItem, { kind: "tools" }>; edits?: EditActions }) {
  const [opened, setOpen] = useState(!it.done);
  const forced = useContext(RevealContext).has(it.id);
  const open = opened || forced;
  // A group that finishes while in view folds to its summary after a
  // moment; one drawn finished (scrolled back to) stays as it is opened.
  const working = useRef(!it.done);
  useEffect(() => {
    if (!it.done || !working.current) return;
    working.current = false;
    const t = window.setTimeout(() => setOpen(false), 1600);
    return () => window.clearTimeout(t);
  }, [it.done]);
  const Icon = it.verb === "Search" ? SearchIcon : it.verb === "Run" ? TerminalIcon : FileTextIcon;
  const doing = it.verb === "Read" ? "Reading" : it.verb === "Search" ? "Searching" : "Running";
  return (
    <div className="cv-in -my-1">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRightIcon className={cn("size-3.5 transition-transform duration-200", open && "rotate-90")} />
        {it.done ? toolSummary(it) : <span className="cv-shimmer">{doing}…</span>}
      </button>
      <div className="cv-fold" data-closed={open ? undefined : ""}>
        <div>
          <ul className="pt-1 pl-[7px]">
            {(it.items ?? []).map((c, i, all) => (
              <ToolRow key={c.id ?? i} c={c} last={i === all.length - 1} Icon={Icon} edits={edits} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ToolRow is one call in a group: its verb and target, and opened, what the
// agent's terminal shows for it.
function ToolRow({ c, last, Icon, edits }: { c: ToolCall; last: boolean; Icon: typeof FileTextIcon; edits?: EditActions }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ state: "loading" } | { state: "ready"; d: ToolDetail } | { state: "error"; message: string }>();
  const can = !!(c.id && edits?.tool);
  const ext = c.file ? (c.target.split(".").pop() ?? "") : "";
  const toggle = () => {
    if (!can) return;
    if (!open && detail?.state !== "ready") {
      setDetail({ state: "loading" });
      edits!.tool!(c.id!).then(
        (d) => setDetail({ state: "ready", d }),
        (err) => setDetail({ state: "error", message: errorMessage(err) }),
      );
    }
    setOpen((o) => !o);
  };
  return (
    <li className="cv-in relative pl-5 text-muted-foreground">
      {/* The tree: a stem down from the summary, an elbow into each row. */}
      <span aria-hidden className={cn("absolute top-0 left-0 w-3 border-l", last ? "h-4 rounded-bl-md border-b" : "h-full")} />
      {!last && <span aria-hidden className="absolute top-4 left-0 w-3 border-t" />}
      <button
        type="button"
        onClick={toggle}
        disabled={!can}
        aria-expanded={can ? open : undefined}
        className={cn("flex h-8 max-w-full items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", can && "hover:text-foreground")}
      >
        <Icon className="size-3.5 shrink-0" />
        <span>{c.verb}</span>
        <Badge variant="outline" className={cn("min-w-0 gap-1.5 font-normal", !c.file && "font-mono")}>
          {c.file && (
            <span className="flex size-3 items-center justify-center rounded-[3px] font-bold font-mono text-[0.4062rem] text-white uppercase" style={{ background: EXT[ext] ?? "#64748b" }}>
              {ext.slice(0, 2)}
            </span>
          )}
          <span className="truncate">{c.target}</span>
        </Badge>
        {can && <ChevronRightIcon className={cn("size-3.5 shrink-0 transition-transform duration-200", open && "rotate-90")} />}
      </button>
      {open && (
        <div className="mt-1 mb-2 overflow-hidden rounded-lg border bg-card text-foreground">
          {detail?.state === "loading" && (
            <div className="flex h-12 items-center justify-center text-muted-foreground text-sm">
              <Spinner className="mr-2 size-4" />
              Reading…
            </div>
          )}
          {detail?.state === "error" && <p className="px-3 py-2.5 text-destructive-foreground text-sm">Couldn't open this step: {detail.message}</p>}
          {detail?.state === "ready" && <ToolDetailView d={detail.d} />}
        </div>
      )}
    </li>
  );
}

// ToolDetailView draws a call the way the terminal does: a command and its
// output, a search and its matches, an edit's change, a new file.
export function ToolDetailView({ d }: { d: ToolDetail }) {
  const edit = d.old != null || (d.new != null && !d.command);
  return (
    <div data-selectable className="font-mono text-[0.75rem] leading-5 [font-variant-ligatures:none]">
      {(d.command || d.pattern || d.file) && !edit && (
        <div className="flex gap-2 border-b bg-muted/30 px-3 py-1.5">
          <span className="shrink-0 text-muted-foreground">{d.command ? "$" : d.pattern ? "?" : "·"}</span>
          <span className="min-w-0 whitespace-pre-wrap break-all">{d.command || [d.pattern, d.file].filter(Boolean).join("  in  ")}</span>
        </div>
      )}
      {edit && <EditChange d={d} />}
      {!edit && (d.output ? (
        <pre className={cn("max-h-80 overflow-auto whitespace-pre-wrap break-all px-3 py-2", d.error && "text-destructive-foreground")}>{plain(d.output)}</pre>
      ) : (
        <p className="px-3 py-2 font-sans text-muted-foreground text-xs">{d.pending ? "Still running…" : "No output."}</p>
      ))}
      {d.truncated && <p className="border-t px-3 py-1 font-sans text-muted-foreground text-xs">The middle of a long output is left out, as in the terminal.</p>}
    </div>
  );
}

// plain drops terminal escape codes (colours, cursor moves) that tools
// write for a terminal; boxes strip them too, this covers older ones.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching escape codes is the point.
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]|\r/g;
const plain = (s: string) => s.replace(ANSI, "");

// Thinking is the agent at work, as its own status line says it
// ("Seasoning… · 9m 11s · 7.1k tokens"), or the step it is running
// ("Running yarn vitest · 6m 47s"), or, with neither to read, a calm word
// of our own that changes now and then.
function Thinking({ since, label, elapsed, meta, step }: { since: number; label?: string; elapsed?: string; meta?: string; step?: { verb: string; target: string } }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((now - since) / 1000));
  const took = elapsed && !step ? elapsed : s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
  const doing = step ? (step.verb === "Read" ? "Reading" : step.verb === "Search" ? "Searching" : step.verb === "Edit" ? "Editing" : "Running") : undefined;
  const word = label ?? `${HARBOUR_WORDS[Math.floor(now / 4000) % HARBOUR_WORDS.length]}…`;
  return (
    <div className="cv-in flex min-w-0 items-center gap-2">
      <PixelGrid className="text-muted-foreground" />
      {step ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="cv-shimmer shrink-0">{doing}</span>
          <code className="min-w-0 truncate rounded bg-muted px-1.5 py-px font-mono text-[0.7812rem]">{step.target}</code>
        </span>
      ) : (
        <span className="cv-shimmer shrink-0">{word}</span>
      )}
      {(s >= 1 || elapsed) && <span className="shrink-0 text-muted-foreground tabular-nums">· {took}</span>}
      {meta && <span className="shrink-0 text-muted-foreground tabular-nums">· {meta}</span>}
    </div>
  );
}
