// Keep the build CLI beside the project's other generated tools, never global.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function wailsVersion() {
  const module = readFileSync(join(root, "app/native/go.mod"), "utf8");
  const version = /github\.com\/wailsapp\/wails\/v3\s+(v\S+)/.exec(module)?.[1];
  const runtime = JSON.parse(readFileSync(join(root, "app/package.json"), "utf8")).dependencies["@wailsio/runtime"];
  if (!version || runtime !== version.slice(1)) throw new Error("Wails Go module and frontend runtime must have the same exact version.");
  return version;
}

export function wails(args) {
  const version = wailsVersion();
  const tools = join(root, "bin/tools");
  const executable = process.env.WAILS3 || join(tools, process.platform === "win32" ? "wails3.exe" : "wails3");
  if (!isAbsolute(executable)) throw new Error("WAILS3 must name an absolute, version-matched CLI path.");
  const env = { ...process.env, GOCACHE: process.env.GOCACHE || join(root, "bin/go-cache") };
  if (!existsSync(executable)) {
    if (process.env.WAILS3) throw new Error(`WAILS3 does not exist: ${executable}`);
    mkdirSync(tools, { recursive: true });
    const host = { ...env, GOBIN: tools };
    delete host.GOOS;
    delete host.GOARCH;
    delete host.CGO_ENABLED;
    execFileSync(process.env.GO || "go", ["install", `github.com/wailsapp/wails/v3/cmd/wails3@${version}`], { cwd: root, env: host, stdio: "inherit" });
  }
  const reported = spawnSync(executable, ["version"], { encoding: "utf8", env, timeout: 10000 });
  if (reported.error || reported.status !== 0) throw new Error("The Wails CLI version check failed.", { cause: reported.error });
  const actual = (reported.stdout + reported.stderr).trim();
  if (actual !== version) throw new Error(`Wails CLI ${actual} does not match the pinned module ${version}.`);
  execFileSync(executable, args, { cwd: join(root, "app/native"), env, stdio: "inherit" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) wails(process.argv.slice(2));
