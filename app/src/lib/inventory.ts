import type { Client } from "@/lib/api";

import { ago } from "./format.ts";

// What runs on a machine: Burf's agents, dev servers, Docker containers and
// OS services, as the laptop agent last read them (/v1/machines). A machine
// is reached by one or more routes: this computer, a paired box's daemon, or
// plain SSH. One reached only over SSH has no daemon, so Burf reads its
// services and can start nothing there.
//
// The agent keeps what it last saw. A scan that fails, or reads only part,
// leaves the services it could not read as they were and says so in
// coverage: a machine that cannot be reached is not a machine whose services
// stopped.

export type RouteKind = "local" | "paired" | "ssh";

export interface Route {
  kind: RouteKind;
  // ssh: user@host or an alias. paired: the daemon's fingerprint (the box's
  // name when attaching one; the agent resolves it).
  target?: string;
}

export type MachineOS = "darwin" | "linux" | "windows";

export interface Machine {
  id: string;
  name: string;
  os?: MachineOS;
  routes: Route[];
  updated_at: string;
}

export type ServiceState = "unknown" | "running" | "stopped" | "failed" | "disappeared";

export interface Service {
  id: string;
  machine_id: string;
  key: string;
  source: string;
  name: string;
  state: ServiceState;
  // Only when the source reports one (a container's health check, say).
  health?: string;
  ports: number[];
  pid?: number;
  // What tells this process from a later one with the same pid. A time on
  // some systems; on Linux a boot id and start ticks, which is not one.
  process_started?: string;
  location?: string;
  worktree?: string;
  // The last scan that saw it. A scan that fails leaves this as it was.
  observed_at: string;
}

export type CoverageState = "ok" | "partial" | "unavailable" | "error";

// How well one source was read at the last attempt.
export interface Coverage {
  source: string;
  state: CoverageState;
  error?: string;
  at: string;
}

export interface Snapshot {
  machine: Machine;
  services: Service[];
  coverage: Coverage[];
  at: string;
}

// One change to a service. gap: scans in between did not see it, so the
// change happened some time before at.
export interface Change {
  id: number;
  machine_id: string;
  service_id: string;
  at: string;
  before?: Service;
  after: Service;
  gap: boolean;
}

// Which machine: one by id, this computer's, or a paired box's. The agent
// answers the last two from its own records; nothing is matched by name here.
export type MachineLookup = { id: string } | { local: true } | { box: string };

export const HISTORY_PAGE = 100;

const machinePath = (id: string, rest = "") => `/v1/machines/${encodeURIComponent(id)}${rest}`;

// Go sends an empty list as null.
const machine = (m: Machine): Machine => ({ ...m, routes: m.routes ?? [] });
const snapshot = (s: Snapshot): Snapshot => ({
  ...s,
  machine: machine(s.machine),
  services: (s.services ?? []).map((v) => ({ ...v, ports: v.ports ?? [] })),
  coverage: s.coverage ?? [],
});

export const inventoryApi = {
  machines: async (c: Client, signal?: AbortSignal) => ((await c.laptop<Machine[] | null>("GET", "/v1/machines", undefined, signal)) ?? []).map(machine),
  find: async (c: Client, where: MachineLookup, signal?: AbortSignal): Promise<Machine | undefined> => {
    if ("id" in where) return (await inventoryApi.machines(c, signal)).find((m) => m.id === where.id);
    const query = "local" in where ? "local=1" : `box=${encodeURIComponent(where.box)}`;
    const found = (await c.laptop<Machine[] | null>("GET", `/v1/machines?${query}`, undefined, signal))?.[0];
    return found && machine(found);
  },
  // register adds a machine Burf only inspects over SSH.
  register: async (c: Client, req: { name: string; os?: MachineOS; target: string }) =>
    machine(await c.laptop<Machine>("POST", "/v1/machines", { name: req.name, ...(req.os ? { os: req.os } : {}), routes: [{ kind: "ssh", target: req.target }] })),
  // setRoutes attaches routes to the machine the person chose. The agent adds
  // to the routes it holds; it never drops one or merges machines by name.
  setRoutes: async (c: Client, id: string, routes: Route[]) => machine(await c.laptop<Machine>("PUT", machinePath(id, "/routes"), { routes })),
  inventory: async (c: Client, id: string, signal?: AbortSignal) => snapshot(await c.laptop<Snapshot>("GET", machinePath(id, "/inventory"), undefined, signal)),
  // A service's changes, oldest first, a page at a time: after is the last id already held.
  history: async (c: Client, id: string, service: string, after?: number, signal?: AbortSignal) =>
    (await c.laptop<Change[] | null>("GET", machinePath(id, `/history?${new URLSearchParams({ service, ...(after === undefined ? {} : { after: String(after) }), limit: String(HISTORY_PAGE) })}`), undefined, signal)) ?? [],
  // refresh scans the machine now. A scan that fails still answers with what was last seen.
  refresh: async (c: Client, id: string) => snapshot(await c.laptop<Snapshot>("POST", machinePath(id, "/refresh"), {})),
};

