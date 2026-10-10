import { MAX_FONT_BYTES, validateFontFile } from "./custom-font-file.ts";

export interface DesktopFont {
  id: string;
  name: string;
  bytes: string;
}

export interface DesktopState {
  version: 1;
  storage: Record<string, string>;
  fonts: DesktopFont[];
  images: DesktopImage[];
}

export interface StoredDesktopFont {
  id: string;
  bytes: ArrayBuffer;
}

export interface DesktopFontStore {
  read(ids: string[]): Promise<StoredDesktopFont[]>;
  addMissing(fonts: StoredDesktopFont[]): Promise<void>;
}

export interface StoredDesktopImage {
  id: string;
  name: string;
  prompt?: string;
  w: number;
  h: number;
  type: "image/webp" | "image/jpeg" | "image/png";
  at: number;
  bytes: ArrayBuffer;
}

export type DesktopImage = Omit<StoredDesktopImage, "bytes"> & { bytes: string };

export interface DesktopImageStore {
  read(): Promise<StoredDesktopImage[]>;
  addMissing(images: StoredDesktopImage[]): Promise<void>;
}

const MAX_STATE_BYTES = 32 * 1024 * 1024;
const MAX_STORAGE_VALUE_BYTES = 1024 * 1024;
const MAX_STORAGE_KEYS = 512;
const MAX_FONTS = 128;
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MARKER = "burf.desktop-state.v1";
const FONT_DB = "berth-custom-fonts";
const FONT_STORE = "fonts";
const IMAGE_DB = "berth-chat-background";
const IMAGE_STORE = "images";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const utf8 = new TextEncoder();

// Enumerate Burf-owned records rather than copying every berth.* key. Plugin
// storage and any credentials/private provider records stay in the old origin.
const KEYS = new Set([
  "berth.prefs", "berth.ui", "berth.workspaces", "berth.notifications", "berth.editor",
  "berth.rail", "berth.sidebar", "berth.preview", "berth.worktreeTitles", "berth.homeBox",
  "berth.pluginScreens", "berth.files.recent", "berth.files.wrap", "berth.files.filter",
  "berth.runs.dismissed", "berth.runs.hiddenBoxes", "berth.worktrees.hiddenBoxes",
  "berth.worktrees.sort", "berth.worktrees.syncMode", "berth.review.comments",
  "berth.review.reviewed", "berth.automations.tab", "berth.automations.events",
  "berth.dashboard.hiddenBoxes", "berth.dashboard.cleanupAfter", "berth.newWorktree.project.v2",
  "berth.broadcast.wait", "berth.devtools.height", "berth.hooks.asked", "berth.serviceCloseTip",
  "berth.chat.permission", "berth.app-version",
  "berth.diff.mode", "berth.loops.folded",
]);
const PREFIXES = [
  "berth.composer.picks.", "berth.composer.default.", "berth.composer.providers.",
  "berth.composer.comparison.", "berth.newWorktree.box.", "berth.loop.check.", "berth.home.",
];

export function isDesktopStateKey(key: string): boolean {
  return utf8.encode(key).length <= 1024 && !/[\u0000-\u001f\u007f-\u009f]/.test(key)
    && (KEYS.has(key) || PREFIXES.some((prefix) => key.startsWith(prefix) && key.length > prefix.length));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validFontInfo(id: unknown, name: unknown): id is string {
  return typeof id === "string" && UUID.test(id) && typeof name === "string"
    && name.length > 0 && name.trim() === name && utf8.encode(name).length <= 512
    && !/[\u0000-\u001f\u007f-\u009f]/.test(name);
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 16_384));
  }
  return btoa(binary);
}

function decodeFont(font: DesktopFont): ArrayBuffer {
  const bytes = decodeBytes(font.bytes, MAX_FONT_BYTES);
  validateFontFile(`${font.name}.woff`, bytes.length, bytes.subarray(0, 4));
  return bytes.buffer;
}

function decodeBytes(encoded: string, limit: number): Uint8Array<ArrayBuffer> {
  if (encoded.length > 4 * Math.ceil(limit / 3) || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new Error("The desktop state contains invalid file bytes.");
  }
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  if (bytes.length > limit || encodeBytes(bytes) !== encoded) throw new Error("The desktop state contains invalid file bytes.");
  return bytes;
}

function imageMetadata(value: unknown): Omit<StoredDesktopImage, "bytes"> {
  if (!isRecord(value) || typeof value.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value.id)
    || typeof value.name !== "string" || !value.name || utf8.encode(value.name).length > 2048
    || (value.prompt !== undefined && (typeof value.prompt !== "string" || utf8.encode(value.prompt).length > MAX_STORAGE_VALUE_BYTES))
    || typeof value.w !== "number" || !Number.isInteger(value.w) || value.w < 1 || value.w > 2560
    || typeof value.h !== "number" || !Number.isInteger(value.h) || value.h < 1 || value.h > 2560
    || typeof value.at !== "number" || !Number.isSafeInteger(value.at) || value.at < 0
    || (value.type !== "image/webp" && value.type !== "image/jpeg" && value.type !== "image/png")) {
    throw new Error("The desktop state contains an invalid background image.");
  }
  return { id: value.id, name: value.name, ...(typeof value.prompt === "string" && value.prompt ? { prompt: value.prompt } : {}), w: value.w, h: value.h, at: value.at, type: value.type };
}

