import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { chmod, lstat, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { windowsProcess } from "./windows-process.mjs";
import { prepareCompanion } from "./prepare-companion.mjs";

export function feedbackEnvironment(inherited, extra = {}) {
  const clean = { ...inherited };
  for (const key of Object.keys(clean)) {
    if (/^AGENTATION_/i.test(key) || /^WAILS_MCP_/i.test(key) || /^WAILS_FEEDBACK/i.test(key) || key === "FRONTEND_DEVSERVER_URL" || key === "BERTH_E2E_LIVE" || key === "BURF_DEV_HOST") delete clean[key];
  }
  if (clean.GOFLAGS && /(?:^|\s)-tags(?:[=\s]|$)/.test(clean.GOFLAGS)) throw new Error("Unset GOFLAGS build tags before running native feedback.");
  return { ...clean, ...extra };
}

export function frontendCommand(manager, script, port, platform = process.platform) {
  if (!["pnpm", "npm", "yarn", "bun"].includes(manager) || !/^[a-zA-Z0-9:_-]+$/.test(script)) throw new Error("Unsupported package manager or development script.");
  if (!Number.isInteger(port) || port < 1421 || port > 1439) throw new Error("Feedback Vite port must be from 1421 through 1439.");
  // Vite versions its dependency URLs from the lockfile and configuration.
  // Preserve that cache instead of rebuilding it on every native launch.
  const tail = ["--mode", "feedback", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  const args = manager === "npm" ? ["run", script, "--", ...tail] : ["run", script, ...tail];
  if (platform !== "win32") return { command: manager, args };
  // cmd.exe is needed for installed .cmd launchers. All arguments above are
  // validated identifiers or constants; no user-supplied shell program runs.
  return { command: process.env.ComSpec ?? "cmd.exe", args: ["/d", "/s", "/c", `${manager}.cmd ${args.join(" ")}`] };
}

async function freePort(requested = 0) {
  const server = createServer();
  await new Promise((yes, no) => { server.once("error", no); server.listen(requested, "127.0.0.1", yes); });
  const port = server.address().port;
  await new Promise((yes, no) => server.close(error => error ? no(error) : yes()));
  return port;
}

async function vitePort(requested) {
  if (requested !== undefined) {
    frontendCommand("pnpm", "dev", requested);
    return freePort(requested);
  }
  for (let port = 1421; port <= 1439; port++) {
    try { return await freePort(port); } catch (error) { if (error.code !== "EADDRINUSE") throw error; }
  }
  throw new Error("No free feedback Vite port from 1421 through 1439.");
}

async function privateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || await realpath(directory) !== resolve(directory)) throw new Error("Feedback state must be a real directory without symlink ancestors.");
  if (process.platform !== "win32") {
    if (metadata.uid !== process.getuid()) throw new Error("Feedback state must belong to the current user.");
    await chmod(directory, 0o700);
  } else {
    // Windows modes do not restrict ACLs. This task-local directory inherits
    // only current-user and SYSTEM access; no machine configuration changes.
    const script = '$ErrorActionPreference="Stop"; $p=$env:WAILS_FEEDBACK_PRIVATE_PATH; $s=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $a=New-Object System.Security.AccessControl.DirectorySecurity; $a.SetOwner($s); $a.SetAccessRuleProtection($true,$false); $a.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($s,"FullControl","ContainerInherit,ObjectInherit","None","Allow"))); $a.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(([System.Security.Principal.SecurityIdentifier]"S-1-5-18"),"FullControl","ContainerInherit,ObjectInherit","None","Allow"))); (Get-Item -LiteralPath $p).SetAccessControl($a); $v=Get-Acl -LiteralPath $p; if (!$v.AreAccessRulesProtected -or $v.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $s.Value) {throw "Private ACL verification failed"}; foreach($r in $v.Access){$id=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; if($id -ne $s.Value -and $id -ne "S-1-5-18"){throw "Unexpected private directory access rule"}}';
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { env: { ...process.env, WAILS_FEEDBACK_PRIVATE_PATH: directory }, stdio: "ignore", windowsHide: true });
    const [code] = await once(child, "exit");
    if (code !== 0) throw new Error("Unable to restrict the private feedback directory ACL.");
  }
}

