import { readFileSync } from "node:fs";

import type { Locator } from "@playwright/test";

import { BOX, fakeAgent } from "./fake-agent";
import { type App, expect, mockOnly, test } from "./fixtures";

// Machine inventory (src/lib/inventory.ts), on a stand-in agent whose
// /v1/machines routes are answered here. inventory.feature holds the
// behaviour in words; each scenario there is the test of the same name here.

const feature = readFileSync(new URL("./inventory.feature", import.meta.url), "utf8");
const scenarios = [...feature.matchAll(/^\s*Scenario: (.+)$/gm)].map((m) => m[1].trim());
const bound: string[] = [];

function scenario(name: string, body: (fixtures: { app: App }) => Promise<void>) {
  if (!scenarios.includes(name)) throw new Error(`inventory.feature has no scenario named "${name}"`);
  bound.push(name);
  test(name, body);
}

interface Route {
  kind: "local" | "paired" | "ssh";
  target?: string;
}
interface Machine {
  id: string;
  name: string;
  os?: string;
  routes: Route[];
  updated_at: string;
}
interface Service {
  id: string;
  machine_id: string;
  key: string;
  source: string;
  name: string;
  state: "unknown" | "running" | "stopped" | "failed" | "disappeared";
  health?: string;
  ports: number[];
  pid?: number;
  process_started?: string;
  location?: string;
  worktree?: string;
  observed_at: string;
}
interface Coverage {
  source: string;
  state: "ok" | "partial" | "unavailable" | "error";
  error?: string;
  at: string;
}
interface Snapshot {
  machine: Machine;
  services: Service[];
  coverage: Coverage[];
  at: string;
}
interface Change {
  id: number;
  machine_id: string;
  service_id: string;
  at: string;
  before?: Service;
  after: Service;
  gap: boolean;
}

// A time that reads as "5m ago" or "2h ago" for the length of a test.
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000 - 5_000).toISOString();

const devl = (): Machine => ({ id: "m-devl", name: BOX, os: "linux", routes: [{ kind: "paired", target: "e2e" }], updated_at: minutesAgo(600) });
const local = (): Machine => ({ id: "m-local", name: "work-hp", os: "windows", routes: [{ kind: "local" }], updated_at: minutesAgo(600) });
const nas = (): Machine => ({ id: "m-nas", name: "nas", os: "linux", routes: [{ kind: "ssh", target: "admin@nas.lan" }], updated_at: minutesAgo(600) });

const service = (machine: Machine, key: string, source: string, name: string, state: Service["state"], more: Partial<Service> = {}): Service => ({
  id: `${machine.id}:${key}`,
  machine_id: machine.id,
  key,
  source,
  name,
  state,
  ports: [],
  observed_at: minutesAgo(5),
  ...more,
});
const read = (at: string, ...sources: string[]): Coverage[] => sources.map((source): Coverage => ({ source, state: "ok", at }));

function devlSnapshot(): Snapshot {
  const machine = devl();
  const at = minutesAgo(5);
  return {
    machine,
    at,
    services: [
      service(machine, "claude", "burf-agents", "Claude Code", "running", { worktree: "/w/shop-fix", pid: 4411, observed_at: at }),
      // A Linux start token: a boot id and start ticks, not a time.
      service(machine, "vite", "listeners", "checkout-web", "running", { ports: [5173], location: "/w/shop", pid: 5120, process_started: "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f/1873921", observed_at: at }),
      service(machine, "redis", "docker", "redis", "running", { health: "healthy", ports: [6379], observed_at: at }),
      service(machine, "backup", "systemd-system", "backup.service", "failed", { observed_at: at }),
    ],
    coverage: read(at, "connection", "burf-agents", "listeners", "docker", "systemd-system"),
  };
}

function localSnapshot(): Snapshot {
  const machine = local();
  const at = minutesAgo(5);
  return {
    machine,
    at,
    services: [service(machine, "ollama", "listeners", "ollama", "running", { ports: [11434], observed_at: at }), service(machine, "lxss", "windows-services", "LxssManager", "running", { observed_at: at })],
    coverage: read(at, "connection", "listeners", "windows-services"),
  };
}

