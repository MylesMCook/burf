import { ChevronDownIcon, ChevronRightIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { StateGlyph } from "@/components/agent-glyph";
import { HelperSheetHost, openHelper } from "@/components/conversation/subagent-view";
import { useHasHistory } from "@/lib/history";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { CrewMember } from "@/lib/transcript";
import { cn } from "@/lib/utils";

// CrewCard lists the helpers working beside one agent: the subagents it
// started, and Berth's own (an attempt, a reviewer, a loop). It folds to its
// header. `title` names whose crew it is.

const KIND: Record<CrewMember["kind"], string> = { subagent: "Subagent", attempt: "Attempt", reviewer: "Reviewer", loop: "Loop" };

const elapsed = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

// With chat (its box and session), a subagent opens to its own conversation.
export function CrewCard({ crew, title, className, chat }: { crew: CrewMember[]; title?: string; className?: string; chat?: { box: string; session: string } }) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(Date.now());
  const busy = crew.filter((c) => c.state !== "finished").length;
  const history = useHasHistory(chat?.box ?? "");
  const helpers = history ? chat : undefined;
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  return (
    <Card className={cn("rounded-xl bg-popover text-sm shadow-lg/5 before:rounded-[calc(var(--radius-xl)-1px)]", className)} role="region" aria-label="Crew">
      <button type="button" data-crew-toggle onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <UsersIcon className="size-3.5 text-muted-foreground" />
        <span className="font-medium">Crew</span>
        {title && <span className="min-w-0 truncate text-muted-foreground text-xs">{title}</span>}
        <Badge variant={busy ? "info" : "success"} className="ml-auto">
          {busy ? `${busy} working` : "All back"}
        </Badge>
        <ChevronDownIcon className={cn("size-3.5 text-muted-foreground transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <ul className="border-t p-1">
          {crew.map((c) => {
            const row = (
              <>
                <StateGlyph state={c.state} className="mt-[3px]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[0.8125rem] leading-5">{c.name.replace(/^Explore:\s*/, "")}</div>
                  <div className="truncate text-muted-foreground text-xs leading-5">{c.doing}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end text-muted-foreground text-xs leading-5">
                  <span>{KIND[c.kind]}</span>
                  <span className="font-mono tabular-nums">{elapsed((c.state === "finished" ? (c.until ?? now) : now) - c.since)}</span>
                </div>
              </>
            );
            return (
              <li key={c.id}>
                {helpers && c.kind === "subagent" ? (
                  <button
                    type="button"
                    onClick={() => openHelper(helpers.box, helpers.session, c.id)}
                    aria-label={`${c.name}: open its conversation`}
                    className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row}
                    <ChevronRightIcon className="mt-[3px] size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </button>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg px-2 py-1.5">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {helpers && <HelperSheetHost />}
    </Card>
  );
}
