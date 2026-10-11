import { createRequire } from "node:module";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This address is replaced before any network request. Codex keeps one
// stdio server while Burf's private companion changes ports between runs.
const endpoint = "http://127.0.0.1:1";

async function readRecord(path) {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error("Invalid native feedback session file.");
  return JSON.parse(await readFile(path, "utf8"));
}

export function feedbackFetch(state, startCommand, networkFetch = globalThis.fetch) {
  return async (input, options = {}) => {
    const requested = new URL(input);
    if (requested.origin !== endpoint) throw new Error("Feedback tools may only contact this app's private companion.");
    let session;
    try {
      if (await realpath(state) !== resolve(state)) throw new Error("Native feedback state must have no symlink ancestors.");
      session = await readRecord(join(state, "session.json"));
      const owner = await readRecord(join(state, "run.lock", "owner.json"));
      if (!Number.isInteger(session.pid) || session.pid <= 0 || session.pid !== owner.pid || session.runID !== owner.runID || !/^[0-9a-f]{32}$/.test(session.runID)) throw new Error("Invalid native feedback run identity.");
      process.kill(session.pid, 0);
    } catch (error) {
      if (["ENOENT", "ESRCH"].includes(error.code)) throw new Error(`Native feedback is not running. Start it with ${startCommand}. This Codex connection will reconnect automatically.`);
      throw error;
    }
    const current = new URL(session.companionURL);
    if (current.protocol !== "http:" || current.hostname !== "127.0.0.1" || !current.port || current.pathname !== "/" || current.search || current.hash || current.username || current.password) throw new Error("Invalid private native feedback endpoint. Restart feedback.");
    const target = new URL(requested.pathname + requested.search, current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      return await networkFetch(target, { ...options, redirect: "error", signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new Error(`The feedback request was interrupted. Start or restart with ${startCommand}, then check comment status before retrying a change.`, { cause: error });
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
  globalThis.fetch = feedbackFetch(join(dirname(planFile), "state"), startCommand);
  await require("agentation-mcp").startMcpServer(endpoint);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await startFeedbackMcp(process.argv[2]); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
