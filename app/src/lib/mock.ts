import type { BerthEvent, Client, Hook, HooksFile, Location, Service, Session, Stats, Status, TerminalHandlers } from "@/lib/api";
import { flowsCall } from "@/lib/mock-flows";
import { phoneCall } from "@/lib/mock-phone";
import { worktreesCall } from "@/lib/mock-worktrees";
import { kitsCall, kitsStream } from "@/lib/mock-kits";
import { reviewCall, reviewExec } from "@/lib/mock-review";
import { editorsCall } from "@/lib/mock-editors";
import { mockShell } from "@/lib/mock-shell";
import { mockIssueTitle } from "@/lib/mock-issues";
import { usageCall, usageExec } from "@/lib/mock-usage";
import { initMockQueue, queueCall } from "@/lib/mock-queue";
import { ApiError } from "@/lib/api";

// Mock mode (?mock=1) runs the whole UI on fixtures, so it can be worked on
// without an agent or a box. State is mutable: new tasks and sessions appear,
// and an agent changes state now and then so notifications can be seen.

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();
const GB = 1024 ** 3;

const status: Status = {
  boxes: [
    { name: "devl", address: "100.64.0.4:7444", fingerprint: "sha256:9f2c…", state: "online", latency_ms: 38, since: ago(140) },
    { name: "gpu", address: "100.64.0.19:7444", network: "personal", fingerprint: "sha256:41ab…", state: "online", latency_ms: 112, since: ago(30) },
    { name: "old-vps", address: "203.0.113.7:7444", fingerprint: "sha256:c0de…", state: "offline", error: "dial tcp: i/o timeout", since: ago(600) },
  ],
  forwards: [{ id: "f1", box: "devl", local: 5432, remote: 5432, state: "listening" }],
  routes: [],
  proxy: { port: 1377, url_port: 1377 },
};

// ?mock=1&fresh=1 is a new account: no boxes yet, so onboarding shows.
const fresh = new URLSearchParams(location.search).has("fresh");
if (fresh) {
  status.boxes = [];
  status.forwards = [];
}

const locations: Record<string, Location[]> = {
  devl: [
    {
      name: "cal",
      path: "/home/me/work/cal",
      repo: true,
      scripts: { setup: "yarn && yarn db-migrate", from: "repo" },
      remote: "git@github.com:calcom/cal.com.git",
      slug: "calcom/cal.com",
      default_branch: "main",
      worktrees: [
        { name: "cal", path: "/home/me/work/cal", branch: "main", main: true },
        { name: "billing-fix", path: "/home/me/work/cal-billing-fix", branch: "me/billing-fix" },
        { name: "qa-deck", path: "/home/me/work/cal-qa-deck", branch: "me/qa-deck" },
        { name: "booker-perf", path: "/home/me/work/cal-booker-perf", branch: "me/booker-perf" },
        { name: "transfer-billing", path: "/home/me/work/cal-transfer-billing", branch: "me/admin-billing-transfer" },
      ],
    },
    {
      name: "notes",
      path: "/home/me/work/notes",
      repo: true,
      remote: "git@github.com:me/notes.git",
      slug: "me/notes",
      default_branch: "main",
      scripts: {},
      worktrees: [{ name: "notes", path: "/home/me/work/notes", branch: "main", main: true }],
    },
  ],
  gpu: [
    {
      name: "cal",
      path: "/home/me/cal",
      repo: true,
      remote: "git@github.com:calcom/cal.com.git",
      slug: "calcom/cal.com",
      default_branch: "main",
      scripts: {},
      worktrees: [
        { name: "cal", path: "/home/me/cal", branch: "main", main: true },
        { name: "ci-flake", path: "/home/me/cal-ci-flake", branch: "me/ci-flake" },
      ],
    },
    {
      name: "evals",
      path: "/home/me/evals",
      repo: true,
      scripts: {},
      worktrees: [
        { name: "evals", path: "/home/me/evals", branch: "main", main: true },
        { name: "judge-v2", path: "/home/me/evals-judge-v2", branch: "judge-v2" },
      ],
    },
  ],
};

const sessions: Record<string, Session[]> = {
  devl: [
    { name: "billing-fix-claude", location: "cal/billing-fix", dir: "/home/me/work/cal-billing-fix", command: "claude", created: ago(52), attached: 0, exited: false, agent: "claude", agent_state: "waiting", state_since: ago(4) },
    { name: "qa-deck-codex", location: "cal/qa-deck", dir: "/home/me/work/cal-qa-deck", command: "codex", created: ago(18), attached: 1, exited: false, agent: "codex", agent_state: "running", state_since: ago(2) },
    { name: "cal-shell", location: "cal", dir: "/home/me/work/cal", command: "", created: ago(300), attached: 0, exited: false },
    { name: "booker-perf-claude", location: "cal/booker-perf", dir: "/home/me/work/cal-booker-perf", command: "claude", created: ago(95), attached: 0, exited: false, agent: "claude", agent_state: "finished", state_since: ago(23) },
    // Three agents in one worktree, so the board has to tell them apart.
    { name: "transfer-billing-claude", location: "cal/transfer-billing", dir: "/home/me/work/cal-transfer-billing", command: "claude 'Move the billing owner when a team is transferred'", created: ago(1700), attached: 0, exited: false, agent: "claude", agent_state: "finished", state_since: ago(1560) },
    { name: "transfer-billing-claude-2", location: "cal/transfer-billing", dir: "/home/me/work/cal-transfer-billing", command: "claude", created: ago(320), attached: 0, exited: false, agent: "claude", agent_state: "idle", state_since: ago(290) },
    { name: "transfer-billing-claude-3", location: "cal/transfer-billing", dir: "/home/me/work/cal-transfer-billing", command: "claude 'Add tests for the transfer webhook'", created: ago(140), attached: 0, exited: false, agent: "claude", agent_state: "finished", state_since: ago(75) },
    { name: "notes-claude", location: "notes", dir: "/home/me/work/notes", command: "claude", created: ago(700), attached: 0, exited: true, agent: "claude" },
  ],
  gpu: [
    { name: "ci-flake-claude", location: "cal/ci-flake", dir: "/home/me/cal-ci-flake", command: "claude", created: ago(30), attached: 0, exited: false, agent: "claude", agent_state: "finished", state_since: ago(6) },
    { name: "judge-v2-claude", location: "evals/judge-v2", dir: "/home/me/evals-judge-v2", command: "claude", created: ago(9), attached: 0, exited: false, agent: "claude", agent_state: "running", state_since: ago(1) },
    { name: "evals-codex", location: "evals", dir: "/home/me/evals", command: "codex", created: ago(3), attached: 0, exited: false, agent: "codex", agent_state: "idle", state_since: ago(3) },
  ],
};

