import assert from "node:assert/strict";
import test from "node:test";
import { emptyLocalChatDraft, localChatDraftKey } from "./local-chat-draft.ts";
import { localHistoryDraftScope, matchingLocalHistoryChats, transferLocalHistoryDraft } from "./local-history-draft.ts";

const history = { id: "history-1", source: "codex", cwd: "/w/project" };
const session = { id: "chat-1", agent: "codex" as const, cwd: history.cwd, history_id: history.id, mode: "chat" as const, state: "idle" as const, started_at: "2026-10-10T17:00:00Z" };

test("saved-history drafts keep source identity and remain separate from sessions", () => {
  const scope = localHistoryDraftScope("owner", history);
  for (const field of ["id", "source", "cwd"] as const) assert.notEqual(localChatDraftKey(scope), localChatDraftKey(localHistoryDraftScope("owner", { ...history, [field]: "other" })));
  assert.notEqual(localChatDraftKey(scope), localChatDraftKey(localHistoryDraftScope("other-account", history)));
  assert.notEqual(localChatDraftKey(scope), localChatDraftKey({ ...session, account: "owner" }));
});

test("recovery finds only independent active chats for this source, provider and folder", () => {
  assert.deepEqual(matchingLocalHistoryChats(history, [session, { ...session, id: "wrong-source", history_id: "different" }, { ...session, id: "wrong-provider", agent: "claude" }, { ...session, id: "wrong-folder", cwd: "/other" }, { ...session, id: "terminal", mode: undefined }, { ...session, id: "stopped", state: "exited" }]), [session]);
  assert.equal(matchingLocalHistoryChats(history, [session, { ...session, id: "second" }]).length, 2);
});

test("first-send transfer preserves following drafts and journals the one explicit message", () => {
  const source = { ...emptyLocalChatDraft(), text: "Following source draft", launch: "send-1", pending: { id: "send-1", text: "First message", options: {} } };
  const target = { ...emptyLocalChatDraft(), text: "Existing session draft", queue: [{ text: "Held queue", options: {} }] };
  const moved = transferLocalHistoryDraft(source, target, true);
  assert.equal(moved.send, true);
  assert.deepEqual(moved.source, { ...emptyLocalChatDraft(), launch: "send-1" });
  assert.deepEqual(moved.target.pending, source.pending);
  assert.equal(moved.target.text, "Existing session draft\n\nFollowing source draft");
  assert.deepEqual(moved.target.queue, target.queue);
  assert.equal(moved.target.launch, undefined);
  assert.equal(moved.target.held, true);
});

test("recovering a lost launch response holds text without a send or a launch marker", () => {
  const moved = transferLocalHistoryDraft({ ...emptyLocalChatDraft(), text: "Following", launch: "send-1", pending: { id: "send-1", text: "Unsent", options: { model: "alpha" } } }, emptyLocalChatDraft(), false);
  assert.equal(moved.send, false);
  assert.equal(moved.target.text, "Unsent\n\nFollowing");
  assert.equal(moved.target.pending, undefined);
  assert.equal(moved.target.launch, undefined);
  assert.equal(moved.target.held, true);
});

test("an existing uncertain send is preserved and prevents automatic first-send delivery", () => {
  const existing = { id: "existing-send", text: "May have arrived", options: {} };
  const moved = transferLocalHistoryDraft({ ...emptyLocalChatDraft(), pending: { id: "send-1", text: "New explicit message", options: {} } }, { ...emptyLocalChatDraft(), pending: existing, text: "Following existing draft" }, true);
  assert.equal(moved.send, false);
  assert.deepEqual(moved.target.pending, existing);
  assert.equal(moved.target.text, "Following existing draft\n\nNew explicit message");
});

test("a crash after transfer retains recovery identity and does not duplicate the pending message", () => {
  const first = transferLocalHistoryDraft({ ...emptyLocalChatDraft(), launch: "send-1", pending: { id: "send-1", text: "Possibly sent", options: {} } }, emptyLocalChatDraft(), true);
  const recovered = transferLocalHistoryDraft(first.source, first.target, false);
  assert.equal(recovered.send, false);
  assert.equal(recovered.source.launch, undefined);
  assert.deepEqual(recovered.target.pending, first.target.pending);
  assert.equal(recovered.target.text, "");
});