export async function stopOwnedProcess(child) {
  if (!child.pid) return;
  const finished = child.exitCode !== null || child.signalCode !== null;
  if (finished && (process.platform === "win32" || !child.feedbackTree)) return;
  const exited = finished ? Promise.resolve() : once(child, "exit").catch(() => {});
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    await once(killer, "exit").catch(() => {});
  } else {
    try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
    // A leader's exit does not establish that its descendants have stopped.
    // Wait on the owned process group, then escalate independently of the leader.
    const deadline = Date.now() + 2000;
    while (true) {
      try { process.kill(-child.pid, 0); }
      catch (error) { if (error.code === "ESRCH") break; throw error; }
      if (Date.now() >= deadline) {
        try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
        break;
      }
      await new Promise(yes => setTimeout(yes, 25));
    }
    await exited;
  }
}

function alive(child) { return child && child.exitCode === null && child.signalCode === null; }

async function waitHTTP(url, child, stopped, milliseconds = 15000, requestMilliseconds = 500) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    if (stopped() || !alive(child)) throw new Error("An owned feedback process stopped during startup.");
    try { const response = await fetch(url, { signal: AbortSignal.timeout(requestMilliseconds) }); await response.arrayBuffer(); if (response.ok) return; } catch {}
    await new Promise(yes => setTimeout(yes, 100));
  }
  throw new Error("An owned feedback process did not become ready.");
}

