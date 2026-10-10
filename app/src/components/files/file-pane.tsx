import * as stylex from "@stylexjs/stylex";
import { ArrowUpRightIcon, ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, FileX2Icon, GitCompareArrowsIcon, TriangleAlertIcon, WrapTextIcon, XIcon } from "lucide-react";
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { agentName, FileGlyph, useEditorName } from "@/components/files/file-bits";
import { useDiffs } from "@/components/diff/load";
import { ErrorText } from "@/components/error-note";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useActiveTheme } from "@/hooks/use-theme";
import { agentMarks, conflictLines } from "@/lib/file-marks";
import { fileName } from "@/lib/file-match";
import { docKey, type Doc, edit, filesApi, isDirty, keepMine, openDoc, openFile, poll, reload, save, setComparing, setWrap, useFiles } from "@/lib/files";
import { ago } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useWorktreeRef } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "backgroundColor": "var(--background)",
  },
  s1: {
    "alignItems": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s2: {
    "width": "20px",
    "height": "20px",
    "color": "var(--muted-foreground)",
  },
  s3: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s4: {
    "minHeight": "0px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s5: {
    "position": "relative",
    "display": "flex",
    "minHeight": "0px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "backgroundColor": "var(--background)",
  },
  s6: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "2px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "display": "flex",
    "minWidth": "0px",
    "flexShrink": 1,
    "alignItems": "center",
    "gap": "2px",
    "color": "var(--muted-foreground)",
  },
  s8: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s9: {
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
    "opacity": 0.5,
  },
  s10: {
    "display": "flex",
    "minWidth": "0px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s11: {
    "width": "12px",
    "height": "12px",
  },
  s12: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s13: {
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 70%, transparent)",
  },
  s14: {
    "display": "inline-flex",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s15: {
    "width": "14px",
    "height": "14px",
  },
  s16: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s17: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s18: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "width": "12px",
    "height": "12px",
  },
  s21: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "display": "flex",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s23: {
    "marginLeft": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s24: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "paddingLeft": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s25: {
    "width": "12px",
    "height": "12px",
  },
  s26: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s27: {
    "color": "var(--success-foreground)",
  },
  s28: {
    "color": "var(--destructive-foreground)",
  },
  s29: {
    "marginLeft": "2px",
    "display": "flex",
    "alignItems": "center",
  },
  s30: {
    "width": "14px",
    "height": "14px",
  },
  s31: {
    "minWidth": "28px",
    "textAlign": "center",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s32: {
    "width": "14px",
    "height": "14px",
  },
  s33: {
    "marginLeft": "2px",
    "marginRight": "2px",
    "height": "14px",
    "width": "1px",
    "backgroundColor": "var(--border)",
  },
  s34: {
    "width": "14px",
    "height": "14px",
  },
  s35: {
    "display": "flex",
    "flexShrink": 0,
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "borderLeftWidth": 2,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--warning)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "paddingRight": "12px",
    "paddingLeft": "10px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s36: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "gap": "8px",
  },
  s37: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--warning-foreground)",
  },
  s38: {
    "flexShrink": 0,
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s39: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s40: {
    "marginLeft": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
  },
  s41: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s42: {
    "display": "flex",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 6%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s43: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s44: {
    "color": "var(--muted-foreground)",
  },
  s45: {
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s46: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s47: {
    "width": "12px",
    "height": "12px",
  },
  s48: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s49: {
    "width": "14px",
    "height": "14px",
  },
  s50: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "auto",
  },
  s51: {
    "margin": "24px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s52: {
    "margin": "24px",
    "display": "inline-flex",
  },
  s53: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "12px",
    "padding": "24px",
    "textAlign": "center",
  },
  s54: {
    "display": "flex",
    "width": "40px",
    "height": "40px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
  },
  s55: {
    "width": "20px",
    "height": "20px",
  },
  s56: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
  },
  s57: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s58: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s59: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s60: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s61: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "overflow": "auto",
    "backgroundColor": "repeating-conic-gradient(color-mix(in oklab,var(--muted) 70%,transparent) 0% 25%,transparent 0% 50%)",
    "padding": "32px",
  },
  s62: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s63: {
    "maxHeight": "100%",
    "maxWidth": "100%",
    "borderRadius": "var(--radius-sm)",
    "objectFit": "contain",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 8%, transparent)",
  },
  s64: {
    "display": "flex",
    "height": "28px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "12px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },

  s65: {
    "@media (max-width: 1099px)": {
      display: "none",
    },
  },
  s66: {
    "@media (max-width: 759px)": {
      display: "none",
    },
  },
  s67: {
    "@media (max-width: 979px)": {
      display: "none",
    },
  },
  s68: {
    maxWidth: "24rem",
  },
  s69: {
    backgroundSize: "16px 16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The editor is its own chunk: nothing of CodeMirror loads until a File
// tab or the picker's preview shows.
const CodeEditor = lazy(() => import("@/components/files/code-editor"));

interface Props {
  path: string;
  // The worktree the pane belongs to (paneWorktree).
  owner: string;
  visible: boolean;
  onClose(): void;
}

// usePolling asks the box every couple of seconds, while the tab shows,
// whether its file changed; every eighth time also what the agent's turn
// did to it. A tab coming back into view asks at once.
function usePolling(key: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const tick = () => {
      if (document.visibilityState === "visible") void poll(key, ++n % 8 === 0);
    };
    void poll(key, true);
    const id = window.setInterval(tick, 2000);
    const onVis = () => document.visibilityState === "visible" && void poll(key);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [key, active]);
}

