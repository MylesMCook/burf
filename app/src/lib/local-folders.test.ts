import assert from "node:assert/strict";
import test from "node:test";
import { folderName, localFolders } from "./local-folders.ts";

test("recent folders combine history and live sessions, once each, newest first", () => {
  const history = (cwd: string, updated_at: string) => ({ id: cwd, source: "codex", title: "Saved", cwd, updated_at, read_only: true as const });
  const session = (cwd: string, started_at: string, state: "running" | "exited") => ({ id: cwd, agent: "codex" as const, cwd, started_at, state });
  assert.deepEqual(localFolders([
    history("C:\\old", "2026-01-01"),
    history("C:\\shared", "2026-01-03"),
    history("C:\\old", "2026-01-02"),
    history("", "2026-01-06"),
  ], [
    session("C:\\shared", "2026-01-04", "running"),
    session("C:\\live", "2026-01-05", "running"),
    session("C:\\exited", "2026-01-06", "exited"),
  ]), ["C:\\live", "C:\\shared", "C:\\old"]);
  assert.deepEqual(localFolders([], []), []);
});

test("folder labels use the last segment on Windows and Unix, keeping roots readable", () => {
  assert.equal(folderName("C:\\Projects\\shop\\"), "shop");
  assert.equal(folderName("/home/me/shop/"), "shop");
  assert.equal(folderName("/"), "/");
  assert.equal(folderName("C:\\"), "C:");
});
