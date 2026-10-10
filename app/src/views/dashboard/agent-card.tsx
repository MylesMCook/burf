import * as stylex from "@stylexjs/stylex";
import { SquareIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { openOrchestrate, SessionActions } from "@/components/orchestrate/session-actions";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toastManager } from "@/components/ui/toast";
import type { SessionEntry } from "@/hooks/use-agent-counts";
import { boxApi } from "@/lib/api";
import { agentOf } from "@/lib/derive";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { focusSession } from "@/lib/workspaces";
import { describeAgent, startedAt } from "@/views/dashboard/names";
import { confirmStop, StopMenuItems } from "@/views/dashboard/stop";
import { type Choice, useScreenTail } from "@/views/dashboard/use-screen-tail";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "display": "flex",
    "cursor": "pointer",
    "flexDirection": "column",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 40%, transparent)",
    },
    "backgroundColor": "var(--card)",
    "textAlign": "left",
    "outline": "none",
    "transitionDuration": "200ms",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s1: {
    "opacity": 1,
  },
  s2: {
    "opacity": 0,
  },
  s3: {
    "borderColor": {
      "default": "color-mix(in oklab, var(--warning) 45%, transparent)",
      ":hover": "color-mix(in oklab, var(--warning) 70%, transparent)",
    },
  },
  s4: {
    "borderColor": {
      "default": "color-mix(in oklab, var(--primary) 60%, transparent)",
      ":hover": "color-mix(in oklab, var(--primary) 60%, transparent)",
    },
    "boxShadow": "0 0 0 2px color-mix(in oklab, var(--primary) 30%, transparent)",
  },
  s5: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "var(--row-pad)",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s7: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "baseline",
    "gap": "6px",
  },
  s8: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s9: {
    "flexShrink": 0,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s11: {
    "color": "var(--warning-foreground)",
  },
  s12: {
    "color": "var(--muted-foreground)",
  },
  s13: {
    "marginTop": "2px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingLeft": "22px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s14: {
    "opacity": 0.7,
  },
  s15: {
    "marginTop": "4px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingLeft": "22px",
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--foreground) 70%, transparent)",
    "fontStyle": "italic",
  },
  s16: {
    "marginTop": "8px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "lineHeight": "1.375",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "1px",
    },
  },
  s17: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  s18: {
    "color": "var(--muted-foreground)",
  },
  s19: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "pre",
  },
  s20: {
    "marginTop": "8px",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s21: {
    "display": "flex",
  },
  s22: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--destructive-foreground)",
    },
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--destructive) 10%, transparent)",
    },
    ":is(.group:hover &)": {
      "opacity": 1,
    },
    ":is(.group:focus-within &)": {
      "opacity": 1,
    },
  },
  s23: {
    "width": "12px",
    "height": "12px",
  },
  s24: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s25: {
    "height": "24px",
    "fontSize": "11px",
  },
  s26: {
    "height": "24px",
    "fontSize": "11px",
  },
  s27: {
    "marginTop": "8px",
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "4px",
  },
  s28: {
    "display": "inline-flex",
    "height": "24px",
    "maxWidth": "100%",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 50%, transparent)",
    },
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "11px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "opacity": {
      ":disabled": 0.5,
    },
  },
  s29: {
    "borderColor": "color-mix(in oklab, var(--success) 50%, transparent)",
    "color": "var(--success)",
  },
  s30: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
  },
  s31: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },

  s32: {
    transitionProperty: "opacity, translate, border-color",
  },
  s33: {
    translate: "0px 0px",
  },
  s34: {
    translate: "0px 4px",
  },
  s35: {
    maxWidth: "100%",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// One clock for every card, so a board of them re-renders once a second at
// most, not once per card.
const listeners = new Set<(n: number) => void>();
let timer = 0;
function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    listeners.add(setNow);
    if (!timer) timer = window.setInterval(() => listeners.forEach((l) => l(Date.now())), 1000);
    return () => {
      listeners.delete(setNow);
      if (!listeners.size) {
        window.clearInterval(timer);
        timer = 0;
      }
    };
  }, []);
  return now;
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// AgentCard is one agent on the board: where it works, how long it has been
// in its state, the last thing it said, and what you can do about it. While
// the board is selecting (or with ⌘ or ⇧ held), a click picks it instead.
export function AgentCard({ entry, selecting, selected, onSelect }: { entry: SessionEntry; selecting?: boolean; selected?: boolean; onSelect?(): void }) {
  const { box, session, state } = entry;
  const locations = useStore((s) => s.boxes[box]?.locations);
  const sessions = useStore((s) => s.boxes[box]?.sessions);
  const { where, place, name, crowded, prompt, title: work, agent } = describeAgent(session, sessions, locations);
  // A titled agent leads with its work, its place below; otherwise its place.
  const title = work ?? place;
  const now = useNow();
  // A ready agent has said nothing yet: its screen is only a banner.
  const { tail, choices } = useScreenTail(box, session, 3, state === "running", state !== "ready");
  const since = session.state_since ?? session.created;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const open = () => void focusSession(box, session.name);
  const asking = state === "waiting" && choices.length > 0;
  // The question, without the options the chips below already show.
  const lines = asking ? (tail ?? []).filter((l) => !/^\s*(?:[❯›>]\s*)?\d[.)]\s/.test(l)) : tail;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selecting ? !!selected : undefined}
      onClick={(e) => (onSelect && (selecting || e.metaKey || e.shiftKey) ? onSelect() : open())}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && (selecting && onSelect ? onSelect() : open())}
      className={[[sx(paint.s0), [sx(paint.s32), "group"].filter(Boolean).join(" ")].filter(Boolean).join(" "), shown ? [sx(paint.s1), sx(paint.s33)].filter(Boolean).join(" ") : [sx(paint.s2), sx(paint.s34)].filter(Boolean).join(" "), state === "waiting" && sx(paint.s3), selected && sx(paint.s4)].filter(Boolean).join(" ")}
    >
      <div className={sx(paint.s5)}>
        <div className={sx(paint.s6)}>
          {selecting && <Checkbox checked={!!selected} tabIndex={-1} aria-hidden passive />}
          <AgentIcon agent={agentOf(session)} />
          <span className={sx(paint.s7)}>
            <span className={sx(paint.s8)}>{title}</span>
            {/* Several agents in one worktree: which one this is. */}
            {!work && crowded && (
              <Tip label={`Session ${session.name}`}>
                <span className={sx(paint.s9)}>{name}</span>
              </Tip>
            )}
          </span>
          <Tip label={`Since ${new Date(since).toLocaleString()}`}>
            <span className={[sx(paint.s10), state === "waiting" ? sx(paint.s11) : sx(paint.s12)].filter(Boolean).join(" ")}>{duration(now - new Date(since).getTime())}</span>
          </Tip>
        </div>
        <div className={sx(paint.s13)}>
          {work && `${agent} · ${place} · `}
          {box}
          {where && !(work && where.worktree.main) && ` · ${where.location.name}`}
          {crowded && ` · started ${startedAt(session.created)}`}
          {where?.worktree.branch && where.worktree.branch !== place && <span className={sx(paint.s14)}> · {where.worktree.branch}</span>}
        </div>
        {prompt && (!work || !prompt.startsWith(work.replace(/…$/, ""))) && (
          <Tip label={prompt} width="lg">
            <div className={sx(paint.s15)}>“{prompt}”</div>
          </Tip>
        )}
        {lines && lines.length > 0 && state !== "ready" && (
          <div className={[sx(paint.s16), state === "waiting" ? sx(paint.s17) : sx(paint.s18)].filter(Boolean).join(" ")}>
            {lines.map((l, i) => (
              <Tip key={i} label={l} width="lg">
                <div className={sx(paint.s19)}>{l}</div>
              </Tip>
            ))}
          </div>
        )}
        {asking && <Answers box={box} session={session.name} choices={choices} />}
      </div>

      <footer className={sx(paint.s20)}>
        {!selecting && (
          <span className={sx(paint.s21)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Tip label="Stop agent…">
              <button
                type="button"
                aria-label={`Stop ${name} in ${place}`}
                onClick={() => confirmStop(entry)}
                className={sx(paint.s22)}
              >
                <SquareIcon className={sx(paint.s23)} />
              </button>
            </Tip>
          </span>
        )}
        <span className={sx(paint.s24)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <span className={sx(paint.s25)}><Button size="xs" variant="ghost"  onClick={open}>
            Open
          </Button></span>
          <span className={sx(paint.s26)}><Button size="xs" variant="ghost"  onClick={() => openOrchestrate("send", box, session.name)}>
            {state === "ready" ? "Prompt…" : "Reply…"}
          </Button></span>
          <SessionActions box={box} session={session.name}>
            <StopMenuItems entry={entry} />
          </SessionActions>
        </span>
      </footer>
    </article>
  );
}