// nas as read at a given time: one running container.
function nasSnapshot(at: string): Snapshot {
  const machine = nas();
  return { machine, at, services: [service(machine, "postgres", "docker", "postgres", "running", { health: "healthy", ports: [5432], observed_at: at })], coverage: read(at, "connection", "docker") };
}

interface Setup {
  machines?: Machine[];
  snapshots?: Record<string, Snapshot>;
  history?: Record<string, Change[]>;
  // What a scan answers: a new snapshot, or the agent's refusal.
  refresh?: (id: string) => { snapshot: Snapshot } | { error: string };
  // Reads of a machine's inventory wait for this, then answer with what the
  // agent held when they were asked.
  holdReads?: Promise<void>;
  // The agent is older than machine inventory.
  missing?: boolean;
  // This computer runs local agents (/v1/local).
  local?: boolean;
}

async function inventory(app: App, setup: Setup = {}) {
  const agent = await fakeAgent();
  const machines = setup.machines ?? [devl()];
  const snapshots = { ...setup.snapshots };
  const calls: { method: string; path: string; body: unknown }[] = [];
  const sameRoute = (a: Route, b: Route) => a.kind === b.kind && (a.target ?? "") === (b.target ?? "");
  // A pairing is the daemon's fingerprint, whatever name the box goes by.
  const fingerprints: Record<string, string> = { [BOX]: "e2e" };
  const resolved = (r: Route): Route => (r.kind === "paired" && r.target && fingerprints[r.target] ? { kind: "paired", target: fingerprints[r.target] } : r);

  await app.context.route(`${agent.url}/v1/boxes/${BOX}/api/worktrees`, (route) => route.fulfill({ json: [] }));
  if (setup.local) {
    await app.context.route(`${agent.url}/v1/local**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path === "/v1/local" ? { client_scope: "fixture-owner", supported: true, name: "work-hp", home: "C:\\Projects\\shop", agents: [{ id: "codex", available: true, can_chat: true }], sessions: [] } : path === "/v1/local/conversations" ? [] : {};
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
  }
  if (!setup.missing) {
    await app.context.route(`${agent.url}/v1/machines**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const body = req.postDataJSON() as { name?: string; os?: string; routes?: Route[] } | null;
      calls.push({ method: req.method(), path: url.pathname + url.search, body });
      const answer = (status: number, value: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });

      if (url.pathname === "/v1/machines") {
        if (req.method() === "POST") {
          // A new identity each time: the agent never merges by name.
          const machine: Machine = { id: `m-${body?.name}`, name: body?.name ?? "", os: body?.os, routes: body?.routes ?? [], updated_at: minutesAgo(0) };
          machines.push(machine);
          return answer(200, machine);
        }
        if (url.searchParams.has("local")) return answer(200, machines.filter((m) => m.routes.some((r) => r.kind === "local")));
        // A box's machine is whichever one holds its pairing, not one of its name.
        const box = url.searchParams.get("box");
        return answer(200, box ? machines.filter((m) => m.routes.some((r) => r.kind === "paired" && r.target === fingerprints[box])) : machines);
      }

      const [, id, part] = /^\/v1\/machines\/([^/]+)\/(\w+)$/.exec(url.pathname) ?? [];
      const machine = machines.find((m) => m.id === decodeURIComponent(id ?? ""));
      if (!machine) return answer(404, { error: "no machine with that id" });
      if (part === "routes" && req.method() === "PUT") {
        // As the agent does it: routes are added, never dropped, and a route
        // has one owner. One held by another machine moves here, and a
        // machine left with no route is removed. This machine keeps its own
        // snapshot and history.
        for (const r of body?.routes ?? []) {
          const added = resolved(r);
          if (machine.routes.some((have) => sameRoute(have, added))) continue;
          for (const owner of [...machines]) {
            if (owner === machine || !owner.routes.some((have) => sameRoute(have, added))) continue;
            owner.routes = owner.routes.filter((have) => !sameRoute(have, added));
            if (owner.routes.length > 0) continue;
            machines.splice(machines.indexOf(owner), 1);
            delete snapshots[owner.id];
          }
          machine.routes.push(added);
        }
        return answer(200, machine);
      }
      const held = (): Snapshot => ({ ...(snapshots[machine.id] ?? { services: [], coverage: [], at: minutesAgo(0) }), machine });
      if (part === "inventory" && req.method() === "GET") {
        const asked = held();
        if (setup.holdReads) await setup.holdReads;
        // The page may have given up on a read it no longer needs.
        return answer(200, asked).catch(() => {});
      }
      if (part === "refresh" && req.method() === "POST") {
        const result = setup.refresh?.(machine.id);
        if (result && "error" in result) return answer(502, { error: result.error });
        if (result) snapshots[machine.id] = result.snapshot;
        return answer(200, held());
      }
      if (part === "history" && req.method() === "GET") {
        // Oldest first, from after the last change the page holds.
        const after = Number(url.searchParams.get("after") ?? 0);
        return answer(200, (setup.history?.[url.searchParams.get("service") ?? ""] ?? []).filter((c) => c.id > after));
      }
      return answer(404, { error: "not on this agent" });
    });
  }
  // An empty Home: its widgets would probe each project's Git and GitHub
  // state with POSTs of their own, and the cases here count what is written.
  await app.open({ agent, prefs: { home: { version: 1, items: [] } } });
  return { agent, calls };
}

