import { CopyIcon } from "lucide-react";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { memo, useMemo, useRef } from "react";

import { useCodeHighlight } from "@/components/conversation/code-highlight";
import { Tip } from "@/components/tip";
import { copyText } from "@/lib/clipboard";
import { openUrl } from "@/lib/open-url";

// Markdown draws an agent's reply as the agent wrote it: headings, lists,
// tables, code, bold and links, as its terminal does. micromark escapes any
// HTML in the text, so a reply can't inject markup; links open outside.
//
// The text is selectable (the app otherwise isn't), code blocks take the
// theme's syntax colours once they've drawn (code-highlight.ts), every
// code block has its own Copy, and the reply's Copy takes the Markdown
// itself, so tables and lists survive a paste into an issue or an editor.

const COPY_CODE = '<button type="button" class="cv-copy-code" data-copy-code aria-label="Copy code">Copy</button>';

export const Markdown = memo(function Markdown({ text, copy = true }: { text: string; copy?: boolean }) {
  const html = useMemo(
    () =>
      micromark(text, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })
        // Wide tables scroll on their own instead of widening the column.
        .replace(/<table>/g, '<div class="cv-table"><table>')
        .replace(/<\/table>/g, "</table></div>")
        .replace(/<pre>/g, `<div class="cv-pre">${COPY_CODE}<pre>`)
        .replace(/<\/pre>/g, "</pre></div>"),
    [text],
  );
  const body = useRef<HTMLDivElement>(null);
  useCodeHighlight(body, html);
  return (
    <div className="group/md relative cv-in">
      <div
        ref={body}
        className="cv-md"
        data-selectable
        // biome-ignore lint/security/noDangerouslySetInnerHtml: micromark escapes HTML in the source.
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(e) => {
          const el = e.target as HTMLElement;
          const code = el.closest("[data-copy-code]");
          if (code) {
            const pre = code.parentElement?.querySelector("pre");
            if (pre) void copyText(pre.textContent ?? "", "Copied the code");
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
        <div className="mt-1 flex h-6 opacity-0 transition-opacity focus-within:opacity-100 group-hover/md:opacity-100">
          <Tip label="Copy as Markdown">
            <button type="button" aria-label="Copy reply" onClick={() => void copyText(text, "Copied the reply")} className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <CopyIcon className="size-3.5" />
            </button>
          </Tip>
        </div>
      )}
    </div>
  );
});
