import * as stylex from "@stylexjs/stylex";
import { ClockIcon, SearchIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { agentName, FileGlyph, useEditorName } from "@/components/files/file-bits";
import { useLabel } from "@/components/workspace/worktree-tone";
import { CommandDialog, CommandDialogPopup, CommandFooter, CommandPanel } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { rank } from "@/lib/file-match";
import { filesApi, type How, loadTouched, openFile, setPickerOpen, type TouchedFile, useFiles } from "@/lib/files";
import { explain } from "@/lib/errors";
import { useStore } from "@/lib/store";
import { useHereKey, useHereRef } from "@/lib/workspaces";
import { focusNewPane } from "@/lib/focus-home";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "56px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "20px",
    "paddingRight": "20px",
  },
  s1: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "opacity": 0.8,
  },
  s2: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "transparent",
    "fontSize": "16px",
    "lineHeight": "24px",
    "outline": "none",
    "color": {
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 80%, transparent)",
    },
  },
  s3: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "display": "flex",
    "minHeight": "0px",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s5: {
    "width": "24rem",
    "flexShrink": 0,
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s6: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s7: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s8: {
    "display": "flex",
    "height": "100%",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s9: {
    "height": "100%",
  },
  s10: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s11: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s12: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s13: {
    "marginLeft": "auto",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s14: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s15: {
    "marginLeft": "auto",
  },
  s16: {
    "height": "100%",
    "minHeight": "0px",
    "overflowY": "auto",
    "overscrollBehavior": "contain",
    "padding": "8px",
    "scrollbarWidth": "thin",
  },
  s17: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "32px",
    "paddingBottom": "32px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s18: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "width": "12px",
    "height": "12px",
  },
  s20: {
    "backgroundColor": "transparent",
    "fontWeight": 600,
    "color": "var(--foreground)",
    "textDecoration": "underline",
  },
  s21: {
    "display": "flex",
    "minHeight": "32px",
    "cursor": "default",
    "userSelect": "none",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-sm)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s22: {
    "backgroundColor": "var(--accent)",
    "color": "var(--accent-foreground)",
  },
  s23: {
    "width": "16px",
    "height": "16px",
  },
  s24: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "baseline",
    "gap": "8px",
  },
  s25: {
    "flexShrink": 0,
    "color": "var(--foreground)",
  },
  s26: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "width": "12px",
    "height": "12px",
  },
  s28: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s29: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--success) 12%, transparent)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 500,
    "fontFamily": "var(--font-sans)",
    "fontSize": "10px",
    "color": "var(--success-foreground)",
  },
  s30: {
    "color": "var(--success-foreground)",
  },
  s31: {
    "color": "var(--destructive-foreground)",
  },
  s32: {
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
    "color": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
  },

  s33: {
    ":is([role=group] + *)": {
      marginTop: 8,
    },
  },
  s34: {
    textDecorationColor: "color-mix(in oklab, var(--foreground) 35%, transparent)",
    textUnderlineOffset: 3,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The preview, with the editor, is its own chunk.
const Preview = lazy(() => import("@/components/files/file-preview"));

// The preview column shows from this window width up.
const WIDE = "(min-width: 1180px)";

function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(WIDE);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(WIDE).matches,
  );
}

interface Entry {
  path: string;
  hits: number[];
  touched?: TouchedFile;
  recent?: boolean;
}

interface Group {
  id: string;
  label: string;
  agent?: string;
  items: Entry[];
}

// FilePicker (⌘P) finds a file in the worktree you are acting in. Empty,
// it lists what the agent changed this turn, then what you opened lately;
// typed, a fuzzy match over every file (the box's list), its matched
// letters marked. ↵ opens a File tab, ⌥↵ opens it beside the focused pane,
// ⌘↵ in your editor. On a wide window the highlighted file shows at the
// agent's first change beside the list.
export function FilePicker() {
  const open = useFiles((s) => s.pickerOpen);
  return (
    <CommandDialog open={open} onOpenChange={(o) => setPickerOpen(o)}>
      {open && <Picker />}
    </CommandDialog>
  );
}

