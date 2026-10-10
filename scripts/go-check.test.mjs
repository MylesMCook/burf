import assert from "node:assert/strict";
import test from "node:test";
import { checksFor, testFilterFor } from "./go-check.mjs";

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
test("chat-only box edits include routes, tools, reports, containment and upgrade guards", () => {
  const filter = testFilterFor(".", "./internal/box", ["internal/box/chat.go", "internal/box/chatpresent_test.go"]);
  const selected = new RegExp(filter);
  for (const name of ["TestPresentationSocketOwnershipStrictInputAndOneUseReply", "TestChatStartingProcessPreventsUpgradeRace", "TestChatRoutesRejectUnpairedClients", "TestManyLongReportsGoAsSeveralMessagesAndNoneIsLost", "TestSwappingAFolderForALinkWhileTheWatchReadsNeverReadsOutside", "TestBrowserAnswersPassTheSendGate"]) {
    assert.match(name, selected);
  }
  assert.doesNotMatch("TestGitHubLooksPickUpWhereTheLastOneRanOutOfCalls", selected);
});
test("other box changes and other packages retain their full package checks", () => {
  assert.equal(testFilterFor(".", "./internal/box", ["internal/box/chat.go", "internal/box/locations.go"]), undefined);
  assert.equal(testFilterFor(".", "./internal/box", ["internal/box/flowtriggers_test.go"]), undefined);
  assert.equal(testFilterFor(".", "./internal/localchat", ["internal/localchat/manager.go"]), undefined);
});
