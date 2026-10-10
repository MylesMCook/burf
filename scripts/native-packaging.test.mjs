import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { appVersion, prepareNative, prepareWindows } from "./native-prepare.mjs";
import { loaderFiles, LOADER_SHA256 } from "./webview2-loader.mjs";
import { createHash } from "node:crypto";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "burf-native-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "app/src/lib"), { recursive: true });
  await mkdir(join(root, "app/dist"), { recursive: true });
  await mkdir(join(root, "scripts/windows"), { recursive: true });
  await writeFile(join(root, "app/package.json"), '{"version":"0.3.12"}');
  await writeFile(join(root, "app/index.html"), "binding placeholder");
  await writeFile(join(root, "app/src/lib/shortcuts.json"), '{"shortcuts":["canonical"]}');
  await writeFile(join(root, "app/dist/index.html"), "built interface");
  await writeFile(join(root, "scripts/windows/app.manifest"), '<assembly name="dev.myles.berth.windows" version="@VERSION@"><requestedExecutionLevel level="asInvoker"/></assembly>');
  await writeFile(join(root, "scripts/windows/cli-path.ps1"), "reviewed PATH command");
  return root;
}

test("bindings bootstrap the first build and assets stage an exact fresh snapshot", async (t) => {
  const root = await fixture(t);
  await prepareNative(root, "bindings");
  assert.equal(await readFile(join(root, "app/native/assets/index.html"), "utf8"), "binding placeholder");
  assert.deepEqual(await readFile(join(root, "app/native/shortcuts.json")), await readFile(join(root, "app/src/lib/shortcuts.json")));
  assert.equal(await readFile(join(root, "app/native/desktop/cli-path.ps1"), "utf8"), "reviewed PATH command");
  await writeFile(join(root, "app/native/assets/obsolete.js"), "old");
  await prepareNative(root, "assets");
  assert.equal(await readFile(join(root, "app/native/assets/index.html"), "utf8"), "built interface");
  await assert.rejects(readFile(join(root, "app/native/assets/obsolete.js")), { code: "ENOENT" });
  await writeFile(join(root, "app/dist/index.html"), "next build");
  assert.equal(await readFile(join(root, "app/native/assets/index.html"), "utf8"), "built interface");
});

test("linked input or output assets are refused before replacing the previous bundle", async (t) => {
  const root = await fixture(t);
  await prepareNative(root, "assets");
  await symlink(join(root, "app/package.json"), join(root, "app/dist/linked.json"));
  await assert.rejects(prepareNative(root, "assets"), /links or special files/);
  assert.equal(await readFile(join(root, "app/native/assets/index.html"), "utf8"), "built interface");
  await rm(join(root, "app/native/assets"), { recursive: true });
  await symlink(join(root, "app/dist"), join(root, "app/native/assets"), "dir");
  await assert.rejects(prepareNative(root, "assets"), /real directory/);
});

test("versions and Windows metadata retain the installed identity and ordinary token", async (t) => {
  const root = await fixture(t);
  assert.equal(await appVersion(root, "dev"), "0.3.12");
  assert.equal(await appVersion(root, "v1.2.3"), "1.2.3");
  await assert.rejects(appVersion(root, "1.2.3; bad"));
  await prepareWindows(root, "v1.2.3");
  const info = JSON.parse(await readFile(join(root, "bin/native/windows-info.json")));
  assert.equal(info.fixed.file_version, "1.2.3");
  const manifest = await readFile(join(root, "bin/native/windows.manifest"), "utf8");
  assert.ok(manifest.includes('name="dev.myles.berth.windows"'));
  assert.ok(manifest.includes('level="asInvoker"'));
  assert.ok(manifest.includes('version="1.2.3.0"'));
});

test("unverified WebView2 packages and unsupported architectures are refused", () => {
  assert.throws(() => loaderFiles(Buffer.from("unverified download"), "amd64"), /digest mismatch/);
  assert.throws(() => loaderFiles(Buffer.alloc(0), "ia32"), /amd64 or arm64/);
});

test("the pinned SDK supplies exact architecture loaders and redistribution notices", { skip: !process.env.WEBVIEW2_SDK_PACKAGE }, async () => {
  const archive = await readFile(process.env.WEBVIEW2_SDK_PACKAGE);
  for (const arch of ["amd64", "arm64"]) {
    const files = loaderFiles(archive, arch);
    assert.equal(createHash("sha256").update(files["WebView2Loader.dll"]).digest("hex"), LOADER_SHA256[arch]);
    assert.ok(files["WebView2-LICENSE.txt"].length > 0);
    assert.ok(files["WebView2-NOTICE.txt"].length > 0);
  }
});
