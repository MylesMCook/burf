import assert from "node:assert/strict";
import { test } from "node:test";

import type { Client } from "./api.ts";
import {
  appendChanges,
  burfManaged,
  type Change,
  coalesceBy,
  type Coverage,
  coverageText,
  describeChange,
  groupServices,
  inventoryApi,
  inventoryMissing,
  inventorySummary,
  type Machine,
  olderSnapshot,
  processText,
  routeLabel,
  type Service,
  serviceStatus,
  type Snapshot,
  sourceLabel,
  sshOnly,
  sshTargetError,
  unreachable,
  withRoute,
} from "./inventory.ts";

const HOUR = 3_600_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const machine = (routes: Machine["routes"]): Machine => ({ id: "m1", name: "nas", routes, updated_at: iso(0) });
const service = (over: Partial<Service> = {}): Service => ({ id: "s1", machine_id: "m1", key: "docker:web", source: "docker", name: "web", state: "running", ports: [8080], observed_at: iso(HOUR), ...over });
const coverage = (over: Partial<Coverage> = {}): Coverage => ({ source: "docker", state: "ok", at: iso(HOUR), ...over });
const snap = (services: Service[], cover: Coverage[]): Snapshot => ({ machine: machine([{ kind: "ssh", target: "admin@nas" }]), services, coverage: cover, at: iso(0) });

// A client that records what it was asked and answers from a table.
function recorder(answers: Record<string, unknown>) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const laptop = async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, ...(body === undefined ? {} : { body }) });
    return answers[`${method} ${path}`];
  };
  return { calls, client: { laptop } as unknown as Client };
}

test("a machine reached only over SSH cannot run work; one with a daemon can", () => {
  assert.equal(sshOnly(machine([{ kind: "ssh", target: "admin@nas" }])), true);
  assert.equal(sshOnly(machine([{ kind: "paired", target: "fp" }, { kind: "ssh", target: "admin@nas" }])), false);
  assert.equal(sshOnly(machine([{ kind: "local" }])), false);
  assert.equal(sshOnly(machine([])), false);
});

test("routes read as where they go", () => {
  assert.equal(routeLabel({ kind: "local" }), "This computer");
  assert.equal(routeLabel({ kind: "paired", target: "fp" }), "Paired");
  assert.equal(routeLabel({ kind: "ssh", target: "admin@nas" }), "SSH admin@nas");
});

test("attaching a route keeps the machine's own and adds nothing twice", () => {
  const paired = [{ kind: "paired" as const, target: "fp" }];
  assert.deepEqual(withRoute(paired, { kind: "ssh", target: "me@devl" }), [...paired, { kind: "ssh", target: "me@devl" }]);
  assert.equal(withRoute(paired, { kind: "paired", target: "fp" }), paired);
});

test("an SSH target is a user@host or an alias, never an option", () => {
  assert.equal(sshTargetError("admin@nas.lan"), undefined);
  assert.equal(sshTargetError("  nas  "), undefined);
  assert.match(sshTargetError("") ?? "", /Enter/);
  assert.match(sshTargetError("-oProxyCommand=x") ?? "", /dash/);
  assert.match(sshTargetError("admin@nas extra") ?? "", /spaces/);
  assert.match(sshTargetError("@nas") ?? "", /user@host/);
  assert.match(sshTargetError("a@b@c") ?? "", /user@host/);
});

test("an agent without machine inventory is told apart from one that failed", () => {
  assert.equal(inventoryMissing({ status: 404 }), true);
  assert.equal(inventoryMissing({ status: 405 }), true);
  assert.equal(inventoryMissing({ status: 500 }), false);
  assert.equal(inventoryMissing(new Error("mock: no fixture")), false);
  assert.equal(inventoryMissing(undefined), false);
});

