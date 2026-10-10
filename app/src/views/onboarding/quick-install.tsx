import * as stylex from "@stylexjs/stylex";
import { ArrowRightIcon, ChevronRightIcon, KeyRoundIcon, RotateCwIcon, ServerIcon, SquareTerminalIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { type AgentChoice, type GuidedInstallRequest, laptopApi } from "@/lib/api";
import { useStore } from "@/lib/store";
import { CommandLine, type InstallRun, type InstallTarget, InstallTerminal, type StepRow, StepIcon, useInstallRun } from "@/views/onboarding/guided-install";
import { FailurePanel } from "@/views/onboarding/ssh-setup";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
  },
  s1: {
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
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "color": "var(--muted-foreground)",
  },
  s2: {
    "width": "16px",
    "height": "16px",
  },
  s3: {
    "minWidth": "0px",
  },
  s4: {
    "marginLeft": "calc(8px * -1)",
    "marginRight": "calc(8px * -1)",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "2px",
    },
  },
  s5: {
    "marginTop": "12px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--info) 6%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s6: {
    "fontWeight": 500,
  },
  s7: {
    "marginTop": "8px",
    "display": "flex",
    "height": "176px",
    "flexDirection": "column",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s8: {
    "marginTop": "12px",
  },
  s9: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "width": "14px",
    "height": "14px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s11: {
    "transform": "rotate(90deg)",
  },
  s12: {
    "marginTop": "8px",
    "display": "flex",
    "height": "176px",
    "flexDirection": "column",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s13: {
    "marginTop": "12px",
  },
  s14: {
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s15: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
  },
  s16: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 6%, transparent)",
  },
  s17: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "10px",
  },
  s18: {
    "flexShrink": 0,
    "fontSize": "13px",
  },
  s19: {
    "color": "var(--muted-foreground)",
  },
  s20: {
    "fontWeight": 500,
  },
  s21: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "marginInlineStart": "auto",
  },
  s23: {
    "marginTop": "4px",
    "marginLeft": "30px",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s24: {
    "marginTop": "6px",
    "marginLeft": "30px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s25: {
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s26: {
    "marginTop": "6px",
    "marginLeft": "30px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s27: {
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s28: {
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "8px",
  },
  s29: {
    "marginTop": "8px",
    "height": "16px",
  },
  s30: {
    "marginTop": "8px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s31: {
    "color": "var(--muted-foreground)",
  },
  s32: {
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "6px",
  },
  s33: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// QuickInstall is adding a box the usual way: no plan to read, no Enter to
// press. Once the person has said where (and which agents), burf add ssh
// runs quietly and this compact dialog shows a short checklist. Only a step
// that truly needs the person opens the terminal, inline, for just that
// step: sudo asking for the password (git missing, or lingering the box
// won't allow without root), whether to keep berthd running after logout
// when that alone needs the password (it can be skipped), or a question
// the box can't answer for them.

export function QuickInstall({ target, onClose, onReady, readyLabel }: { target?: InstallTarget & { agents: string[] }; onClose(): void; onReady(box: string): void; readyLabel?: string }) {
  const run = useInstallRun();
  const busy = run.state === "running";
  const host = target?.host ?? "";
  const where = host.split("@").pop() ?? host;
  const user = host.includes("@") ? host.slice(0, host.lastIndexOf("@")) : "your user";
  const [identity, setIdentity] = useState(target?.identity ?? "");
  const [output, setOutput] = useState(false);
  const ready = run.state === "done" && !!run.box;
  const failed = run.steps.find((s) => s.state === "fail");
  const go = useRef<HTMLButtonElement>(null);

  const request = (more: Partial<GuidedInstallRequest> = {}) => ({ ...target!, identity: identity || target!.identity, knownHostKeys: target!.knownHostKeys, ...more }) as GuidedInstallRequest;
  useEffect(() => {
    if (!target) {
      run.reset();
      setOutput(false);
      return;
    }
    run.start(request());
    // A new target starts again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.host]);
  useEffect(() => {
    if (ready) go.current?.focus();
  }, [ready]);

  // The step the person is needed for, if any: the terminal shows for it.
  const needed = run.steps.find((s) => s.state === "running" && (s.needs === "password" || run.waiting === "password"));
  const asking = run.steps.find((s) => s.state === "running" && s.needs === "ask");
  const question = !needed && !asking && run.waiting === "enter";
  const showTerminal = busy && (!!needed || question);

  const title = ready ? `${run.box} is ready` : run.state === "failed" ? `${where} isn't set up yet` : `Setting up ${where}`;
  const sub = ready
    ? "Paired with this computer. Burf no longer needs SSH for it."
    : needed
      ? `sudo needs ${user}'s password on ${where} for this step.`
      : asking
        ? "One question before Burf goes on."
        : run.state === "failed"
          ? "It stopped at the step below. The steps before it are kept."
          : "Burf installs what the box needs. It only stops if sudo needs your password.";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogPopup data-testid="quick-install" data-state={ready ? "ready" : run.state} data-needs={needed ? "password" : asking ? "ask" : question ? "answer" : ""} showCloseButton={!busy} width={showTerminal || output ? "2xl" : "md"}>
        <DialogHeader pad="short">
          <div className={sx(paint.s0)}>
            <span className={sx(paint.s1)}>
              <ServerIcon className={sx(paint.s2)} />
            </span>
            <div className={sx(paint.s3)}>
              <DialogTitle size="tight" truncate>{title}</DialogTitle>
              <DialogDescription nudge size="xs">{sub}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogPanel>
          <ol data-testid="quick-steps" className={sx(paint.s4)}>
            {run.steps.map((s) => (
              <QuickRow key={s.id} step={s} run={run} host={where} user={user} busy={busy} agents={target?.agents ?? []} needed={needed?.id === s.id} onRetry={() => run.start(request(), s.id === "connect" ? undefined : s.id)} />
            ))}
          </ol>
          {question && (
            <div data-testid="quick-question" className={sx(paint.s5)}>
              <span className={sx(paint.s6)}>{where} needs an answer.</span> Answer in the terminal below and press <Kbd>↵</Kbd>.
            </div>
          )}
          {showTerminal && (
            <div className={sx(paint.s7)} data-testid="quick-terminal">
              <InstallTerminal run={run} fontSize={11.5} />
            </div>
          )}
          {run.failure && run.state === "failed" && <FailurePanel failure={run.failure} identity={identity} setIdentity={setIdentity} onRetry={(trust) => run.start(request({ trust_host_key: trust ?? target?.trust_host_key }))} />}
          {run.state === "failed" && !showTerminal && (
            <div className={sx(paint.s8)}>
              <button type="button" className={sx(paint.s9)} aria-expanded={output} onClick={() => setOutput((o) => !o)}>
                <ChevronRightIcon className={[sx(paint.s10), output && sx(paint.s11)].filter(Boolean).join(" ")} /> {output ? "Hide" : "Show"} what the box printed
              </button>
              {output && (
                <div className={sx(paint.s12)} data-testid="quick-output">
                  <InstallTerminal run={run} fontSize={11.5} />
                </div>
              )}
            </div>
          )}
          {run.state === "failed" && !failed && !run.failure && (
            <span className={sx(paint.s13)}><Button size="sm" variant="outline"  onClick={() => run.start(request())}>
              <RotateCwIcon /> Start again
            </Button></span>
          )}
        </DialogPanel>
        <DialogFooter>
          {busy ? (
            <Button variant="ghost" data-testid="quick-stop" onClick={run.stop}>
              Stop
            </Button>
          ) : ready ? (
            <Button ref={go} data-testid="quick-continue" onClick={() => run.box && onReady(run.box)}>
              {readyLabel ?? `Go to ${run.box}`} <ArrowRightIcon />
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

// What each step does, in a few words, beside its title.
function hint(s: StepRow, agents: string[]): string | undefined {
  switch (s.id) {
    case "berthd":
      return "as your own user service";
    case "linger":
      return "so berthd runs after you log out";
    case "tools":
      return s.sudo ? "git, with sudo" : "Burf's own tmux, no sudo";
    case "agents":
      return agents.length === 1 ? "into ~/.local/bin, no sudo" : `${agents.length} agents, no sudo`;
    case "integrations":
      return "hooks and skills";
    case "pair":
      return "keys pinned both ways";
  }
  return undefined;
}

function QuickRow({ step: s, run, host, user, busy, agents, needed, onRetry }: { step: StepRow; run: InstallRun; host: string; user: string; busy: boolean; agents: string[]; needed: boolean; onRetry(): void }) {
  // What it did, where that says more than the hint: who it connected as,
  // lingering on without sudo, or why a step was skipped.
  const message = s.state === "skip" ? s.message?.replace(/^skipped: /, "") : (s.id === "connect" || s.id === "linger") && s.state === "done" ? s.message : undefined;
  return (
    <li data-testid={`quick-step-${s.id}`} data-state={s.state} data-needs={s.needs ?? ""} className={[sx(paint.s14), (needed || s.needs === "ask") && sx(paint.s15), s.state === "fail" && sx(paint.s16)].filter(Boolean).join(" ")}>
      <div className={sx(paint.s17)}>
        <StepIcon state={s.state} />
        <span className={[sx(paint.s18), (s.state === "todo" || s.state === "skip") && sx(paint.s19), s.state === "running" && sx(paint.s20)].filter(Boolean).join(" ")}>{s.id === "tools" ? "tmux and git" : s.title}</span>
        <span className={sx(paint.s21)}>{message ?? hint(s, agents)}</span>
        {s.sudo && s.state !== "skip" && (
          <span className={sx(paint.s22)}><Badge variant="warning" size="sm">
            <KeyRoundIcon /> sudo
          </Badge></span>
        )}
      </div>
      {needed && (
        <p data-testid="quick-password" className={sx(paint.s23)}>
          Type it in the terminal below and press <Kbd>↵</Kbd>; nothing shows as you type. It goes to sudo on {host}: Burf never sees it or keeps it.
        </p>
      )}
      {s.needs === "ask" && s.state === "running" && <LingerChoice run={run} user={user} host={host} question={s.question} />}
      {s.state === "fail" && (
        <div className={sx(paint.s24)}>
          {s.message && <p className={sx(paint.s25)}>{s.message}</p>}
          {s.command && <CommandLine command={s.command} />}
          {!busy && (
            <Button size="xs" data-testid={`quick-retry-${s.id}`} onClick={onRetry}>
              <RotateCwIcon /> Retry from here
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

// LingerChoice: keeping berthd running after logout needs root on this box
// and nothing else does, so the person decides: type the password once, or
// skip it and know what that means.
function LingerChoice({ run, user, host }: { run: InstallRun; user: string; host: string; question?: string }) {
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => yes.current?.focus(), []);
  return (
    <div data-testid="quick-linger" className={sx(paint.s26)}>
      <p className={sx(paint.s27)}>
        {host} needs root to keep berthd running after you log out: sudo asks for {user}'s password, once. Without it, berthd stops when your last login there ends, and the box goes offline until you log in again.
      </p>
      <div className={sx(paint.s28)}>
        <Button ref={yes} size="xs" data-testid="quick-linger-yes" onClick={() => run.answer("linger", true)}>
          <SquareTerminalIcon /> Keep it running
        </Button>
        <Button size="xs" variant="ghost" data-testid="quick-linger-skip" onClick={() => run.answer("linger", false)}>
          Skip
        </Button>
      </div>
    </div>
  );
}

// InlineAgents is the agents choice beside the SSH field: Claude Code ticked
// the first time, the choice remembered for the next box.
export function InlineAgents({ value, onChange, disabled }: { value: string[]; onChange(ids: string[]): void; disabled?: boolean }) {
  const offered = useAgentCatalog().filter((a) => a.offered);
  if (!offered.length) return <div className={sx(paint.s29)} />;
  return (
    <div data-testid="inline-agents" className={sx(paint.s30)}>
      <span className={sx(paint.s31)}>Agents</span>
      {offered.map((a) => {
        const on = value.includes(a.id);
        return (
          <label key={a.id} data-testid={`inline-agent-${a.id}`} data-checked={on || undefined} className={sx(paint.s32)}>
            <Checkbox checked={on} disabled={disabled} aria-label={a.name} onCheckedChange={(c) => onChange(c ? [...value.filter((v) => v !== a.id), a.id].sort((x, y) => order(x) - order(y)) : value.filter((v) => v !== a.id))} />
            {a.name}
          </label>
        );
      })}
      {busyHint(value)}
    </div>
  );
}

const ORDER = ["claude", "codex", "cursor", "opencode"];
const order = (id: string) => (ORDER.indexOf(id) + 1 || 99) as number;
const busyHint = (v: string[]) => (v.length === 0 ? <span className={sx(paint.s33)}>none: add them later in Settings</span> : null);

// The agent CLIs Burf can install, as the laptop agent lists them; asked
// once per window.
let catalog: Promise<AgentChoice[]> | undefined;
function useAgentCatalog(): AgentChoice[] {
  const client = useStore((s) => s.client);
  const [list, setList] = useState<AgentChoice[]>([]);
  useEffect(() => {
    if (!client) return;
    let live = true;
    catalog ??= laptopApi.installPlan(client, "me@box", []).then(
      (p) => p.agents,
      () => {
        catalog = undefined;
        return [];
      },
    );
    void catalog.then((a) => live && setList(a));
    return () => {
      live = false;
    };
  }, [client]);
  return list;
}