const stats: Record<string, Stats> = {
  devl: {
    hostname: "dev-box",
    cpus: 8,
    load: [1.2, 0.9, 0.8],
    memory: { total: 16 * GB, used: 9.4 * GB },
    swap: { total: 2 * GB, used: 0.1 * GB },
    disks: [{ mount: "/", total: 160 * GB, used: 71 * GB }],
    agents: [],
    hooks: true,
  },
  gpu: {
    hostname: "gpu",
    cpus: 32,
    load: [4.1, 3.8, 3.5],
    memory: { total: 128 * GB, used: 41 * GB },
    swap: { total: 0, used: 0 },
    disks: [{ mount: "/", total: 2000 * GB, used: 840 * GB }],
    agents: [],
    hooks: true,
  },
};

const services: Record<string, Service[]> = {
  devl: [
    { location: "cal", worktree: "cal", path: "/home/me/work/cal", port: 3000, process: "node", main: true },
    { location: "cal", worktree: "billing-fix", path: "/home/me/work/cal-billing-fix", port: 3001, process: "node" },
    { location: "cal", worktree: "qa-deck", path: "/home/me/work/cal-qa-deck", port: 4789, process: "vite" },
  ],
  gpu: [{ location: "evals", worktree: "judge-v2", path: "/home/me/evals-judge-v2", port: 8888, process: "jupyter" }],
};

// Hooks per machine, editable the way the agent and boxes allow.
const hooksFiles: Record<string, HooksFile> = {
  laptop: {
    path: "/Users/me/.berth/hooks.json",
    hooks: [
      { on: "agent.waiting", run: `osascript -e "display notification \\"$BERTH_PATH\\" with title \\"An agent on $BERTH_EVENT_BOX needs you\\""` },
      { on: "agent.finished", run: "afplay /System/Library/Sounds/Glass.aiff", source: "plugin:hello-ports" },
    ],
  },
  devl: {
    path: "/home/me/.berth/hooks.json",
    hooks: [
      { on: "worktree.created", run: 'cd "$BERTH_PATH" && pnpm install --frozen-lockfile', timeout: "10m" },
      { on: "before:worktree.create", run: '[ "${BERTH_BRANCH:-$BERTH_NAME}" != "main" ] || { echo "work on a branch, not main"; exit 1; }' },
      { on: "agent.finished", run: 'curl -fsS -X POST "$SLACK_HOOK" -d "{\\"text\\":\\"$BERTH_PATH done\\"}"', tool: "slack", timeout: "20s" },
    ],
  },
  gpu: { path: "/home/me/.berth/hooks.json", hooks: [] },
};

const VALID_ON = /^(before:)?(\*|[a-z][a-z0-9-]*\.(\*|[a-z][a-z0-9.-]*))$/;

// saveHooks validates like the Go side (internal/hooks.Validate) and keeps
// plugins' hooks, which the editor never sends back.
function saveHooks(machine: string, hooks: Hook[]): Promise<HooksFile> {
  for (const [i, h] of hooks.entries()) {
    if (!VALID_ON.test(h.on)) return Promise.reject(new Error(`hook ${i + 1}: "${h.on}" is not an event, a prefix like worktree.*, *, or before: one of those`));
    if (!h.run.trim()) return Promise.reject(new Error(`hook ${i + 1} (${h.on}): nothing to run`));
  }
  const file = hooksFiles[machine];
  file.hooks = [...hooks.filter((h) => !h.source), ...file.hooks.filter((h) => h.source)];
  setTimeout(() => emit({ type: "hooks.changed", box: machine === "laptop" ? undefined : machine }), 30);
  return delay(file);
}

// /v1/app documents, as the laptop agent keeps them. Projects start with a
// Work section so sections show.
const appDocs: Record<string, unknown> = fresh ? {} : { projects: { projects: [{ id: "calcom/cal.com", section: "Work", default_box: "devl" }, { id: "me/notes", section: "Work" }], sections: ["Work", "Personal"] } };

const listeners = new Set<(e: BerthEvent) => void>();
const emit = (e: Omit<BerthEvent, "time">) => listeners.forEach((l) => l({ ...e, time: new Date().toISOString() }));

// An agent finishes its turn, then starts again, so the board moves. A new
// account has no agents, so nothing moves there.
if (!fresh) setInterval(() => {
  const s = sessions.devl.find((x) => x.name === "qa-deck-codex");
  if (!s) return;
  s.agent_state = s.agent_state === "running" ? "waiting" : "running";
  s.state_since = new Date().toISOString();
  emit({ type: s.agent_state === "waiting" ? "agent.waiting" : "agent.started", box: "devl", origin: s.agent, data: { path: s.dir } });
}, 25_000);

const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120));

// mockOrchestration answers send, wait and exec: a prompted agent works for
// a moment and finishes, and a worktree's check fails once, then passes, so
// a loop takes two rounds.
const checksRun: Record<string, number> = {};
// mockProjects is a box's folders, branches and the resolver: enough to
// browse, clone, create, and make worktrees from names, branches, PRs and
// issues.
const mockFolders: Record<string, { git?: boolean; slug?: string }> = {
  "/home/me": {},
  "/home/me/work": {},
  "/home/me/work/cal": { git: true, slug: "calcom/cal.com" },
  "/home/me/work/notes": { git: true, slug: "me/notes" },
  "/home/me/work/ondine": { git: true, slug: "me/ondine" },
  "/home/me/work/drafts": {},
  "/home/me/work/scratch": {},
  "/home/me/learn": { git: true },
  "/home/me/go": {},
  "/home/me/orca": {},
  "/home/me/orca/projects": {},
  "/home/me/orca/projects/bean-app": { git: true, slug: "me/bean-app" },
};
const mockBranches = ["main", "me/billing-fix", "me/qa-deck", "me/booker-perf", "feat/qa-app", "feat/pr-previews", "fix/impersonation-banner"];
const HOME = "/home/me";
const expand = (p: string) => (p === "~" ? HOME : p.startsWith("~/") ? `${HOME}${p.slice(1)}` : p.replace(/\/+$/, "") || "/");

