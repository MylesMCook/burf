import { ArrowLeftIcon, ChevronRightIcon, LinkIcon, NetworkIcon, WaypointsIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Machine } from "@/lib/api";
import { LinkStep } from "@/views/onboarding/link-step";
import { NetworksStep } from "@/views/onboarding/networks-step";
import { TailnetStep } from "@/views/onboarding/tailnet-step";
import { Code } from "@/views/settings/rows";

type Step = { kind: "choose" } | { kind: "tailnet"; network?: string; picked?: { machine: Machine; user: string } } | { kind: "networks" } | { kind: "link" };

// AddBoxFlow is every way to add a box: from this computer's tailnet, from
// another tailnet Berth signs in to, or with a pairing link. Onboarding and
// the Add a box dialog both show it. There is one Back, at the top, and it
// always goes one step back; onExit, when given, is where Back leads from
// the first step.
export function AddBoxFlow({ onDone, onExit }: { onDone(box: string): void; onExit?(): void }) {
  const [step, setStep] = useState<Step>({ kind: "choose" });

  const back = () => {
    if (step.kind === "tailnet" && step.picked) setStep({ kind: "tailnet", network: step.network });
    else if (step.kind === "tailnet" && step.network) setStep({ kind: "networks" });
    else if (step.kind === "choose") onExit?.();
    else setStep({ kind: "choose" });
  };

  return (
    <div>
      {(step.kind !== "choose" || onExit) && (
        <Button size="xs" variant="ghost" className="-ml-2 mb-3 text-muted-foreground" onClick={back}>
          <ArrowLeftIcon /> Back
        </Button>
      )}
      {step.kind === "choose" && <Choose onPick={setStep} />}
      {step.kind === "tailnet" && (
        <TailnetStep network={step.network} picked={step.picked} onPick={(machine, user) => setStep({ kind: "tailnet", network: step.network, picked: { machine, user } })} onDone={onDone} />
      )}
      {step.kind === "networks" && <NetworksStep onPick={(network) => setStep({ kind: "tailnet", network })} />}
      {step.kind === "link" && <LinkStep onDone={onDone} />}
    </div>
  );
}

function Choose({ onPick }: { onPick(step: Step): void }) {
  return (
    <div className="space-y-2">
      <Option icon={<WaypointsIcon />} title="On my tailnet" description="A machine this computer reaches over Tailscale. Berth installs itself over SSH and pairs." onClick={() => onPick({ kind: "tailnet" })} />
      <Option icon={<NetworkIcon />} title="On another tailnet" description="A personal tailnet while this Mac is on work's, say. You sign in once in the browser." onClick={() => onPick({ kind: "networks" })} />
      <Option
        icon={<LinkIcon />}
        title="Paste a pairing link"
        description={
          <>
            From <Code>berthd pair</Code>, on a box that already runs Berth.
          </>
        }
        onClick={() => onPick({ kind: "link" })}
      />
    </div>
  );
}

function Option({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: ReactNode; onClick(): void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl border bg-card/40 px-4 py-3.5 text-left outline-none transition-colors hover:border-foreground/20 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground [&_svg]:size-4.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{title}</span>
        <span className="mt-0.5 block text-muted-foreground text-xs leading-relaxed">{description}</span>
      </span>
      <ChevronRightIcon className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
