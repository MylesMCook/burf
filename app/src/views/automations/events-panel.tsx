import * as stylex from "@stylexjs/stylex";
import { ActivityIcon, PanelRightCloseIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { FilterChip } from "@/components/filter-chip";
import { Button } from "@/components/ui/button";
import type { BerthEvent } from "@/lib/api";
import { useEventLog } from "@/lib/events";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "width": "360px",
    "flexShrink": 0,
    "flexDirection": "column",
    "borderLeftWidth": 1,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--sidebar) 40%, transparent)",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "12px",
    "paddingBottom": "8px",
  },
  s2: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s4: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s5: {
    "marginLeft": "auto",
  },
  s6: {
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "4px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingBottom": "8px",
  },
  s7: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s8: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
  },
  s9: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "borderColor": "color-mix(in oklab, var(--border) 60%, transparent)",
  },
  s11: {
    "display": "flex",
    "width": "100%",
    "alignItems": "baseline",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "textAlign": "left",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
  },
  s12: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s13: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "color": "var(--destructive-foreground)",
  },
  s15: {
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s16: {
    "marginLeft": "12px",
    "marginRight": "12px",
    "marginBottom": "8px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "6px",
    },
  },
  s17: {
    "overflowX": "auto",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "lineHeight": "1.375",
  },
  s18: {
    "display": "flex",
    "width": "36px",
    "flexShrink": 0,
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "6px",
    "borderLeftWidth": 1,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--sidebar) 40%, transparent)",
    "paddingTop": "12px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s19: {
    "width": "16px",
    "height": "16px",
  },
  s20: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "fontVariantNumeric": "tabular-nums",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const PREFIXES = ["agent", "worktree", "session", "task", "box", "hooks"];

// EventsPanel shows events as they arrive, which is what writing a hook
// needs: the exact type and the data it carries.
export function EventsPanel({ onClose, onNewHook }: { onClose(): void; onNewHook(e: BerthEvent): void }) {
  const events = useEventLog((s) => s.events);
  // Types to narrow to; none on means every event.
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const shown = prefixes.length ? events.filter((e) => prefixes.some((p) => e.type.startsWith(`${p}.`))) : events;

  return (
    <aside className={sx(paint.s0)}>
      <header className={sx(paint.s1)}>
        <ActivityIcon className={sx(paint.s2)} />
        <h2 className={sx(paint.s3)}>Live events</h2>
        <span className={sx(paint.s4)}>{events.length}</span>
        <span className={sx(paint.s5)}><Button size="icon-xs" variant="ghost"  aria-label="Hide events" onClick={onClose}>
          <PanelRightCloseIcon />
        </Button></span>
      </header>
      {/* Wraps rather than scrolls: a hidden scrollbar read as chips cut off. */}
      <div className={sx(paint.s6)} role="group" aria-label="Show only">
        {PREFIXES.map((p) => (
          <FilterChip key={p} className={sx(paint.s7)} pressed={prefixes.includes(p)} onPressedChange={(on) => setPrefixes((ps) => (on ? [...ps, p] : ps.filter((x) => x !== p)))}>
            {p}.*
          </FilterChip>
        ))}
      </div>
      <ol className={sx(paint.s8)}>
        {shown.length === 0 ? (
          <li className={sx(paint.s9)}>Nothing yet. Events from this laptop and every box appear here as they happen.</li>
        ) : (
          shown.map((e, i) => <EventRow key={`${e.time}-${e.type}-${i}`} e={e} onNewHook={() => onNewHook(e)} />)
        )}
      </ol>
    </aside>
  );
}

function EventRow({ e, onNewHook }: { e: BerthEvent; onNewHook(): void }) {
  const [open, setOpen] = useState(false);
  const data = e.data && Object.keys(e.data).length > 0 ? e.data : undefined;
  return (
    <li className={sx(paint.s10)}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={sx(paint.s11)}>
        <span className={sx(paint.s12)}>{new Date(e.time).toLocaleTimeString([], { hour12: false })}</span>
        <span className={[sx(paint.s13), e.error && sx(paint.s14)].filter(Boolean).join(" ")}>{e.type}</span>
        <span className={sx(paint.s15)}>{[e.box, e.origin && e.origin !== "berth" && `via ${e.origin}`].filter(Boolean).join(" · ")}</span>
      </button>
      {open && (
        <div className={sx(paint.s16)}>
          <pre className={sx(paint.s17)}>{JSON.stringify({ type: e.type, box: e.box, origin: e.origin, error: e.error, data }, null, 2)}</pre>
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
    <button type="button" onClick={onOpen} aria-label="Show live events" className={sx(paint.s18)}>
      <ActivityIcon className={sx(paint.s19)} />
      <span className={sx(paint.s20)}>{count}</span>
    </button>
  );
}
