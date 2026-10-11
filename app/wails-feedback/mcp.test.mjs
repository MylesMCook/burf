import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, realpath, rm, utimes, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feedbackFetch, runtimeFeedbackDirectory } from "./mcp.mjs";
import { codexCommand, connectCodex } from "./connect-codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const app = process.env.WAILS_FEEDBACK_TEST_APP ?? resolve(here, "..");

test("regular feedback discovery matches the native state layout on Mac and Windows", () => {
  assert.equal(runtimeFeedbackDirectory("darwin", {}, "/Users/test"), "/Users/test/Library/Application Support/berth/client/native-feedback");
  assert.equal(runtimeFeedbackDirectory("win32", { APPDATA: "C:\\Users\\test\\AppData\\Roaming" }, "C:\\Users\\test"), "C:\\Users\\test\\AppData\\Roaming\\berth\\client\\native-feedback");
  assert.equal(runtimeFeedbackDirectory("win32", { BERTH_HOME: "D:\\Synthetic\\berth" }, "C:\\Users\\test"), "D:\\Synthetic\\berth\\client\\native-feedback");
  assert.throws(() => runtimeFeedbackDirectory("win32", { BERTH_HOME: "relative" }, "C:\\Users\\test"), /absolute/);
});

test("runtime discovery revokes disabled generations and rotates capability without replay", async () => {
  const f = await fixture();
  const runtime = join(f.root, "runtime");
  await mkdir(runtime, { mode: 0o700 });
  const attempts = [];
  const fetch = feedbackFetch(join(f.root, "state"), "pnpm --dir app dev:feedback", async (url, options) => {
    attempts.push({ url: url.href, token: options.headers.get("Authorization") });
    return new Response("{}");
  }, runtime);
  const record = { version: 1, mode: "runtime", enabled: true, pid: process.pid, runID: "a".repeat(32), companionURL: "http://127.0.0.1:49002", token: "b".repeat(64) };
  const write = (value) => writeFile(join(runtime, "session.json"), JSON.stringify(value), { mode: 0o600 });
  try {
    await write({ ...record, enabled: false, token: undefined, companionURL: undefined });
    await assert.rejects(fetch("http://127.0.0.1:1/pending"), /off.*Settings > Developer/);
    assert.equal(attempts.length, 0);
    await write(record);
    await fetch("http://127.0.0.1:1/pending");
    assert.deepEqual(attempts[0], { url: "http://127.0.0.1:49002/pending", token: "Bearer " + record.token });
    await assert.rejects(fetch("http://127.0.0.1:1/pending", { headers: { Origin: "http://wails.localhost" } }), /browser Origin/);
    await write({ ...record, enabled: false });
    await assert.rejects(fetch("http://127.0.0.1:1/pending"), /off/);
    await write({ ...record, companionURL: "http://127.0.0.1:49003", token: "c".repeat(64), runID: "d".repeat(32) });
    await fetch("http://127.0.0.1:1/pending");
    assert.equal(attempts[1].url, "http://127.0.0.1:49003/pending");
    assert.equal(attempts[1].token, "Bearer " + "c".repeat(64));
    await write({ ...record, companionURL: "https://example.invalid" });
    await assert.rejects(fetch("http://127.0.0.1:1/pending"), /Invalid private/);
    assert.equal(attempts.length, 2);
  } finally { await f.clean(); }
});
async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "feedback-mcp-"));
  await mkdir(join(root, "state", "run.lock"), { recursive: true });
  const planFile = join(root, "plan.json");
  await writeFile(planFile, JSON.stringify({ root: app, frontend: ".", packageManager: "pnpm", appName: "burf" }));
  const setSession = async (url, runID = "a".repeat(32)) => {
    const identity = { pid: process.pid, runID };
    await writeFile(join(root, "state", "run.lock", "owner.json"), JSON.stringify(identity));
    await writeFile(join(root, "state", "session.json"), JSON.stringify({ ...identity, companionURL: url }));
  };
  return { root, planFile, setSession, clean: () => rm(root, { recursive: true, force: true }) };
}