function Picker() {
  const ws = useHereKey();
  const ref = useHereRef();
  const { label: where } = useLabel(ws);
  const client = useStore((s) => s.client);
  // Asked again when its box comes back, so an error from while it was away
  // doesn't stay.
  const online = useStore((s) => (ref ? s.status?.boxes.find((b) => b.name === ref.box)?.state === "online" : false));
  const recent = useFiles((s) => (ws ? s.recent[ws] : undefined));
  const touched = useFiles((s) => (ws ? s.touched[ws] : undefined));
  const wide = useWide();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; files: string[]; truncated?: boolean }>();
  const [error, setError] = useState<string>();
  const [at, setAt] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const editor = useEditorName();

  useEffect(() => {
    if (ws && ref) void loadTouched(ws, ref);
  }, [ws, ref]);

  // Typed: the box's best matches, asked for a beat after the last key.
  useEffect(() => {
    const q = query.trim();
    if (!q || !client || !ref) return;
    const ac = new AbortController();
    const id = window.setTimeout(() => {
      filesApi.list(client, ref, q, 120, ac.signal).then(
        (r) => {
          setFound({ q, files: r.files ?? [], truncated: r.truncated });
          setError(undefined);
        },
        (err: unknown) => {
          if (ac.signal.aborted) return;
          // In words (a box away, one not answering), not the transport's.
          const e = explain(err, { box: ref.box });
          setError(`${e.title}. ${e.message}`);
        },
      );
    }, 50);
    return () => {
      window.clearTimeout(id);
      ac.abort();
    };
  }, [query, client, ref, online]);

  const groups = useMemo<Group[]>(() => {
    const files = touched?.files.filter((f) => !f.deleted) ?? [];
    const byPath = new Map(files.map((f) => [f.path, f]));
    const mine = recent ?? [];
    const q = query.trim();
    if (!q) {
      const agents = new Set(files.map((f) => f.agent));
      const who = agents.size === 1 ? agentName([...agents][0]) : "agents";
      return [
        { id: "agent", label: `Changed by ${who} this turn`, agent: agents.size === 1 ? [...agents][0] : undefined, items: files.map((f) => ({ path: f.path, hits: [], touched: f })) },
        { id: "recent", label: "Recently opened", items: mine.filter((p) => !byPath.has(p)).slice(0, 8).map((p) => ({ path: p, hits: [], recent: true })) },
      ].filter((g) => g.items.length);
    }
    if (!found) return [];
    // The box's list, ranked here as it ranks, the agent's files and
    // recent ones lifted, and the letters to mark.
    const pool = [...new Set([...found.files, ...files.map((f) => f.path), ...mine])];
    const ranked = rank(q, pool, (p) => (byPath.has(p) ? 6 : 0) + (mine.includes(p) ? 3 : 0)).slice(0, 60);
    if (!ranked.length) return [];
    return [{ id: "found", label: ranked.length === 1 ? "1 file" : `${ranked.length} files`, items: ranked.map((m) => ({ path: m.path, hits: m.hits, touched: byPath.get(m.path), recent: mine.includes(m.path) })) }];
  }, [query, found, touched, recent]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const current = flat[Math.min(at, flat.length - 1)];
  useEffect(() => setAt(0), [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const choose = (e: Entry | undefined, how: How) => {
    if (!e) return;
    setPickerOpen(false);
    openFile(e.path, how);
    // The file takes the keyboard, in its tab or beside (not in an editor app).
    if (how !== "external") focusNewPane();
  };
  // ↵ before the box has answered what you typed opens its best match as
  // soon as it does.
  const [pending, setPending] = useState<How>();
  const q = query.trim();
  const searching = !!q && (!found || found.q !== q) && !error;
  useEffect(() => {
    if (pending && !searching) {
      setPending(undefined);
      choose(flat[0], pending);
    }
    // choose reads only store setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, searching, flat]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault();
      setAt((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault();
      setAt((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.nativeEvent.isComposing) return;
      const how: How = e.metaKey || e.ctrlKey ? "external" : e.altKey ? "split" : "tab";
      if (searching) setPending(how);
      else choose(current, how);
    }
  };

  const preview = wide && !!ws && !!ref;

  return (
    <CommandDialogPopup size={preview ? "preview" : "files"} data-testid="file-picker" aria-label="Go to file">
      <div className={sx(paint.s0)}>
        <SearchIcon className={sx(paint.s1)} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder={where ? `Go to a file in ${where}…` : "Go to a file…"}
          aria-label="Go to file"
          aria-controls="file-picker-list"
          aria-activedescendant={current ? `file-option-${at}` : undefined}
          role="combobox"
          aria-expanded
          spellCheck={false}
          autoComplete="off"
          className={sx(paint.s2)}
        />
        {searching && <Spinner  size="md" muted/>}
        {ref && <span className={sx(paint.s3)}>{ref.box}</span>}
      </div>
      <CommandPanel grow={preview}>
        <div className={[sx(paint.s4), preview ? sx(paint.s5) : sx(paint.s6)].filter(Boolean).join(" ")}>
          <Results groups={groups} at={at} setAt={setAt} choose={choose} listRef={list} empty={!ws ? "Open a worktree first: ⌘P finds files in the one in front." : error ? error : q ? (searching ? "" : "No file matches.") : touched ? "Type a file's name." : ""} />
        </div>
        {preview && <div className={sx(paint.s7)}>{current ? <Suspense fallback={<div className={sx(paint.s8)}><Spinner  size="lg" muted/></div>}><Preview ws={ws!} path={current.path} /></Suspense> : <div className={sx(paint.s9)} />}</div>}
      </CommandPanel>
      <CommandFooter align="start" gap={4}>
        <span className={sx(paint.s10)}>
          <Kbd>↵</Kbd> open
        </span>
        <span className={sx(paint.s11)}>
          <Kbd>⌥↵</Kbd> split
        </span>
        <span className={sx(paint.s12)}>
          <Kbd>⌘↵</Kbd> {editor}
        </span>
        {/* Past the box's 20,000-file list (internal/box/commands.go): the
            search covers those, plus what the agents touched. */}
        {q && found?.truncated && (
          <span className={sx(paint.s13)} data-testid="file-picker-truncated">
            Searching the first 20,000 files
          </span>
        )}
        <span className={[sx(paint.s14), !(q && found?.truncated) && sx(paint.s15)].filter(Boolean).join(" ")}>
          <Kbd>esc</Kbd> close
        </span>
      </CommandFooter>
    </CommandDialogPopup>
  );
}

function Results({ groups, at, setAt, choose, listRef, empty }: { groups: Group[]; at: number; setAt(i: number): void; choose(e: Entry, how: How): void; listRef: React.RefObject<HTMLDivElement | null>; empty: string }) {
  let i = -1;
  return (
    <div ref={listRef} id="file-picker-list" role="listbox" aria-label="Files" className={sx(paint.s16)}>
      {!groups.length && empty && <p className={sx(paint.s17)}>{empty}</p>}
      {groups.map((g) => (
        <div key={g.id} role="group" aria-label={g.label} className={sx(paint.s33)}>
          <div className={sx(paint.s18)}>
            {g.id === "agent" && <AgentIcon agent={g.agent} className={sx(paint.s19)} />}
            {g.label}
          </div>
          {g.items.map((e) => {
            i++;
            const idx = i;
            return <Row key={e.path} e={e} index={idx} active={idx === at} onHover={() => setAt(idx)} onPick={(how) => choose(e, how)} grouped={g.id === "agent"} />;
          })}
        </div>
      ))}
    </div>
  );
}

// Marked is text with the matched letters (indexes into the whole path;
// offset is where text starts in it) bold and underlined.
function Marked({ text, hits, offset, className }: { text: string; hits: number[]; offset: number; className?: string }) {
  if (!hits.length) return <span className={className}>{text}</span>;
  const set = new Set(hits);
  const out: React.ReactNode[] = [];
  let run = "";
  let on = false;
  const flush = (k: number) => {
    if (!run) return;
    out.push(
      on ? (
        <mark key={k} className={[sx(paint.s20), sx(paint.s34)].filter(Boolean).join(" ")}>
          {run}
        </mark>
      ) : (
        <span key={k}>{run}</span>
      ),
    );
    run = "";
  };
  for (let k = 0; k < text.length; k++) {
    const hit = set.has(offset + k);
    if (hit !== on) {
      flush(k);
      on = hit;
    }
    run += text[k];
  }
  flush(text.length);
  return <span className={className}>{out}</span>;
}

function Row({ e, index, active, onHover, onPick, grouped }: { e: Entry; index: number; active: boolean; onHover(): void; onPick(how: How): void; grouped: boolean }) {
  const slash = e.path.lastIndexOf("/");
  const name = e.path.slice(slash + 1);
  const dir = slash >= 0 ? e.path.slice(0, slash) : "";
  const t = e.touched;
  return (
    <div
      id={`file-option-${index}`}
      role="option"
      aria-selected={active}
      data-index={index}
      data-path={e.path}
      onMouseMove={onHover}
      onClick={(ev) => onPick(ev.metaKey || ev.ctrlKey ? "external" : ev.altKey ? "split" : "tab")}
      className={[sx(paint.s21), active && sx(paint.s22)].filter(Boolean).join(" ")}
    >
      <FileGlyph path={e.path} className={sx(paint.s23)} />
      <span className={sx(paint.s24)}>
        <Marked text={name} hits={e.hits} offset={slash + 1} className={sx(paint.s25)} />
        {dir && <Marked text={dir} hits={e.hits} offset={0} className={sx(paint.s26)} />}
      </span>
      {t && !grouped && <AgentIcon agent={t.agent} className={sx(paint.s27)} />}
      {t && (
        <span className={sx(paint.s28)}>
          {t.created && <span className={sx(paint.s29)}>new</span>}
          <span className={sx(paint.s30)}>+{t.added}</span>
          {t.removed > 0 && <span className={sx(paint.s31)}>−{t.removed}</span>}
        </span>
      )}
      {!t && e.recent && <ClockIcon aria-label="Opened lately" className={sx(paint.s32)} />}
    </div>
  );
}