function mockProjects(box: string, method: string, path: string, body?: unknown): Promise<unknown> | undefined {
  const [route, query = ""] = path.split("?");
  if (method === "GET" && route === "fs") {
    const dir = expand(new URLSearchParams(query).get("path") ?? "~");
    if (!(dir in mockFolders)) return Promise.reject(new Error(`${dir}: no such folder`));
    const entries = Object.keys(mockFolders)
      .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes("/"))
      .sort()
      .map((p) => ({ name: p.split("/").pop()!, path: p, ...mockFolders[p] }));
    return delay({ path: dir, parent: dir === "/" ? undefined : dir.split("/").slice(0, -1).join("/") || "/", home: HOME, entries });
  }
  if (method === "POST" && route === "locations/new") {
    const r = body as { name: string; parent?: string };
    const dir = `${expand(r.parent ?? "~/work")}/${r.name}`;
    if (locations[box]?.some((l) => l.name === r.name)) return Promise.reject(new Error(`a location named ${r.name} already exists`));
    mockFolders[dir] = { git: true };
    const loc: Location = { name: r.name, path: dir, repo: true, scripts: {}, default_branch: "main", worktrees: [{ name: r.name, path: dir, branch: "main", main: true }] };
    locations[box] = [...(locations[box] ?? []), loc];
    setTimeout(() => emit({ type: "location.added", box, data: { location: r.name, path: dir } }), 30);
    return delay(loc);
  }
  const m = /^locations\/([^/]+)\/(resolve|branches|worktrees)$/.exec(route);
  if (!m) return undefined;
  const loc = locations[box]?.find((l) => l.name === decodeURIComponent(m[1]));
  if (!loc) return Promise.reject(new Error("no location with that name"));
  if (m[2] === "branches" && method === "GET") {
    return delay({ default: "main", branches: [...mockBranches.map((name) => ({ name, current: name === "main" })), { name: "release/v5.2", remote: true }] });
  }
  if (m[2] === "resolve" && method === "POST") {
    const { input, kind } = body as { input: string; kind?: string };
    const text = input.trim();
    const slugOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
    const pr = /(?:^#|\/pull\/|^!|merge_requests\/)(\d+)/.exec(text);
    const issue = /\/issues\/(\d+)/.exec(text);
    let r: Record<string, unknown>;
    if (issue && kind !== "branch" && kind !== "name") {
      const title = mockIssueTitle(Number(issue[1])) ?? "Login loops after password reset";
      const name = `issue-${issue[1]}-${slugOf(title).slice(0, 40).replace(/-$/, "")}`;
      r = { kind: "issue", name, branch: name, base: "main", title, url: text };
    } else if (pr && kind !== "branch" && kind !== "name") {
      const n = Number(pr[1]);
      r = n === 404
        ? { kind: "pr", name: `pr-${n}`, branch: `pr-${n}`, pr: n, ref: `pull/${n}/head`, note: "gh is not installed on this box; using pull/404/head" }
        : { kind: "pr", name: "fix-billing-retries", branch: "me/fix-billing-retries", pr: n, ref: `pull/${n}/head`, title: "Fix billing retries without an idempotency key", url: `https://github.com/calcom/cal.com/pull/${n}` };
    } else if (kind !== "name" && mockBranches.includes(text)) {
      r = { kind: "branch", name: slugOf(text.split("/").pop()!), branch: text, exists: true };
    } else if (kind !== "name" && text === "release/v5.2") {
      r = { kind: "remote-branch", name: "v5-2", branch: text, exists: true };
    } else {
      r = { kind: kind === "branch" ? "branch" : "name", name: slugOf(text), branch: slugOf(text), base: "main", exists: false };
    }
    return new Promise((res) => setTimeout(() => res(r), 220));
  }
  if (m[2] === "worktrees" && method === "POST") {
    const r = body as { name: string; branch?: string; pr?: number };
    if (loc.worktrees?.some((w) => w.name === r.name)) return Promise.reject(new Error(`git worktree add: '${loc.path}-${r.name}' already exists`));
    const wt = { name: r.name, path: `${loc.path}-${r.name}`, branch: r.branch || r.name };
    loc.worktrees = [...(loc.worktrees ?? []), wt];
    setTimeout(() => emit({ type: "worktree.created", box, data: { location: loc.name, name: r.name, path: wt.path } }), 50);
    return delay(wt);
  }
  return undefined;
}

function mockOrchestration(box: string, method: string, path: string, body?: unknown): Promise<unknown> | undefined {
  const m = /^sessions\/([^/?]+)\/(send|wait)/.exec(path);
  const s = m ? sessions[box]?.find((x) => x.name === decodeURIComponent(m[1])) : undefined;
  if (m && !s) return Promise.reject(new Error("no session with that name"));
  if (s && m?.[2] === "send") {
    const at = new Date().toISOString();
    s.agent_state = "running";
    s.state_since = at;
    emit({ type: "agent.started", box, origin: s.agent, data: { path: s.dir } });
    setTimeout(() => {
      s.agent_state = "finished";
      s.state_since = new Date().toISOString();
      emit({ type: "agent.finished", box, origin: s.agent, data: { path: s.dir } });
    }, 1500);
    return delay({ sent: true, at });
  }
  if (s && m?.[2] === "wait") {
    const q = new URLSearchParams(path.split("?")[1]);
    const want = (q.get("for") || "finished,waiting").split(",");
    const after = Date.parse(q.get("after") ?? "") || 0;
    const until = Date.now() + Math.min(parseInt(q.get("timeout") ?? "60") || 60, 60) * 1000;
    return new Promise((resolve) => {
      const tick = () => {
        if (s.exited) return resolve({ state: "exited", timed_out: false });
        if (s.agent_state && want.includes(s.agent_state) && Date.parse(s.state_since ?? "") > after) return resolve({ state: s.agent_state, timed_out: false });
        if (Date.now() >= until) return resolve({ state: s.agent_state ?? "", timed_out: true });
        setTimeout(tick, 100);
      };
      tick();
    });
  }
  // secrets/test resolves a reference the way the box would, answering only
  // whether it could and the value's length.
  if (method === "POST" && path === "secrets/test") {
    const { ref } = body as { ref: string };
    if (!/^(op|env):\/\/[^/\s]+/.test(ref)) return delay({ ok: false, error: "not a secret reference: use op://vault/item/field or env://NAME" });
    if (/missing|nope/.test(ref)) return delay({ ok: false, error: `"${ref.split("/").pop()}" isn't an item in this vault` });
    return delay({ ok: true, length: 32 });
  }
  if (method === "POST" && path === "exec") {
    const r = body as { location: string; command: string };
    const reviewed = reviewExec(box, r.location, r.command, emit);
    if (reviewed) return new Promise((resolve) => setTimeout(() => resolve(reviewed), 400));
    const usage = usageExec(box, r.command);
    if (usage) return new Promise((resolve) => setTimeout(() => resolve(usage), 600));
    const shell = mockShell(box, r.location, r.command);
    if (shell) return new Promise((resolve) => setTimeout(() => resolve(shell), 250));
    const n = (checksRun[`${box}:${r.location}`] = (checksRun[`${box}:${r.location}`] ?? 0) + 1);
    const output = n === 1 ? `$ ${r.command}\n FAIL  src/booking.test.ts > rejects a double booking\n   Expected: 409\n   Received: 200\n\nTests: 1 failed, 213 passed\n` : `$ ${r.command}\nTests: 214 passed\n`;
    return new Promise((resolve) => setTimeout(() => resolve({ exit_code: n === 1 ? 1 : 0, output }), 700));
  }
  return undefined;
}

