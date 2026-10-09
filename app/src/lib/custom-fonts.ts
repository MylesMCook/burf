import { useMemo } from "react";
import { create } from "zustand";

import { type CustomFontInfo, fontFamily, validateFontFile } from "@/lib/custom-font-file";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { DEFAULT_TERMINAL_PREFS } from "@/lib/terminal";

const DB = "berth-custom-fonts";
const STORE = "fonts";
const SANS = "'Inter Variable', sans-serif";
const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const faces = new Map<string, FontFace>();
export const useCustomFonts = create<{ status: Record<string, "loaded" | "failed"> }>(() => ({ status: {} }));

// Like chat pictures, font bytes are ArrayBuffers in IndexedDB. WebKit
// cannot keep Blobs in some stores. Wait for commit before changing prefs.
async function stored<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function status(id: string, value: "loaded" | "failed") {
  useCustomFonts.setState((s) => ({ status: { ...s.status, [id]: value } }));
}

function clearUses(id: string) {
  const p = usePrefs.getState();
  setPrefs({
    ...(p.interfaceFont === id ? { interfaceFont: null } : {}),
    ...(p.codeFont === id ? { codeFont: null } : {}),
    ...(p.terminalFont === id ? { terminalFont: null, terminal: { ...p.terminal, fontFamily: DEFAULT_TERMINAL_PREFS.fontFamily } } : {}),
  });
}

function stack(id: string | null, fallback: string): string {
  return id && useCustomFonts.getState().status[id] === "loaded" ? `"${fontFamily(id)}", ${fallback}` : fallback;
}

function applyFonts() {
  const p = usePrefs.getState();
  const root = document.documentElement;
  root.style.setProperty("--font-sans", stack(p.interfaceFont, SANS));
  root.style.setProperty("--font-mono", stack(p.codeFont, MONO));
}

// The first draw uses the built-in stacks. Stored fonts arrive without
// holding up startup, and a failed font remains named in Settings.
export function initCustomFonts() {
  applyFonts();
  usePrefs.subscribe((p, prev) => {
    if (p.interfaceFont !== prev.interfaceFont || p.codeFont !== prev.codeFont) applyFonts();
  });
  useCustomFonts.subscribe(applyFonts);
  const p = usePrefs.getState();
  for (const id of [p.interfaceFont, p.codeFont, p.terminalFont]) {
    if (id && !p.customFonts.some((font) => font.id === id)) clearUses(id);
  }
  for (const font of p.customFonts) void loadStoredFont(font);
}

async function loadStoredFont(font: CustomFontInfo) {
  try {
    const record = await stored<{ id: string; bytes: ArrayBuffer } | undefined>("readonly", (s) => s.get(font.id));
    if (!record) throw new Error("Missing font");
    const face = await new FontFace(fontFamily(font.id), record.bytes).load();
    if (!usePrefs.getState().customFonts.some((f) => f.id === font.id)) return;
    document.fonts.add(face);
    faces.set(font.id, face);
    status(font.id, "loaded");
  } catch {
    if (!usePrefs.getState().customFonts.some((f) => f.id === font.id)) return;
    clearUses(font.id);
    status(font.id, "failed");
  }
}

export async function addCustomFont(file: File): Promise<void> {
  const name = validateFontFile(file.name, file.size, new Uint8Array(await file.slice(0, 4).arrayBuffer()));
  if (usePrefs.getState().customFonts.some((f) => f.name === name)) throw new Error(`A font named “${name}” is already added. Remove it first to replace it.`);
  const info: CustomFontInfo = { id: crypto.randomUUID(), name };
  const bytes = await file.arrayBuffer();
  let face: FontFace;
  try {
    face = await new FontFace(fontFamily(info.id), bytes).load();
  } catch {
    throw new Error(`“${name}” could not be loaded. Try another font file.`);
  }
  try {
    await stored("readwrite", (s) => s.put({ id: info.id, bytes }));
  } catch {
    throw new Error("The font could not be saved on this computer. Try adding it again.");
  }
  document.fonts.add(face);
  faces.set(info.id, face);
  status(info.id, "loaded");
  setPrefs({ customFonts: [...usePrefs.getState().customFonts, info] });
}

export async function removeCustomFont(id: string): Promise<void> {
  try {
    await stored("readwrite", (s) => s.delete(id));
  } catch {
    throw new Error("The font could not be removed. Try again.");
  }
  clearUses(id);
  setPrefs({ customFonts: usePrefs.getState().customFonts.filter((f) => f.id !== id) });
  const face = faces.get(id);
  if (face) document.fonts.delete(face);
  faces.delete(id);
  useCustomFonts.setState((s) => {
    const next = { ...s.status };
    delete next[id];
    return { status: next };
  });
}

// The default terminal follows Code font. A terminal-specific pick wins;
// only its id is saved, so the stored terminal stack stays compatible.
export function useCustomTerminalPrefs() {
  const terminal = usePrefs((p) => p.terminal);
  const code = usePrefs((p) => p.codeFont);
  const chosen = usePrefs((p) => p.terminalFont);
  const loaded = useCustomFonts((s) => s.status[chosen ?? code ?? ""] === "loaded");
  const id = chosen ?? (terminal.fontFamily === DEFAULT_TERMINAL_PREFS.fontFamily ? code : null);
  return useMemo(() => loaded && id ? { ...terminal, fontFamily: stack(id, DEFAULT_TERMINAL_PREFS.fontFamily) } : terminal, [terminal, id, loaded]);
}