test("a dead newer development run cannot hide enabled normal-app feedback", async () => {
  const f = await fixture();
  const runtime = join(f.root, "runtime");
  await mkdir(runtime, { mode: 0o700 });
  const record = { version: 1, mode: "runtime", enabled: true, pid: process.pid, runID: "a".repeat(32), companionURL: "http://127.0.0.1:49002", token: "b".repeat(64) };
  let request;
  const fetch = feedbackFetch(join(f.root, "state"), "pnpm --dir app dev:feedback", async (url, options) => {
    request = { url: url.href, token: options.headers?.get("Authorization") };
    return new Response("{}");
  }, runtime);
  try {
    await writeFile(join(runtime, "session.json"), JSON.stringify(record), { mode: 0o600 });
    const child = spawnSync(process.execPath, ["-e", ""], { timeout: 5000 });
    assert.equal(child.status, 0);
    assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
    const dead = { pid: child.pid, runID: "c".repeat(32) };
    await writeFile(join(f.root, "state", "run.lock", "owner.json"), JSON.stringify(dead));
    await writeFile(join(f.root, "state", "session.json"), JSON.stringify({ ...dead, companionURL: "http://127.0.0.1:49003" }));
    const newer = new Date(Date.now() + 2000);
    await utimes(join(f.root, "state", "session.json"), newer, newer);
    await fetch("http://127.0.0.1:1/pending");
    assert.deepEqual(request, { url: "http://127.0.0.1:49002/pending", token: "Bearer " + record.token });
    await f.setSession("http://127.0.0.1:49003", "c".repeat(32));
    await utimes(join(f.root, "state", "session.json"), newer, newer);
    await fetch("http://127.0.0.1:1/pending");
    assert.deepEqual(request, { url: "http://127.0.0.1:49003/pending", token: undefined });
  } finally { await f.clean(); }
});

test("one MCP client discovers tools offline and reads and resolves comments across companion restarts", async () => {
  const f = await fixture();
  const require = createRequire(join(app, "package.json"));
  const dependency = createRequire(require.resolve("agentation-mcp"));
  const { Client } = dependency("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = dependency("@modelcontextprotocol/sdk/client/stdio.js");
  const client = new Client({ name: "feedback-restart-test", version: "1" });
  const servers = [];
  async function companion(id) {
    const annotation = { id, sessionId: "synthetic", comment: "Synthetic restart acceptance", element: "button", elementPath: "body > button", x: 1, y: 1, timestamp: Date.now(), status: "pending" };
    let writes = 0;
    const server = createServer(async (req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET" && req.url === "/pending") return res.end(JSON.stringify({ count: annotation.status === "pending" ? 1 : 0, annotations: annotation.status === "pending" ? [annotation] : [] }));
      if (req.method === "PATCH" && req.url === `/annotations/${id}`) {
        let body = "";
        for await (const part of req) body += part;
        annotation.status = JSON.parse(body).status;
        writes++;
        return res.end(JSON.stringify(annotation));
      }
      res.writeHead(404); res.end("{}");
    });
    await new Promise((yes) => server.listen(0, "127.0.0.1", yes));
    const url = `http://127.0.0.1:${server.address().port}`;
    servers.push(server);
    return { url, annotation, writes: () => writes, stop: () => new Promise((yes) => server.close(yes)) };
  }
  const data = (response) => { assert.notEqual(response.isError, true, response.content[0]?.text); return JSON.parse(response.content[0].text); };
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(here, "mcp.mjs"), f.planFile], env: { ...process.env, AGENTATION_API_KEY: "synthetic-must-not-leave-machine", AGENTATION_WEBHOOK_URL: "https://example.invalid/never" }, stderr: "pipe" }));
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    assert.equal(tools.length, 9);
    assert.ok(tools.includes("agentation_watch_annotations"));
    const offline = await client.callTool({ name: "agentation_get_all_pending", arguments: {} });
    assert.equal(offline.isError, true);
    assert.match(offline.content[0].text, /not running.*dev:feedback/);
    assert.match(offline.content[0].text, /Open Burf and enable it in Settings > Developer/);
    const first = await companion("before-restart");
    await f.setSession(first.url);
    assert.equal(data(await client.callTool({ name: "agentation_get_all_pending", arguments: {} })).annotations[0].id, "before-restart");
    data(await client.callTool({ name: "agentation_resolve", arguments: { annotationId: "before-restart" } }));
    assert.equal(first.annotation.status, "resolved");
    assert.equal(first.writes(), 1);
    await first.stop();
    await rm(join(f.root, "state", "session.json"));
    assert.equal((await client.callTool({ name: "agentation_get_all_pending", arguments: {} })).isError, true);
    const second = await companion("after-restart");
    assert.notEqual(first.url, second.url);
    await f.setSession(second.url, "b".repeat(32));
    assert.equal(data(await client.callTool({ name: "agentation_get_all_pending", arguments: {} })).annotations[0].id, "after-restart");
    data(await client.callTool({ name: "agentation_resolve", arguments: { annotationId: "after-restart" } }));
    assert.equal(second.annotation.status, "resolved");
    assert.equal(second.writes(), 1);
    assert.equal((await client.listTools()).tools.length, 9);
  } finally {
    await client.close();
    for (const server of servers) if (server.listening) await new Promise((yes) => server.close(yes));
    await f.clean();
  }
});

