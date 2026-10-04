import { CheckIcon, ChevronRightIcon, FileTextIcon, PencilLineIcon, SearchIcon, TerminalIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toolSummary, type TranscriptItem } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import { BoatSide } from "@/views/shore/harbour";

// TranscriptView draws a session's turn as it happens: what was asked, what
// the agent says, its tool calls folded into groups, edits, and questions
// for you with their answers as buttons.

export function TranscriptView({ items, onAnswer }: { items: TranscriptItem[]; onAnswer(id: string, yes: boolean): void }) {
  const end = useRef<HTMLDivElement>(null);
  const last = items[items.length - 1];
  const lastLen = last?.kind === "text" ? last.text.length : last?.kind === "tools" ? last.items.length : 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [items.length, lastLen]);

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5 px-6 pt-8 pb-44 text-(--sh-ink) text-[15px] leading-[1.65]">
      {items.map((it) => (
        <Item key={it.id} it={it} onAnswer={onAnswer} />
      ))}
      <div ref={end} />
    </div>
  );
}

function Item({ it, onAnswer }: { it: TranscriptItem; onAnswer(id: string, yes: boolean): void }) {
  switch (it.kind) {
    case "user":
      return (
        <div className="shore-in max-w-[78%] self-end rounded-[18px] rounded-br-md bg-(--sh-glass-hi) px-4 py-2.5 text-[14.5px] shadow-(--sh-shadow-sm) ring-(--sh-edge) ring-1">
          {it.text}
        </div>
      );
    case "text":
      return <p className="shore-in text-pretty">{it.text}</p>;
    case "thinking":
      return <Thinking since={it.since} />;
    case "tools":
      return <Tools it={it} />;
    case "edit":
      return <Edit it={it} />;
    case "crew":
      return (
        <div className="shore-in flex flex-wrap items-center gap-x-2 gap-y-1.5 text-(--sh-ink-2) text-[14px]">
          Sent out {it.names.length} helper{it.names.length === 1 ? "" : "s"}
          {it.names.map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-(--sh-chip) py-0.5 pr-2.5 pl-1.5 text-(--sh-ink) text-[13px]">
              <BoatSide sail size={16} />
              {n.replace(/^Explore:\s*/, "")}
            </span>
          ))}
        </div>
      );
    case "ask":
      return <Ask it={it} onAnswer={onAnswer} />;
  }
}

function Ask({ it, onAnswer }: { it: Extract<TranscriptItem, { kind: "ask" }>; onAnswer(id: string, yes: boolean): void }) {
  const question = it.tool === "Question";
  if (it.decided) {
    const yes = it.decided === "approved";
    return (
      <div className="shore-in flex items-center gap-2 text-(--sh-ink-2) text-[14px]">
        {yes ? <CheckIcon className="size-4 text-(--sh-done)" /> : <XIcon className="size-4 text-(--sh-ink-3)" />}
        {question ? (yes ? "You said yes" : "You said no") : yes ? "Allowed" : "Denied"}
        <code className="rounded-md bg-(--sh-chip) px-1.5 py-0.5 font-mono text-[12.5px] text-(--sh-ink-2)">{it.detail}</code>
      </div>
    );
  }
  return (
    <div className="shore-in overflow-hidden rounded-2xl bg-(--sh-glass-hi) shadow-(--sh-shadow) ring-(--sh-lamp)/60 ring-1">
      <div className="flex items-center gap-2 px-4 pt-3.5 font-medium text-[14px]">
        <span className="relative flex size-2.5 items-center justify-center" aria-hidden>
          <span className="shore-lamp absolute size-4 rounded-full bg-(--sh-lamp)/35" />
          <span className="relative size-2 rounded-full bg-(--sh-lamp)" />
        </span>
        {question ? "Needs your answer" : "Wants to run a command"}
      </div>
      {question ? (
        <p className="px-4 pt-1.5 text-(--sh-ink) text-[15px]">{it.detail}</p>
      ) : (
        <div className="mx-4 mt-2.5 rounded-lg bg-(--sh-chip) px-3 py-2 font-mono text-(--sh-ink) text-[13px]">
          <span className="select-none text-(--sh-ink-2)">$ </span>
          {it.detail}
        </div>
      )}
      <div className="mt-3.5 flex items-center gap-2 border-(--sh-line) border-t bg-(--sh-chip)/40 px-4 py-2.5">
        <button
          type="button"
          onClick={() => onAnswer(it.id, true)}
          className="inline-flex h-8 items-center rounded-lg bg-(--sh-btn) px-3.5 font-medium text-(--sh-btn-ink) text-[13px] shadow-sm transition-opacity hover:opacity-90"
        >
          {question ? "Yes" : "Allow"}
        </button>
        <button
          type="button"
          onClick={() => onAnswer(it.id, false)}
          className="inline-flex h-8 items-center rounded-lg px-3.5 font-medium text-(--sh-ink-2) text-[13px] ring-(--sh-line-2) ring-1 transition-colors hover:bg-(--sh-chip)"
        >
          {question ? "No" : "Deny"}
        </button>
        <span className="ml-auto text-(--sh-ink-3) text-[12.5px]">{question ? "Or reply below" : "Paused until you answer"}</span>
      </div>
    </div>
  );
}

