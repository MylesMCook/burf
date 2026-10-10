import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { wailsVersion } from "./wails-cli.mjs";

test("the pinned CLI may report its version on stderr", { skip: process.platform === "win32" }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "burf-wails-cli-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = join(directory, "wails3");
  await writeFile(executable, `#!/bin/sh\nprintf '%s\\n' '${wailsVersion()}' >&2\n`, { mode: 0o755 });
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./wails-cli.mjs", import.meta.url)), "version"], { encoding: "utf8", env: { ...process.env, WAILS3: executable } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, new RegExp(wailsVersion().replaceAll(".", "\\.")));
});
