import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";

import { StepHeader } from "@/components/step-header";
import { Button } from "@/components/ui/button";
import type { LocalBoxStatus } from "@/lib/local-box";
import type { AddBoxStage } from "@/views/onboarding/add-box-flow";
import { UseThisMac } from "@/views/onboarding/local-box";
import { thisComputer } from "@/lib/platform";

const paint = stylex.create({
  s0: {
    "marginTop": "24px",
  },
  s1: {
    "marginTop": "16px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s2: {
    "height": "auto",
    "padding": "0px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// ThisMacStep makes this Mac the box, at once: the person chose it on the
// welcome. The log shows each step; once paired it moves on by itself, and
// a remote box is still one click away.
export function ThisMacStep({ status, onStage, onDone, onRemote, onBack }: { status: LocalBoxStatus; onStage(s: AddBoxStage): void; onDone(box: string): void; onRemote(): void; onBack(): void }) {
  const [running, setRunning] = useState(true);
  const [paired, setPaired] = useState<string>();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => onStage(paired ? "paired" : running ? "working" : "start"), [onStage, paired, running]);
  // A beat on "Paired" before moving on.
  useEffect(() => {
    if (!paired) return;
    const t = setTimeout(() => done.current(paired), 700);
    return () => clearTimeout(t);
  }, [paired]);
  return (
    <div>
      <StepHeader
        variant="page"
        title={thisComputer("Setting up this Mac")}
        description={thisComputer("Burf installs berthd for your user, no password needed. It listens on this Mac only, so nothing opens to your network.")}
        onBack={running ? undefined : onBack}
      />
      <UseThisMac status={status} autoStart className={sx(paint.s0)} onRunning={setRunning} onPaired={setPaired} />
      <p className={sx(paint.s1)}>
        Rather run agents on a server?{" "}
        <span className={sx(paint.s2)}><Button variant="link" size="xs"  disabled={running && !paired} onClick={onRemote}>
          Connect a remote box
        </Button></span>
      </p>
    </div>
  );
}
