import assert from "node:assert/strict";
import { test } from "node:test";

import { captureDesktopState, isDesktopStateKey, parseDesktopState, restoreDesktopState, type DesktopFontStore, type DesktopImageStore, type DesktopState, type StoredDesktopFont, type StoredDesktopImage } from "./desktop-state.ts";

const fontId = "1ce41d9e-2536-436a-8eaf-d0de35cfc404";
const fontBytes = () => new TextEncoder().encode("wOF2synthetic font").buffer;
const state = (): DesktopState => ({
  version: 1,
  storage: {
    "berth.ui": JSON.stringify({ themeId: "personal" }),
    "berth.prefs": JSON.stringify({ density: "compact", customFonts: [{ id: fontId, name: "Mono" }], codeFont: fontId }),
    "berth.workspaces": JSON.stringify({ spaces: { project: { draft: "keep my unsent text" } } }),
  },
  fonts: [{ id: fontId, name: "Mono", bytes: btoa("wOF2synthetic font") }],
  images: [],
});

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  failKey: string | undefined;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(at: number) { return [...this.values.keys()][at] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error("Synthetic storage quota");
    this.values.set(key, value);
  }
}

class MemoryFonts implements DesktopFontStore {
  readonly rows: StoredDesktopFont[] = [];
  fail = false;
  reads = 0;
  writes = 0;
  async read() { this.reads++; return this.rows; }
  async addMissing(fonts: StoredDesktopFont[]) {
    this.writes++;
    if (this.fail) throw new Error("Synthetic IndexedDB failure");
    for (const font of fonts) if (!this.rows.some((row) => row.id === font.id)) this.rows.push(font);
  }
}

class MemoryImages implements DesktopImageStore {
  readonly rows: StoredDesktopImage[] = [];
  fail = false;
  writes = 0;
  async read() { return this.rows; }
  async addMissing(images: StoredDesktopImage[]) {
    this.writes++;
    if (this.fail) throw new Error("Synthetic image storage failure");
    for (const image of images) if (!this.rows.some((row) => row.id === image.id)) this.rows.push(image);
  }
}

const image = (): StoredDesktopImage => ({ id: "img-migration-0001", name: "My background: mountain\nlake", prompt: "mountain\nlake", w: 16, h: 12, type: "image/jpeg", at: 1760050000000, bytes: new Uint8Array([255, 216, 255, 1]).buffer });

test("export keeps preferences, saved drafts, theme and custom font bytes, while excluding credentials and plugin data", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  const original = state();
  for (const [key, value] of Object.entries(original.storage)) storage.setItem(key, value);
  storage.setItem("berth.ui-token", "synthetic credential");
  storage.setItem("berth.plugin.thirdParty.secret", "synthetic credential");
  storage.setItem("provider.auth", "synthetic credential");
  fonts.rows.push({ id: fontId, bytes: fontBytes() });
  const before = [...storage.values.entries()];
  assert.deepEqual(await captureDesktopState(storage, fonts, new MemoryImages()), original);
  assert.deepEqual([...storage.values.entries()], before, "export must leave rollback source unchanged");
  assert.equal(fonts.writes, 0);
});

test("state permits known dynamic project choices but rejects unrecognized and credential keys", () => {
  for (const key of ["berth.diff.mode", "berth.loops.folded", "berth.composer.default.box/project", "berth.newWorktree.box.project", "berth.loop.check.box/project", "berth.home.widget"]) {
    assert.equal(isDesktopStateKey(key), true, key);
  }
  for (const key of ["berth.plugin.usage.token", "berth.token", "berth.credentials", "berth.provider.codex", "berth.composer.default.", "berth.ui\n"]) {
    assert.equal(isDesktopStateKey(key), false, key);
  }
});

test("an absent export starts a fresh profile without touching saved files or importing later exports", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  const images = new MemoryImages();
  assert.equal(await restoreDesktopState(null, storage, fonts, images), "fresh");
  assert.deepEqual([...storage.values.entries()], [["burf.desktop-state.v1", "complete"]]);
  assert.equal(fonts.reads, 0);
  assert.equal(fonts.writes, 0);
  assert.equal(images.writes, 0);
  storage.setItem("berth.prefs", "preferences created here");
  assert.equal(await restoreDesktopState(state(), storage, fonts, images), "already-restored");
  assert.equal(storage.getItem("berth.prefs"), "preferences created here");
  assert.equal(storage.getItem("berth.workspaces"), null);
});

