import { readFileSync } from "node:fs";
import type { Response } from "@playwright/test";

import { type App, expect, mockOnly, test } from "./fixtures";

const bytes = readFileSync(new URL("../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", import.meta.url));
const name = "My JetBrains Mono";
const file = { name: `${name}.woff2`, mimeType: "font/woff2", buffer: bytes };

test.beforeEach(() => mockOnly("custom fonts use isolated browser storage"));

function fontResponses(app: App): Response[] {
  const responses: Response[] = [];
  app.page.on("response", (response) => {
    if (/\.(woff2|ttf)$/.test(new URL(response.url()).pathname)) responses.push(response);
  });
  return responses;
}

test("the interface default loads the bundled Geist face", async ({ app }) => {
  const responses = fontResponses(app);
  await app.open();
  await app.page.evaluate(() => document.fonts.load('400 13px "Geist"'));
  await expectBodyFont(app, "Geist");
  const response = responses.find((item) => {
    const path = new URL(item.url()).pathname;
    return path.includes("/geist") && !path.includes("pixel") && path.endsWith(".woff2");
  });
  if (!response) throw new Error("The bundled Geist resource was not loaded.");
  expect(new URL(response.url()).origin).toBe(new URL(app.page.url()).origin);
  expect(response.ok()).toBe(true);
  expect((await response.body()).equals(readFileSync(new URL("../src/assets/fonts/geist.woff2", import.meta.url)))).toBe(true);
});

test("headings, Pixel and Paper Mono use their bundled local assets", async ({ app }) => {
  const responses = fontResponses(app);
  await app.open();
  await app.openSettings("boxes");
  await app.page.getByRole("button", { name: "Add a box", exact: true }).first().click();
  await expect(app.page.getByRole("dialog", { name: "Add a box", exact: true }).getByRole("heading", { name: "Add a box", exact: true })).toHaveCSS("font-family", /Geist/);
  await app.page.evaluate(async () => {
    await document.fonts.load('400 13px "Geist Pixel Square"');
    await document.fonts.load('400 13px "Paper Mono"');
  });
  const faces = await app.page.evaluate(() => Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status })));
  expect(faces).toEqual(expect.arrayContaining([{ family: "Geist Pixel Square", status: "loaded" }, { family: "Paper Mono", status: "loaded" }]));
  for (const file of ["geist-pixel-square.woff2", "paper-mono.ttf"]) {
    const name = file.replace(/\.[^.]+$/, ""), extension = file.slice(file.lastIndexOf("."));
    const response = responses.find((item) => {
      const path = new URL(item.url()).pathname;
      return path.includes(name) && path.endsWith(extension);
    });
    if (!response) throw new Error(`The bundled ${file} resource was not loaded.`);
    expect(new URL(response.url()).origin).toBe(new URL(app.page.url()).origin);
    expect(response.ok()).toBe(true);
    expect((await response.body()).equals(readFileSync(new URL(`../src/assets/fonts/${file}`, import.meta.url)))).toBe(true);
  }
});

async function addFont(app: App) {
  const settings = await app.openSettings("appearance");
  await expect(settings.getByRole("button", { name: "Add a font", exact: true })).toBeVisible();
  await settings.locator('input[type="file"][accept=".woff,.woff2"]').setInputFiles(file);
  await expect(settings.getByRole("list", { name: "Added fonts" }).getByText(name, { exact: true })).toBeVisible();
  return settings;
}

test("the Pixel interface choice reloads without changing headings, code or terminals", async ({ app }) => {
  await app.open();
  const settings = await app.openSettings("appearance");
  await choose(app, "Interface font", "Geist Pixel");
  await expectBodyFont(app, "Geist Pixel Square");
  const heading = settings.getByRole("heading", { name: "Fonts", exact: true });
  await expect(heading).toHaveCSS("font-family", /^"?Geist"?,/);
  await expect.poll(() => heading.evaluate((element) => getComputedStyle(element).fontSynthesis)).toMatch(/\bstyle\b/);
  await expect(settings.locator("pre").first()).toHaveCSS("font-family", /Paper Mono/);
  await app.openSettings("terminal");
  await expect(app.page.getByTestId("terminal-preview")).toHaveCSS("font-family", /Paper Mono/);
  await app.page.reload();
  await expectBodyFont(app, "Geist Pixel Square");
  await app.openSettings("appearance");
  await expect(app.page.getByRole("combobox", { name: "Interface font", exact: true })).toContainText("Geist Pixel");
  await choose(app, "Interface font", "Default");
  await expectBodyFont(app, "Geist");
});

