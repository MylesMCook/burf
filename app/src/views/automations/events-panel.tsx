import { ActivityIcon, PanelRightCloseIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { BerthEvent } from "@/lib/api";
import { useEventLog } from "@/lib/events";
import { cn } from "@/lib/utils";

const PREFIXES = ["agent", "worktree", "session", "task", "box", "hooks"];

// EventsPanel shows events as they arrive, which is what writing a hook
// needs: the exact type and the data it carries.
export function EventsPanel({ onClose, onNewHook }: { onClose(): void; onNewHook(e: BerthEvent): void }) {
  const events = useEventLog((s) => s.events);
  const [prefix, setPrefix] = useState<string>();
  const shown = prefix ? events.filter((e) => e.type.startsWith(`${prefix}.`)) : events;

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l bg-sidebar/40">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <ActivityIcon className="size-3.5 text-muted-foreground" />
        <h2 className="font-medium text-sm">Live events</h2>
        <span className="text-muted-foreground text-xs tabular-nums">{events.length}</span>
        <Button size="icon-xs" variant="ghost" className="ml-auto" aria-label="Hide events" onClick={onClose}>
          <PanelRightCloseIcon />
        </Button>
      </header>
      <div className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
        <Chip active={!prefix} onClick={() => setPrefix(undefined)} sans>
          All
        </Chip>
        {PREFIXES.map((p) => (
          <Chip key={p} active={prefix === p} onClick={() => setPrefix(prefix === p ? undefined : p)}>
            {p}.*
          </Chip>
        ))}
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto border-t">
        {shown.length === 0 ? (
          <li className="px-3 py-4 text-muted-foreground text-xs">Nothing yet. Events from this laptop and every box appear here as they happen.</li>
        ) : (
          shown.map((e, i) => <EventRow key={`${e.time}-${e.type}-${i}`} e={e} onNewHook={() => onNewHook(e)} />)
        )}
      </ol>
    </aside>
  );
}

function Chip({ active, onClick, children, sans }: { active: boolean; onClick(): void; children: React.ReactNode; sans?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground", !sans && "font-mono", active && "border-ring/50 bg-accent text-foreground")}
    >
      {children}
    </button>
  );
}

function EventRow({ e, onNewHook }: { e: BerthEvent; onNewHook(): void }) {
  const [open, setOpen] = useState(false);
  const data = e.data && Object.keys(e.data).length > 0 ? e.data : undefined;
  return (
    <li className="border-b border-border/60">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-accent/40">
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">{new Date(e.time).toLocaleTimeString([], { hour12: false })}</span>
        <span className={cn("min-w-0 flex-1 truncate font-mono text-xs", e.error && "text-destructive-foreground")}>{e.type}</span>
        <span className="shrink-0 truncate text-[11px] text-muted-foreground">{[e.box, e.origin && e.origin !== "berth" && `via ${e.origin}`].filter(Boolean).join(" · ")}</span>
      </button>
      {open && (
        <div className="mx-3 mb-2 space-y-1.5">
          <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground leading-snug">{JSON.stringify({ type: e.type, box: e.box, origin: e.origin, error: e.error, data }, null, 2)}</pre>
          <Button size="xs" variant="outline" onClick={onNewHook}>
            <PlusIcon />
            New hook for this event
          </Button>
        </div>
      )}
    </li>
  );
}

// EventsRail is the panel collapsed: still there, with a live count.
export function EventsRail({ onOpen }: { onOpen(): void }) {
  const count = useEventLog((s) => s.events.length);
  return (
    <button type="button" onClick={onOpen} aria-label="Show live events" className="flex w-9 shrink-0 flex-col items-center gap-1.5 border-l bg-sidebar/40 pt-3 text-muted-foreground hover:text-foreground">
      <ActivityIcon className="size-4" />
      <span className="font-mono text-[10px] tabular-nums">{count}</span>
    </button>
  );
}
