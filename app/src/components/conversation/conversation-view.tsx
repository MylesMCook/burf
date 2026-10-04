import { CheckIcon, ChevronRightIcon, FileTextIcon, PencilLineIcon, SearchIcon, TerminalIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toolSummary, type TranscriptItem } from "@/lib/transcript";
import { cn } from "@/lib/utils";
import "@/components/conversation/conversation.css";

// ConversationView draws an agent's turn as a calm transcript rather than a
// terminal: what was asked, what the agent says, its tool calls folded into
// groups ("Read 5 files"), edits, the helpers it sent out, and questions for
// the person with their answers as buttons. It only draws items; where they
// come from and what an answer does is the caller's.

export interface ConversationViewProps {
  items: TranscriptItem[];
  onAnswer(id: string, yes: boolean): void;
  className?: string;
}

export function ConversationView({ items, onAnswer, className }: ConversationViewProps) {
  const end = useRef<HTMLDivElement>(null);
  const last = items[items.length - 1];
  const grew = last?.kind === "text" ? last.text.length : last?.kind === "tools" ? last.items.length : 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [items.length, grew]);

  return (
    <div className={cn("mx-auto flex w-full max-w-[680px] flex-col gap-4 text-[14px] text-foreground leading-relaxed", className)}>
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
      return <div className="cv-in max-w-[80%] self-end whitespace-pre-wrap rounded-2xl bg-muted px-3.5 py-2">{it.text}</div>;
    case "text":
      return <p className="cv-in text-pretty">{it.text}</p>;
    case "thinking":
      return <Thinking since={it.since} />;
    case "tools":
      return <Tools it={it} />;
    case "edit":
      return <Edit it={it} />;
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
      return <Ask it={it} onAnswer={onAnswer} />;
  }
}

function Ask({ it, onAnswer }: { it: Extract<TranscriptItem, { kind: "ask" }>; onAnswer(id: string, yes: boolean): void }) {
  const question = it.tool === "Question";
  if (it.decided) {
    const yes = it.decided === "approved";
    return (
      <div className="cv-in flex items-center gap-2 text-muted-foreground">
        {yes ? <CheckIcon className="size-3.5 text-success" /> : <XIcon className="size-3.5" />}
        {question ? (yes ? "You said yes" : "You said no") : yes ? "Allowed" : "Denied"}
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
        {question ? <p>{it.detail}</p> : <code className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-[12.5px]">{it.detail}</code>}
      </div>
      <div className="flex items-center gap-2 border-t px-4 py-3">
        <Button size="sm" onClick={() => onAnswer(it.id, true)}>
          {question ? "Yes" : "Allow"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAnswer(it.id, false)}>
          {question ? "No" : "Deny"}
        </Button>
        <span className="ml-auto text-muted-foreground text-xs">{question ? "Or reply below" : "The agent waits for you"}</span>
      </div>
    </Card>
  );
}

function Edit({ it }: { it: Extract<TranscriptItem, { kind: "edit" }> }) {
  const cut = it.file.lastIndexOf("/");
  return (
    <div className="cv-in flex items-center gap-2 self-start rounded-lg bg-muted/40 px-2.5 py-1.5 text-[13px]">
      <PencilLineIcon className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">Edited</span>
      <span className="font-mono text-[12.5px]">
        <span className="text-muted-foreground">{it.file.slice(0, cut + 1)}</span>
        {it.file.slice(cut + 1)}
      </span>
      <span className="font-medium font-mono text-[12px] text-success-foreground tabular-nums">+{it.added}</span>
      <span className="font-medium font-mono text-[12px] text-destructive-foreground tabular-nums">−{it.removed}</span>
    </div>
  );
}

// A file's mark: its extension, in the colour editors give it.
const EXT: Record<string, string> = { ts: "#3178c6", tsx: "#3178c6", js: "#b8860b", rs: "#d0573a", go: "#00a7d0", md: "#6b7280", json: "#8b5cf6", css: "#2965f1", py: "#3a75b0" };

function Tools({ it }: { it: Extract<TranscriptItem, { kind: "tools" }> }) {
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
            {it.items.map((c, i) => {
              const lastRow = i === it.items.length - 1;
              const ext = c.file ? (c.target.split(".").pop() ?? "") : "";
              return (
                <li key={i} className="cv-in relative flex h-8 items-center gap-2 pl-5 text-muted-foreground">
                  {/* The tree: a stem down from the summary, an elbow into each row. */}
                  <span aria-hidden className={cn("absolute top-0 left-0 w-3 border-l", lastRow ? "h-1/2 rounded-bl-md border-b" : "h-full")} />
                  {!lastRow && <span aria-hidden className="absolute top-1/2 left-0 w-3 border-t" />}
                  <Icon className="size-3.5" />
                  <span>{c.verb}</span>
                  <Badge variant="outline" className={cn("gap-1.5 font-normal", !c.file && "font-mono")}>
                    {c.file && (
                      <span className="flex size-3 items-center justify-center rounded-[3px] font-bold font-mono text-[6.5px] text-white uppercase" style={{ background: EXT[ext] ?? "#64748b" }}>
                        {ext.slice(0, 2)}
                      </span>
                    )}
                    {c.target}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
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