export async function runFeedback(planFile, inspect = false) {
  if (!["darwin", "win32"].includes(process.platform)) throw new Error("Native feedback currently supports macOS and Windows desktop runners.");
  const target = process.platform === "win32" ? "windows" : "darwin";
  if (process.env.GOOS && process.env.GOOS !== target) throw new Error("Unset cross-target GOOS before launching native feedback.");
  const plan = JSON.parse(await readFile(planFile, "utf8"));
  const root = resolve(dirname(planFile), plan.root);
  const frontend = resolve(root, plan.frontend);
  const native = resolve(root, plan.native);
  const state = resolve(dirname(planFile), "state");
  const clean = feedbackEnvironment(process.env);
  await privateDirectory(state);
  const profileIDFile = join(state, "profile-id");
  try { await writeFile(profileIDFile, randomBytes(16).toString("hex"), { mode: 0o600, flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  if (!(await lstat(profileIDFile)).isFile()) throw new Error("The feedback profile identifier must be a regular file.");
  const profileID = await readFile(profileIDFile, "utf8");
  if (!/^[0-9a-f]{32}$/.test(profileID)) throw new Error("Invalid private feedback profile identifier.");
  const lock = join(state, "run.lock");
  try { await mkdir(lock, { mode: 0o700 }); }
  catch (error) { if (error.code === "EEXIST") throw new Error("A feedback run or stale lock exists. Check its owner before removing state/run.lock."); throw error; }
  const runID = randomBytes(16).toString("hex");
  await writeFile(join(lock, "owner.json"), JSON.stringify({ pid: process.pid, runID }), { mode: 0o600 });
  const children = [];
  let stopping = false;
  let cleanupPromise;
  const cleanup = () => {
    stopping = true;
    return cleanupPromise ??= (async () => {
      await Promise.allSettled(children.map(stopOwnedProcess));
      await rm(join(state, "session.json"), { force: true });
      await rm(lock, { recursive: true, force: true });
    })();
  };
  const onSignal = () => { void cleanup(); };
  process.once("SIGINT", onSignal); process.once("SIGTERM", onSignal);
  const launch = (command, args, options) => {
    if (stopping) throw new Error("Feedback startup was cancelled.");
    const windows = process.platform === "win32" ? windowsProcess(command, args, options.cwd, options.env) : null;
    const child = spawn(windows?.command ?? command, windows?.args ?? args, { ...options, ...(windows ? { env: windows.env } : {}), detached: process.platform !== "win32", windowsHide: true });
    child.feedbackTree = options.feedbackTree === true;
    children.push(child);
    // Register immediately: signals and failed spawns must never leak children.
    child.on("error", () => { void cleanup(); });
    return child;
  };
  try {
    const port = await vitePort(process.env.WAILS_FEEDBACK_VITE_PORT ? Number(process.env.WAILS_FEEDBACK_VITE_PORT) : undefined);
    const companionPort = await freePort();
    const companionCLI = await prepareCompanion(frontend, state);
    const agentation = join(state, "agentation");
    const profile = join(state, "app-profile");
    await privateDirectory(agentation); await privateDirectory(profile);
    const companion = launch(process.execPath, [companionCLI, "server", "--host", "127.0.0.1", "--port", String(companionPort)], {
      feedbackTree: true, cwd: frontend, env: feedbackEnvironment(clean, { AGENTATION_STORE: "sqlite", AGENTATION_DATA_DIR: agentation, AGENTATION_CORS_ORIGINS: "" }), stdio: ["ignore", "pipe", "pipe"],
    });
    let listening = false;
    let output = "";
    const inspectOutput = bytes => {
      output = (output + bytes.toString()).slice(-8192);
      if (output.includes("EADDRINUSE") || output.includes("already in use")) void cleanup();
      // Upstream renders loopback hosts as "localhost", even when bound to 127.0.0.1.
      if (output.includes(`[HTTP] Agentation server listening on http://localhost:${companionPort}`)) listening = true;
    };
    companion.stdout.on("data", inspectOutput); companion.stderr.on("data", inspectOutput);
    companion.once("exit", () => { void cleanup(); });
    const deadline = Date.now() + 15000;
    while (!listening && Date.now() < deadline && alive(companion) && !stopping) await new Promise(yes => setTimeout(yes, 50));
    if (!listening || stopping || !alive(companion)) throw new Error("The owned feedback companion could not bind its private port.");
    await waitHTTP(`http://127.0.0.1:${companionPort}/health`, companion, () => stopping);
    const cmd = frontendCommand(plan.packageManager, plan.devScript, port);
    const frontendProcess = launch(cmd.command, cmd.args, { feedbackTree: true, cwd: frontend, env: feedbackEnvironment(clean, { WAILS_FEEDBACK: "1" }), stdio: "inherit" });
    frontendProcess.once("exit", () => { void cleanup(); });
    console.log("Preparing the development app...");
    if (plan.nativePrepare) {
      const prepare = launch(process.execPath, [resolve(root, plan.nativePrepare), "bindings"], { cwd: root, env: clean, stdio: "inherit" });
      const [prepareCode] = await once(prepare, "exit");
      if (prepareCode !== 0) throw new Error("The existing native preparation workflow failed.");
    }
    let binary = join(state, "feedback-app.exe");
    if (process.platform === "darwin") {
      const contents = join(state, "Native Feedback.app", "Contents");
      await mkdir(join(contents, "MacOS"), { recursive: true, mode: 0o700 });
      binary = join(contents, "MacOS", "feedback-app");
      await writeFile(join(contents, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>dev.myles.wails-feedback.${profileID}</string><key>CFBundleName</key><string>Native Feedback</string><key>CFBundleExecutable</key><string>feedback-app</string><key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>`, { mode: 0o600 });
    }
    const build = launch("go", ["build", "-tags", inspect ? "dev,wailsfeedback,mcp" : "dev,wailsfeedback", "-o", binary, "."], { cwd: native, env: clean, stdio: "inherit" });
    const buildFinished = once(build, "exit").then(([code]) => {
      if (code !== 0) { void cleanup(); throw new Error("The feedback development app did not compile."); }
    });
    // Observe early failures while waiting for the frontend, then await below.
    void buildFinished.catch(() => {});
    // Frontend preparation and Go compilation overlap; neither can be skipped.
    await waitHTTP(`http://127.0.0.1:${port}`, frontendProcess, () => stopping, 60000, 5000);
    await waitHTTP(`http://127.0.0.1:${port}/__wails-feedback-ready`, frontendProcess, () => stopping, 60000, 5000);
    await buildFinished;
    if (process.platform === "win32") {
      if (!plan.windowsLoader) throw new Error("The Windows feedback runner requires the existing signed WebView2 loader workflow.");
      const architecture = process.arch === "arm64" ? "arm64" : "amd64";
      const loader = launch(process.execPath, [resolve(root, plan.windowsLoader), architecture, state], { cwd: root, env: clean, stdio: "inherit" });
      if ((await once(loader, "exit"))[0] !== 0) throw new Error("Unable to stage the existing WebView2 loader.");
      const script = '$ErrorActionPreference="Stop"; $s=Get-AuthenticodeSignature -LiteralPath $env:WAILS_FEEDBACK_LOADER; if($s.Status -ne "Valid" -or !$s.SignerCertificate -or $s.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -ne "Microsoft Corporation"){throw "WebView2 loader Microsoft signature validation failed"}';
      const verify = launch("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { cwd: state, env: { ...clean, WAILS_FEEDBACK_LOADER: join(state, "WebView2Loader.dll") }, stdio: "ignore" });
      if ((await once(verify, "exit"))[0] !== 0) throw new Error("WebView2 loader Microsoft signature validation failed.");
    }
    const env = feedbackEnvironment(clean, {
      WAILS_FEEDBACK: "1", WAILS_FEEDBACK_RUN_ID: runID,
      WAILS_FEEDBACK_COMPANION_URL: `http://127.0.0.1:${companionPort}`,
      FRONTEND_DEVSERVER_URL: `http://127.0.0.1:${port}`,
      BERTH_UI_BUILTIN: "1", BERTH_HOME: profile,
    });
    let inspectorPort;
    if (inspect) {
      inspectorPort = await freePort();
      const token = randomBytes(32).toString("hex");
      await writeFile(join(state, "mcp-token"), token, { mode: 0o600 });
      Object.assign(env, { WAILS_MCP_HOST: "127.0.0.1", WAILS_MCP_PORT: String(inspectorPort), WAILS_MCP_TOKEN: token });
    }
    if (!alive(companion) || !alive(frontendProcess)) throw new Error("A feedback dependency stopped before app launch.");
    await writeFile(join(state, "session.json"), JSON.stringify({ runID, pid: process.pid, companionURL: env.WAILS_FEEDBACK_COMPANION_URL, frontendURL: env.FRONTEND_DEVSERVER_URL, ...(inspect ? { inspectorURL: `http://127.0.0.1:${inspectorPort}/mcp`, tokenFile: "mcp-token" } : {}) }), { mode: 0o600 });
    const app = launch(binary, [], { feedbackTree: true, cwd: native, env, stdio: "inherit" });
    const appExited = once(app, "exit");
    app.once("exit", () => { void cleanup(); });
    console.log("Native feedback is running with an isolated app profile. Close its window or press Ctrl-C to stop this run.");
    await appExited;
  } finally {
    await cleanup();
    await rm(join(state, "session.json"), { force: true });
    process.off("SIGINT", onSignal); process.off("SIGTERM", onSignal);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runFeedback(resolve(process.argv.find((arg, index) => index > 1 && arg !== "--inspect") ?? join(dirname(fileURLToPath(import.meta.url)), "plan.json")), process.argv.includes("--inspect")); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
