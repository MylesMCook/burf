import * as stylex from "@stylexjs/stylex";
import { CheckIcon, CopyIcon, PlayIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Scene } from "@/components/art/scenes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { type AgentBinary, findAgentBinary, retryConnection, startAgent } from "@/lib/agent-start";
import { plainError } from "@/lib/errors";

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
    "backgroundColor": "var(--background)",
  },
  s1: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "backgroundColor": "var(--background)",
  },
  s2: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "12px",
  },
  s3: {
    "width": "100%",
  },
  s4: {
    "display": "flex",
    "width": "100%",
    "alignItems": "flex-start",
    "gap": "10px",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "width": "100%",
    "textAlign": "left",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s7: {
    "width": "100%",
    "textAlign": "left",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "cursor": "default",
    "userSelect": "none",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s9: {
    "marginTop": "8px",
  },
  s10: {
    "width": "100%",
    "textAlign": "left",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "cursor": "default",
    "userSelect": "none",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s12: {
    "marginTop": "8px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "whiteSpace": "pre-wrap",
  },
  s13: {
    "marginTop": "8px",
  },
  s14: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "paddingRight": "4px",
    "paddingLeft": "12px",
    "textAlign": "left",
  },
  s15: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "fontFamily": "var(--font-mono)",
    "color": "var(--foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Any burf command starts the agent when it is not running.
const START = "burf status";

// How long to wait for a started agent to answer before saying so.
const ANSWER_TIMEOUT = 15_000;

// Connecting is shown until the laptop agent answers. When it is not
// running, the app offers to start it (asking before it installs anything
// that starts at login); without a burf command to run, it says how to
// start it from a terminal. Either way this window connects by itself once
// the agent is up.
export function Connecting({ state, error }: { state: string; error?: string }) {
  if (state === "connecting") {
    return (
      <div className={sx(paint.s0)}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Scene name="lighthouse" />
            </EmptyMedia>
            <EmptyTitle>Finding the Burf agent…</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  return <AgentOffline error={error} />;
}

type Phase = { kind: "idle" } | { kind: "starting" } | { kind: "waiting" } | { kind: "failed"; message: string };

function AgentOffline({ error }: { error?: string }) {
  // undefined while looking, null when there is no burf command to run.
  const [binary, setBinary] = useState<AgentBinary | null>();
  const [atLogin, setAtLogin] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  useEffect(() => {
    findAgentBinary().then(setBinary, () => setBinary(null));
  }, []);

  // This screen goes away once the agent answers; still here means it did not.
  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const t = window.setTimeout(
      () => setPhase({ kind: "failed", message: "The agent started, but Burf can't reach it on 127.0.0.1:1378. Its log, agent.log in Burf's state folder, says why." }),
      ANSWER_TIMEOUT,
    );
    return () => window.clearTimeout(t);
  }, [phase.kind]);

  const start = async () => {
    setPhase({ kind: "starting" });
    try {
      await startAgent(atLogin);
      setPhase({ kind: "waiting" });
      retryConnection();
    } catch (err) {
      setPhase({ kind: "failed", message: plainError(err) });
    }
  };

  const busy = phase.kind === "starting" || phase.kind === "waiting";
  return (
    <div className={sx(paint.s1)}>
      <Empty measure="md">
        <EmptyHeader>
          <EmptyMedia>
            <Scene name="offline" />
          </EmptyMedia>
          <EmptyTitle>The Burf agent isn't running</EmptyTitle>
          <EmptyDescription>
            {binary === null
              ? "It keeps your boxes connected while this window is closed. Run this in a terminal to start it; Burf connects as soon as it is up."
              : "It keeps your boxes connected while this window is closed, and keeps running after you quit Burf."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {binary === null && <TerminalCommand />}
          {binary && (
            <div className={sx(paint.s2)}>
              <span className={sx(paint.s3)}><Button  disabled={busy} onClick={() => void start()}>
                {busy ? <Spinner /> : <PlayIcon />}
                {phase.kind === "starting" ? "Starting the Burf agent…" : phase.kind === "waiting" ? "Connecting…" : "Start the Burf agent"}
              </Button></span>
              <label className={sx(paint.s4)}>
                <Checkbox offset checked={atLogin} disabled={busy} onCheckedChange={(v) => setAtLogin(!!v)} />
                <span>
                  Start at login
                  <span className={sx(paint.s5)}>Also starts it whenever you log in to this computer, and restarts it if it stops.</span>
                </span>
              </label>
              {phase.kind === "failed" && (
                <p role="alert" className={sx(paint.s6)}>
                  {phase.message}
                </p>
              )}
              <details className={sx(paint.s7)}>
                <summary className={sx(paint.s8)}>Start it from a terminal instead</summary>
                <div className={sx(paint.s9)}>
                  <TerminalCommand />
                </div>
              </details>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => location.reload()}>
            <RotateCwIcon />
            Retry now
          </Button>
          {error && (
            <details className={sx(paint.s10)}>
              <summary className={sx(paint.s11)}>Details</summary>
              <pre className={sx(paint.s12)}>{error}</pre>
              {binary && <p className={sx(paint.s13)}>Burf starts it with {binary.path}</p>}
            </details>
          )}
        </EmptyContent>
      </Empty>
    </div>
  );
}

function TerminalCommand() {
  const [copied, setCopied] = useState(false);
  return (
    <div className={sx(paint.s14)}>
      <code className={sx(paint.s15)}>{START}</code>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard?.writeText(START);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
