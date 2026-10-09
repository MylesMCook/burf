import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_FONT_BYTES, validateFontFile } from "./custom-font-file.ts";

const header = (text: string) => new TextEncoder().encode(text);

test("WOFF and WOFF2 keep readable file names without the extension", () => {
  assert.equal(validateFontFile("My Mono.woff2", 100, header("wOF2")), "My Mono");
  assert.equal(validateFontFile("Interface.v2.WOFF", MAX_FONT_BYTES, header("wOFF")), "Interface.v2");
  assert.equal(validateFontFile("書体.woff2", 100, header("wOF2")), "書体");
});

test("wrong or incomplete first bytes are refused even with a font extension", () => {
  for (const bytes of ["nope", "wOF", "", "wOFF".toLowerCase()]) {
    assert.throws(() => validateFontFile("Bad.woff2", 100, header(bytes)), /isn't a WOFF font/);
  }
  assert.throws(() => validateFontFile("Short.woff", 3, header("wOFF")), /isn't a WOFF font/);
});

test("files over 5 MB are refused", () => {
  assert.throws(() => validateFontFile("Large.woff2", MAX_FONT_BYTES + 1, header("wOF2")), /over 5 MB/);
});

test("unsupported extensions and empty or unreadable names are refused", () => {
  for (const name of ["Font.ttf", "Font.woff2.txt", "Font"]) {
    assert.throws(() => validateFontFile(name, 100, header("wOFF")), /Pick a .woff/);
  }
  for (const name of [".woff", "  .woff2", "Bad\nname.woff2"]) {
    assert.throws(() => validateFontFile(name, 100, header("wOF2")), /readable name/);
  }
});
