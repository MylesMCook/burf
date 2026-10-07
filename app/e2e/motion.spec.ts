import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Reduce motion (index.css, lib/motion.ts): with it on, nothing on screen
// keeps moving: no spinner, shimmer, pulse, the pixel loader, the harbour
// or a drawer's slide runs on, and a sheet opens without one.

test.use({ reducedMotion: "reduce" });

// moving lists the animations still running a moment after the screen
// settles: CSS animations and transitions, and the Web Animations ones.
const moving = (page: Page) =>
  page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 300));
    return document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => {
        const t = a.effect?.getComputedTiming();
        const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
        return { name: (a as CSSAnimation).animationName ?? a.constructor.name, iterations: t?.iterations, duration: Number(t?.duration ?? 0), on: el?.className?.toString().slice(0, 80) ?? "" };
      })
      .filter((a) => a.iterations === Infinity || a.duration > 50);
  });

test("Home, its widgets and the sidebar's spinners hold still", async ({ app }) => {
  await app.open();
  await expect(app.page.getByTestId("home-grid")).toBeVisible();
  expect(await moving(app.page)).toEqual([]);
});

test("a working agent's chat holds still: no shimmer, spinner or pulse", async ({ app }) => {
  await app.open({ params: { view: "conversation" } });
  await app.openWorktree("gpu/judge-v2");
  await expect(app.chat).toBeVisible();
  expect(await moving(app.page)).toEqual([]);
});

test("the folded rail and a sheet open without moving", async ({ app }) => {
  await app.open();
  await app.page.getByRole("button", { name: "Hide the sidebar" }).click();
  await expect(app.page.getByRole("navigation", { name: "Agents" })).toBeVisible();
  await app.page.keyboard.press("Meta+Slash");
  await expect(app.page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  expect(await moving(app.page)).toEqual([]);
});

test("first run's welcome art holds still", async ({ app }) => {
  await app.page.goto("/?mock=1&fresh=1");
  await expect(app.page.locator("main")).toBeVisible();
  expect(await moving(app.page)).toEqual([]);
});