test("a missing export cannot abandon a pending import; the next valid export resumes it", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  storage.setItem("burf.desktop-state.v1", "pending");
  storage.setItem("berth.ui", "selected during recovery");
  await assert.rejects(restoreDesktopState(null, storage, fonts), /missing.*export/i);
  assert.equal(storage.getItem("burf.desktop-state.v1"), "pending");
  assert.equal(await restoreDesktopState(state(), storage, fonts), "restored");
  assert.equal(storage.getItem("berth.ui"), "selected during recovery");
  assert.equal(storage.getItem("berth.workspaces"), state().storage["berth.workspaces"]);
});

test("invalid exports and failed fresh-profile marker writes remain retryable", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  for (const value of [undefined, {}, false]) await assert.rejects(restoreDesktopState(value, storage, fonts));
  assert.equal(storage.length, 0);
  storage.failKey = "burf.desktop-state.v1";
  await assert.rejects(restoreDesktopState(null, storage, fonts), /quota/);
  assert.equal(storage.length, 0);
  storage.failKey = undefined;
  assert.equal(await restoreDesktopState(null, storage, fonts), "fresh");
});

test("fresh-origin import completes once and never replays a later source snapshot", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  const original = state();
  assert.equal(await restoreDesktopState(original, storage, fonts), "restored");
  for (const [key, value] of Object.entries(original.storage)) assert.equal(storage.getItem(key), value);
  assert.deepEqual(fonts.rows, [{ id: fontId, bytes: fontBytes() }]);
  storage.setItem("berth.ui", "my Wails theme");
  assert.equal(await restoreDesktopState({ ...original, storage: { "berth.ui": "changed old theme" } }, storage, fonts), "already-restored");
  assert.equal(storage.getItem("berth.ui"), "my Wails theme");
  assert.equal(fonts.writes, 1);
});

test("an already-used Wails origin keeps its preferences and font records", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  storage.setItem("berth.prefs", "existing Wails preferences");
  fonts.rows.push({ id: fontId, bytes: new TextEncoder().encode("wOFFexisting Wails font").buffer });
  assert.equal(await restoreDesktopState(state(), storage, fonts), "existing");
  assert.equal(storage.getItem("berth.prefs"), "existing Wails preferences");
  assert.equal(storage.getItem("berth.workspaces"), null);
  assert.equal(fonts.writes, 0);
});

test("an interrupted import retries missing values without replacing new Wails values or fonts", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  storage.failKey = "berth.prefs";
  await assert.rejects(restoreDesktopState(state(), storage, fonts), /quota/);
  assert.equal(storage.getItem("burf.desktop-state.v1"), "pending");
  storage.setItem("berth.ui", "selected during recovery");
  fonts.rows[0] = { id: fontId, bytes: new TextEncoder().encode("wOFFexisting font").buffer };
  storage.failKey = undefined;
  assert.equal(await restoreDesktopState(state(), storage, fonts), "restored");
  assert.equal(storage.getItem("berth.ui"), "selected during recovery");
  assert.equal(new TextDecoder().decode(fonts.rows[0].bytes), "wOFFexisting font");
  assert.equal(storage.getItem("berth.workspaces"), state().storage["berth.workspaces"]);
});

test("font storage failure keeps import retryable and does not commit preferences", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  fonts.fail = true;
  await assert.rejects(restoreDesktopState(state(), storage, fonts), /IndexedDB failure/);
  assert.equal(storage.getItem("burf.desktop-state.v1"), "pending");
  assert.equal(storage.getItem("berth.prefs"), null);
  fonts.fail = false;
  assert.equal(await restoreDesktopState(state(), storage, fonts), "restored");
});

