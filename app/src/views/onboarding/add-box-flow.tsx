import * as stylex from "@stylexjs/stylex";
import { ChevronRightIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { StepHeader } from "@/components/step-header";
import { Tip } from "@/components/tip";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DialogPanel } from "@/components/ui/dialog";
import { offerLocalBox, useLocalBox } from "@/lib/local-box";
import { useStore } from "@/lib/store";
import { InstallCommand } from "@/views/onboarding/install-command";
import { UseThisMac } from "@/views/onboarding/local-box";
import { NetworksStep } from "@/views/onboarding/networks-step";
import { PasteLink } from "@/views/onboarding/paste-link";
import { SshSetup } from "@/views/onboarding/ssh-setup";
import { boxable, sourcesOf, useTailnets } from "@/views/onboarding/tailnet";
import { TailnetMachines, UseTailscale } from "@/views/onboarding/tailnet-machines";

const paint = stylex.create({
  s0: {
    "marginTop": "12px",
  },
  s1: {
    "marginTop": "24px",
    "marginBottom": "24px",
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s2: {
    "height": "1px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "var(--border)",
  },
  s3: {
    "height": "1px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "var(--border)",
  },
  s4: {
    "marginTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s5: {
    "marginTop": "20px",
  },
  s6: {
    "marginTop": "12px",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "color": "var(--foreground)",
  },
  s8: {
    "borderRadius": "var(--radius-md)",
    "padding": "2px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s9: {
    "width": "12px",
    "height": "12px",
  },
  s10: {
    "marginTop": "24px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingTop": "16px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s11: {
    "paddingTop": "12px",
  },
  s12: {
    "paddingTop": "12px",
  },
  s13: {
    "marginTop": "24px",
  },
  s14: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
    ":is(.group:is([data-state=panel-open], [data-panel-open]) &)": {
      "transform": "rotate(90deg)",
    },
  },
  s15: {
    "marginBottom": "8px",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s16: {
    "display": "flex",
    "width": "20px",
    "height": "20px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s17: {
    "paddingInlineStart": "28px",
  },

  s18: {
    top: 0,
  },
  s19: {
    marginTop: 12,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// What the flow is doing, for onboarding's scene: arriving while it waits,
// the lighthouse while a box is being set up or paired, the signal lamp
// while signing in to another tailnet, moored once paired.
export type AddBoxStage = "start" | "working" | "tailnet" | "paired";

type From = "link" | "ssh" | "tailnet";

// AddBoxFlow is every way to add a box, on one screen. When this computer
// reaches a tailnet (its own Tailscale, or one Burf signed in to), that
// tailnet's machines come first, each set up in a click; then the install
// command to run on any box and the field for the link it prints; then
// setting a box up over SSH by hand. Without a tailnet, the tailnet path
// sits below the command as "Or use Tailscale". Use this Mac (local-box.tsx),
// when this computer can be a box and isn't one yet, comes first without a
// tailnet and right below its machines with one. The screen is laid out once,
// when it knows which, and keeps that layout. Onboarding and the Add a box
// dialog both show it under one StepHeader; onExit, when given, is where the
// back arrow leads from the first screen.
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
  const [tailscaleOpen, setTailscaleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paired, setPaired] = useState<string>();
  // Bumped to make the path that was waiting on a tailnet try again.
  const [retry, setRetry] = useState({ link: 0, ssh: 0 });
  const done = useRef(onDone);
  done.current = onDone;
  const sshSupported = useStore((s) => !s.status || !("ssh_setup_supported" in s.status) || s.status.ssh_setup_supported !== false);
  const readyLabel = variant === "page" ? "Continue" : undefined;

  const tailnets = useTailnets();
  const sources = sourcesOf(tailnets.system, tailnets.networks);
  const [source, setSource] = useState<string>();
  // Where the tailnet's machines go, decided once: first when there are
  // machines to show, else below the command.
  const [placement, setPlacement] = useState<"top" | "bottom">();
  // Whether to offer this Mac itself, decided with the placement.
  const local = useLocalBox();
  const [thisMac, setThisMac] = useState(false);
  useEffect(() => {
    if (placement || !tailnets.ready || !local.ready) return;
    setPlacement(boxable(tailnets.system) || tailnets.networks.length > 0 ? "top" : "bottom");
    setThisMac(offerLocalBox(local.status));
  }, [placement, tailnets.ready, tailnets.system, tailnets.networks, local.ready, local.status]);

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
        description: "For a box on a tailnet this computer isn't on. Burf joins it as its own device, so nothing changes for the rest of this computer.",
      }
    : intro;
  const onBack = signingIn ? () => setSigningIn(undefined) : onExit;

  const machines = sources.length > 0 && (
    <TailnetMachines
      sources={sources}
      system={tailnets.system}
      active={source ?? sources[0].key}
      onActive={setSource}
      autoFocus={placement === "top"}
      onRunning={setBusy}
      onPaired={setPaired}
      onSignIn={() => setSigningIn("tailnet")}
      readyLabel={readyLabel}
    />
  );

  const useThisMac = thisMac && local.status && (
    <UseThisMac status={local.status} compact={placement === "top"} autoFocus={placement === "bottom"} className={placement === sx(paint.s18) ? sx(paint.s19) : undefined} onRunning={setBusy} onPaired={setPaired} />
  );
  const anyBox = (
    <div aria-hidden className={sx(paint.s1)}>
      <span className={sx(paint.s2)} />
      or, on any box
      <span className={sx(paint.s3)} />
    </div>
  );

  // The main screen stays mounted while signing in, hidden, so the pasted
  // link and the SSH host are still there to try again with.
  const body = (
    <>
      {signingIn && (
        <NetworksStep
          onPick={(joined) => {
            if (signingIn === "tailnet") {
              // Its machines, in the list.
              setSource(`network:${joined}`);
              setTailscaleOpen(true);
              tailnets.refresh();
            } else {
              setNetwork(joined);
              setRetry((r) => ({ ...r, [signingIn]: r[signingIn] + 1 }));
            }
            setSigningIn(undefined);
          }}
        />
      )}
      {placement && (
        <div hidden={!!signingIn}>
          {placement === "top" && (
            <>
              {machines}
              {useThisMac}
              {anyBox}
            </>
          )}
          {placement === "bottom" && useThisMac && (
            <>
              {useThisMac}
              {anyBox}
            </>
          )}
          <Step n={1} title="On the box, run">
            <InstallCommand />
            <p className={sx(paint.s4)}>It installs berthd for your user (no root), starts it, and prints a pairing link.</p>
          </Step>
          <Step n={2} title="Paste what it printed" className={sx(paint.s5)}>
            <PasteLink network={network} retry={retry.link} autoFocus={placement === "bottom" && !useThisMac} onBusy={setBusy} onPaired={setPaired} onSignIn={() => setSigningIn("link")} />
          </Step>

          {network && (
            <div className={sx(paint.s6)}>
              Reaching boxes through the <span className={sx(paint.s7)}>{network}</span> tailnet
              <Tip label="Use this computer's own network">
                <button type="button" aria-label="Use this computer's own network" className={sx(paint.s8)} onClick={() => setNetwork(undefined)}>
                  <XIcon className={sx(paint.s9)} />
                </button>
              </Tip>
            </div>
          )}

          <div className={sx(paint.s10)}>
            {placement === "bottom" && (
              <Collapsible open={tailscaleOpen} onOpenChange={setTailscaleOpen}>
                <Trigger>Or use Tailscale</Trigger>
                <CollapsiblePanel>
                  <div className={sx(paint.s11)}>{machines || <UseTailscale system={tailnets.system} onRefresh={tailnets.refresh} onSignIn={() => setSigningIn("tailnet")} />}</div>
                </CollapsiblePanel>
              </Collapsible>
            )}
            {sshSupported && <Collapsible open={sshOpen} onOpenChange={setSshOpen}>
              <Trigger>Or let Burf set it up over SSH</Trigger>
              <CollapsiblePanel>
                <div className={sx(paint.s12)}>
                  <SshSetup network={network} retry={retry.ssh} onRunning={setBusy} onPaired={setPaired} onSignIn={() => setSigningIn("ssh")} readyLabel={readyLabel} />
                </div>
              </CollapsiblePanel>
            </Collapsible>}
          </div>
        </div>
      )}
    </>
  );

  if (variant === "dialog") {
    return (
      <>
        <StepHeader title={head.title} description={head.description} onBack={onBack} />
        <DialogPanel inset="body">{body}</DialogPanel>
      </>
    );
  }
  return (
    <div>
      <StepHeader variant="page" title={head.title} description={head.description} onBack={onBack} />
      <div className={sx(paint.s13)}>{body}</div>
    </div>
  );
}

function Trigger({ children }: { children: ReactNode }) {
  return (
    <CollapsibleTrigger look="row" marker="group">
      <ChevronRightIcon className={sx(paint.s14)} />
      {children}
    </CollapsibleTrigger>
  );
}

function Step({ n, title, className, children }: { n: number; title: string; className?: string; children: ReactNode }) {
  return (
    <section className={className}>
      <h2 className={sx(paint.s15)}>
        <span aria-hidden className={sx(paint.s16)}>
          {n}
        </span>
        {title}
      </h2>
      <div className={sx(paint.s17)}>{children}</div>
    </section>
  );
}