// inventoryMissing: the agent is older than machine inventory and has no such route.
export function inventoryMissing(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 404 || status === 405 || status === 501;
}

// sshOnly: reached by SSH and nothing else, so nothing can be started there.
export function sshOnly(m: Machine): boolean {
  return m.routes.length > 0 && m.routes.every((r) => r.kind === "ssh");
}

export function routeLabel(r: Route): string {
  if (r.kind === "local") return "This computer";
  if (r.kind === "paired") return "Paired";
  return r.target ? `SSH ${r.target}` : "SSH";
}

// withRoute is a machine's routes with one more, unless it has it already.
export function withRoute(routes: Route[], route: Route): Route[] {
  return routes.some((r) => r.kind === route.kind && (r.target ?? "") === (route.target ?? "")) ? routes : [...routes, route];
}

// sshTargetError says what is wrong with an SSH target, if anything. A
// leading dash would reach ssh as an option, not a host.
export function sshTargetError(target: string): string | undefined {
  const t = target.trim();
  if (!t) return "Enter user@host or an alias from your SSH configuration.";
  if (/\s/.test(t)) return "An SSH target has no spaces.";
  if (t.startsWith("-")) return "An SSH target cannot start with a dash.";
  const parts = t.split("@");
  if (parts.length > 2 || parts.some((p) => !p)) return "Use user@host or an alias from your SSH configuration.";
  return undefined;
}

// The agent's collectors, in the order they are listed.
const SOURCE_LABELS: Record<string, string> = {
  "burf-agents": "Burf agents",
  "burf-chats": "Burf chats",
  "burf-sessions": "Burf sessions",
  "burf-services": "Burf worktree services",
  listeners: "Dev servers",
  docker: "Docker containers",
  "launchd-system": "System services (launchd)",
  "launchd-user": "User services (launchd)",
  "systemd-system": "System services (systemd)",
  "systemd-user": "User services (systemd)",
  "windows-services": "Windows services",
  "windows-tasks": "Scheduled tasks",
};
const SOURCE_ORDER = Object.keys(SOURCE_LABELS);

// Coverage that is about the scan itself, not a kind of service: whether the
// machine was reached, and whether its changes could be recorded.
export const CONNECTION = "connection";
export const HISTORY = "history";

// A source the app has no words for yet shows under its own name.
export const sourceLabel = (source: string): string => SOURCE_LABELS[source] ?? source;

// Burf started these and controls them from their chat or worktree; the rest it only reads.
export const burfManaged = (source: string): boolean => source.startsWith("burf-");

const STATE_WORDS: Record<ServiceState, string> = { running: "Running", stopped: "Stopped", failed: "Failed", disappeared: "No longer found", unknown: "Unknown" };
const STATE_RANK: Record<ServiceState, number> = { failed: 0, running: 1, unknown: 2, stopped: 3, disappeared: 4 };
const stateWord = (state: ServiceState): string => STATE_WORDS[state] ?? state;

export interface ServiceStatus {
  label: string;
  // Running has no hue; only a failure is coloured.
  tone: "plain" | "muted" | "danger";
  // The last scan could not read it: this is what an earlier one saw.
  stale: boolean;
}

// serviceStatus is a service's state in words. One its source could not read
// at the last scan is "last seen" in that state, never stopped.
export function serviceStatus(s: Service, coverage?: Coverage): ServiceStatus {
  const stale = !!coverage && coverage.state !== "ok" && Date.parse(s.observed_at) < Date.parse(coverage.at);
  const tone = s.state === "failed" ? "danger" : s.state === "running" && !stale ? "plain" : "muted";
  const lastSeen = stale && (s.state === "running" || s.state === "stopped" || s.state === "failed");
  return { label: lastSeen ? `Last seen ${stateWord(s.state).toLowerCase()}` : stateWord(s.state), tone, stale };
}

export interface SourceGroup {
  source: string;
  coverage?: Coverage;
  services: Service[];
}

// groupServices lists every source the machine has services or coverage for,
// the known ones first, each with its services: failures, then running, by name.
export function groupServices(snap: Snapshot): SourceGroup[] {
  const sources = [...new Set([...snap.coverage.map((c) => c.source), ...snap.services.map((s) => s.source)])].filter((s) => s !== CONNECTION && s !== HISTORY);
  const rank = (source: string) => (SOURCE_ORDER.includes(source) ? SOURCE_ORDER.indexOf(source) : SOURCE_ORDER.length);
  return sources
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((source) => ({
      source,
      coverage: snap.coverage.find((c) => c.source === source),
      services: snap.services.filter((s) => s.source === source).sort((a, b) => (STATE_RANK[a.state] ?? 2) - (STATE_RANK[b.state] ?? 2) || a.name.localeCompare(b.name)),
    }));
}

