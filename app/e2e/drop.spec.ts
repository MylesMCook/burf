import type { Page } from "@playwright/test";

import { expect, mockOnly, test } from "./fixtures";

// Files dragged in from Finder (components/file-drop-guard.tsx): a file let
// fall where nothing takes it must never open in the window's place, and
// the composers take it as an attachment.

// fire dispatches a drag event carrying files (or, with no files, the app's
// own kind of drag) at the element, and says whether it was taken.
async function fire(page: Page, selector: string, type: "dragover" | "drop", files = true) {
  return page.evaluate(
    ({ selector, type, files }) => {
      const dt = new DataTransfer();
      if (files) {
        dt.items.add(new File(["# Notes\n\nThe refund flow double-charges.\n"], "notes.md", { type: "text/markdown" }));
        dt.items.add(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "shot.png", { type: "image/png" }));
      } else dt.setData("application/x-berth-test", "internal");
      const el = document.querySelector(selector)!;
      const e = new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    },
    { selector, type, files },
  );
}

const WIDGET = '[data-testid="home-grid"] [data-widget="needs-you"]';

test("a file dropped where nothing takes it doesn't replace the app, and a hint says where it goes", async ({ app }) => {
  await app.open();
  const page = app.page;
  await expect(page.locator(WIDGET)).toBeVisible();
  const url = page.url();
  const hint = page.getByTestId("file-drop-hint");
  await expect(hint).not.toHaveAttribute("data-shown");

  // Held over a widget: refused, so the browser won't open it there.
  // A real drag sends dragover every ~50ms and the hint goes 200ms after the
  // last: keep it coming until the hint is read.
  await expect(async () => {
    expect(await fire(page, WIDGET, "dragover")).toBe(true);
    await expect(hint).toHaveAttribute("data-shown", "true", { timeout: 150 });
    await expect(hint).toHaveText("Drop on a message box or a terminal to attach", { timeout: 150 });
  }).toPass();
  // Let go: the drop's default (opening the file) is prevented.
  expect(await fire(page, WIDGET, "drop")).toBe(true);
  await expect(hint).not.toHaveAttribute("data-shown");
  expect(page.url()).toBe(url);
  await expect(page.getByRole("heading", { name: "What should your agents work on?" })).toBeVisible();

  // The app's own drags (a project, a tab, a widget) are left alone.
  expect(await fire(page, WIDGET, "dragover", false)).toBe(false);
  await expect(hint).not.toHaveAttribute("data-shown");
});

test("files dropped on Home's composer attach, and Start takes them", async ({ app }) => {
  mockOnly("uploads to a box");
  await app.open();
  const page = app.page;
  const composer = page.getByTestId("task-composer");
  const editor = composer.getByRole("textbox", { name: "What should your agents work on?" });
  await expect(editor).toBeVisible();
  // The files go to the project's box: wait until there is one (not
  // "Loading…" or "Connecting…" while the fixtures arrive).
  await expect(composer.getByRole("button", { name: /^Project: (?!Loading)/ })).toBeVisible();
  await expect(composer.getByRole("button", { name: /^Box: (?!Connecting|No box)/ })).toBeVisible();

  // Held over the composer: taken, and no hint.
  expect(await fire(page, '[data-testid="task-composer"] textarea', "dragover")).toBe(true);
  await expect(composer).toHaveAttribute("data-dragging", "true");
  await expect(page.getByTestId("file-drop-hint")).not.toHaveAttribute("data-shown");
  expect(await fire(page, '[data-testid="task-composer"] textarea', "drop")).toBe(true);
  await expect(composer).not.toHaveAttribute("data-dragging");

  const chips = composer.getByTestId("attachment-chip");
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(0)).toContainText("notes.md");
  await expect(chips.nth(1)).toContainText("shot.png");
  for (const chip of await chips.all()) await expect(chip).toHaveAttribute("data-state", "ready");

  // Taking one out leaves the other.
  await chips.nth(1).hover();
  await composer.getByRole("button", { name: "Remove shot.png" }).click();
  await expect(chips).toHaveCount(1);

  await editor.fill("Why does checkout double-charge on refunds?");
  await expect(composer.getByRole("button", { name: "Start", exact: true })).toBeEnabled();
});

test("a file dropped on the reply box of a chat attaches", async ({ app }) => {
  mockOnly("uploads to a box");
  await app.open({ params: { view: "conversation" } });
  await app.openWorktree("devl/search-perf");
  await expect(app.composer).toBeVisible();
  expect(await fire(app.page, '[data-testid="composer"] textarea', "dragover")).toBe(true);
  await expect(app.page.getByTestId("file-drop-hint")).not.toHaveAttribute("data-shown");
  expect(await fire(app.page, '[data-testid="composer"] textarea', "drop")).toBe(true);
  await expect(app.composer.getByTestId("attachment-chip")).toHaveCount(2);
});
