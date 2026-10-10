import * as stylex from "@stylexjs/stylex";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { create } from "zustand";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useStore } from "@/lib/store";
import { useWorkspaces } from "@/lib/workspaces";
import { resetDemo, startDemoScript } from "@/demo/script";

const paint = stylex.create({
  s0: {
    "position": "fixed",
    "bottom": "38px",
    "left": "12px",
    "zIndex": 40,
  },
  s1: {
    "boxShadow": "0 4px 6px color-mix(in oklab, var(--foreground) 10%, transparent)",
  },
  s2: {
    "position": "fixed",
    "bottom": "38px",
    "left": "12px",
    "zIndex": 40,
    "width": "17rem",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "color": "var(--popover-foreground)",
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s3: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
  },
  s4: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s5: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s6: {
    "fontSize": "11.5px",
    "color": "var(--muted-foreground)",
    "lineHeight": "1.375",
  },
  s7: {
    "marginTop": "calc(2px * -1)",
    "marginRight": "calc(6px * -1)",
  },
  s8: {
    "marginTop": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "12.5px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "4px",
    },
  },
  s9: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
  },
  s10: {
    "height": "18px",
    "minWidth": "18px",
    "fontSize": "11px",
  },
  s11: {
    "marginTop": "10px",
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "8px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s12: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s13: {
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
  },
  s14: {
    "borderColor": "color-mix(in oklab, var(--foreground) 70%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    "color": "var(--background)",
  },
  s15: {
    "borderColor": "var(--border)",
  },
  s16: {
    "width": "10px",
    "height": "10px",
  },
  s17: {
    "minWidth": "0px",
  },
  s18: {
    "color": "var(--muted-foreground)",
    "textDecoration": "line-through",
  },
  s19: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },

  s20: {
    textDecorationColor: "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The live demo's guide: three things to try, ticked off as you do them,
// and a way to start over. It sits bottom left, clear of the toasts, and
// folds down to one small button.

const CHECKOUT_FIX = "devl:/home/me/work/shop-checkout-fix";
const mac = /Mac|iPhone|iPad/.test(navigator.platform);

interface Steps {
  open: boolean;
  answer: boolean;
  palette: boolean;
}

const useSteps = create<Steps>(() => ({ open: false, answer: false, palette: false }));

// Ticks each step off for good the first time it happens.
function follow() {
  let waiting = new Set<string>();
  const seen = () => {
    const s = useStore.getState();
    const now = new Set<string>();
    for (const [box, data] of Object.entries(s.boxes)) {
      for (const x of data.sessions ?? []) {
        const k = `${box}/${x.name}`;
        if (x.agent_state === "waiting") now.add(k);
        else if (waiting.has(k)) useSteps.setState({ answer: true });
      }
    }
    waiting = now;
    if (s.paletteOpen) useSteps.setState({ palette: true });
    const ws = useWorkspaces.getState();
    if (s.view.kind === "workspace" && ws.current === CHECKOUT_FIX) useSteps.setState({ open: true });
  };
  const a = useStore.subscribe(seen);
  const b = useWorkspaces.subscribe(seen);
  return () => {
    a();
    b();
  };
}

// ?shots=1 is the website's poster (site/scripts/capture.mjs): the demo as
// it opens, without the guide or the script.
const shots = new URLSearchParams(location.search).has("shots");

export default function DemoGuide() {
  const steps = useSteps();
  const [folded, setFolded] = useState(false);
  const connected = useStore((s) => !!s.client);
  useEffect(() => {
    if (connected) startDemoScript(shots);
  }, [connected]);
  useEffect(follow, []);
  const done = steps.open && steps.answer && steps.palette;
  if (shots) return null;

  if (folded) {
    return (
      <div className={sx(paint.s0)}>
        <span className={sx(paint.s1)}><Button size="xs" variant="outline" onClick={() => setFolded(false)}>
          Demo guide
        </Button></span>
      </div>
    );
  }

  return (
    <section aria-labelledby="demo-guide-title" className={sx(paint.s2)}>
      <header className={sx(paint.s3)}>
        <div className={sx(paint.s4)}>
          <h2 id="demo-guide-title" className={sx(paint.s5)}>
            {done ? "That's the tour" : "Try the demo"}
          </h2>
          <p className={sx(paint.s6)}>Invented boxes and repositories; nothing runs.</p>
        </div>
        <Tip label="Fold the guide">
          <span className={sx(paint.s7)}><Button size="icon-xs" variant="ghost" aria-label="Fold the guide" onClick={() => setFolded(true)} muted>
            <XIcon />
          </Button></span>
        </Tip>
      </header>
      <ol className={sx(paint.s8)}>
        <Step done={steps.open}>
          Open <span className={sx(paint.s9)}>checkout-fix</span>
        </Step>
        <Step done={steps.answer}>Answer the waiting agent</Step>
        <Step done={steps.palette}>
          Press{" "}
          <span className={sx(paint.s10)}><Kbd>
            {mac ? "⌘" : "Ctrl"} K
          </Kbd></span>{" "}
          for every command
        </Step>
      </ol>
      <footer className={sx(paint.s11)}>
        <Button size="xs" variant="ghost" onClick={resetDemo} muted>
          <RotateCcwIcon />
          Reset demo
        </Button>
        {done && (
          <Button size="xs" variant="ghost" render={<a href="../#start" target="_top" />}>
            Get started
          </Button>
        )}
      </footer>
    </section>
  );
}

function Step({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className={sx(paint.s12)}>
      <span aria-hidden className={[sx(paint.s13), done ? sx(paint.s14) : sx(paint.s15)].filter(Boolean).join(" ")}>
        {done && <CheckIcon className={sx(paint.s16)} strokeWidth={3} />}
      </span>
      <span className={[sx(paint.s17), done && [sx(paint.s18), sx(paint.s20)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>{children}</span>
      <span className={sx(paint.s19)}>{done ? "(done)" : ""}</span>
    </li>
  );
}