test("invalid or stale runs cannot route feedback off-machine, and interrupted writes are never replayed", async () => {
  const f = await fixture();
  let attempts = 0;
  const fetch = feedbackFetch(join(f.root, "state"), "pnpm --dir app dev:feedback", async () => { attempts++; throw new Error("connection lost"); });
  try {
    await assert.rejects(fetch("http://127.0.0.1:1/pending"), /not running/);
    await f.setSession("https://example.invalid");
    await assert.rejects(fetch("http://127.0.0.1:1/pending"), /Invalid private/);
    await f.setSession("http://127.0.0.1:49001");
    await writeFile(join(f.root, "state", "run.lock", "owner.json"), JSON.stringify({ pid: process.pid, runID: "c".repeat(32) }));
    await assert.rejects(fetch("http://127.0.0.1:1/pending"), /run identity/);
    await f.setSession("http://127.0.0.1:49001");
    await assert.rejects(fetch("http://127.0.0.1:1/annotations/synthetic", { method: "PATCH", body: "{}" }), /check comment status/);
    assert.equal(attempts, 1);
    await assert.rejects(fetch("https://example.invalid/pending"), /only contact/);
    assert.equal(attempts, 1);
  } finally { await f.clean(); }
});

test("Codex connection setup is idempotent, reversible and refuses unrelated registration", async () => {
  const f = await fixture();
  let registration;
  const commands = [];
  const invoke = (args) => {
    commands.push(args);
    if (args[1] === "get") return registration ? { status: 0, stdout: JSON.stringify(registration) } : { status: 1, stderr: "No MCP server named 'burf-feedback' found." };
    if (args[1] === "add") registration = { transport: { type: "stdio", command: args[4], args: [args[5]] } };
    if (args[1] === "remove") registration = undefined;
    return { status: 0, stdout: "" };
  };
  const options = { invoke, planFile: f.planFile };
  try {
    assert.match(await connectCodex(options), /connected/);
    assert.match(await connectCodex(options), /already connected/);
    assert.equal(commands.filter((args) => args[1] === "add").length, 1);
    registration.enabled = false;
    await assert.rejects(connectCodex(options), /configured but disabled/);
    assert.match(await connectCodex({ ...options, remove: true }), /disconnected/);
    assert.match(await connectCodex({ ...options, remove: true }), /already disconnected/);
    assert.equal(commands.filter((args) => args[1] === "remove").length, 1);
    registration = { transport: { type: "streamable_http", url: "http://127.0.0.1:49000/mcp" } };
    await assert.rejects(connectCodex(options), /different.*No configuration changed/);
    await assert.rejects(connectCodex({ ...options, remove: true }), /different.*No configuration changed/);
    assert.equal(commands.filter((args) => args[1] === "add").length, 1);
  } finally { await f.clean(); }
});

test("Windows PowerShell passes all CLI arguments through a Codex script shim", { skip: process.platform !== "win32" }, async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.root, "codex.ps1"), '$args | ConvertTo-Json -Compress\nexit 0\n');
    const environment = { ...process.env };
    const path = Object.keys(environment).find((key) => key.toLowerCase() === "path");
    environment[path] = f.root + ";" + environment[path];
    const args = ["mcp", "add", "burf-feedback", "--", "C:\\Program Files\\nodejs\\node.exe", "D:\\A folder with spaces\\mcp.mjs"];
    const result = codexCommand(args, environment);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), args);
  } finally { await f.clean(); }
});
