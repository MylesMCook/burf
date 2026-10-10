import assert from "node:assert/strict";
import { test } from "node:test";
import { desktopKind, invoke, listen } from "./desktop.ts";

test("a runtime-created Wails object does not turn a browser into the desktop", () => {
  const scope: { top?: unknown; _wails: object } = { _wails: {} };
  scope.top = scope;
  assert.equal(desktopKind(scope), "browser");
});

test("only the trusted top-level Wails page uses the native adapter", () => {
  const scope: { top?: unknown; __BURF_WAILS__: unknown } = { __BURF_WAILS__: true };
  scope.top = scope;
  assert.equal(desktopKind(scope), "wails");
  scope.top = {};
  assert.equal(desktopKind(scope), "browser");
  scope.top = scope;
  scope.__BURF_WAILS__ = "true";
  assert.equal(desktopKind(scope), "browser");
});

test("legacy top-level windows retain their transition adapter", () => {
  const scope: { top?: unknown; __TAURI_INTERNALS__: object } = { __TAURI_INTERNALS__: {} };
  scope.top = scope;
  assert.equal(desktopKind(scope), "tauri");
  scope.top = {};
  assert.equal(desktopKind(scope), "browser");
});

test("a plain browser cannot call desktop commands or receive native events", async () => {
  await assert.rejects(invoke("ui_endpoint"), /only available in the Burf app/);
  let heard = false;
  const stop = await listen("berth://menu", () => { heard = true; });
  stop();
  assert.equal(heard, false);
});
