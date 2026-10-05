import { type RefObject, useEffect, useLayoutEffect } from "react";

import { loadDiffs } from "@/components/diff/load";
import { useActiveTheme } from "@/hooks/use-theme";
import { syntaxThemes } from "@/themes/apply";

// Code blocks in an agent's reply, coloured as the diffs are: the theme's
// own Shiki theme, tokenized in the diff renderer's workers. Nothing loads
// until a reply with a fenced block shows. Only the colours change, never
// the text or its box: the block is the same <code> with spans in it, so
// it selects, copies and sizes as before, and nothing moves when they
// arrive.

// Longer blocks stay plain: tokenizing them costs more than it gives.
const MAX_LINES = 2000;
// While a reply streams in, its last block changes; wait for a pause.
const SETTLE = 250;

// Highlighted blocks by theme, language and text, so a chat scrolled back
// over, or a reply drawn again, is coloured at once.
const cache = new Map<string, string | null>();
const CACHE_MAX = 400;

function remember(key: string, html: string | null) {
  cache.delete(key);
  cache.set(key, html);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

// Fence names Shiki doesn't know by that name.
const ALIASES: Record<string, string> = { sh: "bash", shell: "bash", zsh: "bash", console: "shellsession", golang: "go", patch: "diff", yml: "yaml", "c++": "cpp", tsx: "tsx", plaintext: "text", txt: "text" };

// guess names the language of a block whose fence doesn't: only the
// unmistakable ones, plain text otherwise.
export function guessLanguage(code: string): string {
  const t = code.trim();
  if (/^(diff --git |--- a\/|@@ -\d)/m.test(t) && /^[+-]/m.test(t)) return "diff";
  if (/^[[{]/.test(t)) {
    try {
      JSON.parse(t);
      return "json";
    } catch {}
  }
  if (/^\$ /m.test(t)) return "shellsession";
  if (/^#!.*\b(ba|z)?sh\b/.test(t) || /^(cd|git|npm|pnpm|yarn|brew|curl|make|go (run|build|test)|export \w+=|sudo) /m.test(t)) return "bash";
  if (/^package \w+$/m.test(t) && /\bfunc\b/.test(t)) return "go";
  if (/^(import|export) .+ from ["']/m.test(t) || /^(interface|type) \w+.*[={]/m.test(t)) return "typescript";
  if (/^(def|class) \w+.*:$/m.test(t) || /^from \w+ import /m.test(t)) return "python";
  if (/^\s*fn \w+|^use \w+(::\w+)+;/m.test(t)) return "rust";
  return "text";
}

function languageOf(code: HTMLElement, text: string): string {
  const named = /\blanguage-([\w#+.-]+)/.exec(code.className)?.[1]?.toLowerCase();
  if (!named) return guessLanguage(text);
  return ALIASES[named] ?? named;
}

// useCodeHighlight colours the code blocks under ref whenever its HTML (or
// the theme) changes.
export function useCodeHighlight(ref: RefObject<HTMLElement | null>, html: string) {
  const { dark, light } = syntaxThemes(useActiveTheme());
  const themeKey = `${dark}|${light}`;

  // Blocks already done in this theme colour before paint, no flash.
  useLayoutEffect(() => {
    for (const { el, key } of blocks(ref.current, themeKey)) {
      const done = cache.get(key);
      if (done) el.innerHTML = done;
    }
  }, [ref, html, themeKey]);

  useEffect(() => {
    const todo = blocks(ref.current, themeKey).filter(({ key }) => !cache.has(key));
    if (!todo.length) return;
    let live = true;
    const timer = window.setTimeout(async () => {
      const mod = await loadDiffs().catch(() => undefined);
      for (const { el, key, text, lang } of todo) {
        if (!live || !mod) return;
        const out = await mod.highlightCode(text, lang, { dark, light }).catch(() => undefined);
        remember(key, out ?? null);
        // The block may have been drawn again, or changed, meanwhile.
        if (live && out && el.isConnected && el.textContent === text) el.innerHTML = out;
      }
    }, SETTLE);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [ref, html, themeKey, dark, light]);
}

function blocks(root: HTMLElement | null, themeKey: string) {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>("pre > code")].flatMap((el) => {
    const text = el.textContent ?? "";
    if (!text.trim() || text.split("\n").length > MAX_LINES) return [];
    const lang = languageOf(el, text);
    if (lang === "text") return [];
    return [{ el, text, lang, key: `${themeKey}|${lang}|${text}` }];
  });
}
