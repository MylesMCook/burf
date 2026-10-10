import * as stylex from "@stylexjs/stylex";
import { CheckIcon, LaptopIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { plainError } from "@/lib/errors";
import { localBoxApi, type LocalBoxStatus, useLocalBoxName } from "@/lib/local-box";
import { useStore } from "@/lib/store";
import { CommandLog } from "@/views/settings/command-log";
import { thisComputer } from "@/lib/platform";

const paint = stylex.create({
  s0: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s1: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "12px",
  },
  s2: {
    "marginTop": "2px",
    "display": "flex",
    "width": "32px",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "width": "16px",
    "height": "16px",
  },
  s4: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s5: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s6: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s7: {
    "display": "flex",
    "height": "28px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "color": "var(--success-foreground)",
  },
  s8: {
    "width": "16px",
    "height": "16px",
  },
  s9: {
    "flexShrink": 0,
  },
  s10: {
    "marginTop": "8px",
    "paddingInlineStart": "44px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s11: {
    "marginTop": "12px",
  },
  s12: {
    "marginTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "color": "var(--foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type State = "ready" | "running" | "done" | "failed";

// UseThisMac is Add a box's way to skip a server: this Mac becomes the box.
// One button installs the berthd Burf carries as a launch agent that
// listens on this Mac only, and pairs with it; the log shows each step as it
// happens. Without a tailnet to list it comes first; with one, it sits below
// the tailnet's machines, compact: a second choice after them. Either way it
// is one card, the same height until it runs.
export function UseThisMac({
  status,
  compact,
  autoFocus,
  autoStart,
  className,
  onRunning,
  onPaired,
}: {
  status: LocalBoxStatus;
  compact?: boolean;
  autoFocus?: boolean;
  // Start at once: the person already chose this Mac (onboarding).
  autoStart?: boolean;
  className?: string;
  onRunning(running: boolean): void;
  onPaired(box: string): void;
}) {
  const [state, setState] = useState<State>("ready");
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [paired, setPaired] = useState<string>();

  const run = async () => {
    const client = useStore.getState().client;
    if (!client) return;
    setState("running");
    setLines([]);
    setError(undefined);
    onRunning(true);
    try {
      const box = await localBoxApi.setUp(client, (l) => setLines((p) => [...p, l]));
      const name = box || status.name;
      useLocalBoxName.setState({ name });
      await useStore.getState().refreshStatus();
      setPaired(name);
      setState("done");
      onRunning(false);
      onPaired(name);
    } catch (err) {
      setError(plainError(err));
      setState("failed");
      onRunning(false);
    }
  };

  // Once, on arrival; StrictMode's second mount must not start it again.
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const reuse = status.installed && !status.owned;
  return (
    <section aria-labelledby="this-mac-heading" className={[sx(paint.s0), className].filter(Boolean).join(" ")}>
      <div className={sx(paint.s1)}>
        <span aria-hidden className={sx(paint.s2)}>
          <LaptopIcon className={sx(paint.s3)} />
        </span>
        <div className={sx(paint.s4)}>
          <h2 id="this-mac-heading" className={sx(paint.s5)}>
            {thisComputer("Use this Mac")}
          </h2>
          <p className={sx(paint.s6)} aria-live="polite">
            {autoStart
              ? state === "running"
                ? "Installing berthd and pairing with it. This takes a few seconds."
                : state === "failed"
                  ? "It stopped before pairing; the log below says where."
                  : state === "done"
                    ? "Ready. Next, a project for your first agent."
                    : thisComputer("Agents run here while this Mac is awake.")
              : thisComputer("No server yet? Agents run here, while this Mac is awake: they pause when it sleeps. You can add a server later.")}
          </p>
        </div>
        {state === "done" ? (
          <span className={sx(paint.s7)}>
            <CheckIcon className={sx(paint.s8)} /> Paired
          </span>
        ) : (
          <span className={sx(paint.s9)}><Button size="sm" variant="outline"  autoFocus={autoFocus} loading={state === "running"} onClick={() => void run()}>
            {state === "failed" ? "Try again" : thisComputer("Set up this Mac")}
          </Button></span>
        )}
      </div>
      {state === "ready" && !compact && (
        <p className={sx(paint.s10)}>
          {reuse ? "Uses the berthd already installed here. " : "Burf installs berthd for your user, no password needed. "}
          {thisComputer("It listens on this Mac only, so nothing opens to your network.")}
        </p>
      )}
      {state !== "ready" && <div className={sx(paint.s11)}><CommandLog lines={lines} done={state === "done"} error={error} /></div>}
      {state === "done" && paired && (
        <p className={sx(paint.s12)}>
          This Mac is <span className={sx(paint.s13)}>{paired}</span> in Burf.
        </p>
      )}
    </section>
  );
}
