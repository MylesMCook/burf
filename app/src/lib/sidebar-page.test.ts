import assert from "node:assert/strict";
import { test } from "node:test";
import { SIDEBAR_PAGE, sidebarPage, sidebarPageKey } from "./sidebar-page.ts";

test("a long list is bounded and additional batches preserve its order", () => {
  const rows = Array.from({ length: 31 }, (_, index) => ({ id: index }));
  assert.equal(sidebarPage(rows, SIDEBAR_PAGE, () => false).length, 12);
  assert.deepEqual(sidebarPage(rows, SIDEBAR_PAGE * 2, () => false), rows.slice(0, 24));
  assert.deepEqual(sidebarPage(rows, SIDEBAR_PAGE * 3, () => false), rows);
});

test("selection beyond the current batch remains visible in its original position", () => {
  const rows = Array.from({ length: 31 }, (_, index) => ({ id: index }));
  assert.deepEqual(sidebarPage(rows, SIDEBAR_PAGE, (row) => row.id === 29), [...rows.slice(0, 12), rows[29]]);
  assert.equal(rows.length, 31);
});

test("pinning an ancestor preserves its full descendants and small lists need no batching", () => {
  const selected = { id: "selected" };
  const rows = Array.from({ length: 15 }, (_, index) => ({ id: index, children: index === 14 ? [selected] : [] }));
  const shown = sidebarPage(rows, SIDEBAR_PAGE, (row) => row.children.includes(selected));
  assert.equal(shown[12], rows[14]);
  assert.deepEqual(shown[12].children, [selected]);
  assert.deepEqual(sidebarPage([], SIDEBAR_PAGE, () => false), []);
  assert.deepEqual(sidebarPage(rows.slice(0, 2), SIDEBAR_PAGE, () => false), rows.slice(0, 2));
});

test("chat paging pins the selected machine/session without pinning another machine's namesake", () => {
  const selected = sidebarPageKey("chat", "mini", "same-name");
  const chats = [
    ...Array.from({ length: 12 }, (_, index) => ({ box: "mini", name: `session-${index}` })),
    { box: "windows", name: "same-name" },
    { box: "mini", name: "same-name" },
  ];
  const shown = sidebarPage(chats, SIDEBAR_PAGE, (s) => sidebarPageKey("chat", s.box, s.name) === selected);
  assert.equal(shown.length, 13);
  assert.equal(shown[12], chats[13]);
  assert.deepEqual(sidebarPage(chats, SIDEBAR_PAGE * 2, () => false), chats);
});

test("paging scopes keep sections, chat lists and worktrees distinct without separator collisions", () => {
  assert.notEqual(sidebarPageKey("project", "a:b", "chats"), sidebarPageKey("project:a", "b", "chats"));
  assert.notEqual(sidebarPageKey("section", "loose", "projects"), sidebarPageKey("loose", "projects"));
  assert.notEqual(sidebarPageKey("repo", "mini/shop", "chats"), sidebarPageKey("repo", "mini/shop", "worktrees"));
});
