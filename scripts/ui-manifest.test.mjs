import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { makeManifest, verifyManifest } from "./ui-manifest.mjs";

test("manifest hashes every nested asset and shares the shell contract", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "burf-ui-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "index.html"), "<html>interface</html>");
  await writeFile(join(dir, "assets/app.js"), "export default 1;");
  const m = await makeManifest(dir, "abcdef123456");
  const pkg = JSON.parse(await readFile(new URL("../app/package.json", import.meta.url), "utf8"));
  assert.equal(m.version, `${pkg.version}+abcdef123456`);
  assert.equal(m.shell, (await readFile(new URL("../internal/uicontract/shell.txt", import.meta.url), "utf8")).trim());
  assert.deepEqual(Object.keys(m.files).sort(), ["assets/app.js", "index.html"]);
  assert.equal(m.files["assets/app.js"], createHash("sha256").update("export default 1;").digest("hex"));
  assert.deepEqual(JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")), m);
  assert.deepEqual(await makeManifest(dir, "abcdef123456"), m);
  await symlink(join(dir, "index.html"), join(dir, "linked.html"));
  await assert.rejects(makeManifest(dir, "abcdef123456"), /not a regular file/);
  await rm(join(dir, "linked.html"));
  await rm(join(dir, "manifest.json"));
  await symlink(join(dir, "index.html"), join(dir, "manifest.json"));
  await assert.rejects(makeManifest(dir, "abcdef123456"), /not a regular file/);
  assert.equal(await readFile(join(dir, "index.html"), "utf8"), "<html>interface</html>");
});

test("a folder without index.html is not a build", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "burf-ui-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await assert.rejects(makeManifest(dir, "abcdef"), /Missing index.html/);
});

test("downloaded UI rejects a stale commit without replacing its manifest", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "burf-ui-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "index.html"), "<html>interface</html>");
  const manifest = await makeManifest(dir, "abcdef123456");
  assert.deepEqual(await verifyManifest(dir, "abcdef123456" + "0".repeat(28)), manifest);
  await assert.rejects(verifyManifest(dir, "123456abcdef"), /must match this commit/);
  assert.deepEqual(JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")), manifest);
});

test("downloaded UI rejects changed, extra or missing bytes", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "burf-ui-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, "index.html"), "<html>interface</html>");
  await writeFile(join(dir, "app.js"), "export default 1");
  await makeManifest(dir, "abcdef123456");
  await writeFile(join(dir, "app.js"), "export default 2");
  await assert.rejects(verifyManifest(dir, "abcdef123456"), /every file hash/);
  await writeFile(join(dir, "app.js"), "export default 1");
  await writeFile(join(dir, "extra.js"), "extra");
  await assert.rejects(verifyManifest(dir, "abcdef123456"), /every file hash/);
  await rm(join(dir, "extra.js"));
  await rm(join(dir, "app.js"));
  await assert.rejects(verifyManifest(dir, "abcdef123456"), /every file hash/);
});