test("a separate reading face reloads without changing interface or code", async ({ app }) => {
  await app.open();
  const settings = await addFont(app);
  const family = await addedFamily(app);
  await choose(app, "Reading font", name);
  await expect(settings.getByRole("heading", { name: "Fonts", exact: true })).toHaveCSS("font-family", new RegExp(family));
  await expectBodyFont(app, "Geist");
  await expect(settings.locator("pre").first()).toHaveCSS("font-family", /Paper Mono/);
  await app.page.reload();
  const restored = await app.openSettings("appearance");
  await expect(restored.getByRole("combobox", { name: "Reading font", exact: true })).toContainText(name);
  await expect(restored.getByRole("heading", { name: "Fonts", exact: true })).toHaveCSS("font-family", new RegExp(family));
  await restored.getByRole("button", { name: `Remove ${name}`, exact: true }).click();
  await expect(restored.getByRole("combobox", { name: "Reading font", exact: true })).toContainText("Default");
  await expect(restored.getByRole("heading", { name: "Fonts", exact: true })).toHaveCSS("font-family", /^"?Geist"?,/);
});

async function choose(app: App, label: string, font: string) {
  await app.page.getByRole("combobox", { name: label, exact: true }).click();
  await app.page.getByRole("option", { name: font, exact: true }).click();
}

async function addedFamily(app: App): Promise<string> {
  const prefs = await app.stored("berth.prefs") as { customFonts: { id: string; name: string }[] };
  return `BurfFont-${prefs.customFonts.find((f) => f.name === name)!.id}`;
}