// Each worktree's "web" service, by worktree path: it starts and stops for
// real here, so the Run button can be seen doing both.
const webRunning = new Map<string, boolean>();

function worktreeServicesFixture(box: string, loc: string, wt: string) {
  const path = locations[box]?.find((l) => l.name === loc)?.worktrees?.find((w) => w.name === wt)?.path ?? `${box}:${loc}/${wt}`;
  const running = webRunning.get(path) ?? false;
  return [
    { name: "web", run: "pnpm dev --port $BERTH_PORT", autostart: true, state: running ? "running" : "stopped", unit: `berth-${loc}-${wt}-web`, port: 3100 },
    { name: "worker", run: "pnpm worker", state: "stopped", unit: `berth-${loc}-${wt}-worker` },
  ];
}

function boxCall(box: string, method: string, path: string, body?: unknown): Promise<unknown> {
  const online = status.boxes.find((b) => b.name === box)?.state === "online";
  // 503, as the agent answers when a request never reached the box.
  if (!online) return Promise.reject(new ApiError(`${box} is offline`, 503));
  const flows = flowsCall(box, method, path, body, emit, delay);
  if (flows) return flows;
  const phone = phoneCall(box, method, path, body, delay);
  if (phone) return phone;
  const usage = usageCall(box, method, path, body, delay);
  if (usage) return usage;
  const wts = worktreesCall(box, method, path, body, { locations, sessions }, emit, delay);
  if (wts) return wts;
  const review = reviewCall(box, method, path, sessions[box]);
  if (review) return review;
  const key = `${method} ${path}`;
  if (key === "GET locations") return delay(locations[box] ?? []);
  if (key === "GET sessions") return delay(sessions[box] ?? []);
  if (key === "GET stats") return delay(stats[box]);
  if (key === "GET services") return delay(services[box] ?? []);
  const svc = /^locations\/([^/]+)\/worktrees\/([^/]+)\/services(?:\/([^/]+)(?:\/(start|stop|restart|log))?)?$/.exec(path);
  if (svc) {
    const [, loc, wt, name, action] = svc.map((x) => x && decodeURIComponent(x));
    // The demo repository has none, to show the empty state.
    if (loc === "notes") return delay([]);
    const list = worktreeServicesFixture(box, loc, wt);
    if (!name) return delay(list);
    const one = list.find((x) => x.name === name);
    if (!one) return Promise.reject(new Error("no service with that name in this repository's config"));
    if (action === "log") return delay(`$ ${one.run}\n  ▲ Next.js 15.2.0\n  - Local:   http://localhost:3100\n ✓ Ready in 1.4s\n GET / 200 in 84ms\n`);
    if (name === "web") {
      const p = locations[box]?.find((l) => l.name === loc)?.worktrees?.find((w) => w.name === wt)?.path ?? `${box}:${loc}/${wt}`;
      webRunning.set(p, action !== "stop");
      setTimeout(() => emit({ type: action === "stop" ? "service.stopped" : "service.started", box, data: { location: loc, name: wt, path: p, service: name, port: 3100 } }), 50);
    }
    return delay(worktreeServicesFixture(box, loc, wt).find((x) => x.name === name));
  }
  const skills = mockSkills(box, method, path, body);
  if (skills) return skills;
  if (key === "GET hooks") return hooksFiles[box] ? delay(hooksFiles[box]) : Promise.reject(new Error("this box has no hooks file"));
  if (key === "PUT hooks") return saveHooks(box, (body as { hooks: Hook[] }).hooks);
  const orchestration = mockOrchestration(box, method, path, body);
  if (orchestration) return orchestration;
  const projects = mockProjects(box, method, path, body);
  if (projects) return projects;
  if (key === "GET info")
    return delay({
      name: box,
      version: "0.1.0",
      tools: ["claude", "codex"],
      agents: [
        { id: "claude", name: "Claude Code", command: "claude" },
        { id: "codex", name: "Codex", command: "codex" },
        { id: "shell", name: "Shell", command: "" },
      ],
    });
  if (method === "GET" && /^sessions\/[^/]+\/screen/.test(path)) {
    const name = decodeURIComponent(path.split("/")[1]);
    const s = sessions[box]?.find((x) => x.name === name);
    const screen =
      s?.agent_state === "waiting"
        ? "● The fix needs a migration for the new idempotency_key column.\n\n  Do you want me to create it?\n  ❯ 1. Yes\n    2. No, and tell Claude what to do differently"
        : s?.agent_state === "finished"
          ? "● Booker renders 38% faster on the slow-network profile.\n  All 214 tests pass.\n\n✻ Baked for 6m 41s · done"
          : s?.agent_state === "idle"
          ? " ▐▛███▜▌   Codex\n  ~/evals\n\n────────────────────────────────\n❯ Try \"refactor the judge\"\n────────────────────────────────\n  ? for shortcuts"
          : "● Running yarn test --filter booking…\n  ⎿  PASS  handleNewBooking.test.ts (41 tests)\n  ⎿  RUNS  billing/webhook.test.ts\n\n✻ Testing… (2m 13s · esc to interrupt)\n\n────────────────────────────────\n❯ \n────────────────────────────────\n  ⏵⏵ auto mode on (shift+tab to cycle)";
    return delay({ screen });
  }
  if (key === "POST tasks") {
    const t = body as { location: string; name: string; branch?: string; agent?: string; command?: string; open?: string };
    const loc = locations[box].find((l) => l.name === t.location)!;
    if (loc.worktrees?.some((w) => w.name === t.name)) return Promise.reject(new Error(`a worktree named ${t.name} already exists`));
    const wt = { name: t.name, path: `${loc.path}-${t.name}`, branch: t.branch || `me/${t.name}` };
    loc.worktrees = [...(loc.worktrees ?? []), wt];
    const agent = t.agent || "claude";
    const session: Session = { name: `${t.name}-${agent}`, location: `${t.location}/${t.name}`, dir: wt.path, command: t.command ?? agent, created: new Date().toISOString(), attached: 0, exited: false, agent, agent_state: "running" };
    sessions[box].push(session);
    setTimeout(() => emit({ type: "worktree.created", box, data: { location: t.location, name: t.name, path: wt.path } }), 50);
    setTimeout(() => emit({ type: "task.created", box, data: { location: t.location, name: t.name, path: wt.path, branch: wt.branch, session: session.name, agent } }), 60);
    if (t.open) setTimeout(() => emit({ type: "session.open", box, data: { name: session.name, location: session.location, path: wt.path, open: t.open, agent } }), 120);
    return delay({ worktree: wt, session });
  }
  if (key === "POST sessions") {
    const r = body as { location: string; name?: string; command?: string };
    const [locName, wtName] = r.location.split("/");
    const loc = locations[box].find((l) => l.name === locName)!;
    const wt = loc.worktrees?.find((w) => w.name === (wtName ?? locName)) ?? loc.worktrees![0];
    const command = r.command ?? "";
    const agent = ["claude", "codex"].includes(command) ? command : undefined;
    const session: Session = { name: r.name ?? `${wt.name}-${command || "shell"}-${sessions[box].length}`, location: r.location, dir: wt.path, command, created: new Date().toISOString(), attached: 0, exited: false, agent, agent_state: agent ? "running" : undefined };
    sessions[box].push(session);
    return delay(session);
  }
  // Removing a worktree or a project. A worktree with uncommitted work
  // (billing-fix, in the fixtures) refuses without force, as git does.
  const rmWt = /^locations\/([^/]+)\/worktrees\/([^/?]+)(\?.*)?$/.exec(path);
  if (method === "DELETE" && rmWt) {
    const [, loc, wt, q = ""] = rmWt.map((x) => x && decodeURIComponent(x));
    const l = locations[box]?.find((x) => x.name === loc);
    const w = l?.worktrees?.find((x) => x.name === wt);
    if (!l || !w) return Promise.reject(new Error("no worktree with that name"));
    if (wt === "billing-fix" && !q.includes("force=1")) return Promise.reject(new Error(`git worktree remove: '${w.path}' contains modified or untracked files, use --force to delete it`));
    l.worktrees = l.worktrees!.filter((x) => x !== w);
    sessions[box] = (sessions[box] ?? []).filter((x) => x.dir !== w.path);
    setTimeout(() => emit({ type: "worktree.removed", box, data: { location: loc, name: wt, path: w.path } }), 50);
    return delay({ removed: wt });
  }
  const rmLoc = /^locations\/([^/]+)$/.exec(path);
  if (method === "DELETE" && rmLoc) {
    const loc = decodeURIComponent(rmLoc[1]);
    locations[box] = (locations[box] ?? []).filter((x) => x.name !== loc);
    setTimeout(() => emit({ type: "location.removed", box, data: { location: loc } }), 50);
    return delay({ removed: loc });
  }
  if (method === "DELETE" && path.startsWith("sessions/")) {
    const name = decodeURIComponent(path.slice("sessions/".length));
    sessions[box] = sessions[box].filter((s) => s.name !== name);
    setTimeout(() => emit({ type: "session.stopped", box, data: { name } }), 50);
    return delay({ removed: name });
  }
  if (key === "POST locations") {
    const r = body as { name: string; path: string };
    const slug = mockFolders[r.path]?.slug;
    const loc: Location = { name: r.name, path: r.path, repo: true, scripts: {}, ...(slug ? { slug, remote: `git@github.com:${slug}.git` } : {}), worktrees: [{ name: r.name, path: r.path, branch: "main", main: true }] };
    locations[box].push(loc);
    return delay(loc);
  }
  return Promise.reject(new Error(`mock: no fixture for ${key}`));
}