function Edit({ it }: { it: Extract<TranscriptItem, { kind: "edit" }> }) {
  const cut = it.file.lastIndexOf("/");
  const dir = cut >= 0 ? it.file.slice(0, cut + 1) : "";
  const base = it.file.slice(cut + 1);
  return (
    <div className="shore-in flex items-center gap-2.5 self-start rounded-xl bg-(--sh-glass) px-3 py-2 text-[13.5px] shadow-(--sh-shadow-sm) ring-(--sh-edge) ring-1">
      <PencilLineIcon className="size-3.5 text-(--sh-ink-3)" />
      <span className="text-(--sh-ink-2)">Edited</span>
      <span className="font-mono text-[12.5px]">
        <span className="text-(--sh-ink-3)">{dir}</span>
        <span className="text-(--sh-ink)">{base}</span>
      </span>
      <span className="font-medium font-mono text-(--sh-add) text-[12px] tabular-nums">+{it.added}</span>
      <span className="-ml-1 font-medium font-mono text-(--sh-del) text-[12px] tabular-nums">−{it.removed}</span>
    </div>
  );
}

// A file's chip: a coloured mark for its kind, then its name.
const EXT: Record<string, string> = { ts: "#3178c6", tsx: "#3178c6", js: "#d4a017", rs: "#d0573a", go: "#00a7d0", md: "#6b7280", json: "#8b5cf6", css: "#2965f1", py: "#3a75b0" };
function FileChip({ name }: { name: string }) {
  const ext = name.split(".").pop() ?? "";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-(--sh-chip) px-1.5 py-0.5 text-(--sh-ink) text-[13px] leading-5">
      <span className="flex size-3.5 items-center justify-center rounded-[4px] font-bold font-mono text-[7.5px] text-white uppercase" style={{ background: EXT[ext] ?? "#64748b" }}>
        {ext.slice(0, 2)}
      </span>
      {name}
    </span>
  );
}

function Tools({ it }: { it: Extract<TranscriptItem, { kind: "tools" }> }) {
  const [open, setOpen] = useState(true);
  // A finished group folds to its summary after a moment.
  useEffect(() => {
    if (!it.done) return;
    const t = setTimeout(() => setOpen(false), 1600);
    return () => clearTimeout(t);
  }, [it.done]);
  const Icon = it.verb === "Search" ? SearchIcon : it.verb === "Run" ? TerminalIcon : FileTextIcon;
  const doing = it.verb === "Read" ? "Reading" : it.verb === "Search" ? "Searching" : "Running";
  return (
    <div className="shore-in -my-1 text-[14px]">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-(--sh-ink-2) transition-colors hover:text-(--sh-ink)">
        <ChevronRightIcon className={cn("size-3.5 text-(--sh-ink-3) transition-transform duration-200", open && "rotate-90")} />
        {it.done ? toolSummary(it) : <span className="shore-shimmer">{doing}…</span>}
      </button>
      <div className="shore-fold" data-closed={open ? undefined : ""}>
        <div>
          <ul className="pt-1 pl-[7px]">
            {it.items.map((c, i) => (
              <li key={i} className="shore-in relative flex h-8 items-center gap-2 pl-5 text-(--sh-ink-2)">
                {/* The tree: a stem down from the summary and an elbow into each row. */}
                <span aria-hidden className={cn("absolute top-0 left-0 w-3 border-(--sh-line-2) border-l", i === it.items.length - 1 ? "h-1/2 rounded-bl-md border-b" : "h-full")} />
                {i !== it.items.length - 1 && <span aria-hidden className="absolute top-1/2 left-0 w-3 border-(--sh-line-2) border-t" />}
                <Icon className="size-3.5 text-(--sh-ink-3)" />
                <span>{c.verb}</span>
                {c.file ? <FileChip name={c.target} /> : <code className="rounded-md bg-(--sh-chip) px-1.5 py-0.5 font-mono text-(--sh-ink) text-[12.5px]">{c.target}</code>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Thinking({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="shore-in flex items-center gap-2 text-[14px]">
      <span className="shore-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span className="shore-shimmer">Thinking…</span>
      {now - since >= 1000 && <span className="text-(--sh-ink-3) tabular-nums">{Math.round((now - since) / 1000)}s</span>}
    </div>
  );
}
