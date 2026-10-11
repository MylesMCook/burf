import { createRequire } from "node:module";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve, posix, win32 } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

// This address is replaced before any network request. Codex keeps one
// stdio server while Burf's private companion changes ports between runs.
const endpoint = "http://127.0.0.1:1";

async function readRecord(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error("Invalid native feedback session file.");
  return JSON.parse(await readFile(path, "utf8"));
}

async function readDevelopmentSession(state) {
  if (await realpath(state) !== resolve(state)) throw new Error("Native feedback state must have no symlink ancestors.");
  const session = await readRecord(join(state, "session.json"));
  const owner = await readRecord(join(state, "run.lock", "owner.json"));
  if (!Number.isInteger(session.pid) || session.pid <= 0 || session.pid !== owner.pid || session.runID !== owner.runID || !/^[0-9a-f]{32}$/.test(session.runID)) throw new Error("Invalid native feedback run identity.");
  process.kill(session.pid, 0);
  return session;
}

export function runtimeFeedbackDirectory(platform = process.platform, environment = process.env, home = homedir()) {
  const { isAbsolute, join } = platform === "win32" ? win32 : posix;
  let base = environment.BERTH_HOME;
  if (base && !isAbsolute(base)) throw new Error("Feedback state home must be absolute.");
  if (!base) {
    const config = platform === "darwin" ? join(home, "Library", "Application Support")
      : platform === "win32" ? environment.APPDATA || join(home, "AppData", "Roaming")
      : environment.XDG_CONFIG_HOME || join(home, ".config");
    if (!isAbsolute(config)) throw new Error("Feedback configuration directory must be absolute.");
    base = join(config, "berth");
  }
  return join(base, "client", "native-feedback");
}

export function feedbackFetch(state, startCommand, networkFetch = globalThis.fetch, runtimeState) {
  return async (input, options = {}) => {
    const requested = new URL(input);
    if (requested.origin !== endpoint) throw new Error("Feedback tools may only contact this app's private companion.");
    let session;
    let runtimeToken;
    try {
      if (runtimeState) {
        try {
          if (await realpath(runtimeState) !== resolve(runtimeState)) throw new Error("Runtime feedback state must have no symlink ancestors.");
          const runtimeFile = join(runtimeState, "session.json");
          const native = await readRecord(runtimeFile);
          if (native.version !== 1 || native.mode !== "runtime" || typeof native.enabled !== "boolean" || !Number.isInteger(native.pid) || native.pid <= 0 || !/^[0-9a-f]{32}$/.test(native.runID)) throw new Error("Invalid runtime feedback identity.");
          process.kill(native.pid, 0);
          let newerDevelopment = false;
          try {
            if ((await lstat(join(state, "session.json"))).mtimeMs > (await lstat(runtimeFile)).mtimeMs) {
              session = await readDevelopmentSession(state);
              newerDevelopment = true;
            }
          } catch (error) { if (!["ENOENT", "ESRCH", "EPERM"].includes(error.code)) throw error; }
          if (!newerDevelopment) {
            if (!native.enabled) throw new Error("Native feedback is off. Enable it in Burf Settings > Developer. This Codex connection will reconnect automatically.");
            if (!/^[0-9a-f]{64}$/.test(native.token)) throw new Error("Invalid private runtime feedback capability.");
            session = native;
            runtimeToken = native.token;
          }
        } catch (error) { if (!["ENOENT", "ESRCH"].includes(error.code)) throw error; }
      }
      if (!session) {
        session = await readDevelopmentSession(state);
      }
    } catch (error) {
      if (["ENOENT", "ESRCH"].includes(error.code)) throw new Error(`Native feedback is not running. Open Burf and enable it in Settings > Developer. For a hot-reload development run, use ${startCommand}. This Codex connection will reconnect automatically.`);
      throw error;
    }
    const current = new URL(session.companionURL);
    if (current.protocol !== "http:" || current.hostname !== "127.0.0.1" || !current.port || current.pathname !== "/" || current.search || current.hash || current.username || current.password) throw new Error("Invalid private native feedback endpoint. Restart feedback.");
    const target = new URL(requested.pathname + requested.search, current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let headers = options.headers;
    if (runtimeToken) {
      headers = new Headers(headers);
      if (headers.has("Origin")) { clearTimeout(timeout); throw new Error("Runtime feedback tools cannot send a browser Origin."); }
      headers.set("Authorization", `Bearer ${runtimeToken}`);
    }
    try {
      return await networkFetch(target, { ...options, headers, redirect: "error", signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new Error(`The feedback request was interrupted. ${runtimeToken ? "Enable native feedback in Burf Settings > Developer" : `Start or restart with ${startCommand}`}, then check comment status before retrying a change.`, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  };
}

export async function startFeedbackMcp(planFile = join(dirname(fileURLToPath(import.meta.url)), "plan.json")) {
  const plan = JSON.parse(await readFile(planFile, "utf8"));
  const root = resolve(dirname(planFile), plan.root);
  const frontend = resolve(root, plan.frontend);
  const require = createRequire(join(frontend, "package.json"));
  const entry = require.resolve("agentation-mcp");
  const metadata = JSON.parse(await readFile(join(dirname(dirname(entry)), "package.json"), "utf8"));
  if (metadata.version !== "1.3.2") throw new Error("The feedback connection requires the pinned agentation-mcp 1.3.2 dependency.");
  // The MCP-only public API never opens a store or starts a listener.
  // Inherited cloud/webhook settings must not route app comments elsewhere.
  for (const key of Object.keys(process.env)) if (/^AGENTATION_/i.test(key)) delete process.env[key];
  const startCommand = plan.packageManager === "pnpm" ? `pnpm --dir ${plan.frontend} dev:feedback` : `${plan.packageManager} run dev:feedback from ${plan.frontend}`;
  globalThis.fetch = feedbackFetch(join(dirname(planFile), "state"), startCommand, globalThis.fetch, runtimeFeedbackDirectory());
  await require("agentation-mcp").startMcpServer(endpoint);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await startFeedbackMcp(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
