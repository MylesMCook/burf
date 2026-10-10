import * as stylex from "@stylexjs/stylex";
import { Icon, Tip } from "@berth/plugin/ui";
import type { ReactNode } from "react";

import { stripComments } from "./gh";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "12px",
    "fontSize": "13px",
    "lineHeight": "1.625",
    "overflowWrap": "anywhere",
  },
  s1: {
    "overflowX": "auto",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "1.5",
  },
  s2: {
    "fontWeight": 600,
  },
  s3: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingBottom": "4px",
  },
  s4: {
    "borderColor": "var(--border)",
  },
  s5: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "borderLeftWidth": 2,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
    "paddingLeft": "12px",
    "color": "var(--muted-foreground)",
  },
  s6: {
    "overflowX": "auto",
  },
  s7: {
    "width": "100%",
    "fontSize": "12px",
  },
  s8: {
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "textAlign": "left",
    "fontWeight": 500,
  },
  s9: {
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "verticalAlign": "top",
  },
  s10: {
    "whiteSpace": "pre-line",
  },
  s11: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
    "paddingLeft": "20px",
  },
  s12: {
    "listStyleType": "decimal",
  },
  s13: {
    "listStyleType": "disc",
  },
  s14: {
    "marginLeft": "calc(20px * -1)",
    "listStyleType": "none",
  },
  s15: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "8px",
  },
  s16: {
    "marginTop": "3px",
    "display": "grid",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "placeItems": "center",
    "borderRadius": "4px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s17: {
    "borderColor": "var(--primary)",
    "backgroundColor": "var(--primary)",
    "color": "var(--primary-foreground)",
  },
  s18: {
    "width": "10px",
    "height": "10px",
  },
  s19: {
    "color": "var(--muted-foreground)",
    "textDecoration": "line-through",
  },
  s20: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
  },
  s21: {
    "fontWeight": 600,
  },
  s22: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s23: {
    "wordBreak": "break-all",
    "fontFamily": "var(--font-mono)",
  },
  s24: {
    "display": "inline-flex",
    "alignItems": "baseline",
    "gap": "4px",
    "color": "var(--info-foreground)",
    "textDecoration": {
      ":hover": "underline",
    },
  },
  s25: {
    "width": "12px",
    "height": "12px",
    "alignSelf": "center",
  },
  q26: {
    "borderCollapse": "collapse",
  },
  q27: {
    "textDecorationColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  q29: {
    "textUnderlineOffset": "2px",
  },
  h15: { fontSize: "15px" },
  h13: { fontSize: "13px" },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A small GitHub-flavoured Markdown renderer for issue bodies and comments.
// It builds React elements and never sets HTML, so whatever an issue says is
// only ever text: raw HTML tags are dropped (their text kept), and only
// http(s) links become links, opened outside the app with onLink.

interface Ctx {
  repo: string;
  onLink(url: string): void;
}

export function Markdown({ source, repo, onLink, className }: { source: string; repo: string; onLink(url: string): void; className?: string }) {
  const ctx = { repo, onLink };
  return <div className={[sx(paint.s0), className].filter(Boolean).join(" ")}>{blocks(clean(source), ctx)}</div>;
}

// clean drops comments and turns the little HTML GitHub bodies use into
// Markdown, or into nothing.
function clean(s: string) {
  return stripComments(s.replace(/\r\n?/g, "\n"))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(details|summary|p|div|span|sub|sup|kbd|picture|source|center)[^>]*>/gi, "")
    .replace(/<img\b[^>]*?(?:alt="([^"]*)")?[^>]*?src="([^"]+)"[^>]*>/gi, (_, alt: string | undefined, src: string) => `![${alt ?? "image"}](${src})`)
    .replace(/<\/?[a-z][^>]*>/gi, "");
}