// FilePane is a File tab: a file of the pane's worktree in the editor, what
// the agent changed this turn in the margin, and, when the agent writes it
// under your unsaved edits, a banner to choose what to keep.
export function FilePane({ path, owner, visible, onClose }: Props) {
  const ref = useWorktreeRef(owner);
  const key = docKey(owner, path);
  const doc = useFiles((s) => s.docs[key]);
  const wrapPref = useFiles((s) => s.wrap);
  const [narrow, setNarrow] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const o = new ResizeObserver(() => setNarrow(el.clientWidth < 720));
    o.observe(el);
    return () => o.disconnect();
  }, [doc?.state]);
  const wrap = wrapPref ?? narrow;
  const [hunk, setHunk] = useState(0);
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    if (ref) void openDoc(owner, ref, path);
  }, [ref, owner, path]);
  usePolling(key, visible && !!doc && (doc.state === "ready" || doc.state === "gone"));

  // The marks follow your typing a beat behind, so a long file stays quick.
  const text = useDeferredValue(doc?.text ?? "");
  const marks = useMemo(() => (doc?.state === "ready" && !doc.binary && !doc.tooLarge ? agentMarks(doc.turn ? doc.turn.before : undefined, doc.agentText, doc.base, text) : undefined), [doc?.state, doc?.binary, doc?.tooLarge, doc?.turn, doc?.agentText, doc?.base, text]);
  const conflicted = useMemo(() => (doc?.conflict?.content !== undefined ? conflictLines(doc.base, text, doc.conflict.content) : undefined), [doc?.conflict, doc?.base, text]);
  const hunks = marks?.hunks ?? [];
  const at = Math.min(hunk, Math.max(0, hunks.length - 1));
  const step = (d: number) => {
    if (!hunks.length) return;
    setHunk((at + d + hunks.length) % hunks.length);
    setReveal((r) => r + 1);
  };

  if (!doc || doc.state === "loading")
    return (
      <div className={sx(paint.s0)} data-testid="file-pane" data-state="loading">
        <Spinner  size="lg" muted/>
      </div>
    );

  const dirty = isDirty(doc);
  const showCompare = doc.comparing && doc.conflict?.content !== undefined;
  let body: React.ReactNode;
  if (doc.state === "error") body = <Refusal path={path} title={`Couldn't open ${fileName(path)}`} detail={<ErrorText text={doc.error} className={sx(paint.s1)} />} retry={() => ref && void openDoc(owner, ref, path)} />;
  else if (doc.state === "gone") body = <Refusal path={path} icon={<FileX2Icon className={sx(paint.s2)} />} title={`${fileName(path)} isn't in this worktree any more`} detail="It was deleted or moved on the box." onClose={onClose} />;
  else if (doc.image && !doc.tooLarge) body = <ImageView doc={doc} />;
  else if (doc.binary || doc.tooLarge) body = <Refusal path={path} title={doc.tooLarge ? "Too large to open here" : "Not a text file"} detail={doc.reason} external />;
  else if (showCompare) body = <CompareMine doc={doc} />;
  else
    body = (
      <Suspense fallback={<div className={sx(paint.s3)}><Spinner  size="lg" muted/></div>}>
        <CodeEditor path={path} text={doc.text} onChange={(t) => edit(key, t)} onSave={() => void save(key)} changes={marks} conflictLines={conflicted} revealLine={hunks[at]?.from} reveal={reveal} wrap={wrap} className={sx(paint.s4)} />
      </Suspense>
    );

  return (
    <div ref={frame} className={sx(paint.s5)} data-testid="file-pane" data-state={doc.state} data-path={path} data-wrap={wrap || undefined}>
      <FileHeader narrow={narrow} doc={doc} dirty={dirty} added={marks?.added} removed={marks?.removed} hunks={hunks.length} at={at} onStep={step} wrap={wrap} text={!doc.binary && !doc.tooLarge && doc.state === "ready"} />
      {doc.conflict && !showCompare && <ConflictBanner doc={doc} />}
      {body}
    </div>
  );
}