async function expectBodyFont(app: App, family: string) {
  await expect.poll(() => app.page.evaluate(() => getComputedStyle(document.body).fontFamily.split(",")[0]?.trim().replace(/^['"]|['"]$/g, ""))).toBe(family);
  // Checking the registered face too prevents a missing family, which
  // document.fonts.check alone can report as available through fallback.
  await expect.poll(() => app.page.evaluate((family) => Array.from(document.fonts).some((face) => face.family === family && face.status === "loaded") && document.fonts.check(`13px "${family}"`), family)).toBe(true);
}

test("an added font is named and offered for both uses and terminals", async ({ app }) => {
  await app.open();
  const settings = await addFont(app);
  for (const label of ["Interface font", "Reading font", "Code font"]) {
    await settings.getByRole("combobox", { name: label, exact: true }).click();
    await expect(app.page.getByRole("option", { name, exact: true })).toBeVisible();
    await app.page.keyboard.press("Escape");
  }
  await app.openSettings("terminal");
  await choose(app, "Font", name);
  await expect(app.page.getByTestId("terminal-preview")).toHaveCSS("font-family", new RegExp(await addedFamily(app)));
  const prefs = await app.stored("berth.prefs") as { customFonts: unknown[]; terminalFont: string };
  expect(prefs.customFonts).toEqual([{ id: expect.any(String), name }]);
  expect(prefs.terminalFont).toBeTruthy();
});

test("interface and code choices apply and survive reload with the stored font", async ({ app }) => {
  await app.open();
  const settings = await addFont(app);
  const family = await addedFamily(app);
  await choose(app, "Interface font", name);
  await expectBodyFont(app, family);
  await choose(app, "Code font", name);
  await expect(settings.locator("pre").first()).toHaveCSS("font-family", new RegExp(`^"?${family}`));
  await app.openSettings("terminal");
  await expect(app.page.getByTestId("terminal-preview")).toHaveCSS("font-family", new RegExp(`^"?${family}`));
  await app.page.reload();
  await expectBodyFont(app, family);
  const restored = await app.openSettings("appearance");
  await expect(restored.getByRole("combobox", { name: "Interface font", exact: true })).toContainText(name);
  await expect(restored.getByRole("combobox", { name: "Code font", exact: true })).toContainText(name);
  await expect(restored.locator("pre").first()).toHaveCSS("font-family", new RegExp(`^"?${family}`));
  await app.openSettings("terminal");
  await expect(app.page.getByTestId("terminal-preview")).toHaveCSS("font-family", new RegExp(`^"?${family}`));
});

test("removing a font in use quietly restores defaults for all uses", async ({ app }) => {
  await app.open();
  await addFont(app);
  await choose(app, "Interface font", name);
  await choose(app, "Code font", name);
  await app.openSettings("terminal");
  await choose(app, "Font", name);
  const settings = await app.openSettings("appearance");
  await settings.getByRole("button", { name: `Remove ${name}`, exact: true }).click();
  await expect(settings.getByRole("list", { name: "Added fonts" })).toHaveCount(0);
  await expect(settings.getByRole("combobox", { name: "Interface font", exact: true })).toContainText("Default");
  await expect(settings.getByRole("combobox", { name: "Code font", exact: true })).toContainText("Default");
  await expectBodyFont(app, "Geist");
  await expect(settings.locator("pre").first()).toHaveCSS("font-family", /Paper Mono/);
  await expect(settings.getByRole("status")).toHaveCount(0);
  const prefs = await app.stored("berth.prefs") as Record<string, unknown>;
  expect(prefs.customFonts).toEqual([]);
  expect(prefs.interfaceFont).toBeNull();
  expect(prefs.codeFont).toBeNull();
  expect(prefs.terminalFont).toBeNull();
  await app.openSettings("terminal");
  await expect(app.page.getByTestId("terminal-preview")).toHaveCSS("font-family", /Paper Mono/);
  await app.page.getByRole("combobox", { name: "Font", exact: true }).click();
  await expect(app.page.getByRole("option", { name, exact: true })).toHaveCount(0);
});

for (const invalid of [
  { name: "not-a-font.woff2", buffer: Buffer.from("This is not a font"), message: /isn't a WOFF font/ },
  { name: "too-large.woff2", buffer: Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(5 * 1024 * 1024)]), message: /over 5 MB/ },
]) test(`refuses ${invalid.name} without adding a font`, async ({ app }) => {
  await app.open();
  const settings = await app.openSettings("appearance");
  await settings.locator('input[accept=".woff,.woff2"]').setInputFiles({ name: invalid.name, mimeType: "font/woff2", buffer: invalid.buffer });
  await expect(settings.getByRole("status")).toHaveText(invalid.message);
  await expect(settings.getByRole("list", { name: "Added fonts" })).toHaveCount(0);
  expect((await app.stored("berth.prefs") as { customFonts: unknown[] }).customFonts).toEqual([]);
});

test("a stored font that cannot load falls back and names the font in Settings", async ({ app }) => {
  await app.open();
  await addFont(app);
  await choose(app, "Interface font", name);
  await choose(app, "Code font", name);
  await app.openSettings("terminal");
  await choose(app, "Font", name);
  // Corrupt the actual stored bytes rather than replacing FontFace with a
  // mock, so startup exercises the browser's font decoder and fallback.
  await app.page.evaluate(async () => {
    const prefs = JSON.parse(localStorage.getItem("berth.prefs")!);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("berth-custom-fonts", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("fonts", "readwrite");
        tx.objectStore("fonts").put({ id: prefs.customFonts[0].id, bytes: new TextEncoder().encode("broken font").buffer });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
  });
  await app.page.reload();
  const settings = await app.openSettings("appearance");
  await expect(settings.getByText(`“${name}” could not be loaded.`, { exact: false })).toBeVisible();
  await expectBodyFont(app, "Geist");
  await expect(settings.getByRole("combobox", { name: "Interface font", exact: true })).toContainText("Default");
  await expect(settings.getByRole("combobox", { name: "Code font", exact: true })).toContainText("Default");
  await expect(settings.locator("pre").first()).toHaveCSS("font-family", /Paper Mono/);
  await app.openSettings("terminal");
  await expect(app.page.getByTestId("terminal-preview")).toHaveCSS("font-family", /Paper Mono/);
});
