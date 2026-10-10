import * as stylex from "@stylexjs/stylex";
import { CopyIcon } from "lucide-react";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { memo, useMemo, useRef } from "react";

import { guessLanguage, languageName, useCodeHighlight } from "@/components/conversation/code-highlight";
import { Tip } from "@/components/tip";
import { copyText } from "@/lib/clipboard";
import { caretAfter } from "@/lib/draft-text";
import { openUrl } from "@/lib/open-url";

const paint = stylex.create({
  s0: {
    "position": "relative",
  },
  s1: {
    "marginTop": "4px",
    "display": "flex",
    "height": "24px",
    "opacity": {
      "default": 0,
      ":focus-within": 1,
    },
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    ":is(.group\\/md:hover &)": {
      "opacity": 1,
    },
  },
  s2: {
    "visibility": "hidden",
  },
  s3: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s4: {
    "width": "14px",
    "height": "14px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Markdown draws an agent's reply as the agent wrote it: headings, lists,
// tables, code, bold and links, as its terminal does. micromark escapes any
// HTML in the text, so a reply can't inject markup; links open outside.
//
// The text is selectable (the app otherwise isn't), code blocks take the
// theme's syntax colours once they've drawn (code-highlight.ts), every
// code block has its own Copy, and the reply's Copy takes the Markdown
// itself, so tables and lists survive a paste into an issue or an editor.

// A code block's head: its language, and Copy (lucide's copy and check).
const ICON = (d: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const COPY_ICON = ICON('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');
const DONE_ICON = ICON('<path d="M20 6 9 17l-5-5"/>');
const COPY_CODE = `<button type="button" class="cv-copy-code" data-copy-code aria-label="Copy code"><span class="cv-copy-idle">${COPY_ICON}Copy</span><span class="cv-copy-done">${DONE_ICON}Copied</span></button>`;

const unescape = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

// codeBlock wraps a fenced block in its frame, headed by its language as
// the fence names it or, unnamed, as code-highlight guesses it.
const codeBlock = (_: string, attrs: string, lang: string | undefined, body: string) => {
  const name = languageName(lang?.toLowerCase() ?? guessLanguage(unescape(body)));
  const head = `<div class="cv-pre-head"><span class="cv-pre-lang">${name}</span>${COPY_CODE}</div>`;
  return `<div class="cv-pre">${head}<pre><code${attrs}>${body}</code></pre></div>`;
};

// A draft (the reply as the agent's screen shows it while it writes) ends
// in a caret, says "…" above when its start is off the screen, and keeps
// the room its Copy will take, so the message that replaces it lands in
// place: the same element, its words swapped (lib/draft-text).
const CARET = '<span class="cv-caret" aria-hidden="true"></span>';

// Replies drawn before, by their words: a long chat's rows come and go as
// it scrolls, and one scrolled back to draws without parsing again. Drafts
// change with every read, so they aren't kept.
const drawn = new Map<string, string>();
const DRAWN_MAX = 300;

function toHtml(text: string, draft: boolean): string {
  const kept = draft ? undefined : drawn.get(text);
  if (kept !== undefined) {
    // Most recently used last, so the oldest go first.
    drawn.delete(text);
    drawn.set(text, kept);
    return kept;
  }
  const out = micromark(text, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })
    // Wide tables scroll on their own instead of widening the column.
    .replace(/<table>/g, '<div class="cv-table"><table>')
    .replace(/<\/table>/g, "</table></div>")
    .replace(/<pre><code((?: class="language-([^"]+)")?)>([\s\S]*?)<\/code><\/pre>/g, codeBlock);
  // A draft's code blocks name no language: its screen doesn't say, and
  // a guess would change when the message lands.
  if (draft) return caretAfter(out.replace(/<span class="cv-pre-lang">[^<]*<\/span>/g, '<span class="cv-pre-lang"></span>'), CARET);
  drawn.set(text, out);
  if (drawn.size > DRAWN_MAX) drawn.delete(drawn.keys().next().value as string);
  return out;
}

export const Markdown = memo(function Markdown({ text, copy = true, draft = false, clipped = false }: { text: string; copy?: boolean; draft?: boolean; clipped?: boolean }) {
  const html = useMemo(() => toHtml(text, draft), [text, draft]);
  const body = useRef<HTMLDivElement>(null);
  useCodeHighlight(body, html);
  return (
    <div className={[sx(paint.s0), "group/md cv-in"].filter(Boolean).join(" ")} data-draft={draft ? "" : undefined} aria-busy={draft || undefined} aria-description={draft ? "Still being written: as the agent's screen shows it" : undefined}>
      {draft && clipped && (
        <p className="cv-clipped">
          <span aria-hidden>…</span> Its start is above the agent's screen: the whole reply shows once it's written
        </p>
      )}
      <div
        ref={body}
        className="cv-md"
        data-selectable
        // biome-ignore lint/security/noDangerouslySetInnerHtml: micromark escapes HTML in the source.
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(e) => {
          const el = e.target as HTMLElement;
          const code = el.closest<HTMLElement>("[data-copy-code]");
          if (code) {
            const pre = code.closest(".cv-pre")?.querySelector("pre");
            if (pre) void copyText(pre.textContent ?? "", "Copied the code");
            // "Copied" for a moment, where the pointer is.
            code.dataset.copied = "";
            window.clearTimeout(Number(code.dataset.timer));
            code.dataset.timer = String(window.setTimeout(() => delete code.dataset.copied, 1600));
            return;
          }
          const a = el.closest("a");
          const href = a?.getAttribute("href");
          if (!href) return;
          e.preventDefault();
          if (/^https?:\/\//.test(href)) void openUrl(href);
        }}
      />
      {copy && (
        <div className={[sx(paint.s1), draft && sx(paint.s2)].filter(Boolean).join(" ")} aria-hidden={draft || undefined}>
          <Tip label="Copy as Markdown">
            <button type="button" aria-label="Copy reply" onClick={() => void copyText(text, "Copied the reply")} className={sx(paint.s3)}>
              <CopyIcon className={sx(paint.s4)} />
            </button>
          </Tip>
        </div>
      )}
    </div>
  );
});
