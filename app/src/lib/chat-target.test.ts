import assert from "node:assert/strict";
import test from "node:test";

import { chatAt, folderChat } from "./chat-target.ts";

const chat = (id: string, cwd: string, state: string, started_at: string) => ({ id, cwd, state, started_at });

test("Send to agent reaches the worktree's newest live chat", () => {
  const chats = [chat("old", "/w/fix", "idle", "2026-10-08T10:00:00Z"), chat("new", "/w/fix", "running", "2026-10-08T12:00:00Z"), chat("other", "/w/main", "idle", "2026-10-08T13:00:00Z")];
  assert.equal(chatAt(chats, "/w/fix")?.id, "new");
});

test("a stopped chat, or one in another folder, is not an agent to send to", () => {
  assert.equal(chatAt([chat("stopped", "/w/fix", "exited", "2026-10-08T12:00:00Z")], "/w/fix"), undefined);
  assert.equal(chatAt([chat("other", "/w/main", "idle", "2026-10-08T12:00:00Z")], "/w/fix"), undefined);
});

test("a project or worktree row opens that chat, and leaves the launcher when there is none", () => {
  const chats = [chat("old", "/repo", "idle", "2026-10-08T10:00:00Z"), chat("live", "/repo", "waiting", "2026-10-08T12:00:00Z"), chat("stopped", "/repo", "exited", "2026-10-08T13:00:00Z")];
  assert.equal(folderChat(chats, "/repo")?.id, "live");
  assert.equal(folderChat([chat("stopped", "/repo", "exited", "2026-10-08T13:00:00Z")], "/repo"), undefined);
});
