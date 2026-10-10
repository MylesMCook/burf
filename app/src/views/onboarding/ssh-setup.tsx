import * as stylex from "@stylexjs/stylex";
import { KeyRoundIcon, MonitorIcon, ServerIcon, ShieldAlertIcon, TerminalIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { laptopApi, type SshFailure, type SshPlan } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useAgentChoice, useInstallTarget } from "@/views/onboarding/guided-install";
import { InlineAgents, QuickInstall } from "@/views/onboarding/quick-install";
import { InstallCommand } from "@/views/onboarding/install-command";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "40px",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--input)",
      ":focus-within": "var(--ring)",
    },
    "backgroundColor": {
      "default": "light-dark(var(--background), color-mix(in oklab, var(--input) 32%, transparent))",
    },
    "paddingInlineStart": "12px",
    "paddingInlineEnd": "4px",
    "boxShadow": {
      "default": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
      ":focus-within": "0 0 0 2px color-mix(in oklab, var(--ring) 24%, transparent)",
    },
  },
  s1: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s2: {
    "height": "100%",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "transparent",
    "fontFamily": {
      "default": "var(--font-mono)",
      "::placeholder": "var(--font-sans)",
    },
    "fontSize": {
      "default": "13px",
      "::placeholder": "14px",
    },
    "outline": "none",
    "color": {
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
    },
    "lineHeight": {
      "::placeholder": "20px",
    },
    "opacity": {
      ":disabled": 0.64,
    },
  },
  s3: {
    "flexShrink": 0,
  },
  s4: {
    "marginTop": "8px",
    "display": "flex",
    "minHeight": "20px",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "20px",
  },
  s5: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s6: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s7: {
    "fontFamily": "var(--font-mono)",
  },
  s8: {
    "marginInlineStart": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s9: {
    "height": "20px",
    "width": "128px",
    "borderColor": {
      "default": "var(--input)",
      ":focus": "var(--ring)",
    },
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "transparent",
    "paddingLeft": "2px",
    "paddingRight": "2px",
    "color": {
      "default": "var(--foreground)",
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
    },
    "outline": "none",
  },
  s10: {
    "marginTop": "4px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "padding": "4px",
  },
  s11: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "textAlign": "left",
  },
  s12: {
    "backgroundColor": "var(--accent)",
  },
  s13: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s14: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s15: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "12.5px",
  },
  s16: {
    "marginInlineStart": "auto",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "2px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s18: {
    "marginInlineStart": "4px",
  },
  s19: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "color": "var(--foreground)",
    "textDecoration": {
      "default": "underline",
      ":hover": "none",
    },
  },
  s21: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "fontFamily": "var(--font-mono)",
  },
  s23: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s24: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "overflowWrap": "anywhere",
  },
  s25: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "display": "flex",
    "gap": "8px",
  },
  s27: {
    "alignSelf": "flex-start",
  },
  s28: {
    "marginTop": "8px",
    "display": "flex",
    "flexDirection": "column",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "padding": "12px",
  },
  s29: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s30: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--destructive-foreground)",
  },
  s31: {
    "color": "var(--destructive-foreground)",
  },

  s32: {
    textUnderlineOffset: 2,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type Suggestion = { value: string; label: string; detail: string; os?: string; network?: string };
export type Failure = SshFailure | { kind: "plain"; message: string };

// SshSetup is the other way to add a box: Burf connects over SSH once from
// this computer, with the person's own keys and agent, uploads berthd, runs
// the same `berthd install` the install command does, and pairs. One field
// takes user@host; Tab completes from ~/.ssh/config and the tailnet.
export function SshSetup({
  network,
  retry,
  onRunning,
  onPaired,
  onSignIn: _onSignIn,
  readyLabel,
}: {
  network?: string;
  // Changing retry runs the setup again: after signing in to a tailnet.
  retry: number;
  onRunning(running: boolean): void;
  onPaired(box: string): void;
  onSignIn(): void;
  // The install's last button.
  readyLabel?: string;
}) {
  const [agents, setAgents] = useAgentChoice();
  const [host, setHost] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  // Setting up opens the quick install's dialog.
  const install = useInstallTarget();
  const state = install.target ? "running" : "ready";
  useEffect(() => onRunning(!!install.target), [install.target, onRunning]);

  const suggestions = useSuggestions(network);
  const plan = useSshPlan(host.trim(), network);
  const typed = host.trim().toLowerCase();
  const matches = useMemo(
    () => suggestions.filter((s) => !typed || (s.value.toLowerCase().includes(typed) && s.value.toLowerCase() !== typed)).slice(0, 5),
    [suggestions, typed],
  );

  const run = (opts: { trust?: string; target?: string } = {}) => {
    const target = (opts.target ?? host).trim();
    if (!target) return;
    if (opts.target) setHost(opts.target);
    // A refused key is asked about in the guided install, which can retry
    // with a key file.
    install.open({ host: target, name: name.trim() || undefined, network, trust_host_key: opts.trust });
  };

  const tried = useRef(retry);
  useEffect(() => {
    if (retry === tried.current) return;
    tried.current = retry;
    if (host.trim()) run();
    // Only a new retry runs again; run reads the latest field and network.
  }, [retry]);

  const pick = (s: Suggestion, go: boolean) => {
    setHost(s.value);
    setActive(-1);
    if (go) run({ target: s.value });
    else field.current?.focus();
  };

  const running = state === "running";
  const showSuggestions = state === "ready" && focused && matches.length > 0;

  return (
    <div>
      <form
        className={sx(paint.s0)}
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && matches[active]) pick(matches[active], true);
          else run();
        }}
      >
        <TerminalIcon aria-hidden className={sx(paint.s1)} />
        <input
          ref={field}
          value={host}
          disabled={running}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="SSH host, like me@my-box"
          placeholder="me@my-box, or a host from ~/.ssh/config"
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onChange={(e) => {
            setHost(e.target.value);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && matches.length) {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === "ArrowUp" && matches.length) {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === "Tab" && !e.shiftKey && showSuggestions) {
              // Tab completes, as in a shell.
              e.preventDefault();
              pick(matches[Math.max(active, 0)], false);
            }
          }}
          className={sx(paint.s2)}
        />
        <span className={sx(paint.s3)}><Button type="submit" size="xs" variant="outline"  disabled={running || (!host.trim() && active < 0)} data-testid="ssh-set-up">
          Set up
        </Button></span>
      </form>

      {/* What Burf will use, before it connects: a wrong agent is obvious here. */}
      <div aria-live="polite" className={sx(paint.s4)}>
        {host.trim() ? (
          plan === "loading" ? (
            <>
              <Spinner  size="sm"/> Reading your SSH setup…
            </>
          ) : plan ? (
            <>
              <KeyRoundIcon className={sx(paint.s5)} />
              <span className={sx(paint.s6)}>
                {plan.summary}
                {plan.hostname ? (
                  <>
                    {" · "}
                    <span className={sx(paint.s7)}>
                      {plan.user ? `${plan.user}@` : ""}
                      {plan.hostname}
                      {plan.port && plan.port !== "22" ? `:${plan.port}` : ""}
                    </span>
                  </>
                ) : null}
                {network ? ` · through the ${network} tailnet` : ""}
              </span>
              <span className={sx(paint.s8)}>
                named
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="after its hostname"
                  aria-label="Name in Burf"
                  spellCheck={false}
                  disabled={running}
                  className={sx(paint.s9)}
                />
              </span>
            </>
          ) : null
        ) : (
          <span>Uses your SSH keys and agent (1Password and the like) once, to install. After that Burf never needs SSH for this box.</span>
        )}
      </div>

      <InlineAgents value={agents} onChange={setAgents} disabled={running} />

      {showSuggestions && (
        <ul role="listbox" aria-label="Hosts" className={sx(paint.s10)}>
          {matches.map((s, i) => (
            <li key={`${s.network ?? ""}${s.value}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s, true)}
                className={[sx(paint.s11), i === active && sx(paint.s12)].filter(Boolean).join(" ")}
              >
                {s.os && s.os !== "linux" ? <MonitorIcon className={sx(paint.s13)} /> : <ServerIcon className={sx(paint.s14)} />}
                <span className={sx(paint.s15)}>{s.label}</span>
                <span className={sx(paint.s16)}>{s.detail}</span>
              </button>
            </li>
          ))}
          <li className={sx(paint.s17)}>
            <Kbd>⇥</Kbd> complete <span className={sx(paint.s18)}><Kbd>↵</Kbd></span> set up
          </li>
        </ul>
      )}

      <QuickInstall
        target={install.target && { ...install.target, agents }}
        readyLabel={readyLabel}
        onClose={install.close}
        onReady={(box) => {
          install.close();
          onPaired(box);
        }}
      />
    </div>
  );
}

// FailurePanel says what went wrong once, in plain words, and offers the
// one thing to do about it.
export function FailurePanel({
  failure,
  identity,
  setIdentity,
  onRetry,
  onSignIn,
}: {
  failure: Failure;
  identity: string;
  setIdentity(v: string): void;
  onRetry(trust?: string): void;
  onSignIn?(): void;
}) {
  let action: ReactNode = null;
  switch (failure.kind) {
    case "refused":
    case "timeout":
    case "unreachable":
    case "resolve":
      action = (
        <>
          <InstallCommand />
          {onSignIn && (
            <p className={sx(paint.s19)}>
              Or, if the box is on a tailnet this computer isn't signed in to,{" "}
              <button type="button" className={[sx(paint.s20), sx(paint.s32)].filter(Boolean).join(" ")} onClick={onSignIn}>
                sign in to that tailnet
              </button>{" "}
              and Burf tries again.
            </p>
          )}
        </>
      );
      break;
    case "auth":
    case "password":
      action = (
        <>
          {failure.kind === "auth" && failure.tried && failure.tried.length > 0 && (
            <p className={sx(paint.s21)}>
              Tried: <span className={sx(paint.s22)}>{failure.tried.join(", ")}</span>
            </p>
          )}
          <form
            className={sx(paint.s23)}
            onSubmit={(e) => {
              e.preventDefault();
              onRetry();
            }}
          >
            <Input size="sm" mono measure="cap72" value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="~/.ssh/id_ed25519" aria-label="Identity file" spellCheck={false} />
            <Button size="sm" type="submit" variant="outline">
              {identity.trim() ? "Try with this key" : "Try again"}
            </Button>
          </form>
        </>
      );
      break;
    case "host-key-unknown":
      action = (
        <>
          {failure.fingerprint && (
            <p className={sx(paint.s24)}>{failure.fingerprint}</p>
          )}
          <p className={sx(paint.s25)}>Trust it only if it matches the box's own key: on the box, run ssh-keygen -lf on its host key in /etc/ssh.</p>
          <div className={sx(paint.s26)}>
            <Button size="sm" variant="outline" disabled={!failure.fingerprint} onClick={() => onRetry(failure.fingerprint)}>
              Trust and connect
            </Button>
          </div>
        </>
      );
      break;
    case "host-key-changed":
      break;
    default:
      action = (
        <span className={sx(paint.s27)}><Button size="sm" variant="outline"  onClick={() => onRetry()}>
          Try again
        </Button></span>
      );
  }
  return (
    <div role="alert" className={sx(paint.s28)}>
      <p className={sx(paint.s29)}>
        {failure.kind === "host-key-changed" || failure.kind === "host-key-unknown" ? (
          <ShieldAlertIcon className={sx(paint.s30)} />
        ) : null}
        <span className={failure.kind === "host-key-changed" ? sx(paint.s31) : undefined}>{failure.message}</span>
      </p>
      {action}
    </div>
  );
}

// useSuggestions lists hosts to complete from: ~/.ssh/config's, then the
// tailnet's machines that are online and not boxes yet.
function useSuggestions(network?: string): Suggestion[] {
  const client = useStore((s) => s.client);
  const [config, setConfig] = useState<string[]>([]);
  const [tailnet, setTailnet] = useState<Suggestion[]>([]);
  useEffect(() => {
    if (!client) return;
    laptopApi.sshHosts(client).then(setConfig, () => setConfig([]));
  }, [client]);
  useEffect(() => {
    if (!client) return;
    let live = true;
    laptopApi.discover(client, network).then(
      (d) => {
        if (!live) return;
        const user = d.user ? `${d.user}@` : "";
        setTailnet(
          d.machines
            .filter((m) => m.online && !m.box)
            .sort((a, b) => Number(a.os !== "linux") - Number(b.os !== "linux") || a.name.localeCompare(b.name))
            .map((m) => ({ value: `${user}${m.dns_name?.replace(/\.$/, "") || m.ip}`, label: m.name, detail: `${network ? `${network} tailnet` : "tailnet"} · ${m.os || "unknown"}`, os: m.os, network })),
        );
      },
      () => live && setTailnet([]),
    );
    return () => {
      live = false;
    };
  }, [client, network]);
  return useMemo(() => [...config.map((h) => ({ value: h, label: h, detail: "~/.ssh/config" })), ...tailnet], [config, tailnet]);
}

// useSshPlan asks the agent what ssh would use for a host: user, address,
// agent and keys. It reads config only; it never connects.
export function useSshPlan(host: string, network?: string): SshPlan | "loading" | undefined {
  const client = useStore((s) => s.client);
  const [plan, setPlan] = useState<SshPlan | "loading">();
  useEffect(() => {
    if (!client || !host || /\s/.test(host)) {
      setPlan(undefined);
      return;
    }
    let live = true;
    setPlan((p) => p ?? "loading");
    const t = setTimeout(() => {
      laptopApi.sshPlan(client, host, network).then(
        (p) => live && setPlan(p),
        () => live && setPlan(undefined),
      );
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [client, host, network]);
  return plan;
}
