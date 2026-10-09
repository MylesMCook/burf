import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// The manifest describes the original bytes, before Tauri adds its CSP hashes.
// It guards copying damage, not an attacker who can write this person's files.
export async function makeManifest(dist, commit) {
  const shell = (await readFile(join(root, "internal/uicontract/shell.txt"), "utf8")).trim();
  const { version } = JSON.parse(await readFile(join(root, "app/package.json"), "utf8"));
  if (!commit) commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const files = {};
  async function walk(dir, prefix = "") {
    for (const name of (await readdir(dir)).sort()) {
      const path = prefix + name;
      if (/[\\:]/.test(name)) throw new Error(`Unsupported asset path: ${path}`);
      const entry = join(dir, name);
      const stat = await lstat(entry);
      if (path === "manifest.json" && stat.isFile()) continue;
      if (stat.isDirectory()) await walk(entry, path + "/");
      else if (stat.isFile()) files[path] = createHash("sha256").update(await readFile(entry)).digest("hex");
      else throw new Error(`Asset is not a regular file: ${path}`);
    }
  }
  if (!(await lstat(dist)).isDirectory()) throw new Error("Expected a built dist folder");
  await walk(dist);
  if (!files["index.html"]) throw new Error("Missing index.html");
  const manifest = { shell, version: `${version}+${commit}`, files };
  await writeFile(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await makeManifest(resolve(process.argv[2] ?? join(root, "app/dist")));
}