const row = (scope: Locator, name: string) => scope.locator(`[data-testid="inventory-service"][data-service="${name}"]`);
const source = (scope: Locator, id: string) => scope.locator(`[data-testid="inventory-source"][data-source="${id}"]`);

// Opens a paired computer's page and its Services sheet. machine is the
// agent's record for it, which need not go by the box's name.
async function openServices(app: App, box: string, machine = box) {
  await app.page.getByRole("button", { name: `Open computer ${box}`, exact: true }).click();
  await expect(app.page.getByRole("heading", { name: `Worktrees on ${box}`, exact: true })).toBeVisible();
  await app.page.getByRole("button", { name: `Services on ${machine}`, exact: true }).click();
  const sheet = app.page.getByRole("dialog", { name: `Services on ${machine}`, exact: true });
  await expect(sheet.getByTestId("machine-inventory")).toBeVisible();
  return sheet;
}

// Opens an SSH-only machine's page from the sidebar.
async function openMachine(app: App, machine: string) {
  await app.page.getByRole("button", { name: `Open machine ${machine}`, exact: true }).click();
  await expect(app.page.getByRole("heading", { name: machine, exact: true, level: 1 })).toBeVisible();
  return app.page.getByTestId("machine-inventory");
}

test.beforeEach(() => mockOnly("isolated machine inventory API"));

// Compile the dev server's shell/settings modules before measuring behavior.
// Hosted checks use an existing bundle and need no compiler warmup.
test.beforeAll(async ({ browser }) => {
  if (process.env.E2E_DEV !== "1") return;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await context.addInitScript(() => localStorage.setItem("berth.prefs", JSON.stringify({ home: { version: 1, items: [] }, whatsNewSeen: "999.0.0" })));
    await page.goto(`http://localhost:${process.env.E2E_PORT ?? "1434"}/?mock=1`);
    await expect(page.getByTestId("nav-home")).toBeVisible();
    await page.getByTestId("nav-settings").click();
    await page.getByTestId("settings-nav-boxes").click();
    await expect(page.getByTestId("settings-boxes")).toBeVisible();
  } finally {
    await context.close();
  }
});