function decodeImage(image: DesktopImage): ArrayBuffer {
  const bytes = decodeBytes(image.bytes, MAX_IMAGE_BYTES);
  const signature = image.type === "image/jpeg" ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : image.type === "image/webp" ? bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
    : bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, at) => bytes[at] === byte);
  if (!signature) throw new Error("The desktop state contains invalid background image bytes.");
  return bytes.buffer;
}

// This boundary is also used for native binding results. It imports no prefs,
// stores or App modules, so bootstrap can finish before those read localStorage.
export function parseDesktopState(value: unknown): DesktopState {
  if (!isRecord(value) || (!exactKeys(value, ["version", "storage", "fonts"]) && !exactKeys(value, ["version", "storage", "fonts", "images"]))
    || value.version !== 1 || !isRecord(value.storage) || !Array.isArray(value.fonts)
    || Object.keys(value.storage).length > MAX_STORAGE_KEYS || value.fonts.length > MAX_FONTS) {
    throw new Error("The desktop state snapshot is not supported.");
  }
  const storage: Record<string, string> = {};
  for (const [key, item] of Object.entries(value.storage)) {
    if (!isDesktopStateKey(key) || typeof item !== "string" || utf8.encode(item).length > MAX_STORAGE_VALUE_BYTES) {
      throw new Error("The desktop state contains unsupported storage.");
    }
    storage[key] = item;
  }
  const seen = new Set<string>();
  const fonts: DesktopFont[] = value.fonts.map((item: unknown) => {
    if (!isRecord(item) || !exactKeys(item, ["id", "name", "bytes"])
      || !validFontInfo(item.id, item.name) || typeof item.name !== "string"
      || typeof item.bytes !== "string" || seen.has(item.id)) {
      throw new Error("The desktop state contains an invalid font.");
    }
    seen.add(item.id);
    const font = { id: item.id, name: item.name, bytes: item.bytes };
    decodeFont(font);
    return font;
  });
  const savedImages = value.images ?? [];
  if (!Array.isArray(savedImages) || savedImages.length > MAX_IMAGES) throw new Error("The desktop state contains too many background images.");
  seen.clear();
  const images: DesktopImage[] = savedImages.map((item: unknown) => {
    if (!isRecord(item) || (!exactKeys(item, ["id", "name", "w", "h", "type", "at", "bytes"]) && !exactKeys(item, ["id", "name", "prompt", "w", "h", "type", "at", "bytes"]))
      || typeof item.bytes !== "string") throw new Error("The desktop state contains an invalid background image.");
    const image = { ...imageMetadata(item), bytes: item.bytes };
    if (seen.has(image.id)) throw new Error("The desktop state repeats a background image.");
    seen.add(image.id);
    decodeImage(image);
    return image;
  });
  const state: DesktopState = { version: 1, storage, fonts, images };
  if (utf8.encode(JSON.stringify(state)).length > MAX_STATE_BYTES) throw new Error("The desktop state is over 32 MB.");
  return state;
}

function storedFontInfo(raw: string | undefined): { id: string; name: string }[] {
  if (!raw) return [];
  const prefs: unknown = JSON.parse(raw);
  if (!isRecord(prefs) || prefs.customFonts === undefined) return [];
  if (!Array.isArray(prefs.customFonts) || prefs.customFonts.length > MAX_FONTS) throw new Error("Saved custom fonts are invalid.");
  return prefs.customFonts.map((item: unknown) => {
    if (!isRecord(item) || !validFontInfo(item.id, item.name) || typeof item.name !== "string") {
      throw new Error("Saved custom fonts are invalid.");
    }
    return { id: item.id, name: item.name };
  });
}

function captureStorage(storage: Storage): Record<string, string> {
  const captured: Record<string, string> = {};
  for (let at = 0; at < storage.length; at++) {
    const key = storage.key(at);
    if (!key || !isDesktopStateKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) captured[key] = value;
  }
  return captured;
}

