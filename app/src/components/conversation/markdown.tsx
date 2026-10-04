import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { memo, useMemo } from "react";

import { openUrl } from "@/lib/open-url";

// Markdown draws an agent's reply as the agent wrote it: headings, lists,
// tables, code, bold and links, as its terminal does. micromark escapes any
// HTML in the text, so a reply can't inject markup; links open outside.

export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const html = useMemo(
    () =>
      micromark(text, { extensions: [gfm()], htmlExtensions: [gfmHtml()] })
        // Wide tables scroll on their own instead of widening the column.
        .replace(/<table>/g, '<div class="cv-table"><table>')
        .replace(/<\/table>/g, "</table></div>"),
    [text],
  );
  return (
    <div
      className="cv-md cv-in"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: micromark escapes HTML in the source.
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        const href = a?.getAttribute("href");
        if (!href) return;
        e.preventDefault();
        if (/^https?:\/\//.test(href)) void openUrl(href);
      }}
    />
  );
});