scenario("Selecting a machine shows only that machine's services", async ({ app }) => {
  const { agent, calls } = await inventory(app, { machines: [devl(), local()], snapshots: { "m-devl": devlSnapshot(), "m-local": localSnapshot() }, local: true });
  try {
    const sheet = await openServices(app, BOX);
    await expect(sheet.getByTestId("inventory-summary")).toContainText("4 services · 1 failed · read 5m ago");
    await expect(source(sheet, "listeners")).toContainText("Dev servers");
    const web = row(source(sheet, "listeners"), "checkout-web");
    await expect(web.getByTestId("service-status")).toHaveText("Running");
    await expect(web).toContainText(":5173");
    await expect(web).toContainText("5m ago");
    const redis = row(source(sheet, "docker"), "redis");
    await expect(redis.getByTestId("service-health")).toHaveText("Health: healthy");
    await expect(redis).toContainText(":6379");
    // Health shows only where the source reported one.
    await expect(web.getByTestId("service-health")).toHaveCount(0);
    await expect(row(source(sheet, "systemd-system"), "backup.service").getByTestId("service-status")).toHaveText("Failed");
    await expect(row(source(sheet, "burf-agents"), "Claude Code").getByTestId("service-status")).toHaveText("Running");
    await web.getByRole("button", { name: "checkout-web", exact: true }).click();
    const details = sheet.getByRole("region", { name: "checkout-web details", exact: true });
    await expect(details).toContainText("/w/shop");
    await expect(details).toContainText("Read only");
    await expect(row(sheet, "ollama")).toHaveCount(0);
    await expect(row(sheet, "LxssManager")).toHaveCount(0);

    await app.page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await app.page.getByTestId("nav-local").click();
    await app.page.getByRole("button", { name: "Services on work-hp", exact: true }).click();
    const mine = app.page.getByRole("dialog", { name: "Services on work-hp", exact: true });
    await expect(row(mine, "ollama").getByTestId("service-status")).toHaveText("Running");
    await expect(row(source(mine, "windows-services"), "LxssManager")).toBeVisible();
    await expect(mine.getByTestId("inventory-service")).toHaveCount(2);
    await expect(row(mine, "redis")).toHaveCount(0);

    expect(calls.some((c) => c.path === "/v1/machines/m-devl/inventory")).toBe(true);
    expect(calls.some((c) => c.path === "/v1/machines/m-local/inventory")).toBe(true);
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  } finally {
    await agent.close();
  }
});

scenario("A machine registered for SSH inspection cannot start chats or tasks", async ({ app }) => {
  const { agent, calls } = await inventory(app, { snapshots: { "m-nas": nasSnapshot(minutesAgo(5)) } });
  try {
    await expect(app.page.getByTestId("nav-machine")).toHaveCount(0);
    const settings = await app.openSettings("boxes");
    await settings.getByRole("button", { name: "Inspect over SSH", exact: true }).click();
    const dialog = app.page.getByRole("dialog", { name: "Inspect over SSH", exact: true });
    await expect(dialog).toContainText("This does not install Burf's daemon: chats and tasks cannot start on a machine that is only inspected.");
    const submit = dialog.getByRole("button", { name: "Inspect over SSH", exact: true });
    await expect(submit).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("nas");
    await dialog.getByRole("textbox", { name: "SSH target", exact: true }).fill("admin@nas.lan");
    await submit.click();
    await expect(dialog).toBeHidden();
    expect(calls.filter((c) => c.method === "POST")).toEqual([{ method: "POST", path: "/v1/machines", body: { name: "nas", routes: [{ kind: "ssh", target: "admin@nas.lan" }] } }]);

    await expect(app.page.getByRole("button", { name: "Open machine nas", exact: true })).toContainText("SSH only");
    const services = await openMachine(app, "nas");
    await expect(app.page.getByTestId("machine-inspected-note")).toContainText("Burf's daemon is not installed on nas, so chats and tasks cannot start here.");
    await expect(row(services, "postgres").getByTestId("service-status")).toHaveText("Running");

    const main = app.page.getByRole("main");
    await expect(main.getByTestId("task-composer")).toHaveCount(0);
    await expect(main.getByRole("textbox")).toHaveCount(0);
    await expect(main.getByRole("button", { name: /new task|new chat|add (a )?project|send/i })).toHaveCount(0);
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) /.test(call))).toEqual([]);
    expect(calls.filter((c) => c.method !== "GET").length).toBe(1);
  } finally {
    await agent.close();
  }
});

