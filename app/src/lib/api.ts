import { invoke } from "@tauri-apps/api/core";
import type {
  BerthEvent,
  BoxInfo,
  ExecResult,
  SendResult,
  Turn,
  TurnWait,
  Hook,
  HooksFile,
  WaitResult,
  WorktreeService,
  Location,
  PluginInfo,
  Service,
  Session,
  Stats,
  Status,
  TaskRequest,
  TaskResult,
  TaskTemplate,
  Theme,
  Worktree,
} from "@berth/plugin";

export type * from "@berth/plugin";

// The app is only a view: the laptop agent holds every box connection and
// serves this API on loopback (docs/reference/app-api.mdx). Closing or crashing the app
// never stops a session or a forward.

export interface Endpoint {
  url: string;
  token: string;
}

export const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

// endpoint finds the agent and its token: from the Tauri shell, which reads
// the token file, or in a plain browser from ?token= or the Vite env.
export async function endpoint(): Promise<Endpoint> {
  if (isTauri()) return invoke<Endpoint>("ui_endpoint");
  const params = new URLSearchParams(location.search);
  const token = params.get("token") ?? import.meta.env.VITE_BERTH_TOKEN;
  const url = params.get("agent") ?? import.meta.env.VITE_BERTH_URL ?? "http://127.0.0.1:1378";
  if (!token) throw new Error("No agent token. Open with ?token=… (berth ui-token prints it).");
  return { url, token };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// A live connection to a terminal session on a box.
export interface TerminalConnection {
  send(data: Uint8Array | string): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

export interface TerminalHandlers {
  onOpen(): void;
  onData(data: Uint8Array | string): void;
  // Called once, however the connection ended. byUs is true after close().
  onClose(byUs: boolean): void;
}

// Client is everything the app asks of the agent. The real one speaks HTTP;
// mock mode (?mock=1) swaps in fixtures with the same shape.
export interface Client {
  status(): Promise<Status>;
  themes(): Promise<Theme[]>;
  templates(): Promise<TaskTemplate[]>;
  plugins(): Promise<PluginInfo[]>;
  // Fetches a file from inside a plugin's folder, as bytes: its manifest or
  // main module, which the plugin host hashes before importing.
  pluginFile(plugin: PluginInfo, file: string): Promise<Uint8Array>;
  box<T = unknown>(box: string, method: string, path: string, body?: unknown): Promise<T>;
  // A box API file as bytes, such as an agent browser's screenshot.
  boxBlob(box: string, path: string): Promise<Blob>;
  // Any laptop API call, such as "GET", "/v1/hooks".
  laptop<T = unknown>(method: string, path: string, body?: unknown): Promise<T>;
  // A laptop API call that answers NDJSON, one value per line, as long
  // commands do (adding a box, upgrading, signing in to a tailnet).
  stream(method: string, path: string, body: unknown, onValue: (v: unknown) => void, signal?: AbortSignal): Promise<void>;
  addForward(box: string, local: number, remote: number): Promise<unknown>;
  // Follows events until signal aborts, reconnecting on its own; onConnect
  // runs on every (re)connect so callers can catch up on what they missed.
  events(onEvent: (e: BerthEvent) => void, onConnect: () => void, signal: AbortSignal): void;
  attach(box: string, session: string, cols: number, rows: number, handlers: TerminalHandlers): TerminalConnection;
  // The laptop proxy's URL for a port on a box.
  serviceUrl(box: string, port: number, proxyPort?: number): string;
}

// Typed helpers over Client.box for the box API.
export const boxApi = {
  locations: async (c: Client, box: string) => (await c.box<Location[] | null>(box, "GET", "locations")) ?? [],
  sessions: async (c: Client, box: string) => (await c.box<Session[] | null>(box, "GET", "sessions")) ?? [],
  stats: (c: Client, box: string) => c.box<Stats>(box, "GET", "stats"),
  services: async (c: Client, box: string) => (await c.box<Service[] | null>(box, "GET", "services")) ?? [],
  info: (c: Client, box: string) => c.box<BoxInfo>(box, "GET", "info"),
  addLocation: (c: Client, box: string, name: string, path: string) => c.box<Location>(box, "POST", "locations", { name, path }),
  addWorktree: (c: Client, box: string, location: string, req: { name: string; branch?: string; base?: string }) =>
    c.box<Worktree>(box, "POST", `locations/${encodeURIComponent(location)}/worktrees`, req),
  removeWorktree: (c: Client, box: string, location: string, worktree: string, force = false) =>
    c.box(box, "DELETE", `locations/${encodeURIComponent(location)}/worktrees/${encodeURIComponent(worktree)}${force ? "?force=1" : ""}`),
  startSession: (c: Client, box: string, req: { location: string; name?: string; command?: string }) =>
    c.box<Session>(box, "POST", "sessions", req),
  stopSession: (c: Client, box: string, name: string) => c.box(box, "DELETE", `sessions/${encodeURIComponent(name)}`),
  createTask: (c: Client, box: string, task: TaskRequest) => c.box<TaskResult>(box, "POST", "tasks", task),
  // A worktree's own services, from its repository's config.
  worktreeServices: async (c: Client, box: string, location: string, worktree: string) =>
    (await c.box<WorktreeService[] | null>(box, "GET", `locations/${encodeURIComponent(location)}/worktrees/${encodeURIComponent(worktree)}/services`)) ?? [],
  serviceAction: (c: Client, box: string, location: string, worktree: string, service: string, action: "start" | "stop" | "restart") =>
    c.box<WorktreeService>(box, "POST", `locations/${encodeURIComponent(location)}/worktrees/${encodeURIComponent(worktree)}/services/${encodeURIComponent(service)}/${action}`),
  serviceLog: (c: Client, box: string, location: string, worktree: string, service: string) =>
    c.box<string>(box, "GET", `locations/${encodeURIComponent(location)}/worktrees/${encodeURIComponent(worktree)}/services/${encodeURIComponent(service)}/log`),
  screen: (c: Client, box: string, name: string) => c.box<{ screen: string }>(box, "GET", `sessions/${encodeURIComponent(name)}/screen`),
  // send types text into a session. A person answering an agent passes
  // force: the box otherwise refuses to type into an agent at a question.
  // when "idle" holds it on the box until the agent is idle.
  send: (c: Client, box: string, name: string, text: string, enter = true, o: { when?: "now" | "idle"; force?: boolean; idem_key?: string } = {}) =>
    c.box<SendResult>(box, "POST", `sessions/${encodeURIComponent(name)}/send`, { text, enter, ...o }),
  // A session's latest turns, oldest first (boxes with the "turns" capability).
  turns: async (c: Client, box: string, name: string, limit = 20) =>
    (await c.box<Turn[] | null>(box, "GET", `sessions/${encodeURIComponent(name)}/turns?limit=${limit}`)) ?? [],
  turn: (c: Client, box: string, id: string) => c.box<Turn>(box, "GET", `turns/${encodeURIComponent(id)}`),
  // waitTurn long-polls until the turn ends (or waits for someone, with
  // until "waiting"), or timeout seconds pass.
  waitTurn: (c: Client, box: string, id: string, timeout: number, until: "end" | "waiting" = "end") =>
    c.box<TurnWait>(box, "GET", `turns/${encodeURIComponent(id)}/wait?${new URLSearchParams({ until, timeout: String(timeout) })}`),
  // wait long-polls until the session's agent reports one of states after
  // the time given, or timeout seconds pass.
  wait: (c: Client, box: string, name: string, states: string[], timeout: number, after?: string) =>
    c.box<WaitResult>(box, "GET", `sessions/${encodeURIComponent(name)}/wait?${new URLSearchParams({ for: states.join(","), timeout: String(timeout), ...(after ? { after } : {}) })}`),
  exec: (c: Client, box: string, location: string, command: string, timeout = "10m") => c.box<ExecResult>(box, "POST", "exec", { location, command, timeout }),
  hooks: (c: Client, box: string) => c.box<HooksFile>(box, "GET", "hooks"),
  saveHooks: (c: Client, box: string, hooks: Hook[]) => c.box<HooksFile>(box, "PUT", "hooks", { hooks }),
  // testSecret asks the box to resolve a secret reference now. It reports
  // whether it could and the value's length, never the value.
  testSecret: (c: Client, box: string, ref: string) => c.box<SecretTest>(box, "POST", "secrets/test", { ref }),
};

export interface SecretTest {
  ok: boolean;
  length?: number;
  error?: string;
}

// A value naming a secret rather than holding one: op://vault/item/field
// (1Password, resolved by the box's op CLI) or env://NAME (a variable from
// berthd's own environment).
export const SECRET_SCHEMES = ["op", "env"] as const;
export const isSecretRef = (v: string | undefined): boolean => !!v && SECRET_SCHEMES.some((s) => v.startsWith(`${s}://`));

// A machine on a tailnet that could be a box (berth discover).
export interface Machine {
  name: string;
  dns_name?: string;
  ip: string;
  os: string;
  online: boolean;
  // The paired box at this address, if it already is one.
  box?: string;
  // The machine runs Tailscale SSH: no keys needed to log in.
  ssh?: boolean;
  // SHA256 fingerprints of the SSH host keys the tailnet reports for it.
  host_keys?: string[];
}

export interface Discovery {
  // The SSH user to suggest: this computer's.
  user: string;
  machines: Machine[];
  // This computer's own Tailscale, when not listing a Berth network.
  tailscale?: "running" | "stopped" | "logged-out" | "missing";
  // Its tailnet's name, while running.
  tailnet?: string;
}

// A tailnet this laptop joined with its own embedded node.
export interface NetworkInfo {
  name: string;
  state: string;
  tailnet?: string;
  ips?: string[];
}

// One line of a long command's progress; the last has done set, and error
// when the command failed.
export interface StreamLine {
  line?: string;
  done?: boolean;
  error?: string;
  // A failed SSH login, explained (berth add ssh).
  ssh?: SshFailure;
}

// SshFailure is an SSH login that failed, in plain words, with what the next
// step needs: the install command when nothing answers, a key file when
// every key was refused, a fingerprint to trust for a new host.
export type SshFailure = {
  kind: "refused" | "timeout" | "unreachable" | "resolve" | "auth" | "password" | "host-key-unknown" | "host-key-changed" | "other";
  host: string;
  port?: string;
  // The one plain sentence to show.
  message: string;
  // The host key's, for host-key-unknown and host-key-changed.
  fingerprint?: string;
  // The agent and keys offered, for auth.
  tried?: string[];
  // ssh's own last line.
  detail?: string;
};

// SshPlan is how Berth will log in to a host, worked out before connecting
// from ~/.ssh/config (ssh -G) and the key agents that answer.
export type SshPlan = {
  host: string;
  user: string;
  hostname: string;
  port: string;
  agent?: { name: string; socket: string; source: "ssh-config" | "environment" | "launchd" | "discovered" };
  // Key files ssh will offer that exist.
  identity_files: string[];
  proxy_jump?: string;
  // One plain line: "Using 1Password's SSH agent".
  summary: string;
};

// CommandError is a streamed command's failure; ssh explains a failed SSH
// login when that is what went wrong.
export class CommandError extends Error {
  ssh?: SshFailure;
  constructor(message: string, ssh?: SshFailure) {
    super(message);
    this.name = "CommandError";
    this.ssh = ssh;
  }
}

// runCommand follows a streamed CLI command, passing each line of output on,
// and rejects with the command's own error when it fails.
async function runCommand(c: Client, method: string, path: string, body: unknown, onLine: (line: string) => void, signal?: AbortSignal) {
  let failure: string | undefined;
  let ssh: SshFailure | undefined;
  let finished = false;
  await c.stream(
    method,
    path,
    body,
    (v) => {
      const l = v as StreamLine;
      if (l.line !== undefined) onLine(l.line);
      if (l.done) {
        finished = true;
        failure = l.error;
        ssh = l.ssh;
      }
    },
    signal,
  );
  if (failure) throw new CommandError(failure, ssh);
  if (!finished && !signal?.aborted) throw new Error("The agent stopped answering before the command finished.");
}

// The laptop agent's own API, beside the boxes'.
export const laptopApi = {
  hooks: (c: Client) => c.laptop<HooksFile>("GET", "/v1/hooks"),
  saveHooks: (c: Client, hooks: Hook[]) => c.laptop<HooksFile>("PUT", "/v1/hooks", { hooks }),
  pair: (c: Client, link: string, name?: string, network?: string) =>
    c.laptop<{ name: string; address?: string; network?: string }>("POST", "/v1/boxes/pair", { link, name: name || undefined, network: network || undefined }),
  forget: (c: Client, box: string) => c.laptop("DELETE", `/v1/boxes/${encodeURIComponent(box)}`),
  upgrade: (c: Client, box: string, onLine: (line: string) => void, signal?: AbortSignal) =>
    runCommand(c, "POST", `/v1/boxes/${encodeURIComponent(box)}/upgrade`, undefined, onLine, signal),
  // addSsh installs berthd on a host over SSH and pairs with it. It rejects
  // with a CommandError whose ssh explains a failed login. identity is a key
  // file to log in with; trust_host_key, a SHA256 fingerprint the person
  // approved for a host this computer hasn't connected to before.
  addSsh: (
    c: Client,
    req: { host: string; name?: string; network?: string; address?: string; identity?: string; trust_host_key?: string },
    onLine: (line: string) => void,
    signal?: AbortSignal,
  ) => runCommand(c, "POST", "/v1/boxes/add-ssh", req, onLine, signal),
  // sshPlan says how Berth will log in to a host, without connecting.
  sshPlan: (c: Client, host: string, network?: string) =>
    c.laptop<SshPlan>("GET", `/v1/ssh/plan?host=${encodeURIComponent(host)}${network ? `&network=${encodeURIComponent(network)}` : ""}`),
  // sshHosts are the hosts ~/.ssh/config names, for completing a host field.
  sshHosts: async (c: Client) => (await c.laptop<string[] | null>("GET", "/v1/ssh/hosts")) ?? [],
  discover: (c: Client, network?: string) => c.laptop<Discovery>("GET", `/v1/discover${network ? `?network=${encodeURIComponent(network)}` : ""}`),
  networks: async (c: Client) => (await c.laptop<NetworkInfo[] | null>("GET", "/v1/networks")) ?? [],
  // networkLogin joins a tailnet: onUrl gets the sign-in page to open, and
  // the promise settles once the person has signed in.
  async networkLogin(c: Client, name: string, onUrl: (url: string) => void, signal?: AbortSignal): Promise<NetworkInfo> {
    let joined: NetworkInfo | undefined;
    let failure: string | undefined;
    await c.stream(
      "POST",
      `/v1/networks/${encodeURIComponent(name)}/login`,
      undefined,
      (v) => {
        const m = v as { auth_url?: string; network?: NetworkInfo; error?: string };
        if (m.auth_url) onUrl(m.auth_url);
        if (m.network) joined = m.network;
        if (m.error) failure = m.error;
      },
      signal,
    );
    if (failure) throw new Error(failure);
    if (!joined) throw new Error("The sign-in did not finish.");
    return joined;
  },
  // Turning a plugin on takes the hash of the files the user reviewed (see
  // plugins/consent.ts); the agent refuses it if they have changed since.
  allowPlugin: (c: Client, id: string, hash: string) => c.laptop<PluginInfo>("POST", `/v1/plugins/${encodeURIComponent(id)}/enable`, { hash }),
  disablePlugin: (c: Client, id: string) => c.laptop<PluginInfo>("POST", `/v1/plugins/${encodeURIComponent(id)}/disable`),
};

export function httpClient(ep: Endpoint): Client {
  const headers = { Authorization: `Bearer ${ep.token}` };

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(ep.url + path, {
      method,
      headers: body === undefined ? headers : { ...headers, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      let message = text.trim() || res.statusText;
      try {
        message = (JSON.parse(text) as { error?: string }).error ?? message;
      } catch {
        // Not JSON: a plain-text error is already the message.
      }
      throw new ApiError(message, res.status);
    }
    // Logs come back as plain text; everything else is JSON.
    if (res.headers.get("Content-Type")?.startsWith("text/plain")) return text as T;
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    status: () => request("GET", "/v1/status"),
    themes: () => request("GET", "/v1/themes"),
    templates: () => request("GET", "/v1/templates"),
    plugins: () => request("GET", "/v1/plugins"),
    async pluginFile(p, file) {
      const res = await fetch(`${ep.url}/v1/plugins/${encodeURIComponent(p.id)}/${file.split("/").map(encodeURIComponent).join("/")}`, { headers });
      if (!res.ok) throw new ApiError(`${p.id}: ${file}: ${res.status} ${res.statusText}`, res.status);
      return new Uint8Array(await res.arrayBuffer());
    },
    box: (box, method, path, body) => request(method, `/v1/boxes/${encodeURIComponent(box)}/api/${path}`, body),
    async boxBlob(box, path) {
      const res = await fetch(`${ep.url}/v1/boxes/${encodeURIComponent(box)}/api/${path}`, { headers });
      if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status);
      return res.blob();
    },
    laptop: (method, path, body) => request(method, path, body),
    async stream(method, path, body, onValue, signal) {
      const res = await fetch(ep.url + path, {
        method,
        headers: body === undefined ? headers : { ...headers, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        let message = text.trim() || res.statusText;
        try {
          message = (JSON.parse(text) as { error?: string }).error ?? message;
        } catch {
          // A plain-text error is already the message.
        }
        throw new ApiError(message, res.status);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      const take = (line: string) => {
        if (!line.trim()) return;
        try {
          onValue(JSON.parse(line));
        } catch {
          // A line that is not JSON is skipped rather than ending the stream.
        }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          take(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
      }
      take(buf);
    },
    addForward: (box, local, remote) => request("POST", "/v1/forwards", { box, local, remote }),
    events: (onEvent, onConnect, signal) => followEvents(ep, onEvent, onConnect, signal),
    attach: (box, session, cols, rows, handlers) => {
      const url = new URL(`/v1/boxes/${encodeURIComponent(box)}/sessions/${encodeURIComponent(session)}/attach`, ep.url);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.search = new URLSearchParams({ cols: String(cols), rows: String(rows), token: ep.token }).toString();
      return attachSocket(url.toString(), handlers);
    },
    serviceUrl: (box, port, proxyPort = 1377) => `http://${port}.${box}.localhost${proxyPort === 80 ? "" : `:${proxyPort}`}/`,
  };
}

// followEvents reads the agent's server-sent events with fetch, which unlike
// EventSource can send the token, and reconnects with backoff when the
// stream ends: after sleep, or while the agent restarts.
function followEvents(ep: Endpoint, onEvent: (e: BerthEvent) => void, onConnect: () => void, signal: AbortSignal) {
  let delay = 500;
  const loop = async () => {
    while (!signal.aborted) {
      try {
        const res = await fetch(`${ep.url}/v1/events`, {
          headers: { Authorization: `Bearer ${ep.token}`, Accept: "text/event-stream" },
          signal,
        });
        if (!res.ok || !res.body) throw new Error(`events: ${res.status}`);
        delay = 500;
        onConnect();
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let end: number;
          while ((end = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, end);
            buf = buf.slice(end + 2);
            const data = block
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart())
              .join("\n");
            if (!data) continue;
            try {
              onEvent(JSON.parse(data) as BerthEvent);
            } catch {
              // A malformed event is dropped, not fatal to the stream.
            }
          }
        }
      } catch {
        if (signal.aborted) return;
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 10_000);
    }
  };
  void loop();
}

// attachSocket relays a terminal over a WebSocket: binary messages carry
// bytes both ways, and text messages carry resizes to the box.
function attachSocket(url: string, h: TerminalHandlers): TerminalConnection {
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  let closedByUs = false;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    h.onClose(closedByUs);
  };
  ws.onopen = () => h.onOpen();
  ws.onmessage = (m) => h.onData(typeof m.data === "string" ? m.data : new Uint8Array(m.data as ArrayBuffer));
  ws.onclose = end;
  ws.onerror = end;
  const encoder = new TextEncoder();
  return {
    send(data) {
      if (ws.readyState === WebSocket.OPEN) ws.send(typeof data === "string" ? encoder.encode(data) : (data as Uint8Array<ArrayBuffer>));
    },
    resize(cols, rows) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "resize", cols, rows }));
    },
    close() {
      closedByUs = true;
      ws.close();
    },
  };
}
