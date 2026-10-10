import assert from "node:assert/strict";
import test from "node:test";
import { checksFor } from "./go-check.mjs";

const exists = (path) => !path.endsWith("removed");
test("changed packages stay in their owning Go module", () => {
  assert.deepEqual(checksFor(["internal/agent/restart.go", "app/native/desktop/service.go"], exists), [
    { directory: ".", packages: ["./internal/agent"] },
    { directory: "app/native", packages: ["./desktop"] },
  ]);
});
test("native-only changes never ask the root module for app/native", () => {
  assert.deepEqual(checksFor(["app/native/nativebrowser/manager.go"], exists), [
    { directory: "app/native", packages: ["./nativebrowser"] },
  ]);
});
test("deleted packages are skipped and duplicate files run the package once", () => {
  assert.deepEqual(checksFor(["internal/removed/x.go", "internal/agent/a.go", "internal/agent/a_test.go"], exists), [
    { directory: ".", packages: ["./internal/agent"] },
  ]);
});
test("manifest changes use quick module smoke checks rather than the local full suite", () => {
  assert.deepEqual(checksFor(["go.sum", "app/native/go.mod"], exists), [
    { directory: ".", packages: ["./cmd/burf", "./internal/uibundle", "./internal/uicontract"] },
    { directory: "app/native", packages: ["./desktop", "./nativebrowser"] },
  ]);
});
test("non-Go paths do not select Go tests", () => {
  assert.deepEqual(checksFor(["app/src/App.tsx", "README.md"], exists), []);
});
