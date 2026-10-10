import * as stylex from "@stylexjs/stylex";
import { AsteriskIcon, CheckIcon, HexagonIcon, SparkleIcon, SquareTerminalIcon, TerminalIcon } from "lucide-react";

import { Tip } from "@/components/tip";
import type { SessionState } from "@/lib/derive";
import { useOutdated } from "@/lib/outdated";
import { BOX_WORDS, type BoxState, boxState, boxWhy, sessionWord } from "@/lib/state-model";
import { useStore } from "@/lib/store";

const paint = stylex.create({
  s0: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s1: {
    "color": "#d97757",
  },
  s2: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s3: {
    "color": "#6f9bff",
  },
  s4: {
    "flexShrink": 0,
    "fontWeight": 600,
    "color": "#a78bfa",
    "fontSize": "12px",
    "lineHeight": "1",
  },
  s5: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s6: {
    "color": "var(--muted-foreground)",
  },
  s7: {
    "display": "inline-flex",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s8: {
    "width": "10px",
    "height": "10px",
    "borderRadius": "999px",
    "borderWidth": "1.5px",
    "borderStyle": "solid",
    "borderColor": "var(--info)",
    "borderTopColor": "transparent",
  },
  s9: {
    "position": "relative",
    "display": "flex",
    "width": "8px",
    "height": "8px",
  },
  s10: {
    "position": "absolute",
    "display": "inline-flex",
    "width": "100%",
    "height": "100%",
    "borderRadius": "999px",
    "backgroundColor": "var(--warning)",
    "opacity": 0.6,
  },
  s11: {
    "position": "relative",
    "display": "inline-flex",
    "width": "8px",
    "height": "8px",
    "borderRadius": "999px",
    "backgroundColor": "var(--warning)",
  },
  s12: {
    "width": "12px",
    "height": "12px",
    "color": "var(--success)",
  },
  s13: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "999px",
    "borderWidth": "1.5px",
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
  },
  s14: {
    "width": "8px",
    "height": "8px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s15: {
    "backgroundColor": "var(--success)",
  },
  s16: {
    "backgroundColor": "color-mix(in oklab, var(--success) 45%, transparent)",
  },
  s17: {
    "backgroundColor": "var(--success)",
    "boxShadow": "0 0 0 2px var(--info)",
  },
  s18: {
    "backgroundColor": "var(--destructive)",
  },
  s19: {
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
  },
  s20: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s21: {
    "display": "inline-block",
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  n0: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  n1: {
    "display": "inline-flex",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  q22: {
    "backgroundColor": "var(--success)",
  },
  q23: {
    "backgroundColor": "color-mix(in oklab, var(--success) 45%, transparent)",
  },
  q24: {
    "backgroundColor": "var(--success)",
    "boxShadow": "0 0 0 4px var(--background), 0 0 0 calc(4px + 1.5px) var(--info)",
  },
  q25: {
    "backgroundColor": "var(--destructive)",
  },
  q26: {
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
  },
  q27: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// AgentIcon marks which agent a session runs, in the agent's own colour.
export function AgentIcon({ agent, className }: { agent?: string; className?: string }) {
  const cls = [sx(paint.n0), className].filter(Boolean).join(" ");
  switch (agent) {
    case "claude":
      return <AsteriskIcon className={[cls, sx(paint.s1)].filter(Boolean).join(" ")} strokeWidth={2.75} />;
    case "codex":
      return <HexagonIcon className={[cls, sx(paint.s2)].filter(Boolean).join(" ")} strokeWidth={2.25} />;
    case "gemini":
      return <SparkleIcon className={[cls, sx(paint.s3)].filter(Boolean).join(" ")} strokeWidth={2.25} />;
    case "pi":
      return <span className={[sx(paint.s4), className].filter(Boolean).join(" ")}>π</span>;
    case "opencode":
      return <SquareTerminalIcon className={[cls, sx(paint.s5)].filter(Boolean).join(" ")} />;
    default:
      return <TerminalIcon className={[cls, sx(paint.s6)].filter(Boolean).join(" ")} />;
  }
}

const stateLabel = (s: SessionState) => sessionWord(s);

// stateText is a session's state in the model's words (lib/state-model.ts):
// Working, Needs you, Done, Idle, Ended, or Shell.
export function stateText(state: SessionState) {
  return stateLabel(state);
}

// StateGlyph is a session's state at a glance: a blue spinner while working,
// an amber dot when it needs you (amber means that and nothing else), a check
// when done, a grey ring when idle, a grey dot once it has ended. Under
// reduced motion the spinner stands still as a broken ring and the dot does
// not ping. The sidebar, the rail, tabs, panes, zen, the dashboard and the
// palette all draw states with it, so they agree. It is named for screen
// readers; the row or card around it says it in words.
export function StateGlyph({ state, className }: { state: SessionState; className?: string }) {
  const box = [sx(paint.n1), className].filter(Boolean).join(" ");
  switch (state) {
    case "running":
      return (
        <span className={box} role="img" aria-label={stateLabel(state)}>
          <span className={[sx(paint.s8), "burf-spin"].filter(Boolean).join(" ")} />
        </span>
      );
    case "waiting":
      return (
        <span className={box} role="img" aria-label={stateLabel(state)}>
          <span className={sx(paint.s9)}>
            <span className={[sx(paint.s10), "burf-ping"].filter(Boolean).join(" ")} />
            <span className={sx(paint.s11)} />
          </span>
        </span>
      );
    case "finished":
      return (
        <span className={box} role="img" aria-label={stateLabel(state)}>
          <CheckIcon className={sx(paint.s12)} strokeWidth={3} />
        </span>
      );
    case "ready":
      return (
        <span className={box} role="img" aria-label={stateLabel(state)}>
          <span className={sx(paint.s13)} />
        </span>
      );
    case "exited":
      return (
        <span className={box} role="img" aria-label={stateLabel(state)}>
          <span className={sx(paint.s14)} />
        </span>
      );
    default:
      return null;
  }
}

// StatusDot is a box's state (lib/state-model.ts): green online, faded
// green when its link is slow, green with
// a blue ring when outdated, red when unreachable, a grey ring while
// connecting, grey when offline. Agent states (amber included) never use it.
export function StatusDot({ state, className }: { state?: BoxState | "untrusted"; className?: string }) {
  const s: BoxState = state === "untrusted" ? "unreachable" : (state ?? "offline");
  const color = {
    online: sx(paint.q22),
    // Still online: green, quieter.
    slow: sx(paint.q23),
    outdated: sx(paint.q24),
    unreachable: sx(paint.q25),
    connecting: [sx(paint.q26), "burf-pulse"].filter(Boolean).join(" "),
    offline: sx(paint.q27),
  }[s];
  return <span role="img" aria-label={BOX_WORDS[s].word} className={[sx(paint.s21), color, className].filter(Boolean).join(" ")} />;
}

// useBoxState is a box's state in the model, from everything the app knows.
export function useBoxState(box: string): BoxState {
  const status = useStore((s) => s.status?.boxes.find((b) => b.name === box));
  const data = useStore((s) => s.boxes[box]);
  const outdated = useOutdated((s) => !!s.boxes[box]?.outdated);
  return boxState(status, data, outdated);
}

// BoxStateDot is useBoxState as a dot, with why in a tooltip.
export function BoxStateDot({ box, className }: { box: string; className?: string }) {
  const state = useBoxState(box);
  const status = useStore((s) => s.status?.boxes.find((b) => b.name === box));
  return (
    <Tip label={boxWhy(box, status, state)}>
      <StatusDot state={state} className={className} />
    </Tip>
  );
}