scenario("An unreachable machine keeps its last-known services", async ({ app }) => {
  const seen = minutesAgo(60);
  const failed = minutesAgo(0);
  const { agent } = await inventory(app, {
    machines: [devl(), nas()],
    snapshots: { "m-nas": nasSnapshot(seen) },
    // The scan fails: coverage is the attempt, the service is as last seen.
    refresh: () => ({
      snapshot: {
        ...nasSnapshot(seen),
        at: failed,
        coverage: [
          { source: "connection", state: "error", error: "ssh: connect to host nas.lan port 22: Operation timed out", at: failed },
          { source: "docker", state: "unavailable", at: failed },
        ],
      },
    }),
  });
  try {
    const services = await openMachine(app, "nas");
    const postgres = row(services, "postgres");
    await expect(postgres.getByTestId("service-status")).toHaveText("Running");
    await expect(services.getByTestId("inventory-unreachable")).toHaveCount(0);

    await services.getByRole("button", { name: "Scan now", exact: true }).click();
    const lost = services.getByTestId("inventory-unreachable");
    await expect(lost).toContainText("nas could not be reached at the last scan, just now");
    await expect(lost).toContainText("ssh: connect to host nas.lan port 22: Operation timed out.");
    await expect(lost).toContainText("Services are shown as last seen. They may still be running.");
    await expect(postgres.getByTestId("service-status")).toHaveText("Last seen running");
    await expect(postgres).toContainText("1h ago");
    await expect(postgres).not.toContainText("Stopped");
    const collector = source(services, "docker").getByTestId("collector-state");
    await expect(collector).toHaveAttribute("data-state", "unavailable");
    await expect(collector).toHaveText("Unavailable, checked just now");
  } finally {
    await agent.close();
  }
});

scenario("A scan the agent cannot run keeps what was last read", async ({ app }) => {
  const { agent } = await inventory(app, { machines: [devl(), nas()], snapshots: { "m-nas": nasSnapshot(minutesAgo(5)) }, refresh: () => ({ error: "a scan of nas is already running" }) });
  try {
    const services = await openMachine(app, "nas");
    await expect(row(services, "postgres").getByTestId("service-status")).toHaveText("Running");
    await services.getByRole("button", { name: "Scan now", exact: true }).click();
    const alert = services.getByTestId("inventory-scan-error");
    await expect(alert).toContainText("Could not scan nas now");
    await expect(alert).toContainText("a scan of nas is already running");
    await expect(alert).toContainText("What was last read is still shown.");
    await expect(row(services, "postgres").getByTestId("service-status")).toHaveText("Running");
  } finally {
    await agent.close();
  }
});

