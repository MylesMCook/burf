import assert from "node:assert/strict";
import test from "node:test";

import { buildLocalThreadRows, groupLocalThreadRows } from "./local-thread-rows.ts";
import type { LocalConversation, LocalSession } from "./local-computer.ts";

const cwd = "C:\\Projects\\shop";

test("hides history that a live session already owns", () => {
  const conversations: LocalConversation[] = [
    { id: "h1", source: "codex", title: "Saved", cwd, updated_at: "2026-01-01T00:00:00Z", read_only: true },
    { id: "h2", source: "codex", title: "Other", cwd, updated_at: "2026-01-01T00:00:00Z", read_only: true },
  ];
  const sessions: LocalSession[] = [
    { id: "s1", agent: "codex", cwd, state: "running", started_at: "2026-01-01T00:00:00Z", history_id: "h1", mode: "chat", title: "Live" },
  ];
  const rows = buildLocalThreadRows(conversations, sessions);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["session:s1", "history:h2"],
  );
});

test("groups rows by folder cwd", () => {
  const rows = buildLocalThreadRows(
    [
      { id: "a", source: "codex", title: "A", cwd, updated_at: "2026-01-01T00:00:00Z", read_only: true },
      { id: "b", source: "codex", title: "B", cwd: "C:\\Other", updated_at: "2026-01-01T00:00:00Z", read_only: true },
    ],
    [],
  );
  const groups = groupLocalThreadRows(rows);
  assert.equal(groups.length, 2);
  assert.ok(groups.some((g) => g.rows.some((r) => r.id === "history:a")));
  assert.ok(groups.some((g) => g.rows.some((r) => r.id === "history:b")));
});
