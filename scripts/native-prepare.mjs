import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function appVersion(root, requested = "dev") {
  const version = requested === "dev" ? JSON.parse(await readFile(join(root, "app/package.json"), "utf8")).version : requested.replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Version must be dev or vX.Y.Z.");
  return version;
}

async function regularTree(directory) {
  if (!(await lstat(directory)).isDirectory()) throw new Error(`Assets must be a real directory: ${directory}`);
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const stat = await lstat(path);
    if (stat.isDirectory()) await regularTree(path);
    else if (!stat.isFile()) throw new Error(`Assets cannot contain links or special files: ${path}`);
  }
}

export async function prepareNative(root, mode) {
  const native = join(root, "app/native");
  await mkdir(native, { recursive: true });
  await mkdir(join(native, "desktop"), { recursive: true });
  // The native embed and installer acceptance use the same reviewed command.
  await cp(join(root, "scripts/windows/cli-path.ps1"), join(native, "desktop/cli-path.ps1"));
  const shortcuts = await readFile(join(root, "app/src/lib/shortcuts.json"));
  JSON.parse(shortcuts);
  await writeFile(join(native, "shortcuts.json"), shortcuts);
  const assets = join(native, "assets");
  try {
    if (!(await lstat(assets)).isDirectory()) throw new Error("The generated native assets path must be a real directory.");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (mode === "bindings") {
    await mkdir(assets, { recursive: true });
    // go:embed must resolve while generating bindings before the first bundle.
    try { await lstat(join(assets, "index.html")); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      await cp(join(root, "app/index.html"), join(assets, "index.html"));
    }
    return;
  }
  if (mode !== "assets") throw new Error("Mode must be bindings or assets.");
  const source = join(root, "app/dist");
  await regularTree(source);
  if (!(await lstat(join(source, "index.html"))).isFile()) throw new Error("Build the frontend before staging native assets.");
  const temporary = await mkdtemp(join(native, ".assets-"));
  const fresh = join(temporary, "fresh");
  const previous = join(temporary, "previous");
  let moved = false;
  try {
    await cp(source, fresh, { recursive: true });
    try { await rename(assets, previous); moved = true; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    try { await rename(fresh, assets); }
    catch (error) { if (moved) await rename(previous, assets); throw error; }
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

export async function prepareWindows(root, requested) {
  const version = await appVersion(root, requested);
  const directory = join(root, "bin/native");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "windows-info.json"), JSON.stringify({
    fixed: { file_version: version, product_version: version },
    info: { "0000": { ProductVersion: version, FileVersion: version, CompanyName: "Myles Cook", FileDescription: "Burf", ProductName: "Burf", OriginalFilename: "Burf.exe" } },
  }, null, 2) + "\n");
  const manifest = await readFile(join(root, "scripts/windows/app.manifest"), "utf8");
  await writeFile(join(directory, "windows.manifest"), manifest.replaceAll("@VERSION@", version + ".0"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  if (process.argv[2] === "version") console.log(await appVersion(root, process.argv[3]));
  else if (process.argv[2] === "windows") await prepareWindows(root, process.argv[3]);
  else await prepareNative(root, process.argv[2]);
}