scenario("An unavailable collector is reported with its reason and age", async ({ app }) => {
  const snapshot = devlSnapshot();
  snapshot.coverage = snapshot.coverage.map((c): Coverage => (c.source === "docker" ? { ...c, state: "unavailable", error: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock" } : c));
  snapshot.services = snapshot.services.map((s): Service => (s.source === "docker" ? { ...s, observed_at: minutesAgo(120) } : s));
  const { agent } = await inventory(app, { snapshots: { "m-devl": snapshot } });
  try {
    const sheet = await openServices(app, BOX);
    const docker = source(sheet, "docker");
    await expect(docker.getByTestId("collector-state")).toHaveAttribute("data-state", "unavailable");
    await expect(docker.getByTestId("collector-state")).toHaveText("Unavailable, checked 5m ago");
    const reason = docker.getByTestId("collector-alert");
    await expect(reason).toContainText("Docker containers could not be read");
    await expect(reason).toContainText("Cannot connect to the Docker daemon at unix:///var/run/docker.sock.");
    await expect(reason).toContainText("What was last seen is still listed.");
    const redis = row(docker, "redis");
    await expect(redis.getByTestId("service-status")).toHaveText("Last seen running");
    await expect(redis).toContainText("2h ago");

    const listeners = source(sheet, "listeners");
    await expect(listeners.getByTestId("collector-state")).toHaveText("Scanned 5m ago");
    await expect(listeners.getByTestId("collector-alert")).toHaveCount(0);
    await expect(row(listeners, "checkout-web").getByTestId("service-status")).toHaveText("Running");
    await expect(sheet.getByTestId("inventory-unreachable")).toHaveCount(0);
  } finally {
    await agent.close();
  }
});

scenario("A service's history can be selected", async ({ app }) => {
  const snapshot = devlSnapshot();
  const web = snapshot.services.find((s) => s.name === "checkout-web")!;
  const redis = snapshot.services.find((s) => s.name === "redis")!;
  const change = (id: number, minutes: number, before: Service | undefined, after: Service, gap = false): Change => ({ id, machine_id: after.machine_id, service_id: after.id, at: minutesAgo(minutes), before, after, gap });
  const down: Service = { ...web, state: "failed", ports: [] };
  const { agent, calls } = await inventory(app, {
    snapshots: { "m-devl": snapshot },
    history: {
      [web.id]: [change(1, 300, undefined, web), change(2, 90, web, down, true), change(3, 30, down, web)],
      [redis.id]: [change(4, 400, undefined, redis)],
    },
  });
  try {
    const sheet = await openServices(app, BOX);
    await row(sheet, "checkout-web").getByRole("button", { name: "checkout-web", exact: true }).click();
    const details = sheet.getByRole("region", { name: "checkout-web details", exact: true });
    await expect(details).toContainText("Dev servers");
    await expect(details).toContainText(":5173");
    await expect(details).toContainText("/w/shop");
    // Its start token is not a time: the process is its number and no more.
    const facts = details.locator("dl");
    await expect(facts.locator("dd").filter({ hasText: /^5120$/ })).toHaveCount(1);
    await expect(facts).not.toContainText("started");
    await expect(details).not.toContainText("NaN");
    await expect(row(sheet, "checkout-web")).toHaveAttribute("data-state", "selected");
    const changes = details.getByTestId("inventory-change");
    await expect(changes).toHaveText([/First seen running/, /Running → Failed · Ports :5173 → none.*After a gap in scans/, /Failed → Running · Ports none → :5173/]);
    await expect(changes.nth(1)).toHaveAttribute("data-gap", "true");
    await expect(changes.nth(0)).not.toHaveAttribute("data-gap", "true");
    await expect(details).toContainText("it may have changed earlier than the time shown");

    await row(sheet, "redis").getByRole("button", { name: "redis", exact: true }).click();
    const other = sheet.getByRole("region", { name: "redis details", exact: true });
    await expect(other.getByTestId("inventory-change")).toHaveText([/First seen running/]);
    await expect(details).toHaveCount(0);

    // Each selection asks for that service's first page (the dev server repeats a read).
    const asked = calls.filter((c) => c.path.startsWith("/v1/machines/m-devl/history?")).map((c) => c.path.split("?")[1]);
    expect([...new Set(asked)].map((query) => Object.fromEntries(new URLSearchParams(query)))).toEqual([
      { service: web.id, limit: "100" },
      { service: redis.id, limit: "100" },
    ]);
  } finally {
    await agent.close();
  }
});

scenario("An open history gains the change a scan records", async ({ app }) => {
  const snapshot = devlSnapshot();
  const web = snapshot.services.find((s) => s.name === "checkout-web")!;
  const scanned = minutesAgo(0);
  const down: Service = { ...web, state: "failed", observed_at: scanned };
  const history: Record<string, Change[]> = { [web.id]: [{ id: 1, machine_id: web.machine_id, service_id: web.id, at: minutesAgo(300), after: web, gap: false }] };
  const { agent, calls } = await inventory(app, {
    snapshots: { "m-devl": snapshot },
    history,
    // The scan finds the dev server failed, and the agent records the change.
    refresh: () => {
      history[web.id].push({ id: 2, machine_id: web.machine_id, service_id: web.id, at: scanned, before: web, after: down, gap: false });
      return { snapshot: { ...snapshot, at: scanned, services: snapshot.services.map((s): Service => (s.id === web.id ? down : s)), coverage: read(scanned, "connection", "burf-agents", "listeners", "docker", "systemd-system") } };
    },
  });
  try {
    const sheet = await openServices(app, BOX);
    const server = row(sheet, "checkout-web");
    await server.getByRole("button", { name: "checkout-web", exact: true }).click();
    const details = sheet.getByRole("region", { name: "checkout-web details", exact: true });
    const changes = details.getByTestId("inventory-change");
    await expect(changes).toHaveText([/First seen running/]);

    await sheet.getByRole("button", { name: "Scan now", exact: true }).click();
    await expect(server.getByTestId("service-status")).toHaveText("Failed");
    // Still open: the change joins what was already shown.
    await expect(changes).toHaveText([/First seen running/, /Running → Failed/]);
    await expect(server).toHaveAttribute("data-state", "selected");
    await expect(details.getByText("History could not be read", { exact: true })).toHaveCount(0);

    // Read on from the last change held, not from the start again.
    const asked = calls.filter((c) => c.path.startsWith("/v1/machines/m-devl/history?")).map((c) => c.path.split("?")[1]);
    expect([...new Set(asked)].map((query) => Object.fromEntries(new URLSearchParams(query)))).toEqual([
      { service: web.id, limit: "100" },
      { service: web.id, after: "1", limit: "100" },
    ]);
  } finally {
    await agent.close();
  }
});

scenario("An SSH route is attached to an existing machine the person chooses", async ({ app }) => {
  const { agent, calls } = await inventory(app);
  try {
    const settings = await app.openSettings("boxes");
    await settings.getByRole("button", { name: `Add a route to ${BOX}`, exact: true }).click();
    const dialog = app.page.getByRole("dialog", { name: `Add a route to ${BOX}`, exact: true });
    await expect(dialog.getByRole("combobox", { name: "Machine", exact: true })).toContainText(BOX);
    await expect(dialog).toContainText("Burf never merges machines by name.");
    const target = dialog.getByRole("textbox", { name: "SSH target", exact: true });
    const submit = dialog.getByRole("button", { name: "Add route", exact: true });

    await target.fill("-oProxyCommand=x");
    await expect(target).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByText("An SSH target cannot start with a dash.", { exact: true })).toBeVisible();
    await expect(target).toHaveAccessibleDescription(/An SSH target cannot start with a dash\./);
    await expect(submit).toBeDisabled();

    await target.fill("me@devl.lan");
    await expect(target).not.toHaveAttribute("aria-invalid", "true");
    await submit.click();
    await expect(dialog).toBeHidden();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([
      { method: "PUT", path: "/v1/machines/m-devl/routes", body: { routes: [{ kind: "paired", target: "e2e" }, { kind: "ssh", target: "me@devl.lan" }] } },
    ]);
    await expect(settings.getByText("Paired · SSH me@devl.lan", { exact: true })).toBeVisible();
    // Still a paired computer: it does not move to the SSH-only machines.
    await expect(app.page.getByTestId("nav-machine")).toHaveCount(0);
    await expect(app.page.getByRole("button", { name: `Open computer ${BOX}`, exact: true })).toBeVisible();
  } finally {
    await agent.close();
  }
});

scenario("A paired computer is attached to a machine inspected over SSH", async ({ app }) => {
  const { agent, calls } = await inventory(app, { machines: [devl(), nas()], snapshots: { "m-devl": devlSnapshot(), "m-nas": nasSnapshot(minutesAgo(5)) } });
  try {
    await expect(app.page.getByRole("button", { name: "Open machine nas", exact: true })).toBeVisible();
    // Before: the paired computer's own record answers for it.
    const before = await openServices(app, BOX);
    await expect(row(before, "redis").getByTestId("service-status")).toHaveText("Running");
    await app.page.keyboard.press("Escape");
    await expect(before).toBeHidden();

    const settings = await app.openSettings("boxes");
    await settings.getByRole("button", { name: "Add a route to nas", exact: true }).click();
    const dialog = app.page.getByRole("dialog", { name: "Add a route to nas", exact: true });
    await dialog.getByRole("button", { name: "Paired computer", exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: "Paired computer", exact: true })).toContainText(BOX);
    await dialog.getByRole("button", { name: "Add route", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(calls.filter((c) => c.method !== "GET")).toEqual([
      { method: "PUT", path: "/v1/machines/m-nas/routes", body: { routes: [{ kind: "ssh", target: "admin@nas.lan" }, { kind: "paired", target: BOX }] } },
    ]);
    await expect(settings.getByText("SSH admin@nas.lan · Paired", { exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Open machine nas", exact: true })).toHaveCount(0);

    // The pairing now belongs to nas, and the record that held it is gone:
    // the paired computer's page reads nas, and nothing asks for the old one.
    const attached = calls.findIndex((c) => c.method === "PUT");
    const after = await openServices(app, BOX, "nas");
    await expect(row(after, "postgres").getByTestId("service-status")).toHaveText("Running");
    await expect(after.getByTestId("inventory-service")).toHaveCount(1);
    await expect(row(after, "redis")).toHaveCount(0);
    await expect(after.getByTestId("inventory-read-error")).toHaveCount(0);
    const later = calls.slice(attached + 1).map((c) => c.path);
    expect(later).toContain("/v1/machines/m-nas/inventory");
    expect(later.filter((path) => path.startsWith("/v1/machines/m-devl"))).toEqual([]);
    expect(calls.filter((c) => c.method !== "GET").length).toBe(1);
  } finally {
    await agent.close();
  }
});

scenario("A scan's result is not replaced by an older answer that arrives late", async ({ app }) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const scanned = minutesAgo(0);
  const machine = nas();
  const found: Snapshot = {
    machine,
    at: scanned,
    services: [
      service(machine, "postgres", "docker", "postgres", "running", { health: "healthy", ports: [5432], observed_at: scanned }),
      service(machine, "grafana", "docker", "grafana", "running", { ports: [3000], observed_at: scanned }),
    ],
    coverage: read(scanned, "connection", "docker"),
  };
  const { agent } = await inventory(app, { machines: [devl(), nas()], snapshots: { "m-nas": nasSnapshot(minutesAgo(60)) }, holdReads: gate, refresh: () => ({ snapshot: found }) });
  try {
    const services = await openMachine(app, "nas");
    // The page's first read is asked and not yet answered.
    await expect(services.getByTestId("inventory-summary")).toHaveText("Reading services…");
    await services.getByRole("button", { name: "Scan now", exact: true }).click();
    await expect(row(services, "grafana").getByTestId("service-status")).toHaveText("Running");
    await expect(services.getByTestId("inventory-summary")).toContainText("2 services · read just now");

    // That first read is answered now, with what the agent held an hour ago.
    const late = app.page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/v1/machines/m-nas/inventory");
    release();
    await (await late).finished();
    await expect(services.getByTestId("inventory-service")).toHaveCount(2);
    await expect(row(services, "grafana").getByTestId("service-status")).toHaveText("Running");
    await expect(services.getByTestId("inventory-summary")).toContainText("2 services · read just now");
    await expect(row(services, "postgres")).toContainText("just now");
  } finally {
    release();
    await agent.close();
  }
});

scenario("A backend without machine inventory leaves machine views as they were", async ({ app }) => {
  const { agent } = await inventory(app, { missing: true });
  try {
    await app.page.getByRole("button", { name: `Open computer ${BOX}`, exact: true }).click();
    await expect(app.page.getByRole("heading", { name: `Worktrees on ${BOX}`, exact: true })).toBeVisible();
    await expect(app.page.getByRole("button", { name: `New task on ${BOX}`, exact: true })).toBeEnabled();
    await expect(app.page.getByRole("main").getByRole("button", { name: `Add a project on ${BOX}`, exact: true }).first()).toBeEnabled();
    // The agent has answered that it has no such route before the page is judged.
    await expect.poll(() => agent.calls.includes(`GET /v1/machines?box=${BOX}`)).toBe(true);
    await expect(app.page.getByRole("button", { name: /^Services/ })).toHaveCount(0);
    await expect(app.page.getByTestId("nav-machine")).toHaveCount(0);

    const settings = await app.openSettings("boxes");
    const missing = settings.getByTestId("inventory-missing");
    await expect(missing).toContainText("Machine inventory is not available");
    await expect(missing).toContainText("Update Burf on this computer");
    await expect(settings.getByRole("button", { name: "Inspect over SSH", exact: true })).toBeDisabled();
    expect(agent.calls.filter((call) => /^(POST|PUT|DELETE) /.test(call))).toEqual([]);
  } finally {
    await agent.close();
  }
});

test("every scenario in inventory.feature has a test", () => {
  expect(scenarios.length).toBeGreaterThan(0);
  expect([...bound].sort()).toEqual([...scenarios].sort());
});
