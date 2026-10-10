import assert from "node:assert/strict";
import test from "node:test";
import { emptyLocalChatDraft, localChatDraftKey, readLocalChatDraft, recoveredLocalChatDraft, settleLocalChatDraft } from "./local-chat-draft.ts";

const session = { account: "owned-client", id: "chat-1", agent: "codex", cwd: "/w/project", started_at: "2026-10-10T17:00:00Z" };

test("local drafts are scoped to all authenticated session identity fields", () => {
  for (const field of ["account", "id", "agent", "cwd", "started_at"] as const) assert.notEqual(localChatDraftKey(session), localChatDraftKey({ ...session, [field]: `${session[field]}-other` }));
});

test("an unconfirmed send is recovered as held text rather than a replayable queue entry", () => {
  const recovered = recoveredLocalChatDraft({ ...emptyLocalChatDraft(), text: "New draft", queue: [{ text: "Following", options: {} }], pending: { id: "send-1", text: "May have arrived", options: { model: "alpha" } } });
  assert.equal(recovered.text, "May have arrived\n\nNew draft");
  assert.equal(recovered.held, true);
  assert.equal(recovered.pending, undefined);
  assert.deepEqual(recovered.queue, [{ text: "Following", options: {} }]);
  assert.deepEqual(recovered.options, { model: "alpha" });
  assert.deepEqual(recoveredLocalChatDraft(recovered), recovered);
});

test("malformed saved state cannot break opening a chat or invent a queued message", () => {
  assert.deepEqual(readLocalChatDraft(null), emptyLocalChatDraft());
  assert.deepEqual(readLocalChatDraft({ text: 3, queue: [null, { text: "Safe", options: { permission: "anything", model: "alpha" } }], pending: { id: 2, text: "Ignored" } }), { text: "", options: {}, queue: [{ text: "Safe", options: { model: "alpha" } }], held: false });
});

test("a late send outcome cannot overwrite a newer request or its draft", () => {
  const current = { ...emptyLocalChatDraft(), text: "Newer draft", pending: { id: "send-2", text: "Second", options: {} } };
  assert.equal(settleLocalChatDraft(current, "send-1", false), current);
  assert.equal(settleLocalChatDraft(current, "send-1", true), current);
});

test("confirmation removes only the pending journal and preserves newly typed text and queue", () => {
  const current = { ...emptyLocalChatDraft(), text: "Following draft", queue: [{ text: "Queued", options: {} }], pending: { id: "send-1", text: "First", options: {} } };
  const settled = settleLocalChatDraft(current, "send-1", true);
  assert.equal(settled.pending, undefined);
  assert.equal(settled.text, "Following draft");
  assert.deepEqual(settled.queue, current.queue);
});