const fence = /^\s{0,3}(`{3,}|~{3,})\s*([\w+-]*)/;
const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const rule = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const quoteLine = /^\s{0,3}>\s?(.*)$/;
const tableSep = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function blocks(src: string, ctx: Ctx): ReactNode[] {
  const lines = src.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const f = fence.exec(line);
    if (f) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(f[1])) code.push(lines[i++]);
      i++;
      out.push(
        <pre key={key++} className={sx(paint.s1)}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = heading.exec(line);
    if (h) {
      const size = h[1].length <= 2 ? sx(paint.h15) : sx(paint.h13);
      out.push(
        <p key={key++} role="heading" aria-level={h[1].length} className={[sx(paint.s2), size, h[1].length <= 2 && sx(paint.s3)].filter(Boolean).join(" ")}>
          {inline(h[2], ctx)}
        </p>,
      );
      i++;
      continue;
    }
    if (rule.test(line)) {
      out.push(<hr key={key++} className={sx(paint.s4)} />);
      i++;
      continue;
    }
    if (quoteLine.test(line)) {
      const q: string[] = [];
      while (i < lines.length && lines[i].trim() && quoteLine.test(lines[i])) q.push(quoteLine.exec(lines[i++])![1]);
      out.push(
        <blockquote key={key++} className={sx(paint.s5)}>
          {blocks(q.join("\n"), ctx)}
        </blockquote>,
      );
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && tableSep.test(lines[i + 1])) {
      const rows: string[][] = [cells(line)];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(
        <div key={key++} className={sx(paint.s6)}>
          <table className={[sx(paint.s7), sx(paint.q26)].filter(Boolean).join(" ")}>
            <thead>
              <tr>
                {rows[0].map((c, j) => (
                  <th key={j} className={sx(paint.s8)}>
                    {inline(c, ctx)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, j) => (
                    <td key={j} className={sx(paint.s9)}>
                      {inline(c, ctx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (item.test(line)) {
      const items: { depth: number; ordered: boolean; text: string }[] = [];
      while (i < lines.length) {
        const m = item.exec(lines[i]);
        if (m) {
          items.push({ depth: Math.floor(m[1].replace(/\t/g, "  ").length / 2), ordered: /\d/.test(m[2]), text: m[3] });
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1].text += ` ${lines[i++].trim()}`;
        } else break;
      }
      out.push(list(items, ctx, key++));
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !fence.test(lines[i]) && !heading.test(lines[i]) && !quoteLine.test(lines[i]) && !(para.length && item.test(lines[i]))) para.push(lines[i++]);
    out.push(
      <p key={key++} className={sx(paint.s10)}>
        {inline(para.join("\n"), ctx)}
      </p>,
    );
  }
  return out;
}

function cells(row: string) {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function list(items: { depth: number; ordered: boolean; text: string }[], ctx: Ctx, key: number) {
  const ordered = items[0]?.ordered;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag key={key} className={[sx(paint.s11), ordered ? sx(paint.s12) : sx(paint.s13)].filter(Boolean).join(" ")}>
      {items.map((it, j) => {
        const task = /^\[([ xX])\]\s+(.*)$/.exec(it.text);
        return (
          <li key={j} style={{ marginLeft: `${it.depth * 1.1}rem` }} className={task ? sx(paint.s14) : undefined}>
            {task ? (
              <span className={sx(paint.s15)}>
                <span className={[sx(paint.s16), task[1] !== " " && sx(paint.s17)].filter(Boolean).join(" ")}>
                  {task[1] !== " " && <Icon name="Check" className={sx(paint.s18)} />}
                </span>
                <span className={task[1] !== " " ? [sx(paint.s19), sx(paint.q27)].filter(Boolean).join(" ") : undefined}>{inline(task[2], ctx)}</span>
              </span>
            ) : (
              inline(it.text, ctx)
            )}
          </li>
        );
      })}
    </Tag>
  );
}

// One pass over a line's inline syntax; the earliest match wins, and its
// inside is rendered again (bold inside a link, and so on).
const INLINE =
  /(`+)([^`][\s\S]*?)\1|!\[([^\]]*)\]\(([^)\s]+)[^)]*\)|\[([^\]]+)\]\(([^)\s]+)[^)]*\)|\*\*([^*][\s\S]*?)\*\*|__([^_][\s\S]*?)__|~~([\s\S]+?)~~|(?<![\w*])\*(?![\s*])([^*\n]+?)\*(?![\w*])|(?<![\w_])_(?![\s_])([^_\n]+?)_(?![\w_])|(https?:\/\/[^\s<>()[\]]+[^\s<>()[\].,;:!?'"])|(?<![\w/&#])#(\d+)\b|(?<![\w`/])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\b/g;

const safe = (url: string) => /^https?:\/\//i.test(url);

function inline(text: string, ctx: Ctx): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    last = at + m[0].length;
    const k = key++;
    if (m[2] !== undefined) {
      out.push(
        <code key={k} className={sx(paint.s20)}>
          {m[2].trim()}
        </code>,
      );
    } else if (m[4] !== undefined) {
      const url = m[4];
      out.push(safe(url) ? <Link key={k} url={url} ctx={ctx} icon="Image">{m[3] || "image"}</Link> : <span key={k}>{m[3]}</span>);
    } else if (m[6] !== undefined) {
      out.push(safe(m[6]) ? <Link key={k} url={m[6]} ctx={ctx}>{inline(m[5], ctx)}</Link> : <span key={k}>{inline(m[5], ctx)}</span>);
    } else if (m[7] !== undefined || m[8] !== undefined) {
      out.push(
        <strong key={k} className={sx(paint.s21)}>
          {inline(m[7] ?? m[8], ctx)}
        </strong>,
      );
    } else if (m[9] !== undefined) {
      out.push(<s key={k}>{inline(m[9], ctx)}</s>);
    } else if (m[10] !== undefined || m[11] !== undefined) {
      out.push(<em key={k}>{inline(m[10] ?? m[11], ctx)}</em>);
    } else if (m[12] !== undefined) {
      out.push(
        <Link key={k} url={m[12]} ctx={ctx}>
          {shortUrl(m[12])}
        </Link>,
      );
    } else if (m[13] !== undefined) {
      out.push(
        <Link key={k} url={`https://github.com/${ctx.repo}/issues/${m[13]}`} ctx={ctx}>
          #{m[13]}
        </Link>,
      );
    } else if (m[14] !== undefined) {
      out.push(
        <span key={k} className={sx(paint.s22)}>
          @{m[14]}
        </span>,
      );
    }
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// github.com/owner/repo/pull/12 reads as owner/repo#12, as GitHub shows it.
function shortUrl(url: string) {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/(\d+)\/?$/.exec(url);
  return m ? `${m[1]}#${m[2]}` : url.replace(/^https?:\/\//, "");
}

function Link({ url, ctx, icon, children }: { url: string; ctx: Ctx; icon?: string; children: ReactNode }) {
  return (
    <Tip label={<span className={sx(paint.s23)}>{url}</span>} width="md">
      <a
        href={url}
        onClick={(e) => {
          e.preventDefault();
          ctx.onLink(url);
        }}
        className={[sx(paint.s24), sx(paint.q29)].filter(Boolean).join(" ")}
      >
        {icon && <Icon name={icon} className={sx(paint.s25)} />}
        {children}
      </a>
    </Tip>
  );
}
