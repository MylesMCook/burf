import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const launcher = join(dirname(fileURLToPath(import.meta.url)), "mcp.mjs");

export function codexCommand(args, environment = process.env) {
  const options = { encoding: "utf8", windowsHide: true, timeout: 20000 };
  const result = process.platform === "win32"
    ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", '$arguments=ConvertFrom-Json $env:WAILS_FEEDBACK_CODEX_ARGS; & codex @arguments; exit $LASTEXITCODE'], { ...options, env: { ...environment, WAILS_FEEDBACK_CODEX_ARGS: JSON.stringify(args) } })
    : spawnSync("codex", args, { ...options, env: environment });
  if (result.error) throw new Error("Codex CLI is unavailable. Install or restore your usual Codex CLI, then rerun feedback:connect.", { cause: result.error });
  return result;
}

export async function connectCodex({ remove = false, invoke = codexCommand, planFile = join(dirname(launcher), "plan.json") } = {}) {
  const plan = JSON.parse(await readFile(planFile, "utf8"));
  const appName = typeof plan.appName === "string" ? plan.appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
  if (!appName) throw new Error("Invalid feedback app name.");
  const name = `${appName}-feedback`;
  const start = plan.packageManager === "pnpm" ? `pnpm --dir ${plan.frontend} dev:feedback` : `${plan.packageManager} run dev:feedback from ${plan.frontend}`;
  const existing = invoke(["mcp", "get", name, "--json"]);
  const missing = existing.status !== 0 && /No MCP server named/.test(existing.stderr);
  if (existing.status !== 0 && !missing) throw new Error("Unable to inspect the Codex feedback configuration. No configuration changed.");
  if (!missing) {
    const configuration = JSON.parse(existing.stdout);
    const transport = configuration.transport;
    if (transport?.type !== "stdio" || resolve(transport.command) !== resolve(process.execPath) || transport.args?.length !== 1 || resolve(transport.args[0]) !== resolve(launcher)) throw new Error(`A different ${name} connection already exists. No configuration changed.`);
    if (!remove && configuration.enabled === false) throw new Error(`Codex feedback is configured but disabled. Enable ${name} in Codex MCP settings, then start feedback with ${start}.`);
    if (!remove) return `Codex feedback is already connected. Start feedback with ${start}.`;
  } else if (remove) return "Codex feedback is already disconnected.";
  const result = invoke(remove ? ["mcp", "remove", name] : ["mcp", "add", name, "--", process.execPath, launcher]);
  if (result.status !== 0) throw new Error("Codex could not update the feedback connection.");
  return remove ? "Codex feedback disconnected. Private comments are preserved." : `Codex feedback connected. Start a new Codex task once, then use ${start} for each development run.`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== "--remove")) throw new Error("Use feedback:connect or feedback:disconnect.");
    console.log(await connectCodex({ remove: process.argv.includes("--remove") }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