test("every collector has words, and one the app does not know keeps its name", () => {
  for (const source of ["burf-sessions", "burf-chats", "burf-services", "burf-agents", "listeners", "docker", "launchd-system", "launchd-user", "systemd-system", "systemd-user", "windows-services", "windows-tasks"]) {
    assert.notEqual(sourceLabel(source), source, source);
  }
  assert.equal(sourceLabel("listeners"), "Dev servers");
  assert.equal(sourceLabel("podman"), "podman");
  assert.equal(burfManaged("burf-services"), true);
  assert.equal(burfManaged("docker"), false);
});

test("a service read at the last scan shows its state", () => {
  const at = iso(60_000);
  assert.deepEqual(serviceStatus(service({ observed_at: at }), coverage({ at })), { label: "Running", tone: "plain", stale: false });
  assert.deepEqual(serviceStatus(service({ state: "failed", observed_at: at }), coverage({ at })), { label: "Failed", tone: "danger", stale: false });
  assert.deepEqual(serviceStatus(service({ state: "stopped", observed_at: at }), coverage({ at })), { label: "Stopped", tone: "muted", stale: false });
  assert.equal(serviceStatus(service({ state: "disappeared", observed_at: at }), coverage({ at })).label, "No longer found");
  assert.equal(serviceStatus(service(), undefined).label, "Running");
});

test("a service its collector could not read is last seen, never stopped", () => {
  for (const state of ["unavailable", "error", "partial"] as const) {
    const status = serviceStatus(service({ observed_at: iso(2 * HOUR) }), coverage({ state, at: iso(60_000) }));
    assert.deepEqual(status, { label: "Last seen running", tone: "muted", stale: true }, state);
  }
  assert.equal(serviceStatus(service({ state: "failed", observed_at: iso(2 * HOUR) }), coverage({ state: "error", at: iso(0) })).label, "Last seen failed");
});

test("a partial scan that did read the service leaves it current", () => {
  const at = iso(60_000);
  assert.deepEqual(serviceStatus(service({ observed_at: at }), coverage({ state: "partial", at })), { label: "Running", tone: "plain", stale: false });
});

test("services group by collector, known ones first, failures leading", () => {
  const groups = groupServices(snap(
    [service({ id: "a", name: "zeta" }), service({ id: "b", name: "alpha", state: "failed" }), service({ id: "c", source: "listeners", name: "vite" }), service({ id: "d", source: "podman", name: "pod" })],
    [coverage(), coverage({ source: "systemd-user", state: "unavailable", error: "no user bus" }), coverage({ source: "connection" }), coverage({ source: "history" })],
  ));
  assert.deepEqual(groups.map((g) => g.source), ["listeners", "docker", "systemd-user", "podman"]);
  assert.deepEqual(groups[1].services.map((s) => s.name), ["alpha", "zeta"]);
  assert.equal(groups[2].services.length, 0);
  assert.equal(groups[2].coverage?.error, "no user bus");
});

test("a machine is unreachable when its connection failed or nothing could be read", () => {
  const lost = coverage({ source: "connection", state: "error", error: "ssh: connect timed out" });
  assert.equal(unreachable(snap([service()], [lost, coverage({ state: "unavailable" })])), lost);
  assert.equal(unreachable(snap([service()], [coverage({ source: "connection" }), coverage({ state: "unavailable" })])), undefined);
  assert.equal(unreachable(snap([service()], [coverage({ state: "error", error: "timed out" }), coverage({ source: "listeners", state: "unavailable" })]))?.error, "timed out");
  assert.equal(unreachable(snap([service()], [coverage(), coverage({ source: "listeners", state: "unavailable" })])), undefined);
  assert.equal(unreachable(snap([], [])), undefined);
});

test("coverage says how the collector fared and how long ago", () => {
  assert.equal(coverageText(coverage({ at: iso(5 * 60_000 + 2000) })), "Scanned 5m ago");
  assert.equal(coverageText(coverage({ state: "partial", at: iso(2 * HOUR + 2000) })), "Partly scanned 2h ago");
  assert.equal(coverageText(coverage({ state: "unavailable", at: iso(5 * 60_000 + 2000) })), "Unavailable, checked 5m ago");
  assert.equal(coverageText(coverage({ state: "error", at: iso(1000) })), "Scan failed just now");
});