// ---- The header ----

function Crumbs({ path, dirty, compact }: { path: string; dirty: boolean; compact?: boolean }) {
  const parts = path.split("/");
  // A narrow pane (a split, or beside the Files panel) shows the name
  // alone, rather than folders squeezed to a stray chevron.
  const dirs = compact ? [] : parts.slice(0, -1);
  return (
    <span className={sx(paint.s6)} aria-label={path} data-testid="file-crumbs">
      {dirs.map((p, i) => (
        // Narrow, only the nearest folders stay.
        <span key={i} className={[sx(paint.s7), i < dirs.length - 2 && sx(paint.s65), i < dirs.length - 1 && sx(paint.s66)].filter(Boolean).join(" ")}>
          <span className={sx(paint.s8)}>{p}</span>
          <ChevronRightIcon className={sx(paint.s9)} />
        </span>
      ))}
      <span className={sx(paint.s10)}>
        <FileGlyph path={path} className={sx(paint.s11)} />
        <span className={sx(paint.s12)}>{parts[parts.length - 1]}</span>
        {dirty && <span role="img" aria-label="Unsaved" className={sx(paint.s13)} />}
      </span>
    </span>
  );
}

export function OpenInEditor({ path, line, compact }: { path: string; line?: number; compact?: boolean }) {
  const name = useEditorName();
  return (
    <Tip label={`Open in ${name}`} side="bottom">
      <button type="button" aria-label={`Open in ${name}`} onClick={() => openFile(path, "external", line)} className={sx(paint.s14)}>
        {!compact && <span className={sx(paint.s66)}>{name}</span>}
        <ArrowUpRightIcon className={sx(paint.s15)} />
      </button>
    </Tip>
  );
}

const IconButton = ({ label, onClick, pressed, children }: { label: string; onClick(): void; pressed?: boolean; children: React.ReactNode }) => (
  <Tip label={label} side="bottom">
    <button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick} className={[sx(paint.s16), pressed && sx(paint.s17)].filter(Boolean).join(" ")}>
      {children}
    </button>
  </Tip>
);

function SaveState({ doc }: { doc: Doc }) {
  const [, tick] = useState(0);
  const recent = !!doc.savedAt && Date.now() - doc.savedAt < 2500;
  useEffect(() => {
    if (!recent) return;
    const id = window.setTimeout(() => tick((n) => n + 1), 2600);
    return () => window.clearTimeout(id);
  }, [recent, doc.savedAt]);
  if (doc.saving) return <span className={sx(paint.s18)}>Saving…</span>;
  if (doc.saveError)
    return (
      <Tip label={doc.saveError} side="bottom">
        <span role="alert" className={sx(paint.s19)}>
          <TriangleAlertIcon className={sx(paint.s20)} /> Not saved
        </span>
      </Tip>
    );
  if (recent) return <span className={sx(paint.s21)} data-testid="file-saved">Saved</span>;
  return null;
}

