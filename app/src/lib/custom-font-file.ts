export interface CustomFontInfo {
  id: string;
  name: string;
}

export const MAX_FONT_BYTES = 5 * 1024 * 1024;

// File names are labels only. CSS families come from Burf's own ids.
export function validateFontFile(name: string, size: number, header: Uint8Array): string {
  if (size > MAX_FONT_BYTES) throw new Error("That file is over 5 MB. Pick a smaller font.");
  if (!/\.woff2?$/i.test(name)) throw new Error("Pick a .woff or .woff2 font file.");
  const label = name.replace(/\.woff2?$/i, "").trim();
  if (!label || /[\u0000-\u001f\u007f]/.test(label)) throw new Error("Give the font file a readable name before adding it.");
  const signature = String.fromCharCode(...header.subarray(0, 4));
  if (size < 4 || (signature !== "wOFF" && signature !== "wOF2")) throw new Error("That file isn't a WOFF font. Pick a .woff or .woff2 font file.");
  return label;
}

export function fontFamily(id: string): string {
  return `BurfFont-${id}`;
}