// A fake terminal: a short Claude-like transcript, then an echoing prompt.
function mockAttach(box: string, session: string, h: TerminalHandlers) {
  const timers: number[] = [];
  let open = true;
  const s = sessions[box]?.find((x) => x.name === session);
  const lines = [
    "\x1b[2J\x1b[H",
    `\x1b[38;5;208m✻\x1b[0m Welcome to \x1b[1m${s?.agent ?? "shell"}\x1b[0m on \x1b[36m${box}\x1b[0m  \x1b[2m${s?.dir ?? ""}\x1b[0m\r\n\r\n`,
    "\x1b[33m●\x1b[0m Read \x1b[1mpackages/features/bookings/lib/handleNewBooking.ts\x1b[0m\r\n",
    "\x1b[2m  ⎿  Read 412 lines\x1b[0m\r\n\r\n",
    "\x1b[37m●\x1b[0m The billing webhook retries without an idempotency key,\r\n  so a slow response can create two invoices.\r\n  I will add the key and a test.\r\n\r\n",
    "\x1b[32m●\x1b[0m Update(\x1b[1mpackages/features/ee/billing/webhook.ts\x1b[0m)\r\n",
    "\x1b[2m  ⎿  Updated with \x1b[0m\x1b[32m12 additions\x1b[0m\x1b[2m and \x1b[0m\x1b[31m3 removals\x1b[0m\r\n\r\n",
    "\x1b[2m✻ Baked for 1m 12s · done\x1b[0m\r\n\r\n",
    "\x1b[1m❯\x1b[0m ",
  ];
  let i = 0;
  timers.push(window.setTimeout(() => h.onOpen(), 150));
  const next = () => {
    if (!open || i >= lines.length) return;
    h.onData(lines[i++]);
    timers.push(window.setTimeout(next, 90));
  };
  timers.push(window.setTimeout(next, 200));
  return {
    send(data: Uint8Array | string) {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      h.onData(text.replace(/\r/g, "\r\n\x1b[2m(mock: nothing runs here)\x1b[0m\r\n\x1b[1m❯\x1b[0m ").replace(/\x7f/g, "\b \b"));
    },
    resize() {},
    close() {
      open = false;
      timers.forEach(clearTimeout);
      h.onClose(true);
    },
  };
}

