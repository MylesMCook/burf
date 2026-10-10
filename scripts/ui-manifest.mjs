import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

// The manifest describes the original bytes, before the native shell adds CSP hashes.
// It guards copying damage, not an attacker who can write this person's files.
async function manifestFor(dist, commit) {
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
  return manifest;
}

export async function makeManifest(dist, commit) {
  const manifest = await manifestFor(dist, commit);
  await writeFile(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

// A downloaded artifact must be the expected commit and intact. Comparing it
// never rewrites its manifest, so stale or changed bytes fail the check.
export async function verifyManifest(dist, commit) {
  if (commit && !/^[a-f0-9]{12,40}$/.test(commit)) throw new Error("Expected a Git commit hash.");
  const expected = await manifestFor(dist, commit?.slice(0, 12));
  const actual = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
  assert.deepEqual(actual, expected, "UI artifact must match this commit, shell and every file hash.");
  return actual;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--verify") {
    await verifyManifest(resolve(process.argv[3] ?? join(root, "app/dist")), process.argv[4]);
    console.log("UI artifact matches this commit, shell and every file hash.");
  } else await makeManifest(resolve(process.argv[2] ?? join(root, "app/dist")));
}