test("snapshot validation rejects malformed records and font bytes before touching destination data", async () => {
  const storage = new MemoryStorage();
  const fonts = new MemoryFonts();
  const original = state();
  for (const value of [
    { ...original, version: 2 },
    { ...original, provider: {} },
    { ...original, storage: { "berth.token": "synthetic credential" } },
    { ...original, storage: { "berth.prefs": "x".repeat(1024 * 1024 + 1) } },
    { ...original, fonts: [{ ...original.fonts[0], bytes: btoa("bad font") }] },
    { ...original, fonts: [{ ...original.fonts[0], bytes: "d09GMh==" }] },
    { ...original, fonts: [original.fonts[0], original.fonts[0]] },
    { ...original, fonts: [{ ...original.fonts[0], id: "untrusted CSS family" }] },
  ]) {
    assert.throws(() => parseDesktopState(value));
    await assert.rejects(restoreDesktopState(value, storage, fonts));
  }
  assert.equal(storage.length, 0);
  assert.equal(fonts.writes, 0);
});

test("missing font bytes preserve the source's failed-font preference entry", async () => {
  const storage = new MemoryStorage();
  storage.setItem("berth.prefs", state().storage["berth.prefs"]);
  const captured = await captureDesktopState(storage, new MemoryFonts(), new MemoryImages());
  assert.equal(captured.storage["berth.prefs"], state().storage["berth.prefs"]);
  assert.deepEqual(captured.fonts, []);
});

test("a valid large WOFF record stays within the existing 5 MB font limit", () => {
  const bytes = new Uint8Array(2 * 1024 * 1024);
  bytes.set(new TextEncoder().encode("wOF2"));
  const snapshot = { version: 1, storage: {}, fonts: [{ id: fontId, name: "Large", bytes: Buffer.from(bytes).toString("base64") }] };
  assert.equal(parseDesktopState(snapshot).fonts[0].bytes, snapshot.fonts[0].bytes);
});

test("background gallery bytes, multiline generated labels, selected picture and timestamps migrate without changing the source", async () => {
  const storage = new MemoryStorage();
  const images = new MemoryImages();
  images.rows.push(image(), { ...image(), id: "img-migration-0002", at: image().at - 100 });
  storage.setItem("berth.prefs", JSON.stringify({ chatBackground: { source: "image", image: { id: image().id, name: image().name, w: image().w, h: image().h } } }));
  const snapshot = await captureDesktopState(storage, new MemoryFonts(), images);
  assert.equal(snapshot.images.length, 2, "unselected retained gallery pictures also survive");
  assert.equal(snapshot.images[0].at, image().at);
  assert.equal(images.writes, 0);
  const destination = new MemoryStorage();
  const imported = new MemoryImages();
  assert.equal(await restoreDesktopState(snapshot, destination, new MemoryFonts(), imported), "restored");
  assert.deepEqual(imported.rows, images.rows);
  assert.equal(destination.getItem("berth.prefs"), storage.getItem("berth.prefs"));
});

test("a background-image failure retries without overwriting existing pictures", async () => {
  const storage = new MemoryStorage();
  const images = new MemoryImages();
  const snapshot = { ...state(), images: [{ ...image(), bytes: Buffer.from(image().bytes).toString("base64") }] };
  images.fail = true;
  await assert.rejects(restoreDesktopState(snapshot, storage, new MemoryFonts(), images), /image storage failure/);
  assert.equal(storage.getItem("berth.prefs"), null);
  images.fail = false;
  const existing = { ...image(), bytes: new Uint8Array([255, 216, 255, 2]).buffer };
  images.rows.push(existing);
  assert.equal(await restoreDesktopState(snapshot, storage, new MemoryFonts(), images), "restored");
  assert.deepEqual(images.rows, [existing]);
});

test("background imports reject mismatched types, broken bytes and excessive gallery data", () => {
  const valid = { ...image(), bytes: Buffer.from(image().bytes).toString("base64") };
  for (const images of [
    [{ ...valid, type: "image/svg+xml" }],
    [{ ...valid, bytes: btoa("not an image") }],
    [{ ...valid, w: 2561 }],
    [valid, valid],
    Array.from({ length: 9 }, (_, at) => ({ ...valid, id: `img-gallery-${at}` })),
  ]) assert.throws(() => parseDesktopState({ ...state(), images }));
});

test("earlier version-1 font-only exports remain readable", () => {
  const original = state();
  const earlier = { version: original.version, storage: original.storage, fonts: original.fonts };
  assert.deepEqual(parseDesktopState(earlier), original);
});