function FileHeader({ narrow, doc, dirty, added, removed, hunks, at, onStep, wrap, text }: { narrow?: boolean; doc: Doc; dirty: boolean; added?: number; removed?: number; hunks: number; at: number; onStep(d: number): void; wrap: boolean; text: boolean }) {
  const turn = doc.turn;
  const [, tick] = useState(0);
  // "2m ago" keeps up.
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={sx(paint.s22)} data-testid="file-header">
      <Crumbs path={doc.path} dirty={dirty} compact={narrow} />
      <SaveState doc={doc} />
      <div className={sx(paint.s23)}>
        {turn && text && (
          <span className={sx(paint.s24)} data-testid="file-turn">
            <AgentIcon agent={turn.agent} className={sx(paint.s25)} />
            <span className={sx(paint.s67)}>
              {agentName(turn.agent)}
              {turn.at ? `, ${ago(new Date(turn.at).toISOString())}` : ""}
            </span>
            <span className={sx(paint.s26)}>
              <span className={sx(paint.s27)}>+{added ?? turn.added}</span> <span className={sx(paint.s28)}>−{removed ?? turn.removed}</span>
            </span>
            {hunks > 0 && (
              <span className={sx(paint.s29)} role="group" aria-label="Changes">
                <IconButton label="Previous change" onClick={() => onStep(-1)}>
                  <ChevronUpIcon className={sx(paint.s30)} />
                </IconButton>
                <span className={sx(paint.s31)} data-testid="file-hunk">
                  {at + 1}/{hunks}
                </span>
                <IconButton label="Next change" onClick={() => onStep(1)}>
                  <ChevronDownIcon className={sx(paint.s32)} />
                </IconButton>
              </span>
            )}
          </span>
        )}
        {turn && text && <span aria-hidden className={sx(paint.s33)} />}
        {text && (
          <IconButton label={wrap ? "Don't wrap long lines" : "Wrap long lines"} pressed={wrap} onClick={() => setWrap(!wrap)}>
            <WrapTextIcon className={sx(paint.s34)} />
          </IconButton>
        )}
        <OpenInEditor path={doc.path} />
      </div>
    </div>
  );
}

// ---- The conflict ----

function ConflictBanner({ doc }: { doc: Doc }) {
  const who = doc.turn ? `${agentName(doc.turn.agent)} ${doc.conflict?.deleted ? "deleted" : "changed"} this.` : doc.conflict?.deleted ? "This file was deleted on the box." : "This file changed on the box.";
  return (
    <div role="alert" className={sx(paint.s35)} data-testid="file-conflict">
      <span className={sx(paint.s36)}>
        <TriangleAlertIcon className={sx(paint.s37)} />
        <span className={sx(paint.s38)}>{who}</span>
        <span className={sx(paint.s39)}>Your unsaved edits are still here.</span>
      </span>
      <span className={sx(paint.s40)}>
        <Button size="xs" variant="outline" onClick={() => reload(doc.key)}>
          {doc.conflict?.deleted ? "Discard mine" : "Reload"}
        </Button>
        <Button size="xs" variant={doc.conflict?.deleted ? "default" : "outline"} onClick={() => keepMine(doc.key)}>
          Keep mine
        </Button>
        {!doc.conflict?.deleted && (
          <Button size="xs" onClick={() => setComparing(doc.key, true)}>
            <GitCompareArrowsIcon />
            Compare
          </Button>
        )}
      </span>
    </div>
  );
}

