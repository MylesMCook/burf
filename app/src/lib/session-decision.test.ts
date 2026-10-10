import assert from "node:assert/strict";
import { test } from "node:test";

import { attentionTarget, sessionDecision } from "./session-decision.ts";

const yesNo = [
  { key: "1", label: "Yes" },
  { key: "2", label: "No, and tell Claude what to do differently" },
];

test("a waiting command is the same permission Home and the session show", () => {
  const d = sessionDecision(
    { agent_state: "waiting", ask: { tool: "Bash", input: "pnpm prisma migrate dev --name idempotency_key", why: "The fix needs a column for idempotency keys" } },
    yesNo,
  );
  assert.equal(d?.kind, "permission");
  if (d?.kind !== "permission") return;
  assert.equal(d.title, "The fix needs a column for idempotency keys");
  assert.equal(d.command, "pnpm prisma migrate dev --name idempotency_key");
  assert.equal(d.allow.key, "1");
  assert.equal(d.deny.key, "2");
  assert.equal(d.always, undefined);
});

test("always allow keeps the option's own key", () => {
  const d = sessionDecision(
    { agent_state: "waiting", ask: { tool: "Bash", input: "ls", why: "List the folder" } },
    [
      { key: "1", label: "Yes" },
      { key: "2", label: "Yes, and don't ask again for ls commands" },
      { key: "3", label: "No" },
    ],
  );
  assert.equal(d?.kind, "permission");
  if (d?.kind !== "permission") return;
  assert.equal(d.always?.key, "2");
  assert.equal(d.always?.title, "Yes, and don't ask again for ls commands");
});

test("a question is not a permission, and a command with no menu yet is pending", () => {
  assert.deepEqual(sessionDecision({ agent_state: "waiting", ask: { tool: "AskUserQuestion", message: "Three questions about the release window" } }, yesNo), {
    kind: "question",
    title: "Three questions about the release window",
  });
  assert.equal(sessionDecision({ agent_state: "running", ask: { tool: "Bash", input: "ls" } }, yesNo), undefined);
  const pending = sessionDecision({ agent_state: "waiting", ask: { tool: "Bash", input: "ls", why: "List it" } }, []);
  assert.equal(pending?.kind, "pending");
  if (pending?.kind !== "pending") return;
  assert.equal(pending.command, "ls");
});

test("the status count opens the agent in this worktree, then the one waiting longest", () => {
  const entries = [
    { box: "devl", name: "shop-claude", dir: "/shop", since: "2026-10-09T12:02:00Z" },
    { box: "devl", name: "checkout-fix-claude", dir: "/checkout", since: "2026-10-09T12:00:00Z" },
    { box: "gpu", name: "other", dir: "/other", since: "2026-10-09T11:00:00Z" },
  ];
  assert.equal(attentionTarget(entries, { box: "devl", dir: "/checkout" })?.name, "checkout-fix-claude");
  assert.equal(attentionTarget(entries, { box: "devl", dir: "/checkout" }, { box: "devl", name: "checkout-fix-claude" })?.name, "other");
  assert.equal(attentionTarget(entries)?.name, "other");
  assert.equal(attentionTarget([]), undefined);
});
