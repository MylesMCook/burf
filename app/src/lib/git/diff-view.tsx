import * as stylex from "@stylexjs/stylex";
import { MessageSquarePlusIcon, MessageSquareTextIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PickOne } from "@/components/pick-one";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import type { ExecResult } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { committedDiffCommand, describeCode, type DiffLine, diffCommand, type FileChange, parseDiff, splitRows } from "@/lib/git/parse";
import { COMMENT_LIMIT, type LineComment } from "@/lib/review-comments";
import { load, save } from "@/lib/storage";

const paint = stylex.create({
  s0: {
    "color": "var(--success-foreground)",
  },
  s1: {
    "color": "var(--success-foreground)",
  },
  s2: {
    "color": "var(--destructive-foreground)",
  },
  s3: {
    "color": "var(--warning)",
  },
  s4: {
    "color": "var(--info)",
  },
  s5: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "textAlign": "left",
    "fontSize": "12px",
    "lineHeight": "16px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s6: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s7: {
    "width": "12px",
    "flexShrink": 0,
    "textAlign": "center",
    "fontFamily": "var(--font-mono)",
    "fontWeight": 600,
  },
  s8: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s9: {
    "marginLeft": "6px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "2px",
    "fontSize": "11px",
    "color": "var(--primary)",
    "fontVariantNumeric": "tabular-nums",
  },
  s11: {
    "width": "12px",
    "height": "12px",
  },
  s12: {
    "color": "var(--muted-foreground)",
  },
  s13: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s14: {
    "color": "var(--success-foreground)",
  },
  s15: {
    "color": "var(--destructive-foreground)",
  },
  s16: {
    "display": "flex",
    "minHeight": "0px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s17: {
    "display": "flex",
    "height": "36px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s19: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "auto",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "20px",
    "fontVariantLigatures": "none",
  },
  s20: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontFamily": "var(--font-sans)",
    "color": "var(--warning)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontFamily": "var(--font-sans)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "display": "flex",
    "height": "100%",
    "minHeight": "128px",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "padding": "24px",
    "fontFamily": "var(--font-sans)",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s23: {
    "backgroundColor": "color-mix(in oklab, var(--success) 10%, transparent)",
  },
  s24: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 10%, transparent)",
  },
  s25: {
    "backgroundColor": "color-mix(in oklab, var(--info) 8%, transparent)",
    "color": "var(--info)",
  },
  s26: {
    "color": "var(--muted-foreground)",
    "fontStyle": "italic",
  },
  s27: {
    "width": "44px",
    "flexShrink": 0,
    "userSelect": "none",
    "paddingRight": "8px",
    "textAlign": "right",
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s28: {
    "minWidth": "fit-content",
  },
  s29: {
    "display": "flex",
    "whiteSpace": "pre",
  },
  s30: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s31: {
    "position": "relative",
    "display": "flex",
    "whiteSpace": "pre",
  },
  s32: {
    "position": "absolute",
    "top": "2px",
    "left": "2px",
    "zIndex": 10,
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--primary)",
    "color": "var(--primary-foreground)",
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "outline": "none",
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
    ":is(.group\\/line:hover &)": {
      "opacity": 1,
    },
  },
  s33: {
    "width": "12px",
    "height": "12px",
  },
  s34: {
    "width": "16px",
    "flexShrink": 0,
    "userSelect": "none",
    "color": "var(--muted-foreground)",
  },
  s35: {
    "paddingRight": "16px",
  },
  s36: {
    "position": "sticky",
    "left": "0px",
    "display": "flex",
    "width": "100%",
    "maxWidth": "min(100%,560px)",
    "alignItems": "flex-start",
    "gap": "8px",
    "borderColor": "color-mix(in oklab, var(--primary) 60%, transparent)",
    "borderLeftWidth": 2,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "paddingRight": "8px",
    "paddingLeft": "12px",
    "fontFamily": "var(--font-sans)",
    "fontSize": "12.5px",
    "lineHeight": "1.375",
  },
  s37: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
  },
  s38: {
    "color": "var(--muted-foreground)",
  },
  s39: {
    "marginTop": "calc(2px * -1)",
    "marginBottom": "calc(2px * -1)",
    "flexShrink": 0,
  },
  s40: {
    "position": "sticky",
    "left": "0px",
    "display": "flex",
    "width": "100%",
    "maxWidth": "min(100%,560px)",
    "flexDirection": "column",
    "gap": "8px",
    "borderColor": "var(--primary)",
    "borderLeftWidth": 2,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "paddingRight": "8px",
    "paddingLeft": "12px",
    "fontFamily": "var(--font-sans)",
  },
  s41: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s42: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s43: {
    "marginLeft": "auto",
  },
  s44: {
    "minWidth": "fit-content",
  },
  s45: {
    "whiteSpace": "pre",
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s46: {
    "display": "grid",
    "gridTemplateColumns": "repeat(2, minmax(0, 1fr))",
  },
  s47: {
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
  },
  s48: {
    "display": "flex",
    "minWidth": "0px",
    "whiteSpace": "pre",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s49: {
    "overflow": "hidden",
    "paddingRight": "12px",
  },
  q50: {
    "color": "var(--success-foreground)",
  },
  q51: {
    "color": "var(--success-foreground)",
  },
  q52: {
    "color": "var(--destructive-foreground)",
  },
  q53: {
    "color": "var(--warning)",
  },
  q54: {
    "color": "var(--info)",
  },
  q55: {
    "backgroundColor": "color-mix(in oklab, var(--success) 10%, transparent)",
  },
  q56: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 10%, transparent)",
  },
  q57: {
    "backgroundColor": "color-mix(in oklab, var(--info) 8%, transparent)",
    "color": "var(--info)",
  },
  q58: {
    "color": "var(--muted-foreground)",
    "fontStyle": "italic",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The app's diff viewer: a file list and a unified or split diff, read with
// git on the box. The built-in Git changes plugin draws the same thing with
// the plugin kit; both parse with lib/git/parse.

export type Run = (command: string) => Promise<ExecResult>;

const toneClass = { add: sx(paint.q50), new: sx(paint.q51), del: sx(paint.q52), mod: sx(paint.q53), ren: sx(paint.q54) } as const;

export function FileRow({ file, active, onSelect, comments }: { file: FileChange; active: boolean; onSelect(): void; comments?: number }) {
  const { label, tone } = describeCode(file.code);
  const slash = file.path.lastIndexOf("/");
  const name = file.path.slice(slash + 1);
  const dir = slash > 0 ? file.path.slice(0, slash) : "";
  return (
    <li>
      <Tip side="right" label={`${label}: ${file.from ? `${file.from} → ` : ""}${file.path}`}>
        <button
          type="button"
          onClick={onSelect}
          className={[sx(paint.s5), active && sx(paint.s6)].filter(Boolean).join(" ")}
        >
          <span className={[sx(paint.s7), toneClass[tone]].filter(Boolean).join(" ")}>{file.code === "??" ? "U" : file.code.trim()[0]}</span>
          <span className={sx(paint.s8)}>
            {name}
            {dir && <span className={sx(paint.s9)}>{dir}</span>}
          </span>
          {!!comments && (
            <span className={sx(paint.s10)} aria-label={`${comments} comment${comments === 1 ? "" : "s"}`}>
              <MessageSquareTextIcon className={sx(paint.s11)} />
              {comments}
            </span>
          )}
          {file.binary ? (
            <span className={sx(paint.s12)}>bin</span>
          ) : (
            <span className={sx(paint.s13)}>
              <span className={sx(paint.s14)}>+{file.added ?? 0}</span> <span className={sx(paint.s15)}>−{file.removed ?? 0}</span>
            </span>
          )}
        </button>
      </Tip>
    </li>
  );
}

type Load<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: T };