const failedScan = (c: Coverage) => c.state === "unavailable" || c.state === "error";

// unreachable is the coverage that says the last scan did not reach the
// machine at all: its connection failed, or no source could be read.
export function unreachable(snap: Snapshot): Coverage | undefined {
  const connection = snap.coverage.find((c) => c.source === CONNECTION);
  if (connection) return failedScan(connection) ? connection : undefined;
  return snap.coverage.length > 0 && snap.coverage.every(failedScan) ? snap.coverage.find((c) => c.error) ?? snap.coverage[0] : undefined;
}

export function coverageText(c: Coverage): string {
  const when = ago(c.at);
  if (c.state === "ok") return `Scanned ${when}`.trim();
  if (c.state === "partial") return `Partly scanned ${when}`.trim();
  if (c.state === "unavailable") return when ? `Unavailable, checked ${when}` : "Unavailable";
  return `Scan failed ${when}`.trim();
}

export function inventorySummary(snap: Snapshot): string {
  const n = snap.services.length;
  const failed = snap.services.filter((s) => s.state === "failed").length;
  return [`${n} service${n === 1 ? "" : "s"}`, failed && `${failed} failed`].filter(Boolean).join(" · ");
}

export const portsText = (ports: number[]): string => ports.map((p) => `:${p}`).join(", ");

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// processText is a process by its number and, only when the source gave a
// time, when it started. A start token that is not a time says nothing a
// person can read, and is left out rather than shown as a date.
export function processText(s: Pick<Service, "pid" | "process_started">): string | undefined {
  if (s.pid === undefined) return undefined;
  const started = s.process_started;
  const timed = !!started && TIMESTAMP.test(started) && Number.isFinite(Date.parse(started));
  return timed ? `${s.pid}, started ${ago(started)}` : String(s.pid);
}

// olderSnapshot: next was observed before what is already held, so it is an
// answer that arrived late and must not replace it.
export function olderSnapshot(next: Snapshot, held?: Snapshot): boolean {
  return !!held && Date.parse(next.at) < Date.parse(held.at);
}

// coalesceBy is lib/net's coalesce with a key: calls for the key whose job is
// running get one more run when it ends, which sees everything they asked
// for. A call for another key starts at once, never waiting behind the one
// before it, whose job runs out alone and is not run again.
export function coalesceBy<K>(job: (key: K) => Promise<void>): (key: K) => Promise<void> {
  let current: { key: K; again: boolean; done: Promise<void> } | undefined;
  return (key) => {
    if (current && current.key === key) {
      current.again = true;
      return current.done;
    }
    const run = { key, again: false, done: Promise.resolve() };
    current = run;
    run.done = (async () => {
      do {
        run.again = false;
        // However it ended: a failed job doesn't stop the next.
        await job(key).catch(() => {});
      } while (run.again && current === run);
      if (current === run) current = undefined;
    })();
    return run.done;
  };
}

// appendChanges adds a page of history to what is held. Changes come oldest
// first by id, so one at or before the last held is a repeat and is dropped.
export function appendChanges(held: Change[], page: Change[]): Change[] {
  let last = held.length ? held[held.length - 1].id : -Infinity;
  const fresh = page.filter((c) => {
    if (c.id <= last) return false;
    last = c.id;
    return true;
  });
  return fresh.length ? [...held, ...fresh] : held;
}

// describeChange is one change in words: what moved between two readings.
export function describeChange(c: Change): string {
  const { before, after } = c;
  if (!before) return `First seen ${stateWord(after.state).toLowerCase()}`;
  const parts: string[] = [];
  if (before.state !== after.state) parts.push(`${stateWord(before.state)} → ${stateWord(after.state)}`);
  else if (before.pid !== undefined && after.pid !== undefined && before.pid !== after.pid) parts.push(`Restarted (process ${before.pid} → ${after.pid})`);
  if ((before.health ?? "") !== (after.health ?? "")) parts.push(`Health ${before.health || "not reported"} → ${after.health || "not reported"}`);
  if (portsText(before.ports ?? []) !== portsText(after.ports ?? [])) parts.push(`Ports ${portsText(before.ports ?? []) || "none"} → ${portsText(after.ports ?? []) || "none"}`);
  if ((before.location ?? "") !== (after.location ?? "")) parts.push(`Location ${before.location || "unknown"} → ${after.location || "unknown"}`);
  return parts.join(" · ") || "Seen again, unchanged";
}
