import { ChevronRightIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { StepHeader } from "@/components/step-header";
import { Tip } from "@/components/tip";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DialogPanel } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { InstallCommand } from "@/views/onboarding/install-command";
import { NetworksStep } from "@/views/onboarding/networks-step";
import { PasteLink } from "@/views/onboarding/paste-link";
import { SshSetup } from "@/views/onboarding/ssh-setup";

// What the flow is doing, for onboarding's scene: arriving while it waits,
// the lighthouse while a box is being set up or paired, the signal lamp
// while signing in to another tailnet, moored once paired.
export type AddBoxStage = "start" | "working" | "tailnet" | "paired";

type From = "link" | "ssh";

// AddBoxFlow is every way to add a box, on one screen: run the install
// command on the box and paste the link it prints (works for any box), or
// let Berth set it up over SSH. Reaching a box on another tailnet is not a
// choice up front; it is offered when a box can't be reached. Onboarding and
// the Add a box dialog both show it under one StepHeader; onExit, when
// given, is where the back arrow leads from the first screen.
export function AddBoxFlow({
  intro,
  variant,
  onDone,
  onExit,
  onStage,
}: {
  intro: { title: ReactNode; description: ReactNode };
  variant: "dialog" | "page";
  onDone(box: string): void;
  onExit?(): void;
  onStage?(stage: AddBoxStage): void;
}) {
  const [signingIn, setSigningIn] = useState<From>();
  const [network, setNetwork] = useState<string>();
  const [sshOpen, setSshOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paired, setPaired] = useState<string>();
  // Bumped to make the path that was waiting on a tailnet try again.
  const [retry, setRetry] = useState({ link: 0, ssh: 0 });
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    onStage?.(paired ? "paired" : signingIn ? "tailnet" : busy ? "working" : "start");
  }, [onStage, paired, signingIn, busy]);

  // A beat on "Paired" before moving on.
  useEffect(() => {
    if (!paired) return;
    const t = setTimeout(() => done.current(paired), 900);
    return () => clearTimeout(t);
  }, [paired]);

  const head = signingIn
    ? {
        title: "Sign in to another tailnet",
        description: "For a box on a tailnet this computer isn't on: a personal one while this Mac is on work's, say. Berth joins it as its own device, so nothing changes for the rest of this Mac.",
      }
    : intro;
  const onBack = signingIn ? () => setSigningIn(undefined) : onExit;

  // The main screen stays mounted while signing in, hidden, so the pasted
  // link and the SSH host are still there to try again with.
  const body = (
    <>
      {signingIn && (
        <NetworksStep
          onPick={(joined) => {
            setNetwork(joined);
            setSigningIn(undefined);
            setRetry((r) => ({ ...r, [signingIn]: r[signingIn] + 1 }));
          }}
        />
      )}
      <div hidden={!!signingIn}>
        <Step n={1} title="On the box, run">
          <InstallCommand />
          <p className="mt-2 text-muted-foreground text-xs leading-relaxed">It installs berthd for your user (no root), starts it, and prints a pairing link.</p>
        </Step>
        <Step n={2} title="Paste what it printed" className="mt-5">
          <PasteLink network={network} retry={retry.link} autoFocus onBusy={setBusy} onPaired={setPaired} onSignIn={() => setSigningIn("link")} />
        </Step>

        {network && (
          <div className="mt-3 flex items-center gap-1.5 text-muted-foreground text-xs">
            Reaching boxes through the <span className="text-foreground">{network}</span> tailnet
            <Tip label="Use this computer's own network">
              <button type="button" aria-label="Use this computer's own network" className="rounded p-0.5 hover:bg-accent hover:text-foreground" onClick={() => setNetwork(undefined)}>
                <XIcon className="size-3" />
              </button>
            </Tip>
          </div>
        )}

        <Collapsible open={sshOpen} onOpenChange={setSshOpen} className="mt-6 border-t pt-4">
          <CollapsibleTrigger className="group flex w-full items-center gap-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            <ChevronRightIcon className="size-3.5 text-muted-foreground transition-transform group-data-panel-open:rotate-90" />
            Or let Berth set it up over SSH
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <div className="pt-3">
              <SshSetup network={network} retry={retry.ssh} onRunning={setBusy} onPaired={setPaired} onSignIn={() => setSigningIn("ssh")} />
            </div>
          </CollapsiblePanel>
        </Collapsible>
      </div>
    </>
  );

  if (variant === "dialog") {
    return (
      <>
        <StepHeader title={head.title} description={head.description} onBack={onBack} />
        <DialogPanel className="px-5 pb-5">{body}</DialogPanel>
      </>
    );
  }
  return (
    <div>
      <StepHeader variant="page" title={head.title} description={head.description} onBack={onBack} />
      <div className="mt-6">{body}</div>
    </div>
  );
}

function Step({ n, title, className, children }: { n: number; title: string; className?: string; children: ReactNode }) {
  return (
    <section className={className}>
      <h2 className="mb-2 flex items-center gap-2 text-sm">
        <span aria-hidden className="flex size-5 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground">
          {n}
        </span>
        {title}
      </h2>
      <div className={cn("ps-7")}>{children}</div>
    </section>
  );
}
