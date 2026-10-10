import * as stylex from "@stylexjs/stylex";
import { RotateCwIcon, ServerIcon } from "lucide-react";

import { Scene } from "@/components/art/scenes";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { startSession } from "@/lib/actions";
import { agentLabel, restartCommand } from "@/lib/derive";
import { retryLine } from "@/lib/net";
import { tryNow, useAway } from "@/lib/reconnect";
import { useStore } from "@/lib/store";
import { useWorkspaces } from "@/lib/workspaces";
import { useTitleAt } from "@/lib/worktree-names";

const paint = stylex.create({
  s0: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "padding": "24px",
  },
  s1: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "textAlign": "center",
  },
  s2: {
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--popover) 95%, transparent)",
    "paddingLeft": "32px",
    "paddingRight": "32px",
    "paddingTop": "24px",
    "paddingBottom": "20px",
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s3: {
    "marginBottom": "16px",
    "color": "color-mix(in oklab, var(--muted-foreground) 80%, transparent)",
  },
  s4: {
    "marginTop": "4px",
    "maxWidth": "100%",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s5: {
    "marginTop": "16px",
    "display": "flex",
    "gap": "8px",
  },
  s6: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s7: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "6px",
  },
  s8: {
    "flexShrink": 0,
  },
  s9: {
    "color": "color-mix(in oklab, var(--muted-foreground) 48%, transparent)",
  },
  s10: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--foreground) 72%, transparent)",
  },
  s11: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "color-mix(in oklab, var(--foreground) 72%, transparent)",
    "fontVariantNumeric": "tabular-nums",
  },
  s12: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },

  s13: {
    maxWidth: "24rem",
  },
  s14: {
    maxWidth: "20rem",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The states a terminal pane shows when there is nothing to attach to: the
// session ended, or its box is out of reach. Each is a small drawing, one
// line saying what happened, one saying where, and what to do next.

function PaneState({ art, title, detail, children, panel }: { art: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; children?: React.ReactNode; panel?: boolean }) {
  return (
    <div className={sx(paint.s0)}>
      <div className={[[sx(paint.s1), sx(paint.s13)].filter(Boolean).join(" "), panel && sx(paint.s2)].filter(Boolean).join(" ")}>
        <div className={sx(paint.s3)}>{art}</div>
        {title}
        {detail && <div className={sx(paint.s4)}>{detail}</div>}
        {children && <div className={sx(paint.s5)}>{children}</div>}
      </div>
    </div>
  );
}

// SessionEnded says what stopped and where, and offers to start the same
// thing again in the same worktree, in this pane.
export function SessionEnded({ box, session, agent, command, wsKey, tab, pane, onClose }: { box: string; session: string; agent?: string; command?: string; wsKey: string; tab: string; pane: string; onClose(): void }) {
  const ref = useWorkspaces((s) => s.spaces[wsKey]?.ref);
  const label = agent ? agentLabel(agent) : "Shell";
  const named = useTitleAt(ref?.box, ref?.path);
  const where = ref ? (named ?? (ref.main ? ref.location : ref.worktree)) : undefined;
  return (
    <PaneState
      art={<Scene name="ended" width={144} />}
      title={
        // Named as its tab named it; the session's id is for the curious.
        <Tip label={`${session} on ${box}`}>
          <p className={sx(paint.s6)}>{agent ? `${label} has ended` : "The shell has ended"}</p>
        </Tip>
      }
      detail={
        <p className={sx(paint.s7)}>
          <span className={sx(paint.s8)}>{where ? `${where} on ${box}` : `on ${box}`}</span>
          {command && (
            <>
              <span className={sx(paint.s9)}>·</span>
              <code className={sx(paint.s10)}>{command}</code>
            </>
          )}
        </p>
      }
    >
      <Button size="sm" onClick={() => void startSession(restartCommand(command) ?? "", { kind: "replace", tab, pane }, label)}>
        <RotateCwIcon />
        Start {agent ? label : "a shell"} again
      </Button>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Close pane
      </Button>
    </PaneState>
  );
}

// RetryLine counts down to the agent's next try of a box that is away
// ("Next try in 6s · away 1m 5s"), from the agent's status.
export function RetryLine({ box, className }: { box: string; className?: string }) {
  const line = retryLine(useAway(box));
  if (!line) return null;
  return (
    <span data-testid="retry-line" aria-live="polite" className={[sx(paint.s11), className].filter(Boolean).join(" ")}>
      {line}
    </span>
  );
}

// BoxOffline sits over the dimmed screen: the session is still running on
// the box, and Burf reattaches on its own when the box is back.
export function BoxOffline({ box, state, onRetry }: { box: string; state?: string; onRetry(): void }) {
  const title = state === "connecting" ? `Connecting to ${box}…` : state === "untrusted" ? `${box} is unreachable` : `Reconnecting to ${box}…`;
  const detail =
    state === "untrusted"
      ? "It answered with a different identity than when it was paired, so Burf won't talk to it. Pair it again if it was rebuilt."
      : "The session keeps running there, and this terminal comes back as it was.";
  return (
    <PaneState
      panel
      art={<Scene name="offline" width={128} />}
      title={<p className={sx(paint.s12)}>{title}</p>}
      detail={
        <>
          {state !== "untrusted" && <RetryLine box={box} />}
          <p className={sx(paint.s14)}>{detail}</p>
        </>
      }
    >
      <Button
        size="sm"
        onClick={() => {
          void tryNow(box);
          onRetry();
        }}
      >
        <RotateCwIcon />
        Try now
      </Button>
      <Button size="sm" variant="outline" onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })}>
        <ServerIcon />
        Boxes
      </Button>
    </PaneState>
  );
}