export async function captureDesktopState(storage: Storage = localStorage, fontStore: DesktopFontStore = desktopFontStore, imageStore: DesktopImageStore = desktopImageStore): Promise<DesktopState> {
  const captured = captureStorage(storage);
  parseDesktopState({ version: 1, storage: captured, fonts: [] });
  const info = storedFontInfo(captured["berth.prefs"]);
  const records = info.length ? await fontStore.read(info.map((font) => font.id)) : [];
  const fonts: DesktopFont[] = [];
  for (const font of info) {
    const record = records.find((row) => row.id === font.id);
    // Missing bytes already represent a failed stored font in Appearance.
    // Preserve its preference entry without inventing replacement bytes.
    if (record) {
      if (record.bytes.byteLength > MAX_FONT_BYTES) throw new Error("A saved font is over 5 MB.");
      fonts.push({ ...font, bytes: encodeBytes(new Uint8Array(record.bytes)) });
    }
  }
  const images = (await imageStore.read()).map((image) => {
    if (image.bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("A saved background image is over 16 MB.");
    return { ...imageMetadata(image), bytes: encodeBytes(new Uint8Array(image.bytes)) };
  });
  return parseDesktopState({ version: 1, storage: captured, fonts, images });
}

export async function restoreDesktopState(value: unknown, storage: Storage = localStorage, fontStore: DesktopFontStore = desktopFontStore, imageStore: DesktopImageStore = desktopImageStore): Promise<"restored" | "existing" | "already-restored"> {
  const marker = storage.getItem(MARKER);
  if (marker === "complete") return "already-restored";
  const snapshot = parseDesktopState(value);
  if (marker !== "pending" && Object.keys(captureStorage(storage)).length) {
    storage.setItem(MARKER, "complete");
    return "existing";
  }
  // The marker is committed last. A quota/IDB failure leaves a retryable import
  // that fills only missing entries and never clears either origin's data.
  storage.setItem(MARKER, "pending");
  if (snapshot.fonts.length) {
    await fontStore.addMissing(snapshot.fonts.map((font) => ({ id: font.id, bytes: decodeFont(font) })));
  }
  if (snapshot.images.length) {
    await imageStore.addMissing(snapshot.images.map((image) => ({ ...image, bytes: decodeImage(image) })));
  }
  for (const [key, value] of Object.entries(snapshot.storage)) {
    if (storage.getItem(key) === null) storage.setItem(key, value);
  }
  storage.setItem(MARKER, "complete");
  return "restored";
}

async function desktopDatabase(name: string, store: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(store, { keyPath: "id" });
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error("Close the other Burf window before migrating saved files.")); };
  });
}

const desktopFontStore: DesktopFontStore = {
  async read(ids) {
    const db = await desktopDatabase(FONT_DB, FONT_STORE);
    try {
      return await new Promise<StoredDesktopFont[]>((resolve, reject) => {
        const tx = db.transaction(FONT_STORE, "readonly");
        const requests: IDBRequest<unknown>[] = ids.map((id) => tx.objectStore(FONT_STORE).get(id));
        tx.oncomplete = () => {
          const rows: StoredDesktopFont[] = [];
          for (const request of requests) {
            const row = request.result;
            if (row === undefined) continue;
            if (!isRecord(row) || typeof row.id !== "string" || !(row.bytes instanceof ArrayBuffer)) {
              reject(new Error("Saved custom fonts are invalid.")); return;
            }
            rows.push({ id: row.id, bytes: row.bytes });
          }
          resolve(rows);
        };
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  },
  async addMissing(fonts) {
    const db = await desktopDatabase(FONT_DB, FONT_STORE);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(FONT_STORE, "readwrite");
        const store = tx.objectStore(FONT_STORE);
        for (const font of fonts) {
          const request = store.get(font.id);
          request.onsuccess = () => { if (request.result === undefined) store.add(font); };
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  },
};

// Match chat-background.ts's supported IndexedDB schema. Import keeps IDs and
// timestamps instead of regenerating or recompressing the person's pictures.
const desktopImageStore: DesktopImageStore = {
  async read() {
    const db = await desktopDatabase(IMAGE_DB, IMAGE_STORE);
    try {
      return await new Promise<StoredDesktopImage[]>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE, "readonly");
        const request = tx.objectStore(IMAGE_STORE).openCursor();
        const images: StoredDesktopImage[] = [];
        let totalBytes = 0;
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          const row: unknown = cursor.value;
          try {
            if (!isRecord(row) || !(row.bytes instanceof ArrayBuffer) || row.bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Saved background images are invalid.");
            totalBytes += row.bytes.byteLength;
            if (images.length === MAX_IMAGES || totalBytes > MAX_STATE_BYTES) throw new Error("Saved background images exceed the desktop state limit.");
            images.push({ ...imageMetadata(row), bytes: row.bytes });
            cursor.continue();
          } catch (error) { reject(error); tx.abort(); }
        };
        tx.oncomplete = () => resolve(images);
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  },
  async addMissing(images) {
    const db = await desktopDatabase(IMAGE_DB, IMAGE_STORE);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IMAGE_STORE, "readwrite");
        const store = tx.objectStore(IMAGE_STORE);
        for (const image of images) {
          const request = store.get(image.id);
          request.onsuccess = () => { if (request.result === undefined) store.add(image); };
        }
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  },
};