// Boxes: discovering, adding over SSH, pairing, upgrading and forgetting
// them, and tailnet sign-ins. Added boxes come online empty.

const discovery = {
  user: "me",
  machines: [
    { name: "dev-box", dns_name: "dev-box.example-tailnet.ts.net", ip: "100.64.0.12", os: "linux", online: true },
    { name: "hetzner-ax41", dns_name: "hetzner-ax41.example-tailnet.ts.net", ip: "100.64.0.11", os: "linux", online: true },
    { name: "gpu-runner", dns_name: "gpu-runner.example-tailnet.ts.net", ip: "100.64.0.19", os: "linux", online: false },
    { name: "my-laptop", dns_name: "my-laptop.example-tailnet.ts.net", ip: "100.64.0.67", os: "macOS", online: true },
  ] as { name: string; dns_name: string; ip: string; os: string; online: boolean; box?: string }[],
};
if (!fresh) discovery.machines[1].box = "devl";

const mockNetworks = fresh ? [] : [{ name: "personal", state: "Running", tailnet: "example.ts.net", ips: ["100.64.0.73"] }];

const mockPlugins = [{ id: "hello-ports", name: "Hello ports", version: "0.1.0", main: "dist/index.js", description: "Every dev server on every box, one click from your browser.", entry: "/__dev-plugins/hello-ports/dist/index.js", enabled: false, defaultEnabled: false }];

function addMockBox(name: string, address: string, network?: string) {
  if (!status.boxes.some((b) => b.name === name)) {
    status.boxes.push({ name, address, network, fingerprint: "sha256:5eed…", state: "online", latency_ms: 42, since: new Date().toISOString() });
  }
  locations[name] ??= [];
  sessions[name] ??= [];
  services[name] ??= [];
  stats[name] ??= { hostname: name, cpus: 8, load: [0.2, 0.1, 0.1], memory: { total: 32 * GB, used: 3 * GB }, swap: { total: 0, used: 0 }, disks: [{ mount: "/", total: 240 * GB, used: 40 * GB }], agents: [], hooks: true };
  const m = discovery.machines.find((x) => address.startsWith(x.ip) || address.startsWith(x.dns_name));
  if (m) m.box = name;
  emit({ type: "box.connected", box: name });
}

function laptopBoxes(method: string, path: string, body: unknown): Promise<unknown> | undefined {
  if (method === "GET" && path.startsWith("/v1/discover")) return delay(discovery);
  if (method === "GET" && path === "/v1/networks") return delay(mockNetworks);
  if (method === "POST" && path === "/v1/boxes/pair") {
    const r = body as { link: string; name?: string; network?: string };
    const address = /^berth:\/\/([^?]+)/.exec(r.link)?.[1] ?? "100.64.0.9:7444";
    const name = r.name || "box";
    addMockBox(name, address, r.network);
    return delay({ name, address, network: r.network });
  }
  const forget = /^\/v1\/boxes\/([^/]+)$/.exec(path);
  if (method === "DELETE" && forget) {
    const name = decodeURIComponent(forget[1]);
    status.boxes = status.boxes.filter((b) => b.name !== name);
    for (const m of discovery.machines) if (m.box === name) delete m.box;
    return delay({ removed: name });
  }
  const toggle = /^\/v1\/plugins\/([^/]+)\/(enable|disable)$/.exec(path);
  if (method === "POST" && toggle) {
    const p = mockPlugins.find((x) => x.id === decodeURIComponent(toggle[1]));
    if (!p) return Promise.reject(new Error("no such plugin"));
    p.enabled = toggle[2] === "enable";
    return delay(p);
  }
  return undefined;
}

// mockStream plays a long command's output a line at a time, as the agent
// streams the CLI's.
async function mockStream(method: string, path: string, body: unknown, onValue: (v: unknown) => void, signal?: AbortSignal) {
  if (method === "POST" && (await kitsStream(path, body, onValue, emit, signal))) return;
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => (clearTimeout(t), reject(new DOMException("aborted", "AbortError"))));
    });
  const say = async (line: string, ms = 450) => {
    await wait(ms);
    onValue({ line });
  };
  if (method === "POST" && path === "/v1/boxes/add-ssh") {
    const r = body as { host: string; name?: string; network?: string };
    const where = r.host.split("@").pop() ?? r.host;
    await say(`Checking ${r.host}…`, 300);
    if (/fail|nope/.test(r.host)) {
      await wait(900);
      onValue({ done: true, error: `ssh: connect to host ${where} port 22: Connection refused` });
      return;
    }
    await say("Installing berthd-linux-amd64 (8 MB)…", 900);
    await say(`  Installed /home/me/.config/systemd/user/berthd.service; berthd is serving on 100.64.0.11:7444.`, 1400);
    const name = r.name || where.split(".")[0];
    await wait(700);
    addMockBox(name, `${where}:7444`, r.network);
    onValue({ line: `Paired with ${name} at 100.64.0.11:7444. SSH is no longer needed for this box.` });
    onValue({ done: true });
    return;
  }
  const upgrade = /^\/v1\/boxes\/([^/]+)\/upgrade$/.exec(path);
  if (method === "POST" && upgrade) {
    const name = decodeURIComponent(upgrade[1]);
    await say(`Uploading berthd-linux-amd64 to ${name}…`, 300);
    await say(`${name} upgraded: 304337b99a15 → b9758a308077. Sessions kept running.`, 1600);
    onValue({ done: true });
    return;
  }
  const login = /^\/v1\/networks\/([^/]+)\/login$/.exec(path);
  if (method === "POST" && login) {
    const name = decodeURIComponent(login[1]);
    await wait(500);
    onValue({ auth_url: "https://login.tailscale.com/a/mock-sign-in" });
    await wait(2500);
    const info = { name, state: "Running", tailnet: "example.ts.net", ips: ["100.64.0.73"] };
    mockNetworks.push(info);
    onValue({ network: info });
    return;
  }
  const clone = /^\/v1\/boxes\/([^/]+)\/api\/locations\/clone$/.exec(path);
  if (method === "POST" && clone) {
    const box = decodeURIComponent(clone[1]);
    const r = body as { url: string; parent?: string; name?: string };
    const name = r.name || r.url.replace(/\/+$/, "").split(/[/:]/).pop()!.replace(/\.git$/, "");
    await say(`Cloning into '${name}'...`, 300);
    if (/nope|missing/.test(r.url)) {
      await wait(600);
      onValue({ line: "remote: Repository not found." });
      onValue({ done: true, error: `fatal: repository '${r.url}' not found` });
      return;
    }
    for (const pct of [12, 47, 83, 100]) await say(`Receiving objects: ${pct}% (${pct * 41}/4100), ${(pct * 0.31).toFixed(1)} MiB | 18.2 MiB/s`, 350);
    await say("Resolving deltas: 100% (2210/2210), done.", 400);
    const dir = `${expand(r.parent ?? "~/work")}/${name}`;
    mockFolders[dir] = { git: true };
    const loc: Location = { name, path: dir, repo: true, scripts: {}, default_branch: "main", slug: r.url.replace(/^.*[:/]([^/:]+\/[^/]+?)(\.git)?$/, "$1"), worktrees: [{ name, path: dir, branch: "main", main: true }] };
    locations[box] = [...(locations[box] ?? []), loc];
    onValue({ done: true, location: loc });
    return;
  }
  throw new Error(`mock: no stream for ${method} ${path}`);
}

