import { CheckIcon, ChevronRightIcon, ClockIcon, CornerDownRightIcon, FileTextIcon, GitCompareArrowsIcon, PencilLineIcon, RotateCwIcon, SearchIcon, SendHorizontalIcon, TerminalIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { QueuedPrompt, SessionDiff } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { DiffLines, type LineComments } from "@/lib/git/diff-view";
import { parseDiff } from "@/lib/git/parse";
import { type ToolCall, type ToolDetail, toolSummary, type TranscriptItem } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/conversation/markdown";
import "@/components/conversation/conversation.css";

// ConversationView draws an agent's turn as a calm transcript rather than a
// terminal: what was asked, what the agent says, its tool calls folded into
// groups ("Read 5 files"), edits, the helpers it sent out, and questions for
// the person with their answers as buttons. It only draws items; where they
// come from and what an answer does is the caller's.

export interface ConversationViewProps {
  items: TranscriptItem[];
  // An answer to an ask: one of its choices' keys, or "yes" or "no".
  onAnswer(id: string, key: string): void;
  // Edits open to their file's diff when the caller can read one.
  edits?: EditActions;
  // The agent's short name, for "Claude wants to run".
  who?: string;
  // Drawn after the transcript: prompts held for the agent.
  tail?: ReactNode;
  tailSize?: number;
  className?: string;
}

// EditActions read an edited file's current diff, keep comments on its
// lines, and open it in Review.
export interface EditActions {
  load(file: string): Promise<SessionDiff>;
  // One tool call opened up: its full command and output, or exact change.
  tool?(id: string): Promise<ToolDetail>;
  comments(file: string): LineComments | undefined;
  review(file: string): void;
}

export function ConversationView({ items, onAnswer, edits, who = "The agent", tail, tailSize = 0, className }: ConversationViewProps) {
  const end = useRef<HTMLDivElement>(null);
  const last = items[items.length - 1];
  const grew = last?.kind === "text" ? last.text.length : last?.kind === "tools" ? (last.items?.length ?? 0) : 0;
  // The view follows new work while it is at the foot. Scrolled up to read,
  // it stays put until the person scrolls back down or sends something.
  const pinned = useRef(true);
  useEffect(() => {
    const sc = end.current?.closest<HTMLElement>(".overflow-y-auto");
    if (!sc) return;
    let userAt = 0;
    const user = () => {
      userAt = Date.now();
    };
    const onScroll = () => {
      const near = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120;
      if (near) pinned.current = true;
      else if (Date.now() - userAt < 1000) pinned.current = false;
    };
    const opts = { passive: true };
    sc.addEventListener("scroll", onScroll, opts);
    for (const e of ["wheel", "touchmove", "pointerdown", "keydown"]) sc.addEventListener(e, user, opts);
    return () => {
      sc.removeEventListener("scroll", onScroll);
      for (const e of ["wheel", "touchmove", "pointerdown", "keydown"]) sc.removeEventListener(e, user);
    };
  }, []);
  useEffect(() => {
    if (last?.kind === "user") pinned.current = true;
    if (pinned.current) end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [items.length, grew, tailSize, last?.kind]);

  return (
    <div className={cn("mx-auto flex w-full max-w-[680px] flex-col gap-4 text-[14px] text-foreground leading-relaxed", className)}>
      {foldTurns(items).map((b) =>
        b.kind === "fold" ? (
          <WorkFold key={b.id} steps={b.steps} live={b.live} onAnswer={onAnswer} edits={edits} who={who} />
        ) : (
          <Item key={b.it.id} it={b.it} onAnswer={onAnswer} edits={edits} who={who} />
        ),
      )}
      {tail}
      <div ref={end} />
    </div>
  );
}

// A turn reads like a chat: what was asked, what the agent changed, and its
// answer. The steps in between (its narration and tool calls) fold into one
// line, "Worked · ran 3 commands, read 5 files", opened on demand. While it
// works, the line says so and its latest words stay in view.
type Block = { kind: "item"; it: TranscriptItem } | { kind: "fold"; id: string; steps: TranscriptItem[]; live: boolean };

function foldTurns(items: TranscriptItem[]): Block[] {
  const last = items[items.length - 1];
  const live = !!last && (last.kind === "thinking" || (last.kind === "ask" && !last.decided));
  const out: Block[] = [];
  let turn: TranscriptItem[] = [];
  const flush = (isLast: boolean) => {
    if (!turn.length) return;
    const working = isLast && live;
    // The answer: the turn's last words, once it has finished; while it
    // works, its latest words. When it says several things after its last
    // step, the answer starts at the longest of them: a reply and a note
    // after it both show, a "now I'll write it up" before it stays folded.
    let answer = -1;
    for (let i = turn.length - 1; i >= 0; i--)
      if (turn[i].kind === "text") {
        answer = i;
        const len = (j: number) => {
          const t = turn[j];
          return t.kind === "text" ? t.text.length : 0;
        };
        for (let j = i - 1; j >= 0 && (turn[j].kind === "text" || turn[j].kind === "edit"); j--) if (len(j) > len(answer)) answer = j;
        break;
      }
    const steps: TranscriptItem[] = [];
    const shown: TranscriptItem[] = [];
    turn.forEach((it, i) => {
      if ((answer >= 0 && i >= answer && it.kind === "text") || it.kind === "edit" || it.kind === "ask" || it.kind === "thinking") shown.push(it);
      else steps.push(it);
    });
    if (steps.length) out.push({ kind: "fold", id: `fold-${steps[0].id}`, steps, live: working });
    for (const it of shown) out.push({ kind: "item", it });
    turn = [];
  };
  for (const it of items) {
    if (it.kind === "user") {
      flush(false);
      out.push({ kind: "item", it });
    } else turn.push(it);
  }
  flush(true);
  return out;
}

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

function WorkFold({ steps, live, onAnswer, edits, who }: { steps: TranscriptItem[]; live: boolean; onAnswer(id: string, key: string): void; edits?: EditActions; who: string }) {
  const [open, setOpen] = useState(false);
  const summary = workSummary(steps);
  return (
    <div className="cv-in -my-1">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-muted-foreground text-[13px] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRightIcon className={cn("size-3.5 transition-transform duration-200", open && "rotate-90")} />
        {live ? <span className="cv-shimmer">Working</span> : "Worked"}
        {summary && <span className="text-muted-foreground/80">· {summary}</span>}
      </button>
      <div className="cv-fold" data-closed={open ? undefined : ""}>
        <div>
          <div className="mt-2 flex flex-col gap-3 border-l pl-4 text-[13.5px]">
            {steps.map((it) => (
              <Item key={it.id} it={it} onAnswer={onAnswer} edits={edits} who={who} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({ it, onAnswer, edits, who }: { it: TranscriptItem; onAnswer(id: string, key: string): void; edits?: EditActions; who: string }) {
  switch (it.kind) {
    case "user":
      return (
        <div data-selectable className="cv-in max-w-[80%] self-end whitespace-pre-wrap rounded-2xl bg-muted px-3.5 py-2">
          {it.text}
        </div>
      );
    case "text":
      return <Markdown text={it.text} />;
    case "thinking":
      return <Thinking since={it.since} />;
    case "tools":
      return <Tools it={it} edits={edits} />;
    case "edit":
      return <Edit it={it} edits={edits} />;
    case "crew":
      return (
        <div className="cv-in flex flex-wrap items-center gap-1.5 text-muted-foreground">
          <span className="mr-0.5">
            Sent out {it.names.length} helper{it.names.length === 1 ? "" : "s"}
          </span>
          {it.names.map((n) => (
            <Badge key={n} variant="secondary">
              {n.replace(/^Explore:\s*/, "")}
            </Badge>
          ))}
        </div>
      );
    case "ask":
      return it.structured ? <Permission it={it} onAnswer={onAnswer} who={who} /> : <Ask it={it} onAnswer={onAnswer} />;
  }
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
        <span className={cn("truncate text-foreground/80", mono && "font-mono text-[12.5px]")}>{it.detail || what}</span>
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
        {it.detail && (mono ? <code className="whitespace-pre-wrap break-all rounded-lg bg-muted/40 px-3 py-2 font-mono text-[12.5px]">{it.detail}</code> : <p data-selectable className="whitespace-pre-wrap">{it.detail}</p>)}
        {it.why && <p className="text-muted-foreground text-[13px]">{it.why}</p>}
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
        <span className={cn("truncate text-foreground/80", !question && "font-mono text-[12.5px]")}>{it.detail}</span>
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
        {it.detail && (question ? <p data-selectable className="whitespace-pre-wrap">{it.detail}</p> : <code className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-[12.5px]">{it.detail}</code>)}
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

type DiffLoad = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; diff: SessionDiff };

// Edit is one file the agent changed. With edits, it opens to the file's
// current diff (what is uncommitted now, not just this edit), folded by
// default, where lines take comments and Review is a click away.
function Edit({ it, edits }: { it: Extract<TranscriptItem, { kind: "edit" }>; edits?: EditActions }) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState<DiffLoad>();
  // An opened diff scrolls into view once it has its height.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, diff?.state]);
  const cut = it.file.lastIndexOf("/");
  const load = () => {
    if (!edits) return;
    setDiff({ state: "loading" });
    edits.load(it.file).then(
      (d) => setDiff({ state: "ready", diff: d }),
      (err) => setDiff({ state: "error", message: errorMessage(err) }),
    );
  };
  // The agent's exact change (from its own record), shown first when known;
  // the whole file's uncommitted diff, where lines take comments, beside it.
  const exact = !!(it.tool && edits?.tool);
  const [view, setView] = useState<"change" | "file">(exact ? "change" : "file");
  const [change, setChange] = useState<{ state: "loading" } | { state: "ready"; d: ToolDetail } | { state: "error"; message: string }>();
  const loadChange = () => {
    if (!exact) return;
    setChange({ state: "loading" });
    edits!.tool!(it.tool!).then(
      (d) => setChange({ state: "ready", d }),
      (err) => setChange({ state: "error", message: errorMessage(err) }),
    );
  };
  const toggle = () => {
    if (!open && (!diff || diff.state === "error")) load();
    if (!open && exact && (!change || change.state === "error")) loadChange();
    setOpen(!open);
  };
  const label = (
    <>
      <PencilLineIcon className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Edited</span>
      <span className="min-w-0 truncate font-mono text-[12.5px]">
        <span className="text-muted-foreground">{it.file.slice(0, cut + 1)}</span>
        {it.file.slice(cut + 1)}
      </span>
      <span className="font-medium font-mono text-[12px] text-success-foreground tabular-nums">+{it.added}</span>
      <span className="font-medium font-mono text-[12px] text-destructive-foreground tabular-nums">−{it.removed}</span>
    </>
  );
  if (!edits) return <div className="cv-in flex min-w-0 items-center gap-2 self-start rounded-lg bg-muted/40 px-2.5 py-1.5 text-[13px]">{label}</div>;
  const lines = diff?.state === "ready" ? parseDiff(diff.diff.diff) : [];
  const comments = edits.comments(it.file);
  return (
    <div className={cn("cv-in flex min-w-0 flex-col", open ? "self-stretch" : "self-start")}>
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-left text-[13px] outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
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
      {open && (
        <div ref={panel} className="mt-2 scroll-mb-4 overflow-hidden rounded-lg border bg-card">
          {exact && (
            <div role="tablist" aria-label="Show" className="flex gap-1 border-b bg-muted/30 px-1.5 py-1 text-xs">
              {(
                [
                  ["change", "This change"],
                  ["file", "Uncommitted in file"],
                ] as const
              ).map(([v, label]) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded-md px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring", view === v ? "bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {exact && view === "change" && (
            <>
              {(!change || change.state === "loading") && (
                <div className="flex h-16 items-center justify-center text-muted-foreground text-sm">
                  <Spinner className="mr-2 size-4" />
                  Reading the change…
                </div>
              )}
              {change?.state === "error" && <p className="px-3 py-3 text-destructive-foreground text-sm">Couldn't read this change: {change.message}</p>}
              {change?.state === "ready" && <ToolDetailView d={change.d} />}
            </>
          )}
          {(!exact || view === "file") && (!diff || diff.state === "loading") && (
            <div className="flex h-16 items-center justify-center text-muted-foreground text-sm">
              <Spinner className="mr-2 size-4" />
              Reading the diff…
            </div>
          )}
          {(!exact || view === "file") && diff?.state === "error" && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm">
              <span className="min-w-0 flex-1 text-destructive-foreground">Couldn't read the diff: {diff.message}</span>
              <Button size="xs" variant="outline" onClick={load}>
                <RotateCwIcon />
                Retry
              </Button>
            </div>
          )}
          {(!exact || view === "file") && diff?.state === "ready" && !lines.length && <p className="px-3 py-3 text-muted-foreground text-sm">No changes left in this file: they were committed or undone since.</p>}
          {(!exact || view === "file") && diff?.state === "ready" && lines.length > 0 && (
            <>
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1 text-muted-foreground text-xs">
                <span className="min-w-0 flex-1 truncate">{diff.diff.untracked ? "A new file" : "Uncommitted changes in this file"} · hover a line to comment</span>
                {diff.diff.truncated && <span className="shrink-0 text-warning">first 64 KB</span>}
              </div>
              <div className="max-h-96 overflow-auto font-mono text-[12px] leading-5 [font-variant-ligatures:none]">
                <DiffLines lines={lines} comments={comments} />
              </div>
            </>
          )}
        </div>
      )}
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
    <div className="cv-in flex max-w-[80%] flex-col items-end gap-1 self-end">
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
  const [open, setOpen] = useState(!it.done);
  // A finished group folds to its summary after a moment.
  useEffect(() => {
    if (!it.done) return;
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
            <span className="flex size-3 items-center justify-center rounded-[3px] font-bold font-mono text-[6.5px] text-white uppercase" style={{ background: EXT[ext] ?? "#64748b" }}>
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
    <div data-selectable className="font-mono text-[12px] leading-5 [font-variant-ligatures:none]">
      {(d.command || d.pattern || d.file) && !edit && (
        <div className="flex gap-2 border-b bg-muted/30 px-3 py-1.5">
          <span className="shrink-0 text-muted-foreground">{d.command ? "$" : d.pattern ? "?" : "·"}</span>
          <span className="min-w-0 whitespace-pre-wrap break-all">{d.command || [d.pattern, d.file].filter(Boolean).join("  in  ")}</span>
        </div>
      )}
      {edit && (
        <>
          {d.file && <div className="border-b bg-muted/30 px-3 py-1.5 text-muted-foreground">{d.old != null ? "Updated" : "Created"} {d.file}</div>}
          <div className="max-h-96 overflow-auto">
            <ChangeLines old={d.old ?? ""} next={d.new ?? ""} />
          </div>
        </>
      )}
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

// ChangeLines is an edit as the terminal shows it: the lines it took out
// and put in, numbered, the rest as context. A line diff of the two texts.
function ChangeLines({ old, next }: { old: string; next: string }) {
  const rows = useMemo(() => lineDiff(old ? old.split("\n") : [], next.split("\n")), [old, next]);
  let n = 0;
  return (
    <table className="w-full border-collapse">
      <tbody>
        {rows.map((r, i) => {
          if (r.op !== "-") n++;
          return (
            <tr key={i} className={r.op === "+" ? "bg-success/12" : r.op === "-" ? "bg-destructive/12" : undefined}>
              <td className="w-10 select-none pr-2 text-right align-top text-muted-foreground/70 tabular-nums">{r.op === "-" ? "" : n}</td>
              <td className={cn("w-4 select-none align-top", r.op === "+" ? "text-success-foreground" : r.op === "-" ? "text-destructive-foreground" : "text-muted-foreground/50")}>{r.op === " " ? "" : r.op}</td>
              <td className="whitespace-pre-wrap break-all pr-3">{r.text || " "}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// lineDiff: the longest common run of lines kept as context, the rest as
// removed or added. Large texts (past ~4M cells) show as removed then added.
function lineDiff(a: string[], b: string[]): { op: " " | "+" | "-"; text: string }[] {
  if (a.length * b.length > 4_000_000) return [...a.map((text) => ({ op: "-" as const, text })), ...b.map((text) => ({ op: "+" as const, text }))];
  const m = a.length, k = b.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(k + 1));
  for (let i = m - 1; i >= 0; i--) for (let j = k - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { op: " " | "+" | "-"; text: string }[] = [];
  let i = 0, j = 0;
  while (i < m && j < k) {
    if (a[i] === b[j]) (out.push({ op: " ", text: a[i] }), i++, j++);
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: "-", text: a[i++] });
    else out.push({ op: "+", text: b[j++] });
  }
  while (i < m) out.push({ op: "-", text: a[i++] });
  while (j < k) out.push({ op: "+", text: b[j++] });
  return out;
}

function Thinking({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const s = Math.round((now - since) / 1000);
  return (
    <div className="cv-in flex items-center gap-2">
      <span className="cv-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="cv-shimmer">Thinking…</span>
      {s >= 1 && <span className="text-muted-foreground tabular-nums">{s}s</span>}
    </div>
  );
}