// Answers are the agent's numbered options as buttons: one click types the
// number into its session, which is how Claude Code takes an answer.
function Answers({ box, session, choices }: { box: string; session: string; choices: Choice[] }) {
  const client = useStore((s) => s.client);
  const [sent, setSent] = useState<string>();
  const answer = async (c: Choice) => {
    if (!client) return;
    setSent(c.key);
    try {
      // The person is answering the question, so the box may type into it.
      await boxApi.send(client, box, session, c.key, false, { when: "now", force: true });
      toastManager.add({ title: `Answered ${c.key}`, description: c.label, type: "success" });
    } catch (err) {
      setSent(undefined);
      toastManager.add({ title: "Couldn't answer", description: errorMessage(err), type: "error" });
    }
  };
  return (
    <div className={sx(paint.s27)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {choices.map((c) => (
        // The whole answer when it is cut short.
        <Tip key={c.key} label={c.label.length > 28 ? c.label : undefined} wrapClassName={sx(paint.s35)}>
          <button
            type="button"
            disabled={!!sent}
            onClick={() => void answer(c)}
            className={[sx(paint.s28), sent === c.key && sx(paint.s29)].filter(Boolean).join(" ")}
          >
            <span className={sx(paint.s30)}>{c.key}</span>
            <span className={sx(paint.s31)}>{c.label.length > 28 ? `${c.label.slice(0, 27)}…` : c.label}</span>
          </button>
        </Tip>
      ))}
    </div>
  );
}
