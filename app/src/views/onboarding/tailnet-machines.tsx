import * as stylex from "@stylexjs/stylex";
import { CheckIcon, ExternalLinkIcon, KeyRoundIcon, PlusIcon, RefreshCwIcon, SearchIcon, ShieldCheckIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import type { Discovery, Machine } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { openUrl } from "@/lib/open-url";
import { useStore } from "@/lib/store";
import { useAgentChoice, useInstallTarget } from "@/views/onboarding/guided-install";
import { InlineAgents, QuickInstall } from "@/views/onboarding/quick-install";
import { useSshPlan } from "@/views/onboarding/ssh-setup";
import { discoverNetwork, type SystemTailnet, sortMachines, type TailnetSource } from "@/views/onboarding/tailnet";

const paint = stylex.create({
  s0: {
    "marginBottom": "8px",
    "display": "flex",
    "height": "24px",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s1: {
    "flexShrink": 0,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s3: {
    "marginInlineEnd": "calc(8px * -1)",
    "marginInlineStart": "auto",
    "flexShrink": 0,
  },
  s4: {
    "display": "flex",
    "height": "96px",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "display": "flex",
    "minHeight": "96px",
    "flexDirection": "column",
    "alignItems": "flex-start",
    "justifyContent": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s6: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "display": "flex",
    "minHeight": "96px",
    "alignItems": "center",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s8: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s9: {
    "display": "flex",
    "height": "36px",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s11: {
    "height": "100%",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "transparent",
    "color": {
      "default": "var(--foreground)",
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
    },
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
  },
  s12: {
    "maxHeight": "201px",
    "overflowY": "auto",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s13: {
    "display": "flex",
    "height": "40px",
    "alignItems": "center",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s14: {
    "display": "flex",
    "height": "40px",
    "alignItems": "center",
    "gap": "10px",
    "paddingInlineStart": "12px",
    "paddingInlineEnd": "8px",
  },
  s15: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 50%, transparent)",
  },
  s16: {
    "color": "var(--muted-foreground)",
  },
  s17: {
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s18: {
    "backgroundColor": "var(--success)",
  },
  s19: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s20: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s21: {
    "display": {
      "default": "none",
      "@media (min-width: 640px)": {
        "default": "inline",
      },
    },
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "marginInlineStart": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
  },
  s23: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "paddingInlineEnd": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s24: {
    "width": "14px",
    "height": "14px",
  },
  s25: {
    "paddingInlineEnd": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "padding": "12px",
  },
  s27: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s28: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "padding": "12px",
  },
  s29: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s30: {
    "display": "flex",
    "height": "32px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--input)",
      ":focus-within": "var(--ring)",
    },
    "backgroundColor": {
      "default": "light-dark(var(--background), color-mix(in oklab, var(--input) 32%, transparent))",
    },
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "13px",
    "boxShadow": {
      "default": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
      ":focus-within": "0 0 0 2px color-mix(in oklab, var(--ring) 24%, transparent)",
    },
  },
  s31: {
    "height": "100%",
    "minWidth": "0px",
    "flexShrink": 0,
    "backgroundColor": "transparent",
    "outline": "none",
    "color": {
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
    },
    "opacity": {
      ":disabled": 0.64,
    },
  },
  s32: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s33: {
    "flexShrink": 0,
  },
  s34: {
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
  s35: {
    "color": "var(--destructive-foreground)",
  },
  s36: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s37: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s38: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s39: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s40: {
    "marginInlineStart": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s41: {
    "height": "20px",
    "width": "112px",
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
  s42: {
    "marginTop": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s43: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s44: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s45: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s46: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
  },

  s47: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const TAILSCALE_DOWNLOAD = "https://tailscale.com/download";

// TailnetMachines lists the machines on a tailnet this computer reaches,
// each with Set up: Burf logs in over SSH once, installs berthd (which
// listens on the machine's tailnet address only) and pairs. With more than
// one tailnet (this Mac's, and ones Burf signed in to), tabs switch.
export function TailnetMachines({
  sources,
  system,
  active,
  onActive,
  autoFocus,
  onRunning,
  onPaired,
  onSignIn,
  readyLabel,
}: {
  sources: TailnetSource[];
  system?: SystemTailnet;
  active: string;
  onActive(key: string): void;
  autoFocus?: boolean;
  onRunning(running: boolean): void;
  onPaired(box: string): void;
  onSignIn(): void;
  readyLabel?: string;
}) {
  const source = sources.find((s) => s.key === active) ?? sources[0];
  const found = useDiscovery(source, system);
  // The machine being set up, by IP; one at a time.
  const [picked, setPicked] = useState<string>();
  const [running, setRunning] = useState(false);
  useEffect(() => setPicked(undefined), [source?.key]);

  return (
    <section aria-labelledby="tailnet-heading">
      <div className={sx(paint.s0)}>
        <h2 id="tailnet-heading" className={sx(paint.s1)}>
          On your tailnet
        </h2>
        {sources.length === 1 && <span className={sx(paint.s2)}>{source.label}</span>}
        <span className={sx(paint.s3)}><Button size="xs" variant="ghost" data-focus-skip=""  disabled={running} onClick={onSignIn} muted>
          <PlusIcon /> Sign in to another tailnet
        </Button></span>
      </div>
      {sources.length > 1 && (
        <Tabs value={source.key} onValueChange={(v) => !running && onActive(String(v))} space="below">
          <TabsList size="sm">
            {sources.map((s) => (
              <TabsTab key={s.key} value={s.key} disabled={running && s.key !== source.key}>
                {s.label}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
      )}
      <MachineList
        key={source.key}
        source={source}
        found={found}
        picked={picked}
        running={running}
        autoFocus={autoFocus}
        onPick={setPicked}
        onRunning={(r) => {
          setRunning(r);
          onRunning(r);
        }}
        onPaired={onPaired}
        onSignIn={onSignIn}
        readyLabel={readyLabel}
      />
    </section>
  );
}

type Found = { state: "loading" } | { state: "error"; message: string; retry(): void } | { state: "ok"; discovery: Discovery };

// useDiscovery is the machine list for a source: this Mac's tailnet comes
// with the screen; a Burf network's is read when its tab is chosen.
function useDiscovery(source: TailnetSource | undefined, system?: SystemTailnet): Found {
  const client = useStore((s) => s.client);
  const [found, setFound] = useState<Found>({ state: "loading" });
  const [nonce, setNonce] = useState(0);
  const network = source?.network;
  useEffect(() => {
    if (!client || !network) return;
    let live = true;
    setFound({ state: "loading" });
    discoverNetwork(client, network, nonce > 0).then(
      (d) => live && setFound({ state: "ok", discovery: d }),
      (err) => live && setFound({ state: "error", message: plainError(err), retry: () => setNonce((n) => n + 1) }),
    );
    return () => {
      live = false;
    };
  }, [client, network, nonce]);
  if (!network) return system?.discovery ? { state: "ok", discovery: system.discovery } : { state: "loading" };
  return found;
}

// A list this long gets a filter.
const FILTER_FROM = 7;

function MachineList({
  source,
  found,
  picked,
  running,
  autoFocus,
  onPick,
  onRunning,
  onPaired,
  onSignIn,
  readyLabel,
}: {
  source: TailnetSource;
  found: Found;
  picked?: string;
  running: boolean;
  autoFocus?: boolean;
  onPick(ip?: string): void;
  onRunning(running: boolean): void;
  onPaired(box: string): void;
  onSignIn(): void;
  readyLabel?: string;
}) {
  const [filter, setFilter] = useState("");
  const all = useMemo(() => (found.state === "ok" ? sortMachines(found.discovery.machines) : []), [found]);
  const q = filter.trim().toLowerCase();
  const machines = q ? all.filter((m) => m.name.toLowerCase().includes(q) || m.os.toLowerCase().includes(q)) : all;
  const machine = all.find((m) => m.ip === picked);
  const firstSettable = machines.find((m) => m.online && !m.box);

  if (found.state === "loading") {
    return (
      <div className={sx(paint.s4)}>
        <Spinner  size="lg"/> Listing machines…
      </div>
    );
  }
  if (found.state === "error") {
    const login = /needs a login/i.test(found.message);
    return (
      <div className={sx(paint.s5)}>
        <span>{login ? `Burf is signed out of ${source.label}.` : `Couldn't list the machines on ${source.label}.`}</span>
        {!login && <span className={sx(paint.s6)}>{found.message}</span>}
        <Button size="xs" variant="outline" onClick={login ? onSignIn : found.retry}>
          {login ? "Sign in again" : "Try again"}
        </Button>
      </div>
    );
  }
  if (all.length === 0) {
    return (
      <div className={sx(paint.s7)}>
        Nothing on {source.label} can be a box yet: berthd runs on Linux and macOS. Add a machine to the tailnet, or run the command below on any box.
      </div>
    );
  }

  return (
    <div className={sx(paint.s8)}>
      {all.length >= FILTER_FROM && (
        <label className={sx(paint.s9)}>
          <SearchIcon aria-hidden className={sx(paint.s10)} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${all.length} machines`}
            aria-label="Filter machines"
            spellCheck={false}
            autoComplete="off"
            data-focus-skip=""
            className={sx(paint.s11)}
          />
        </label>
      )}
      {/* At most about five rows tall, whatever the tailnet's size. */}
      <ul aria-label={`Machines on ${source.label}`} className={[sx(paint.s12), sx(paint.s47)].filter(Boolean).join(" ")}>
        {machines.map((m) => (
          <MachineRow
            key={m.ip}
            machine={m}
            picked={m.ip === picked}
            locked={running}
            autoFocus={autoFocus && m === firstSettable && !picked}
            onPick={() => onPick(m.ip === picked ? undefined : m.ip)}
          />
        ))}
        {machines.length === 0 && <li className={sx(paint.s13)}>No machine matches “{filter.trim()}”.</li>}
      </ul>
      {machine && found.state === "ok" && (
        <MachineSetup
          key={machine.ip}
          machine={machine}
          user={found.discovery.user}
          network={source.network}
          onRunning={onRunning}
          onPaired={onPaired}
          onClose={() => onPick(undefined)}
          readyLabel={readyLabel}
        />
      )}
    </div>
  );
}

function MachineRow({ machine: m, picked, locked, autoFocus, onPick }: { machine: Machine; picked: boolean; locked: boolean; autoFocus?: boolean; onPick(): void }) {
  const sshSupported = useStore((s) => !s.status || !("ssh_setup_supported" in s.status) || s.status.ssh_setup_supported !== false);
  const kind = m.os === "linux" ? "Linux" : m.os;
  return (
    <li className={[sx(paint.s14), picked && sx(paint.s15), !m.online && !m.box && sx(paint.s16)].filter(Boolean).join(" ")}>
      <Tip label={m.online ? "Online" : "Offline"}>
        <span role="img" aria-label={m.online ? "Online" : "Offline"} className={[sx(paint.s17), m.online ? sx(paint.s18) : sx(paint.s19)].filter(Boolean).join(" ")} />
      </Tip>
      <span className={sx(paint.s20)}>{m.name}</span>
      <span className={sx(paint.s21)}>
        {kind}
        {m.ssh ? " · Tailscale SSH" : ""}
      </span>
      <span className={sx(paint.s22)}>
        {m.box ? (
          <span className={sx(paint.s23)}>
            <CheckIcon className={sx(paint.s24)} /> Paired as {m.box}
          </span>
        ) : !m.online ? (
          <span className={sx(paint.s25)}>Offline</span>
        ) : picked ? (
          <Button size="xs" variant="ghost"  disabled={locked} onClick={onPick} muted>
            Cancel
          </Button>
        ) : (
          <Tip label={locked ? "Another machine is being set up" : undefined}>
            <Button size="xs" variant="outline" disabled={locked} autoFocus={autoFocus} onClick={onPick} aria-label={`${sshSupported ? "Set up" : "Pair"} ${m.name}`}>
              {sshSupported ? "Set up" : "Pair"}
            </Button>
          </Tip>
        )}
      </span>
    </li>
  );
}

// boxName is a machine's name as a box name, unless a box has it already
// (then the box's own hostname decides, with a number if need be).
function boxName(machine: string, taken: string[]): string {
  const name = machine.split(".")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
  return taken.includes(name) ? "" : name;
}

// MachineSetup sets one machine up: who to log in as, then the install as
// it happens. A Mac is set up with the install command instead.
function MachineSetup({
  machine: m,
  user: suggested,
  network,
  onRunning,
  onPaired,
  onClose: _onClose,
  readyLabel,
}: {
  machine: Machine;
  user: string;
  network?: string;
  onRunning(running: boolean): void;
  onPaired(box: string): void;
  onClose(): void;
  readyLabel?: string;
}) {
  const [agents, setAgents] = useAgentChoice();
  // A Burf network is dialed by address; this Mac's tailnet by name.
  const host = network ? m.ip : m.dns_name || m.ip;
  const sshSupported = useStore((s) => !s.status || !("ssh_setup_supported" in s.status) || s.status.ssh_setup_supported !== false);
  const plan = useSshPlan(sshSupported && m.os === "linux" ? host : "", network);
  const boxes = useStore((s) => s.status?.boxes);
  const [user, setUser] = useState(suggested);
  const [touched, setTouched] = useState(false);
  const [name, setName] = useState(() => boxName(m.name, boxes?.map((b) => b.name) ?? []));
  // Setting up opens the quick install's dialog.
  const install = useInstallTarget();
  const running = !!install.target;
  const state = running ? "running" : "ready";
  useEffect(() => onRunning(running), [running, onRunning]);

  // ssh's own answer for the user (~/.ssh/config's User), until one is typed.
  const planned = plan && plan !== "loading" ? plan.user : undefined;
  useEffect(() => {
    if (planned && !touched) setUser(planned);
  }, [planned, touched]);

  if (m.os !== "linux" || !sshSupported) {
    return (
      <div className={sx(paint.s26)}>
        <p className={sx(paint.s27)}>
          Run the command in step 1 below on {m.name}, then paste what it prints into step 2.
        </p>
      </div>
    );
  }

  const go = () => {
    const u = user.trim();
    if (/[\s@]/.test(u)) return;
    install.open({ host: `${u ? `${u}@` : ""}${host}`, name: name.trim() || undefined, network, knownHostKeys: m.host_keys });
  };
  const userError = /@/.test(user) ? `Only the user: Burf connects to ${m.name}.` : /\s/.test(user.trim()) ? "A user name has no spaces." : undefined;

  return (
    <div className={sx(paint.s28)}>
      <form
        className={sx(paint.s29)}
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <div className={sx(paint.s30)}>
          <input
            autoFocus
            value={user}
            disabled={running}
            onChange={(e) => {
              setUser(e.target.value);
              setTouched(true);
            }}
            aria-label={`SSH user on ${m.name}`}
            aria-invalid={userError ? true : undefined}
            placeholder="user"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            style={{ width: `${(user.length || 4) + 0.25}ch` }}
            className={sx(paint.s31)}
          />
          <span className={sx(paint.s32)}>@{host}</span>
        </div>
        <span className={sx(paint.s33)}><Button type="submit" size="sm"  disabled={!!userError || running} data-testid="machine-install">
          Install and pair
        </Button></span>
      </form>
      <div aria-live="polite" className={sx(paint.s34)}>
        {userError ? (
          <span className={sx(paint.s35)}>{userError}</span>
        ) : m.ssh ? (
          <>
            <ShieldCheckIcon className={sx(paint.s36)} />
            <span className={sx(paint.s37)}>Tailscale SSH: no keys needed</span>
          </>
        ) : plan === "loading" ? (
          <>
            <Spinner  size="sm"/> Reading your SSH setup…
          </>
        ) : plan ? (
          <>
            <KeyRoundIcon className={sx(paint.s38)} />
            <span className={sx(paint.s39)}>{plan.summary}</span>
          </>
        ) : null}
        <span className={sx(paint.s40)}>
          named
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="after its hostname"
            aria-label="Name in Burf"
            spellCheck={false}
            disabled={running}
            className={sx(paint.s41)}
          />
        </span>
      </div>
      <InlineAgents value={agents} onChange={setAgents} disabled={running} />
      {state === "ready" && (
        <p className={sx(paint.s42)}>
          Burf logs in once to install berthd for that user. It listens on {m.name}'s tailnet address only, and Burf never needs SSH for it again.
        </p>
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

// UseTailscale is the tailnet path while this Mac can't list one: what
// Tailscale gives you here, and the one thing to do about its state.
export function UseTailscale({ system, onRefresh, onSignIn }: { system?: SystemTailnet; onRefresh(): void; onSignIn(): void }) {
  const state = system?.state ?? "unknown";
  const said =
    state === "missing"
      ? undefined
      : state === "logged-out"
        ? "Tailscale is on this computer, but signed out. Sign in from its app and your machines show up here."
        : state === "stopped"
          ? "Tailscale is on this computer, but not connected. Connect from its app and your machines show up here."
          : state === "running"
            ? `Nothing on ${system?.name || "your tailnet"} can be a box yet: berthd runs on Linux and macOS.`
            : "Burf couldn't ask Tailscale on this computer for its machines.";
  return (
    <div className={sx(paint.s43)}>
      <p className={sx(paint.s44)}>
        Tailscale puts your machines on one private network. With it on this computer, they're listed here. Pair a box with the link its install command prints.
      </p>
      {said && <p className={sx(paint.s45)}>{said}</p>}
      <div className={sx(paint.s46)}>
        {state === "missing" ? (
          <Button size="sm" variant="outline" onClick={() => void openUrl(TAILSCALE_DOWNLOAD)}>
            <ExternalLinkIcon /> Get Tailscale
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCwIcon /> Check again
          </Button>
        )}
        <Button size="sm" variant="ghost"  onClick={onSignIn} muted>
          Sign in to a tailnet in Burf
        </Button>
      </div>
    </div>
  );
}