test("the summary counts services and names failures", () => {
  assert.equal(inventorySummary(snap([service()], [])), "1 service");
  assert.equal(inventorySummary(snap([service(), service({ id: "b", state: "failed" }), service({ id: "c" })], [])), "3 services · 1 failed");
  assert.equal(inventorySummary(snap([], [])), "0 services");
});

test("a change reads as what moved", () => {
  const change = (before: Partial<Service> | undefined, after: Partial<Service>): Change => ({ id: 1, machine_id: "m1", service_id: "s1", at: iso(0), before: before && service(before), after: service(after), gap: false });
  assert.equal(describeChange(change(undefined, {})), "First seen running");
  assert.equal(describeChange(change({}, { state: "failed" })), "Running → Failed");
  assert.equal(describeChange(change({ pid: 10 }, { pid: 22 })), "Restarted (process 10 → 22)");
  assert.equal(describeChange(change({ health: "healthy" }, { health: "unhealthy", ports: [8080, 9090] })), "Health healthy → unhealthy · Ports :8080 → :8080, :9090");
  assert.equal(describeChange(change({ ports: [] }, { state: "stopped", ports: [] })), "Running → Stopped");
  assert.equal(describeChange(change({}, {})), "Seen again, unchanged");
});

test("a process shows when it started only where the source gave a time", () => {
  assert.equal(processText({ pid: 5120, process_started: iso(5 * 60_000 + 2000) }), "5120, started 5m ago");
  assert.equal(processText({ pid: 5120 }), "5120");
  assert.equal(processText({ process_started: iso(0) }), undefined);
  // Linux: a boot id and start ticks, in any of the shapes it may take.
  for (const token of ["6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f/1873921", "6f1c2d3e4b5a4c7d8e9f0a1b2c3d4e5f:1873921", "1873921", "2026", "boot 2026 1873921", ""]) {
    const text = processText({ pid: 5120, process_started: token });
    assert.equal(text, "5120", token);
    assert.doesNotMatch(text ?? "", /NaN|started/, token);
  }
});

test("an answer observed before what is held is late, and one at or after it is not", () => {
  const at = (msAgo: number) => ({ ...snap([], []), at: iso(msAgo) });
  const held = at(60_000);
  assert.equal(olderSnapshot(at(HOUR), held), true);
  assert.equal(olderSnapshot(at(1000), held), false);
  assert.equal(olderSnapshot(held, held), false);
  assert.equal(olderSnapshot(at(HOUR), undefined), false);
  // A time that cannot be read is not grounds to drop an answer.
  assert.equal(olderSnapshot({ ...held, at: "" }, held), false);
});

test("a page of history is appended once, in order", () => {
  const change = (id: number): Change => ({ id, machine_id: "m1", service_id: "s1", at: iso(0), after: service(), gap: false });
  const held = [change(1), change(2)];
  assert.deepEqual(appendChanges(held, [change(3), change(4)]).map((c) => c.id), [1, 2, 3, 4]);
  // The same page answered twice, or one that overlaps, adds nothing twice.
  assert.deepEqual(appendChanges(held, [change(2), change(3), change(3)]).map((c) => c.id), [1, 2, 3]);
  assert.equal(appendChanges(held, [change(1), change(2)]), held);
  assert.deepEqual(appendChanges([], []), []);
});

// Jobs a test finishes by hand, in the order it chooses.
function jobs() {
  const started: string[] = [];
  const pending: { key: string; finish(): void; fail(): void }[] = [];
  const job = (key: string) =>
    new Promise<void>((resolve, reject) => {
      started.push(key);
      pending.push({ key, finish: resolve, fail: () => reject(new Error("failed")) });
    });
  return { started, pending, load: coalesceBy(job) };
}
const settled = async (p: Promise<void>) => {
  let done = false;
  void p.then(() => (done = true));
  // Past every microtask a finished job queues.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return done;
};

