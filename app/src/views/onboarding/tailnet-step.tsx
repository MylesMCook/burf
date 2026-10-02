import { CheckIcon, MonitorIcon, RefreshCwIcon, ServerIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { type Discovery, laptopApi, type Machine } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CommandLog } from "@/views/settings/command-log";

// TailnetStep lists the machines on a tailnet; picking one asks for the SSH
// user and installs berthd there, showing the install as it happens. The
// flow around it owns which machine is picked, so its Back leads here.
export function TailnetStep({ network, picked, onPick, onDone }: { network?: string; picked?: { machine: Machine; user: string }; onPick(machine: Machine, user: string): void; onDone(box: string): void }) {
  const client = useStore((s) => s.client);
  const [found, setFound] = useState<Discovery>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(undefined);
    try {
      setFound(await laptopApi.discover(client, network));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [client, network]);

  useEffect(() => {
    void load();
  }, [load]);

  if (picked) return <ConnectMachine machine={picked.machine} user={picked.user} network={network} onDone={onDone} />;

  // Online machines that are not boxes yet first, then paired ones, then
  // offline ones; Linux before anything else within each.
  const machines = [...(found?.machines ?? [])].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  return (
    <div>
      <div className="overflow-hidden rounded-xl border">
        <div className="flex h-9 items-center gap-2 border-b bg-muted/30 pr-1.5 pl-3.5 text-muted-foreground text-xs">
          <span className="flex-1">Machines{found ? ` (${machines.length})` : ""}</span>
          <Button size="icon-xs" variant="ghost" aria-label="Refresh the list" data-focus-skip="" onClick={() => void load()} disabled={loading}>
            <RefreshCwIcon className={cn(loading && "animate-spin")} />
          </Button>
        </div>
        {error ? (
          <div className="px-4 py-5 text-sm">
            <div className="font-medium">Couldn't list the tailnet's machines</div>
            <div className="mt-1 text-muted-foreground text-xs">{error}</div>
            <Button size="xs" variant="outline" className="mt-3" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : loading && !found ? (
          <div className="flex items-center gap-2 px-4 py-6 text-muted-foreground text-sm">
            <Spinner className="size-4" /> Looking for machines…
          </div>
        ) : machines.length === 0 ? (
          <div className="px-4 py-6 text-muted-foreground text-sm">No machines found. Check this computer is signed in to Tailscale, then refresh. Or go back and paste a pairing link instead.</div>
        ) : (
          <ul className="max-h-[320px] divide-y divide-border/70 overflow-y-auto">
            {machines.map((m) => (
              <li key={m.ip} className={cn("flex items-center gap-3 px-3.5 py-2.5", !m.online && "opacity-55")}>
                {m.os === "linux" ? <ServerIcon className="size-4 text-muted-foreground" /> : <MonitorIcon className="size-4 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate">{m.name}</span>
                    <span className={cn("size-1.5 shrink-0 rounded-full", m.online ? "bg-success" : "bg-muted-foreground/40")} />
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {m.os || "unknown"} · {m.dns_name || m.ip}
                  </div>
                </div>
                {m.box ? (
                  <span className="flex items-center gap-1 text-muted-foreground text-xs">
                    <CheckIcon className="size-3.5" /> Paired as {m.box}
                  </span>
                ) : m.online ? (
                  <Button size="xs" variant="outline" onClick={() => onPick(m, found?.user ?? "")}>
                    Connect
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">Offline</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function rank(m: Machine) {
  const group = !m.online ? 2 : m.box ? 1 : 0;
  return group * 2 + (m.os === "linux" ? 0 : 1);
}

// ConnectMachine asks who to SSH in as, then runs the install.
function ConnectMachine({ machine, user: suggested, network, onDone }: { machine: Machine; user: string; network?: string; onDone(box: string): void }) {
  const client = useStore((s) => s.client);
  const [user, setUser] = useState(suggested);
  const [name, setName] = useState(boxName(machine.name));
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<"ready" | "running" | "done" | "failed">("ready");
  const [error, setError] = useState<string>();
  const abort = useRef<AbortController>(null);
  const target = machine.dns_name || machine.ip;
  const userError = sshUserError(user, machine.name);

  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    if (!client || userError) return;
    abort.current = new AbortController();
    setLines([]);
    setError(undefined);
    setState("running");
    const box = name.trim() || machine.name;
    try {
      const host = `${user.trim() ? `${user.trim()}@` : ""}${target}`;
      await laptopApi.addSsh(client, { host, name: name.trim() || undefined, network }, (l) => setLines((prev) => [...prev, l]), abort.current.signal);
      setState("done");
      await useStore.getState().refreshAll();
      // A beat on "Paired" before the next step.
      await new Promise((r) => setTimeout(r, 700));
      onDone(box);
    } catch (err) {
      if (abort.current?.signal.aborted) return;
      setError(errorMessage(err));
      setState("failed");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <ServerIcon className="size-5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-sm">{machine.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{machine.dns_name || machine.ip}</div>
        </div>
      </div>
      {state === "ready" || state === "failed" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs">SSH user</span>
              <Input
                size="sm"
                value={user}
                // "sean@dev-box" pasted whole: keep the user, the host is known.
                onChange={(e) => setUser(stripHost(e.target.value, machine))}
                placeholder="sean"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-invalid={userError ? true : undefined}
                autoFocus
              />
              {userError && <span className="block text-destructive-foreground text-xs">{userError}</span>}
            </label>
            <label className="space-y-1.5">
              <span className="text-muted-foreground text-xs">Name in Berth</span>
              <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder={machine.name} />
            </label>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Berth connects as <span className="font-mono text-foreground">{user.trim() || "you"}@{target}</span> once, using your SSH keys (and 1Password's agent if you use it), installs berthd as a user service, and pairs. After that it never needs SSH again.
          </p>
          {state === "failed" && <CommandLog lines={lines} error={error} />}
          <Button size="sm" type="submit" disabled={!!userError}>
            {state === "failed" ? "Try again" : "Install and pair"}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <CommandLog lines={lines} done={state === "done"} />
          {state === "done" ? (
            <p className="flex items-center gap-1.5 text-sm text-success-foreground">
              <CheckIcon className="size-4" /> Paired as {name.trim() || machine.name}
            </p>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                abort.current?.abort();
                setState("ready");
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// stripHost drops "@host" from a typed user when host is this machine, so
// "sean@dev-box" pasted from a terminal becomes "sean".
function stripHost(value: string, machine: Machine): string {
  const at = value.lastIndexOf("@");
  if (at < 0) return value;
  const host = value.slice(at + 1).trim().toLowerCase();
  const names = [machine.name, machine.dns_name, machine.dns_name?.split(".")[0], machine.ip].filter(Boolean).map((n) => n!.toLowerCase().replace(/\.$/, ""));
  return names.includes(host.replace(/\.$/, "")) ? value.slice(0, at) : value;
}

// sshUserError says what is wrong with a typed SSH user, if anything.
function sshUserError(user: string, machine: string): string | undefined {
  const u = user.trim();
  if (u.includes("@")) return `Only the user, without @host: Berth connects to ${machine}.`;
  if (/\s/.test(u)) return "A user name has no spaces.";
  return undefined;
}

// boxName turns a machine name into a short box name: dev-box stays as is,
// a long hostname keeps its first label.
function boxName(machine: string) {
  return machine.split(".")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-");
}
