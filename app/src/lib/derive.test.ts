import assert from "node:assert/strict";
import { test } from "node:test";

import type { Session } from "./api.ts";
import { sidebarChats } from "./derive.ts";

function session(partial: Partial<Session> & Pick<Session, "name" | "dir" | "created">): Session {
  return { attached: 0, exited: false, ...partial };
}

test("an exited titled agent on an undrawn checkout is a sidebar chat", () => {
  const testChat = session({ name: "s1", dir: "/executor", created: "2026-01-02T00:00:00Z", exited: true, agent: "codex", title: "This is a test" });
  const older = session({ name: "s0", dir: "/executor", created: "2026-01-01T00:00:00Z", exited: true, agent: "codex", title: "Older" });
  const listed = sidebarChats([older, testChat], new Set());
  assert.deepEqual(listed.map((s) => s.title), ["This is a test", "Older"]);
});

test("sessions on a drawn worktree are not listed again", () => {
  const live = session({ name: "live", dir: "/wt", created: "2026-01-03T00:00:00Z", agent: "codex", title: "On the row" });
  const main = session({ name: "main", dir: "/repo", created: "2026-01-04T00:00:00Z", agent: "claude", title: "On main" });
  const shell = session({ name: "sh", dir: "/other", created: "2026-01-05T00:00:00Z", command: "bash" });
  const service = session({ name: "svc", dir: "/other", created: "2026-01-06T00:00:00Z", agent: "codex", title: "Service", service: "web" });
  const listed = sidebarChats([live, main, shell, service], new Set(["/wt"]));
  assert.deepEqual(listed.map((s) => s.name), ["main"]);
});