// The offline prompt queue and its box-offline simulator (lib/mock-queue).
initMockQueue({ status, sessions, emit, delay, send: (box, session, text, enter) => boxCall(box, "POST", `sessions/${encodeURIComponent(session)}/send`, { text, enter }) }, fresh);

export function mockClient(): Client {
  return {
    status: () => delay(status),
    themes: () => delay([]),
    templates: () =>
      delay([
        {
          id: "bugfix",
          name: "Fix a bug",
          description: "Claude on a fresh branch from main, test first.",
          location: "cal",
          agent: "claude",
          branch: "fix/{{name}}",
          base: "main",
          prompt: "Fix {{issue}}. Write a failing test first.",
          variables: [{ id: "issue", label: "Issue or description", multiline: true }],
        },
        { id: "review", name: "Review a branch", description: "Codex reviews the changes against main.", agent: "codex", prompt: "Review {{branch_name}} against main and list risks." },
      ]),
    plugins: () => delay(mockPlugins),
    async pluginSource(p) {
      const res = await fetch(p.entry!);
      if (!res.ok) throw new Error(`${p.id}: ${res.status} (run pnpm build in plugins/${p.id})`);
      return res.text();
    },
    box: <T,>(box: string, method: string, path: string, body?: unknown) => boxCall(box, method, path, body) as Promise<T>,
    laptop: <T,>(method: string, path: string, body?: unknown) => {
      if (method === "GET" && path === "/v1/hooks") return delay(hooksFiles.laptop) as Promise<T>;
      if (method === "PUT" && path === "/v1/hooks") return saveHooks("laptop", (body as { hooks: Hook[] }).hooks) as Promise<T>;
      // The app's own documents (/v1/app/<key>), such as project groups.
      const app = /^\/v1\/app\/([a-z0-9-]+)$/.exec(path);
      if (app && method === "GET") return delay(appDocs[app[1]] ?? null) as Promise<T>;
      if (app && method === "PUT") {
        appDocs[app[1]] = structuredClone(body);
        return delay(body) as Promise<T>;
      }
      const boxes = laptopBoxes(method, path, body);
      if (boxes) return boxes as Promise<T>;
      const queued = queueCall(method, path, body);
      if (queued) return queued as Promise<T>;
      const kits = kitsCall(method, path, body, emit, delay);
      if (kits) return kits as Promise<T>;
      const eds = editorsCall(method, path, body, delay);
      if (eds) return eds as Promise<T>;
      return Promise.reject(new Error(`mock: no fixture for ${method} ${path}`));
    },
    stream: mockStream,
    addForward: () => delay({}),
    events(onEvent, onConnect, signal) {
      listeners.add(onEvent);
      setTimeout(onConnect, 0);
      signal.addEventListener("abort", () => listeners.delete(onEvent));
    },
    attach: (box, session, _cols, _rows, h) => mockAttach(box, session, h),
    serviceUrl: (box, port) => `http://${port}.${box}.localhost:1377/`,
  };
}

// Skills on each box: some installed, one outdated, the rest missing, so
// every state shows. Project copies start missing and are kept out of git.
const skillCatalog = [
  { name: "berth", description: "Use berth to work across development boxes — repos, worktrees, tasks, sessions, ports and the repo's config.", version: "eb32be71b151" },
  { name: "berth-hooks", description: "Automate berth with hooks and gates at the right scope.", version: "f20829fe718c" },
  { name: "berth-orchestrate", description: "Drive other coding agents: prompt, wait, check, loop, hand off, review.", version: "66660a4b14c8" },
  { name: "berth-preview", description: "Run the worktree's dev server on its port and show it in the Berth app.", version: "e1454dda1a21" },
];
type MockSkillState = "installed" | "outdated" | "missing";
const skillStates: Record<string, Record<string, MockSkillState>> = {};
const skillCommitted: Record<string, boolean> = {};

function skillState(scope: string, skill: string, agent: string): MockSkillState {
  const k = `${scope}|${skill}|${agent}`;
  if (!skillStates[scope]) skillStates[scope] = {};
  if (!(k in skillStates[scope])) {
    const seeded = !scope.includes("/") && agent === "claude" ? (skill === "berth" ? "installed" : skill === "berth-orchestrate" ? "outdated" : "missing") : "missing";
    skillStates[scope][k] = seeded;
  }
  return skillStates[scope][k];
}

function skillsReport(box: string, location?: string) {
  const agents = ["claude", "codex"];
  const home = box === "mac-test" ? "/Users/me" : "/home/me";
  const repo = location ? (locations[box]?.find((l) => l.name === location)?.path ?? `${home}/work/${location}`) : undefined;
  return {
    agents,
    user_dirs: { claude: `${home}/.claude/skills`, codex: `${home}/.agents/skills` },
    project_dirs: repo ? { claude: `${repo}/.claude/skills`, codex: `${repo}/.agents/skills` } : undefined,
    location,
    skills: skillCatalog.map((s) => ({
      ...s,
      user: Object.fromEntries(agents.map((a) => [a, skillState(box, s.name, a)])),
      project: location ? Object.fromEntries(agents.map((a) => [a, skillState(`${box}/${location}`, s.name, a)])) : undefined,
      excluded: location ? Object.fromEntries(agents.map((a) => [a, !skillCommitted[`${box}/${location}|${s.name}|${a}`]])) : undefined,
    })),
  };
}