// CompareMine shows your version beside the agent's, in the diff view.
function CompareMine({ doc }: { doc: Doc }) {
  const diffs = useDiffs(true);
  const dark = useActiveTheme().appearance === "dark";
  const theirs = doc.conflict?.content ?? "";
  const fd = useMemo(() => (diffs && "mod" in diffs ? diffs.mod.fromTexts(doc.path, doc.text, theirs) : undefined), [diffs, doc.path, doc.text, theirs]);
  const who = agentName(doc.turn?.agent);
  return (
    <div className={sx(paint.s41)} data-testid="file-compare">
      <div className={sx(paint.s42)}>
        <GitCompareArrowsIcon className={sx(paint.s43)} />
        <span className={sx(paint.s44)}>Yours</span>
        <span className={sx(paint.s45)}>→</span>
        <span className={sx(paint.s46)}>
          {doc.turn && <AgentIcon agent={doc.turn.agent} className={sx(paint.s47)} />} {doc.turn ? `${who}'s` : "On the box"}
        </span>
        <span className={sx(paint.s48)}>
          <Button size="xs" variant="outline" onClick={() => reload(doc.key)}>
            Take {doc.turn ? `${who}'s` : "theirs"}
          </Button>
          <Button size="xs" variant="outline" onClick={() => keepMine(doc.key)}>
            Keep mine
          </Button>
          <IconButton label="Back to the file" onClick={() => setComparing(doc.key, false)}>
            <XIcon className={sx(paint.s49)} />
          </IconButton>
        </span>
      </div>
      <div className={sx(paint.s50)}>
        {diffs && "error" in diffs ? <ErrorText text={diffs.error} className={sx(paint.s51)} /> : fd && diffs && "mod" in diffs ? <diffs.mod.Diff fileDiff={fd} layout="split" dark={dark} /> : <span className={sx(paint.s52)}><Spinner size="lg" /></span>}
      </div>
    </div>
  );
}

// ---- Files the editor doesn't hold ----

function Refusal({ path, icon, title, detail, external, retry, onClose }: { path: string; icon?: React.ReactNode; title: string; detail?: React.ReactNode; external?: boolean; retry?(): void; onClose?(): void }) {
  const name = useEditorName();
  return (
    <div className={sx(paint.s53)} data-testid="file-refusal">
      <span className={sx(paint.s54)}>{icon ?? <FileGlyph path={path} className={sx(paint.s55)} />}</span>
      <div className={[sx(paint.s56), sx(paint.s68)].filter(Boolean).join(" ")}>
        <p className={sx(paint.s57)}>{title}</p>
        {typeof detail === "string" ? <p className={sx(paint.s58)}>{detail}</p> : detail}
      </div>
      <div className={sx(paint.s59)}>
        {external && (
          <Button size="sm" variant="outline" onClick={() => openFile(path, "external")}>
            Open in {name}
            <ArrowUpRightIcon />
          </Button>
        )}
        {retry && (
          <Button size="sm" variant="outline" onClick={retry}>
            Try again
          </Button>
        )}
        {onClose && (
          <Button size="sm" variant="outline" onClick={onClose}>
            Close tab
          </Button>
        )}
      </div>
    </div>
  );
}

const sizeWords = (n?: number) => (n === undefined ? "" : n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} bytes`);

// ImageView shows a picture from the worktree, as the box serves it.
function ImageView({ doc }: { doc: Doc }) {
  const c = useStore((s) => s.client);
  const [url, setUrl] = useState<string>();
  const [err, setErr] = useState<string>();
  const [dims, setDims] = useState<{ w: number; h: number }>();
  useEffect(() => {
    if (!c) return;
    let live = true;
    let made: string | undefined;
    filesApi.image(c, doc.ref, doc.path).then(
      (b) => {
        made = URL.createObjectURL(b);
        if (live) setUrl(made);
      },
      (e: unknown) => live && setErr(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [c, doc.ref, doc.path, doc.etag]);
  return (
    <div className={sx(paint.s60)} data-testid="file-image">
      <div className={[sx(paint.s61), sx(paint.s69)].filter(Boolean).join(" ")}>
        {err ? <ErrorText text={err} className={sx(paint.s62)} /> : url ? <img src={url} alt={fileName(doc.path)} onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className={sx(paint.s63)} /> : <Spinner  size="lg" muted/>}
      </div>
      <div className={sx(paint.s64)}>
        <span>{doc.image?.replace("image/", "").toUpperCase()}</span>
        {dims && (
          <span>
            {dims.w} × {dims.h}
          </span>
        )}
        <span>{sizeWords(doc.size)}</span>
      </div>
    </div>
  );
}

export default FilePane;
