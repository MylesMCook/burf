import { expect, mockOnly, test } from "./fixtures";

// The reply box at the foot of a chat.

test.beforeEach(async ({ app }) => {
  await app.open({ params: { view: "conversation" } });
});

test("a long reply is capped in height and scrolls, with Send in reach", async ({ app }) => {
  mockOnly();
  await app.openWorktree("devl/search-perf");
  const box = app.composer.getByRole("textbox", { name: "Reply" });
  await box.fill(Array.from({ length: 200 }, (_, i) => `line ${i + 1} of a very long pasted prompt`).join("\n"));
  await expect.poll(() => box.evaluate((el) => el.scrollHeight > el.clientHeight + 100)).toBe(true);
  const r = await box.evaluate((el) => ({ h: el.getBoundingClientRect().height, overflow: getComputedStyle(el).overflowY, cap: Math.min(innerHeight * 0.4, 16 * parseFloat(getComputedStyle(document.documentElement).fontSize)) }));
  expect(r.overflow).toBe("auto");
  expect(r.h).toBeLessThanOrEqual(r.cap + 1);
  const send = app.composer.getByRole("button", { name: "Send" });
  await expect(send).toBeEnabled();
  await expect(send).toBeInViewport({ ratio: 1 });
  // The caret's end is reachable: the field scrolls to its last line.
  await box.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect.poll(() => box.evaluate((el) => Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1)).toBe(true);
});

test("a pasted image becomes a chip with its size", async ({ app }) => {
  mockOnly("uploads to a box");
  await app.openWorktree("devl/search-perf");
  const box = app.composer.getByRole("textbox", { name: "Reply" });
  await box.click();
  // A screenshot on the clipboard, pasted as the app gets it from macOS.
  await box.evaluate(async (el) => {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = "#3b82f6";
    g.fillRect(0, 0, 96, 64);
    g.fillStyle = "#f59e0b";
    g.fillRect(24, 16, 48, 32);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "image.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  const chip = app.composer.getByTestId("attachment-chip");
  await expect(chip).toHaveCount(1);
  // A screenshot has no name of its own: it is named for when it was pasted.
  await expect(chip).toContainText(/pasted-\d+\.png/);
  // Uploaded: the chip says how big it is, and Send takes it.
  await expect(chip).not.toHaveAttribute("data-state", /uploading|shrinking|error/);
  await expect(chip).toHaveText(/^pasted-\d+\.png\s*\d+ (B|KB)$/);
  await expect(chip.locator("img")).toBeVisible();
  await expect(app.composer.getByRole("button", { name: "Send" })).toBeEnabled();
});
