import "@/views/onboarding/onboarding.css";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AddBoxFlow } from "@/views/onboarding/add-box-flow";
import { AgentStep } from "@/views/onboarding/agent-step";
import { finishOnboarding, markOnboardingStarted } from "@/views/onboarding/onboarding-state";
import { RepoStep } from "@/views/onboarding/repo-step";
import { WelcomeStep } from "@/views/onboarding/welcome-step";

type Step = { kind: "welcome" } | { kind: "box" } | { kind: "repo"; box: string } | { kind: "agent"; box: string; location: string };

const ORDER: Step["kind"][] = ["welcome", "box", "repo", "agent"];

// OnboardingView takes a new account from nothing to a running agent, one
// calm step at a time. It fills the main area until finished.
export function OnboardingView() {
  const hasBoxes = useStore((s) => (s.status?.boxes.length ?? 0) > 0);
  const [step, setStep] = useState<Step>({ kind: "welcome" });

  useEffect(markOnboardingStarted, []);

  const finish = () => {
    finishOnboarding();
    useStore.getState().setView({ kind: "workspace" });
  };

  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-background">
      {/* Anchored at the top, as the launcher is: steps differ in height, and
          centring them would move each title as the step changes. */}
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 pt-[18vh] pb-16">
        <div className="mb-10 flex items-center">
          <Progress at={step.kind} />
          {/* Skipping makes sense once there is a box to work on. */}
          {hasBoxes && (
            <Button size="xs" variant="ghost" className="-mr-2 ml-auto text-muted-foreground" onClick={finish}>
              Skip setup
            </Button>
          )}
        </div>
        <div key={step.kind} className="onboarding-step">
          {step.kind === "welcome" && <WelcomeStep onNext={() => setStep({ kind: "box" })} />}
          {step.kind === "box" && (
            <AddBoxFlow
              variant="page"
              intro={{ title: "Where are your boxes?", description: "Berth installs a small daemon on the box. It's the only thing that runs there; your code and agents stay as they are." }}
              onDone={(box) => setStep({ kind: "repo", box })}
              onExit={() => setStep({ kind: "welcome" })}
            />
          )}
          {step.kind === "repo" && <RepoStep box={step.box} onDone={(location) => setStep({ kind: "agent", box: step.box, location })} />}
          {step.kind === "agent" && <AgentStep box={step.box} location={step.location} onFinish={finish} />}
        </div>
      </div>
    </div>
  );
}

function Progress({ at }: { at: Step["kind"] }) {
  const i = ORDER.indexOf(at);
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${i + 1} of ${ORDER.length}`}>
      {ORDER.map((k, n) => (
        <span key={k} className={cn("h-1 rounded-full transition-all duration-300", n === i ? "w-6 bg-foreground" : n < i ? "w-3 bg-foreground/50" : "w-3 bg-foreground/15")} />
      ))}
    </div>
  );
}