const MODE_KEY = "berth.diff.mode";

// DiffView shows one file's diff: against HEAD, or, with base, what the
// branch's commits changed since it left base.
export function DiffView({ file, run, base, comments }: { file: FileChange; run: Run; base?: string; comments?: LineComments }) {
  const [diff, setDiff] = useState<Load<{ lines: DiffLine[]; truncated?: boolean }>>({ state: "loading" });
  const [mode, setMode] = useState<"unified" | "split">(() => load(MODE_KEY, "unified"));

  useEffect(() => {
    let live = true;
    setDiff({ state: "loading" });
    run(base ? committedDiffCommand(file, base) : diffCommand(file))
      .then((r) => live && setDiff({ state: "ready", value: { lines: parseDiff(r.output), truncated: r.truncated } }))
      .catch((err) => live && setDiff({ state: "error", message: plainError(err) }));
    return () => {
      live = false;
    };
  }, [file, run, base]);

  return (
    <section className={sx(paint.s16)}>
      <div className={sx(paint.s17)}>
        <span className={sx(paint.s18)}>{file.from ? `${file.from} → ${file.path}` : file.path}</span>
        <Badge variant="outline" size="sm" >
          {describeCode(file.code).label}
        </Badge>
        <PickOne<"unified" | "split">
          label="Diff layout"
          align="end"
          value={mode}
          onChange={(m) => {
            setMode(m);
            save(MODE_KEY, m);
          }}
          options={[
            { value: "unified", label: "Unified" },
            { value: "split", label: "Split" },
          ]}
        />
      </div>
      <div className={sx(paint.s19)}>
        {diff.state === "loading" && (
          <Centered>
            <Spinner  size="lg"/>
          </Centered>
        )}
        {diff.state === "error" && <Centered>{diff.message}</Centered>}
        {diff.state === "ready" && diff.value.lines.length === 0 && <Centered>Nothing to show for this file.</Centered>}
        {diff.state === "ready" && diff.value.truncated && <p className={sx(paint.s20)}>Only the end of this diff is shown: it is longer than 64 KB.</p>}
        {diff.state === "ready" && comments && mode === "split" && diff.value.lines.length > 0 && (
          <p className={sx(paint.s21)}>Switch to Unified to comment on a line.</p>
        )}
        {diff.state === "ready" && (mode === "unified" ? <DiffLines lines={diff.value.lines} comments={comments} /> : <Split lines={diff.value.lines} />)}
      </div>
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className={sx(paint.s22)}>{children}</div>;
}

const lineBg = { add: sx(paint.q55), del: sx(paint.q56), ctx: "", hunk: sx(paint.q57), meta: sx(paint.q58) } as const;

function Num({ n }: { n?: number }) {
  return <span className={sx(paint.s27)}>{n ?? ""}</span>;
}

// LineComments lets a person leave notes on a diff's lines for its agent
// (lib/review-comments): the ones for this file, and how to add or drop one.
export interface LineComments {
  list: LineComment[];
  onAdd(line: number, side: "new" | "old", text: string): void;
  onRemove(id: string): void;
}

// DiffLines is a unified diff. With comments, each line has a button in
// its gutter to comment on it, and its comments show beneath it.
export function DiffLines({ lines, comments }: { lines: DiffLine[]; comments?: LineComments }) {
  const [open, setOpen] = useState<string>();
  const at = (l: DiffLine) => (l.kind === "del" ? { side: "old" as const, line: l.oldNo ?? 0 } : { side: "new" as const, line: l.newNo ?? 0 });
  return (
    <div className={sx(paint.s28)}>
      {lines.map((l, i) => {
        if (l.kind === "hunk" || l.kind === "meta") {
          return (
            <div key={i} className={[sx(paint.s29), lineBg[l.kind]].filter(Boolean).join(" ")}>
              <span className={sx(paint.s30)}>{l.text}</span>
            </div>
          );
        }
        const where = at(l);
        const id = `${where.side}:${where.line}`;
        const here = comments?.list.filter((c) => c.side === where.side && c.line === where.line) ?? [];
        return (
          <div key={i}>
            <div className={[[sx(paint.s31), "group/line"].filter(Boolean).join(" "), lineBg[l.kind]].filter(Boolean).join(" ")}>
              {comments && (
                <button
                  type="button"
                  aria-label={`Comment on line ${where.line}`}
                  onClick={() => setOpen(open === id ? undefined : id)}
                  className={sx(paint.s32)}
                >
                  <MessageSquarePlusIcon className={sx(paint.s33)} />
                </button>
              )}
              <Num n={l.oldNo} />
              <Num n={l.newNo} />
              <span className={sx(paint.s34)}>{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</span>
              <span className={sx(paint.s35)}>{l.text || " "}</span>
            </div>
            {comments && here.map((c) => <CommentNote key={c.id} c={c} onRemove={() => comments.onRemove(c.id)} />)}
            {comments && open === id && (
              <CommentComposer
                line={where.line}
                onCancel={() => setOpen(undefined)}
                onSave={(text) => {
                  comments.onAdd(where.line, where.side, text);
                  setOpen(undefined);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CommentNote({ c, onRemove }: { c: LineComment; onRemove(): void }) {
  return (
    <div className={sx(paint.s36)}>
      <p className={[sx(paint.s37), c.sent && sx(paint.s38)].filter(Boolean).join(" ")}>{c.text}</p>
      {c.sent ? (
        <Badge variant="outline" size="sm" >
          Sent
        </Badge>
      ) : (
        <Tip label="Delete this comment">
          <span className={sx(paint.s39)}><Button size="icon-xs" variant="ghost" aria-label="Delete this comment"  onClick={onRemove} muted>
            <Trash2Icon />
          </Button></span>
        </Tip>
      )}
    </div>
  );
}

export function CommentComposer({ line, onSave, onCancel }: { line: number; onSave(text: string): void; onCancel(): void }) {
  const [text, setText] = useState("");
  const save = () => text.trim() && onSave(text);
  return (
    <div className={sx(paint.s40)}>
      <Textarea
        autoFocus
        rows={2}
        size="sm"
        maxLength={COMMENT_LIMIT}
        value={text}
        aria-label={`Comment on line ${line}`}
        placeholder="What should the agent change here?"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className={sx(paint.s41)}>
        <span className={sx(paint.s42)}>Line {line} · ⌘↵ to add</span>
        <span className={sx(paint.s43)}><Button size="xs" variant="ghost"  onClick={onCancel}>
          Cancel
        </Button></span>
        <Button size="xs" disabled={!text.trim()} onClick={save}>
          Add comment
        </Button>
      </div>
    </div>
  );
}

function Split({ lines }: { lines: DiffLine[] }) {
  const rows = useMemo(() => splitRows(lines), [lines]);
  return (
    <div className={sx(paint.s44)}>
      {rows.map((r, i) =>
        r.hunk ? (
          <div key={i} className={[sx(paint.s45), lineBg.hunk].filter(Boolean).join(" ")}>
            {r.hunk}
          </div>
        ) : (
          <div key={i} className={sx(paint.s46)}>
            <Half line={r.left} side="old" />
            <Half line={r.right} side="new" />
          </div>
        ),
      )}
    </div>
  );
}

function Half({ line, side }: { line?: DiffLine; side: "old" | "new" }) {
  if (!line) return <div className={sx(paint.s47)} />;
  return (
    <div className={[sx(paint.s48), line.kind !== "ctx" && lineBg[line.kind]].filter(Boolean).join(" ")}>
      <Num n={side === "old" ? line.oldNo : line.newNo} />
      <span className={sx(paint.s49)}>{line.text || " "}</span>
    </div>
  );
}
