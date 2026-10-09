import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

// A stand-in for the agent HTTP API and event stream. Tests override
// structured/local routes through their browser context.
//
// It listens on a free loopback port, never the agent's 1377-1379.

export const BOX = "devl";
export const SESSION = "fix-claude";
export const DIR = "/w/shop-fix";

export interface FakeAgent {
  url: string;
  token: string;
  // Fields laid over the session as the box lists it (its state, command…).
  session: Record<string, unknown>;
  // Every request, as "METHOD path?query".
  calls: string[];
  // Fields laid over the box's status while it is online: its latency and
  // link (slow, why, how Tailscale reaches it).
  online: Record<string, unknown>;
  // Sends an event to the app's stream.
  event(e: { type: string; data?: Record<string, unknown> }): void;
  close(): Promise<void>;
}

const now = () => new Date().toISOString();

const ITEMS = [
  { kind: "user", id: "u1", text: "Fix the flaky checkout test", off: 10 },
  { kind: "text", id: "t1", text: "The retry loop never backs off; fixed it.", off: 200 },
];

export async function fakeAgent(): Promise<FakeAgent> {
  const streams = new Set<ServerResponse>();
  let seq = 0;
  const agent: FakeAgent = {
    url: "",
    token: "e2e-token",
    calls: [],
    online: {},
    session: {},
    event(e) {
      const ev = { seq: ++seq, time: now(), box: BOX, origin: "claude", ...e };
      for (const s of streams) s.write(`data: ${JSON.stringify(ev)}\n\n`);
    },
    close: () =>
      new Promise((resolve) => {
        for (const s of streams) s.end();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };

  const created = new Date(Date.now() - 10 * 60_000).toISOString();
  const status = () => ({
    boxes: [
      { name: BOX, address: "devl:7444", fingerprint: "e2e", state: "online", since: created, latency_ms: 3, ...agent.online },
    ],
    forwards: [],
    routes: [],
    proxy: { port: 1377, url_port: 1377 },
  });
  const box: Record<string, () => unknown> = {
    info: () => ({ name: BOX, version: "0.3.7", build: "e2e", tools: ["claude"], capabilities: ["transcript", "turns"], agents: [{ id: "claude", name: "Claude Code", command: "claude" }] }),
    locations: () => [
      {
        name: "shop",
        path: "/w/shop",
        repo: true,
        worktrees: [
          { name: "shop", path: "/w/shop", branch: "main", main: true },
          { name: "fix", path: DIR, branch: "me/fix" },
        ],
      },
    ],
    sessions: () => [
      { name: SESSION, title: "Fix the flaky checkout test", location: "shop/fix", dir: DIR, command: "claude", created, attached: 0, exited: false, agent: "claude", agent_state: "running", state_since: now(), ...agent.session },
    ],
    stats: () => ({}),
    services: () => [],
  };

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? "/", "http://fake");
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    agent.calls.push(`${req.method} ${u.pathname}${u.search}`);
    if (req.headers.authorization !== `Bearer ${agent.token}`) return send(res, 401, { error: "missing or wrong token" });
    const p = u.pathname;
    if (p === "/v1/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      res.write(": hello\n\n");
      streams.add(res);
      req.on("close", () => streams.delete(res));
      return;
    }
    if (req.method === "GET" && p === "/v1/status") return send(res, 200, status());
    if (req.method === "POST" && p === "/v1/refresh") return send(res, 200, status());
    if (req.method === "GET" && (p === "/v1/themes" || p === "/v1/templates" || p === "/v1/plugins")) return send(res, 200, []);
    const m = /^\/v1\/boxes\/([^/]+)\/api\/(.*)$/.exec(p);
    if (m && m[1] === BOX && req.method === "GET") {
      const rest = m[2];
      if (rest === `sessions/${SESSION}/transcript`) {
        return send(res, 200, { source: "claude", items: ITEMS, next: 2, crew: [], gen: "1.0", start: 10, file: "abc" });
      }
      if (rest === `sessions/${SESSION}/screen`) return send(res, 200, { screen: "" });
      if (box[rest]) return send(res, 200, box[rest]());
    }
    send(res, 404, { error: "not on this agent", code: "not_found" });
  };
  const server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  agent.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return agent;
}