test("calls for a key whose job is running get one more run, and wait for it", async () => {
  const { started, pending, load } = jobs();
  const first = load("a");
  const second = load("a");
  const third = load("a");
  assert.deepEqual(started, ["a"]);
  pending[0].finish();
  assert.equal(await settled(second), false);
  assert.deepEqual(started, ["a", "a"]);
  pending[1].finish();
  assert.deepEqual([await settled(first), await settled(second), await settled(third)], [true, true, true]);
  assert.deepEqual(started, ["a", "a"]);
  // Nothing is left running: the next call starts a job of its own.
  void load("a");
  assert.deepEqual(started, ["a", "a", "a"]);
});

test("a call for another key starts at once, and the key before it is not run again", async () => {
  const { started, pending, load } = jobs();
  void load("a");
  void load("a");
  const other = load("b");
  assert.deepEqual(started, ["a", "b"]);
  // The earlier key's job ends, late or failed: its second run is dropped.
  pending[0].fail();
  assert.equal(await settled(other), false);
  assert.deepEqual(started, ["a", "b"]);
  // The new key still coalesces as usual.
  const again = load("b");
  pending[1].finish();
  assert.equal(await settled(again), false);
  assert.deepEqual(started, ["a", "b", "b"]);
  pending[2].finish();
  assert.deepEqual([await settled(other), await settled(again)], [true, true]);
});

test("the client asks the agent's machine routes and fills lists Go sent as null", async () => {
  const devl = { id: "m/1", name: "devl", routes: null, updated_at: iso(0) };
  const { calls, client } = recorder({
    "GET /v1/machines": null,
    "GET /v1/machines?local=1": [devl],
    "GET /v1/machines?box=dev%20box": [devl],
    "GET /v1/machines/m%2F1/inventory": { machine: devl, services: [{ ...service(), ports: null }], coverage: null, at: iso(0) },
    "GET /v1/machines/m%2F1/history?service=s1&limit=100": null,
    "GET /v1/machines/m%2F1/history?service=s1&after=7&limit=100": [],
    "POST /v1/machines/m%2F1/refresh": { machine: devl, services: null, coverage: null, at: iso(0) },
    "POST /v1/machines": devl,
    "PUT /v1/machines/m%2F1/routes": devl,
  });
  assert.deepEqual(await inventoryApi.machines(client), []);
  assert.deepEqual((await inventoryApi.find(client, { local: true }))?.routes, []);
  assert.equal((await inventoryApi.find(client, { box: "dev box" }))?.name, "devl");
  const got = await inventoryApi.inventory(client, "m/1");
  assert.deepEqual([got.machine.routes, got.services[0].ports, got.coverage], [[], [], []]);
  assert.deepEqual(await inventoryApi.history(client, "m/1", "s1"), []);
  await inventoryApi.history(client, "m/1", "s1", 7);
  assert.deepEqual((await inventoryApi.refresh(client, "m/1")).services, []);
  await inventoryApi.register(client, { name: "nas", target: "admin@nas" });
  await inventoryApi.register(client, { name: "nas", os: "linux", target: "admin@nas" });
  await inventoryApi.setRoutes(client, "m/1", [{ kind: "paired", target: "devl" }]);
  assert.deepEqual(calls.slice(-4), [
    { method: "POST", path: "/v1/machines/m%2F1/refresh", body: {} },
    { method: "POST", path: "/v1/machines", body: { name: "nas", routes: [{ kind: "ssh", target: "admin@nas" }] } },
    { method: "POST", path: "/v1/machines", body: { name: "nas", os: "linux", routes: [{ kind: "ssh", target: "admin@nas" }] } },
    { method: "PUT", path: "/v1/machines/m%2F1/routes", body: { routes: [{ kind: "paired", target: "devl" }] } },
  ]);
});
