import assert from "node:assert/strict";
import test from "node:test";

import { waitingCleared } from "./notification-state.ts";

const before = "2026-10-08T12:00:00.000Z";
const time = "2026-10-08T12:00:01.000Z";
const after = "2026-10-08T12:00:02.000Z";
const note = { session: "not-cached-yet", time };
const session = { name: note.session, dir: "/w/shop/fix", command: "claude", created: before, attached: 0, exited: false, agent_state: "waiting" as const, state_since: before };

test("an unrelated cache update cannot clear a newly announced session's request", () => {
  assert.equal(waitingCleared(note, [], before), false);
});

test("a session read started before the alert cannot clear it when it arrives late", () => {
  assert.equal(waitingCleared(note, [], before), false);
});

test("a read started in the same millisecond is not proof that the session stopped", () => {
  assert.equal(waitingCleared(note, [], time), false);
});

test("missing or failed session reads cannot clear the alert", () => {
  assert.equal(waitingCleared(note), false);
  assert.equal(waitingCleared(note, undefined, after), false);
  assert.equal(waitingCleared(note, []), false);
});

test("a subsequent successful read can recover a missed session stop event", () => {
  assert.equal(waitingCleared(note, [], after), true);
});

test("a waiting session still needs the person after a fresh read", () => {
  assert.equal(waitingCleared(note, [session], after), false);
});

test("an old exit snapshot cannot dismiss a newer waiting alert", () => {
  assert.equal(waitingCleared(note, [{ ...session, exited: true }], before), false);
});

test("a fresh exit snapshot clears the request", () => {
  assert.equal(waitingCleared(note, [{ ...session, exited: true }], after), true);
});

test("a newer running state clears the request, even when the read started earlier", () => {
  assert.equal(waitingCleared(note, [{ ...session, agent_state: "running", state_since: after }], before), true);
});

test("a running state older than the request, or without a time, cannot clear it", () => {
  assert.equal(waitingCleared(note, [{ ...session, agent_state: "running" }], after), false);
  assert.equal(waitingCleared(note, [{ ...session, agent_state: "running", state_since: undefined }], after), false);
});