function mockSkills(box: string, method: string, path: string, body?: unknown): Promise<unknown> | undefined {
  if (method === "GET" && (path === "skills" || path.startsWith("skills?"))) {
    const location = new URLSearchParams(path.split("?")[1] ?? "").get("location") ?? undefined;
    return delay(skillsReport(box, location));
  }
  const m = /^skills\/(install|uninstall)$/.exec(path);
  if (method !== "POST" || !m) return undefined;
  const req = body as { skills: string[] | "all"; agent: string; target: string; location?: string; commit?: boolean };
  if (req.target === "project" && !req.location) return Promise.reject(new Error("a project install needs a location"));
  const names = req.skills === "all" || (req.skills.length === 1 && req.skills[0] === "all") ? skillCatalog.map((s) => s.name) : req.skills;
  const agents = req.agent === "all" ? ["claude", "codex"] : [req.agent];
  const scope = req.target === "project" ? `${box}/${req.location}` : box;
  for (const n of names) {
    for (const a of agents) {
      skillState(scope, n, a);
      skillStates[scope][`${scope}|${n}|${a}`] = m[1] === "install" ? "installed" : "missing";
      if (req.target === "project") skillCommitted[`${scope}|${n}|${a}`] = m[1] === "install" && !!req.commit;
    }
  }
  setTimeout(() => emit({ type: m[1] === "install" ? "skills.installed" : "skills.removed", box, data: { skills: names, agents, target: req.target, location: req.location } }), 50);
  return new Promise((resolve) => setTimeout(() => resolve(skillsReport(box, req.location)), 450));
}

// mockAgentOpens plays an agent on a box running
// `berthd session new LOC/WT --agent claude --prompt … --open split|tab`:
// a new session, then session.open asking the app to show it.
let mockOpened = 0;
export function mockAgentOpens(box: string, location: string, dir: string, open: "split" | "tab") {
  const name = `${location.replace(/\//g, "-")}-claude-${(++mockOpened).toString(36)}`;
  const now = new Date().toISOString();
  (sessions[box] ??= []).push({ name, location, dir, command: "claude 'Review the diff'", created: now, attached: 0, exited: false, agent: "claude", agent_state: "running", state_since: now });
  emit({ type: "session.started", box, data: { name, location, path: dir, command: "claude" } });
  setTimeout(() => emit({ type: "session.open", box, data: { name, location, path: dir, open, agent: "claude" } }), 80);
}

// mockNotifications plays one of every event the notification centre turns
// into a notification, a moment apart, so each kind shows: a waiting agent,
// one that finished three times (one collapsed row), failures, the guard, a
// kit with warnings, a flow's message, and an agent opening things.
export function mockNotifications() {
  const devl = "devl";
  const plays: [number, Omit<BerthEvent, "time">][] = [
    [0, { type: "agent.waiting", box: devl, origin: "claude", data: { path: "/home/me/work/cal-billing-fix" } }],
    [150, { type: "agent.finished", box: devl, origin: "claude", data: { path: "/home/me/work/cal-booker-perf" } }],
    [300, { type: "agent.finished", box: devl, origin: "claude", data: { path: "/home/me/work/cal-booker-perf" } }],
    [450, { type: "agent.finished", box: devl, origin: "claude", data: { path: "/home/me/work/cal-booker-perf" } }],
    [600, { type: "flow.finished", box: devl, origin: "flow:tests-after-turn", data: { flow: "tests-after-turn", scope: "repo:cal", run: "r3", status: "failed", path: "/home/me/work/cal-billing-fix" } }],
    [750, { type: "worktree.setup.failed", box: devl, data: { location: "cal", name: "qa-deck", path: "/home/me/work/cal-qa-deck" }, error: "pnpm install exited with status 1: ERR_PNPM_FETCH_404" }],
    [900, { type: "service.failed", box: devl, data: { location: "cal", name: "qa-deck", service: "storybook", error: "port 6006 is already in use" } }],
    [1050, { type: "guard.acted", box: "gpu", origin: "guard", data: { action: "stop_services", location: "evals", name: "judge-v2", path: "/home/me/evals-judge-v2", services: ["web", "worker"], memory_percent: 93.4, reason: "Memory at 93% for 2 minutes" } }],
    [1200, { type: "kit.installed", box: devl, data: { location: "cal", kit: "cal-com", version: "3", source: "https://example.com/kits/cal-com.json", warnings: ["The .env.example has keys this kit does not set: STRIPE_WEBHOOK_SECRET", "yarn is not installed; used pnpm"] } }],
    [1350, { type: "notify", box: devl, origin: "flow:nightly-e2e", data: { title: "Nightly e2e passed", body: "412 tests in 9m 12s", flow: "nightly-e2e", location: "cal" } }],
    [1500, { type: "preview.open", box: devl, data: { location: "cal", name: "qa-deck", path: "/home/me/work/cal-qa-deck", port: 4789, url_path: "/deck" } }],
  ];
  for (const [ms, e] of plays) setTimeout(() => emit(e), ms);
  setTimeout(() => mockAgentOpens(devl, "cal/qa-deck", "/home/me/work/cal-qa-deck", "split"), 1650);
  // A plugin's notify, and a review-ready item, come from the app itself.
  setTimeout(() => {
    void import("@/lib/notify").then((m) => m.notify("Usage at 82% of the weekly limit", "Claude Code on your work account", "warning"));
    void import("@/lib/notifications").then((m) =>
      m.route({
        category: "review",
        title: "Claude Code left changes to review",
        detail: "4 files · +128 −31 · me/booker-perf",
        tone: "success",
        box: devl,
        path: "/home/me/work/cal-booker-perf",
        action: { kind: "review", box: devl, path: "/home/me/work/cal-booker-perf" },
        key: `review|${devl}|/home/me/work/cal-booker-perf`,
      }),
    );
  }, 1800);
}

// ?notify=1 plays them on start.
if (!fresh && new URLSearchParams(location.search).has("notify")) setTimeout(mockNotifications, 2500);
