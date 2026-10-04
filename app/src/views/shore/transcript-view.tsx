import { CheckIcon, ChevronRightIcon, FileTextIcon, PencilLineIcon, SearchIcon, TerminalIcon, UsersIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toolSummary, type TranscriptItem } from "@/lib/transcript";
import { cn } from "@/lib/utils";

// TranscriptView draws a session's turn as it happens: what was asked, what
// the agent says, its tool calls folded into groups, edits, and questions
// for you with their answers as buttons.

export function TranscriptView({ items, onAnswer }: { items: TranscriptItem[]; onAnswer(id: string, yes: boolean): void }) {
  const end = useRef<HTMLDivElement>(null);
  const last = items[items.length - 1];
  const lastLen = last?.kind === "text" ? last.text.length : last?.kind === "tools" ? last.items.length : 0;
  useEffect(() => {
    void end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [items.length, lastLen]);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 px-6 pt-6 pb-40 text-[14.5px] text-slate-800 leading-relaxed">
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
      return <div className="shore-in max-w-[80%] self-end rounded-2xl bg-white/80 px-3.5 py-2 text-slate-700 shadow-sm">{it.text}</div>;
    case "text":
      return <p className="shore-in text-pretty">{it.text}</p>;
    case "thinking":
      return <Thinking since={it.since} />;
    case "tools":
      return <Tools it={it} />;
    case "edit":
      return (
        <div className="shore-in inline-flex items-center gap-2 self-start rounded-lg bg-white/60 px-2.5 py-1.5 text-[13px]">
          <PencilLineIcon className="size-3.5 text-slate-500" />
          <span className="font-mono text-[12.5px]">{it.file}</span>
          <span className="font-mono text-[12px] text-emerald-700">+{it.added}</span>
          <span className="font-mono text-[12px] text-rose-700">−{it.removed}</span>
        </div>
      );
    case "crew":
      return (
        <div className="shore-in flex items-center gap-2 text-[13px] text-slate-500">
          <UsersIcon className="size-3.5" />
          Started {it.names.length} helpers: {it.names.join(", ")}
        </div>
      );
    case "ask":
      return (
        <div className={cn("shore-in rounded-xl border bg-white/85 p-3 shadow-sm", it.decided ? "border-white/60" : "border-amber-300")}>
          <div className="flex items-center gap-2 text-[13px]">
            <span className={cn("size-2 rounded-full", it.decided ? "bg-slate-300" : "shore-lamp bg-amber-400")} />
            <span className="font-medium">{it.tool === "Question" ? "Needs your answer" : "Wants to run a command"}</span>
          </div>
          <div className="mt-1.5 font-mono text-[12.5px] text-slate-600">{it.detail}</div>
          {it.decided ? (
            <div className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-slate-500">
              <CheckIcon className="size-3.5" />
              {it.decided === "approved" ? "Approved" : "Denied"}
            </div>
          ) : (
            <div className="mt-2.5 flex gap-2">
              <button type="button" onClick={() => onAnswer(it.id, true)} className="h-7 rounded-md bg-slate-900 px-3 text-[12.5px] text-white">
                {it.tool === "Question" ? "Yes" : "Allow"}
              </button>
              <button type="button" onClick={() => onAnswer(it.id, false)} className="h-7 rounded-md px-3 text-[12.5px] text-slate-600 hover:bg-slate-100">
                {it.tool === "Question" ? "No" : "Deny"}
              </button>
            </div>
          )}
        </div>
      );
  }
}

function Tools({ it }: { it: Extract<TranscriptItem, { kind: "tools" }> }) {
  const [open, setOpen] = useState(true);
  // A finished group folds to its summary after a moment.
  useEffect(() => {
    if (!it.done) return;
    const t = setTimeout(() => setOpen(false), 1400);
    return () => clearTimeout(t);
  }, [it.done]);
  const Icon = it.verb === "Search" ? SearchIcon : it.verb === "Run" ? TerminalIcon : FileTextIcon;
  return (
    <div className="shore-in text-[13.5px]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700">
        <ChevronRightIcon className={cn("size-3.5 transition-transform", open && "rotate-90")} />
        {it.done ? toolSummary(it) : `${it.verb === "Read" ? "Reading" : it.verb === "Search" ? "Searching" : "Running"}…`}
      </button>
      {open && (
        <div className="mt-1.5 ml-[7px] flex flex-col gap-1.5 border-slate-300/70 border-l pl-4">
          {it.items.map((c, i) => (
            <div key={i} className="shore-in flex items-center gap-2 text-slate-600">
              <Icon className="size-3.5 text-slate-400" />
              <span>{c.verb}</span>
              <span className={cn("rounded-md bg-white/70 px-1.5 py-0.5 text-[12.5px]", c.file ? "font-mono" : "font-mono text-slate-500")}>{c.target}</span>
            </div>
          ))}
        </div>
      )}
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
    <div className="flex items-center gap-2 text-[13.5px] text-slate-500">
      <span className="shore-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      Thinking… <span className="text-slate-400 tabular-nums">{Math.max(0, Math.round((now - since) / 1000))}s</span>
    </div>
  );
}
