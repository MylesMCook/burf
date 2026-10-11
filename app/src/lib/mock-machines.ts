import { ApiError, type Status } from "@/lib/api";
import type { Change, Coverage, Machine, Route, Service, Snapshot } from "@/lib/inventory";

// Machine inventory in mock mode (?mock=1) and the demo: every paired box is
// a machine with a few services, and a machine can be added for inspection
// over SSH. All of it is invented; nothing is read from anywhere.

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

// Machines added for inspection, and the routes set on any machine since.
const added: Machine[] = [];
const routes = new Map<string, Route[]>();

function machines(status: Status): Machine[] {
  const paired = status.boxes.map((b): Machine => ({ id: `box-${b.name}`, name: b.name, os: "linux", routes: [{ kind: "paired", target: b.fingerprint }], updated_at: b.since }));
  return [...paired, ...added].map((m) => ({ ...m, routes: routes.get(m.id) ?? m.routes }));
}

function services(m: Machine): Service[] {
  const service = (key: string, source: string, name: string, state: Service["state"], more: Partial<Service> = {}): Service => ({ id: `${m.id}:${key}`, machine_id: m.id, key, source, name, state, ports: [], observed_at: minutesAgo(1), ...more });
  if (m.routes.every((r) => r.kind === "ssh")) {
    return [service("docker:postgres", "docker", "postgres", "running", { health: "healthy", ports: [5432] }), service("systemd:nginx", "systemd-system", "nginx.service", "running", { ports: [80, 443], pid: 812 })];
  }
  return [
    service("agent:claude", "burf-agents", "Claude Code", "running", { worktree: "/w/shop-fix", pid: 4411 }),
    service("listener:5173", "listeners", "vite", "running", { ports: [5173], location: "/w/shop", pid: 5120 }),
    service("docker:redis", "docker", "redis", "running", { health: "healthy", ports: [6379] }),
    service("systemd:backup", "systemd-system", "backup.service", "failed"),
  ];
}

function snapshot(m: Machine): Snapshot {
  const list = services(m);
  const coverage = ["connection", ...new Set(list.map((s) => s.source))].map((source): Coverage => ({ source, state: "ok", at: minutesAgo(1) }));
  return { machine: m, services: list, coverage, at: minutesAgo(1) };
}

function history(m: Machine, id: string): Change[] {
  const service = services(m).find((s) => s.id === id);
  if (!service) return [];
  const first: Change = { id: 1, machine_id: m.id, service_id: id, at: minutesAgo(180), after: { ...service, state: "running" }, gap: false };
  return service.state === "running" ? [first] : [first, { id: 2, machine_id: m.id, service_id: id, at: minutesAgo(40), before: first.after, after: service, gap: false }];
}

export function machinesCall(method: string, path: string, body: unknown, status: Status, delay: <T>(v: T) => Promise<T>): Promise<unknown> | undefined {
  const [route, query = ""] = path.split("?");
  if (route === "/v1/machines") {
    const all = machines(status);
    if (method === "GET") {
      const q = new URLSearchParams(query);
      // The mock's own computer is a paired box, not a native local machine.
      if (q.has("local")) return delay([]);
      const box = q.get("box");
      return delay(box ? all.filter((m) => m.id === `box-${box}`) : all);
    }
    if (method === "POST") {
      const req = body as { name: string; os?: Machine["os"]; routes: Route[] };
      const machine: Machine = { id: `ssh-${added.length + 1}`, name: req.name, os: req.os, routes: req.routes, updated_at: minutesAgo(0) };
      added.push(machine);
      return delay(machine);
    }
    return undefined;
  }
  const match = /^\/v1\/machines\/([^/]+)\/(routes|inventory|history|refresh)$/.exec(route);
  if (!match) return undefined;
  const machine = machines(status).find((m) => m.id === decodeURIComponent(match[1]));
  if (!machine) return Promise.reject(new ApiError("no machine with that id", 404, "not_found"));
  if (match[2] === "routes" && method === "PUT") {
    routes.set(machine.id, (body as { routes: Route[] }).routes);
    return delay({ ...machine, routes: routes.get(machine.id)! });
  }
  if ((match[2] === "inventory" && method === "GET") || (match[2] === "refresh" && method === "POST")) return delay(snapshot(machine));
  if (match[2] === "history" && method === "GET") return delay(history(machine, new URLSearchParams(query).get("service") ?? ""));
  return undefined;
}
