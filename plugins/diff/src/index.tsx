import * as stylex from "@stylexjs/stylex";
import { definePlugin, useEvent, useStorage, worktreeLocation, type WorktreePanelProps } from "@berth/plugin";
import { Button, type DiffFile, type DiffsModule, type DiffViewerItem, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Icon, Input, loadDiffs, PickOne, Spinner, Tip } from "@berth/plugin/ui";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type DiffResult, fetchDiff, type FileStat, LIMIT, type Scope, splitPath, startsCollapsed } from "./git";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
    "backgroundColor": "var(--background)",
  },
  s1: {
    "display": "flex",
    "height": "40px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s3: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s4: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s5: {
    "marginLeft": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s7: {
    "color": "var(--muted-foreground)",
  },
  s8: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--success)",
  },
  s9: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--destructive)",
  },
  s10: {
    "width": "14px",
    "height": "14px",
  },
  s11: {
    "width": "14px",
    "height": "14px",
  },
  s12: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s13: {
    "width": "14px",
    "height": "14px",
  },
  s14: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s15: {
    "width": "14px",
    "height": "14px",
  },
  s16: {
    "width": "14px",
    "height": "14px",
  },
  s17: {
    "width": "14px",
    "height": "14px",
  },
  s18: {
    "width": "16px",
    "height": "16px",
  },
  s19: {
    "whiteSpace": "pre-wrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "display": "flex",
    "minHeight": "160px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "padding": "24px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s21: {
    "color": "var(--success)",
  },
  s22: {
    "color": "var(--destructive)",
  },
  s23: {
    "color": "var(--warning)",
  },
  s24: {
    "color": "var(--info)",
  },
  s25: {
    "color": "var(--info)",
  },
  s26: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s27: {
    "display": "flex",
    "width": "240px",
    "flexShrink": 0,
    "flexDirection": "column",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s28: {
    "display": "none",
  },
  s29: {
    "flexShrink": 0,
    "padding": "8px",
    "paddingBottom": "4px",
  },
  s30: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingBottom": "8px",
  },
  s31: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s33: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--warning-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s34: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s35: {
    "width": "16px",
    "height": "16px",
  },
  s36: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s37: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s38: {
    "color": "var(--muted-foreground)",
  },
  s39: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s40: {
    "color": "var(--success)",
  },
  s41: {
    "color": "var(--destructive)",
  },
  s42: {
    "color": "var(--muted-foreground)",
  },
  s43: {
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
  s44: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s45: {
    "cursor": "default",
    "opacity": 0.5,
    "backgroundColor": {
      ":hover": "transparent",
    },
  },
  s46: {
    "width": "12px",
    "flexShrink": 0,
    "textAlign": "center",
    "fontFamily": "var(--font-mono)",
    "fontWeight": 600,
  },
  s47: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s48: {
    "marginLeft": "6px",
    "color": "var(--muted-foreground)",
  },
  s49: {
    "display": "flex",
    "height": "36px",
    "alignItems": "center",
    "gap": "8px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontFamily": "var(--font-sans)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s50: {
    "flexShrink": 0,
  },
  s51: {
    "width": "14px",
    "height": "14px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s52: {
    "transform": "rotate(90deg)",
  },
  s53: {
    "width": "12px",
    "flexShrink": 0,
    "textAlign": "center",
    "fontFamily": "var(--font-mono)",
    "fontWeight": 600,
  },
  s54: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "baseline",
    "gap": "4px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "textAlign": "left",
    "fontFamily": "var(--font-mono)",
  },
  s55: {
    "cursor": "default",
  },
  s56: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s57: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s58: {
    "flexShrink": 0,
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s59: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-sm)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s60: {
    "marginLeft": "auto",
  },
  q61: {
    "containerType": "inline-size",
  },
  q62: {
    "display": {
      "@container (max-width: 42rem)": {
        "default": "none",
      },
    },
  },
  q63: {
    "display": {
      "@container (max-width: 48rem)": {
        "default": "none",
      },
    },
  },
  q64: {
    "display": {
      "@container (max-width: 42rem)": {
        "default": "none",
      },
    },
  },
  q65: {
    "color": "var(--success)",
  },
  q66: {
    "color": "var(--destructive)",
  },
  q67: {
    "color": "var(--warning)",
  },
  q68: {
    "color": "var(--info)",
  },
  q69: {
    "color": "var(--info)",
  },
  q70: {
    "display": {
      "@container (max-width: 42rem)": {
        "default": "none",
      },
    },
  },
  q71: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Diff: the whole of a branch's change in one scrolling view, the way a pull
// request shows it, drawn with the app's diff renderer (@pierre/diffs,
// diffs.com), shared with its chats. The diff is read with git on the box;
// the renderer, its highlighter and their languages load only once a Diff
// panel has something to show.

export default definePlugin((berth) => {
  berth.addWorktreePanel({ id: "diff", title: "Diff", icon: "FileDiff", Component: DiffPanel });
  berth.addCommand({ id: "open", title: "Show this branch's diff", group: "Git", run: () => berth.openPanel("diff") });
});

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; value: DiffResult };
type Layout = "split" | "unified";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "branch", label: "Branch" },
  { value: "uncommitted", label: "Uncommitted" },
  { value: "all", label: "All" },
];

const SCOPE_HELP: Record<Scope, string> = {
  branch: "The branch's commits since it left the default branch",
  uncommitted: "What isn't committed yet, new files included",
  all: "Commits and uncommitted work since the default branch",
};

// useWorktreeWatch calls onChange when the worktree's branch or commit moves
// (and, with dirty, its uncommitted work): an agent mid-turn checks out,
// commits and rebases without any event saying so. It looks every 15s while
// the window is shown, and at once on coming back to it.
function useWorktreeWatch(run: (command: string, timeout?: string) => Promise<{ output: string }>, onChange: () => void, dirty = false) {
  const changed = useRef(onChange);
  changed.current = onChange;
  useEffect(() => {
    let live = true;
    let last: string | undefined;
    let timer = 0;
    const cmd = `git symbolic-ref -q --short HEAD; git rev-parse -q --verify HEAD${dirty ? "; git status --porcelain 2>/dev/null | cksum" : ""}`;
    const look = async () => {
      window.clearTimeout(timer);
      if (!document.hidden) {
        try {
          const { output } = await run(cmd, "15s");
          if (!live) return;
          if (last !== undefined && output !== last) changed.current();
          last = output;
        } catch {
          // The box is away; the panel says so when it loads.
        }
      }
      if (live) timer = window.setTimeout(() => void look(), 15_000);
    };
    void look();
    const back = () => void look();
    window.addEventListener("focus", back);
    return () => {
      live = false;
      window.clearTimeout(timer);
      window.removeEventListener("focus", back);
    };
  }, [run, dirty]);
}

// The app's light or dark look, which follows .dark on <html>.
function useDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const o = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => o.disconnect();
  }, []);
  return dark;
}

function DiffPanel({ berth, box, location, worktree, path, main }: WorktreePanelProps) {
  const where = worktreeLocation({ location, worktree, main });
  const [scope, setScope] = useStorage<Scope>("scope", "branch");
  const [layout, setLayout] = useStorage<Layout>("layout", "split");
  const [wrap, setWrap] = useStorage<boolean>("wrap", false);
  const [list, setList] = useStorage<boolean>("files", true);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState(0);

  const run = useCallback((command: string, timeout = "60s") => berth.orchestrate.exec(box, where, command, timeout), [berth, box, where]);
  const refresh = useCallback(() => setStamp((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    const ctl = new AbortController();
    setBusy(true);
    // A refresh keeps what is on screen until the new diff is in.
    setLoad((l) => (l.state === "ready" && l.value.kind === "ok" ? l : { state: "loading" }));
    fetchDiff(run, scope, ctl.signal)
      .then((value) => live && setLoad({ state: "ready", value }))
      .catch((err) => live && setLoad({ state: "error", message: String(err?.message ?? err) }))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
      ctl.abort();
    };
  }, [run, scope, stamp]);

  // An agent finishing, or a terminal here ending, likely changed the diff.
  useEvent("agent.finished", (e) => e.box === box && e.data?.path === path && refresh());
  useEvent("session.stopped", (e) => e.box === box && refresh());
  // A branch switched, a commit or a rebase mid-turn changes it too.
  useWorktreeWatch(run, refresh, scope !== "branch");

  const result = load.state === "ready" ? load.value : undefined;
  const ok = result?.kind === "ok" ? result : undefined;
  const added = ok?.files.reduce((n, f) => n + f.added, 0) ?? 0;
  const removed = ok?.files.reduce((n, f) => n + f.removed, 0) ?? 0;

  return (
    <div className={[sx(paint.s0), sx(paint.q61)].filter(Boolean).join(" ")}>
      <header className={sx(paint.s1)}>
        <Icon name="GitBranch" className={sx(paint.s2)} />
        <span className={sx(paint.s3)}>{ok?.branch || (result?.kind === "nobase" ? result.branch : "") || (ok ? "detached HEAD" : "…")}</span>
        {ok?.base && scope !== "uncommitted" && (
          <Tip label={`Compared with ${ok.base} at ${ok.mergeBase.slice(0, 8)}, where the branch left it`}>
            <span className={[sx(paint.s4), sx(paint.q62)].filter(Boolean).join(" ")}>vs {ok.base}</span>
          </Tip>
        )}
        <PickOne label="What to compare" nudge value={scope} onChange={(v: string) => setScope(v as Scope)} options={SCOPES.map((s) => ({ value: s.value, label: <Tip label={SCOPE_HELP[s.value]}><span>{s.label}</span></Tip> }))} />
        <span className={sx(paint.s5)}>
          {ok && ok.files.length > 0 && (
            <span className={[sx(paint.s6), sx(paint.q63)].filter(Boolean).join(" ")}>
              <span className={sx(paint.s7)}>
                {ok.files.length} file{ok.files.length === 1 ? "" : "s"}
              </span>
              <span className={sx(paint.s8)}>+{added}</span>
              <span className={sx(paint.s9)}>−{removed}</span>
            </span>
          )}
        </span>
        <PickOne
          label="Diff layout"
          value={layout}
          onChange={(v: string) => setLayout(v as Layout)}
          options={[
            { value: "split", label: "Split", icon: <Icon name="columns-2" className={sx(paint.s10)} /> },
            { value: "unified", label: "Unified", icon: <Icon name="rows-2" className={sx(paint.s11)} /> },
          ]}
        />
        <Tip label={list ? "Hide the file list" : "Show the file list"}>
          <Button size="icon-sm" variant="ghost" aria-label="File list" aria-pressed={list} className={[sx(paint.q64), list && sx(paint.s12)].filter(Boolean).join(" ")} onClick={() => setList(!list)}>
            <Icon name="PanelLeft" className={sx(paint.s13)} />
          </Button>
        </Tip>
        <Tip label={wrap ? "Don't wrap long lines" : "Wrap long lines"}>
          <Button size="icon-sm" variant="ghost" aria-label="Wrap long lines" aria-pressed={wrap} className={wrap && sx(paint.s14)} onClick={() => setWrap(!wrap)}>
            <Icon name="WrapText" className={sx(paint.s15)} />
          </Button>
        </Tip>
        <Tip label="Read the diff again">
          <Button size="icon-sm" variant="ghost" aria-label="Refresh" onClick={refresh} disabled={busy && load.state !== "ready"}>
            {busy ? <Spinner className={sx(paint.s16)} /> : <Icon name="RefreshCw" className={sx(paint.s17)} />}
          </Button>
        </Tip>
      </header>
      <Body load={load} scope={scope} setScope={setScope} refresh={refresh} layout={layout} wrap={wrap} list={list} />
    </div>
  );
}

function Body({ load, scope, setScope, refresh, layout, wrap, list }: { load: Load; scope: Scope; setScope(s: Scope): void; refresh(): void; layout: Layout; wrap: boolean; list: boolean }) {
  if (load.state === "loading") {
    return (
      <Centered>
        <Spinner className={sx(paint.s18)} /> Reading the diff…
      </Centered>
    );
  }
  if (load.state === "error") {
    return (
      <Message title="Couldn't read the diff" detail={<span className={sx(paint.s19)}>{load.message}</span>}>
        <Button size="sm" variant="outline" onClick={refresh}>
          Try again
        </Button>
      </Message>
    );
  }
  const r = load.value;
  if (r.kind === "notgit") return <Message title="Not a git repository" detail="This worktree's folder isn't inside a git repository, so there is no diff to show." />;
  if (r.kind === "nohead" || r.kind === "nobase") {
    return (
      <Message
        title={r.kind === "nohead" ? "No commits yet" : "No default branch to compare with"}
        detail={r.kind === "nohead" ? "This repository has no commits, so there is no branch to diff yet." : "None of origin/HEAD, origin/main, main or master exists here."}
      >
        <Button size="sm" variant="outline" onClick={() => setScope("uncommitted")}>
          Show uncommitted changes
        </Button>
      </Message>
    );
  }
  if (r.files.length === 0) {
    const detail = {
      branch: `${r.branch || "This branch"} has no commits that ${r.base} doesn't have.`,
      uncommitted: "Everything here is committed.",
      all: `Nothing here differs from ${r.base}.`,
    }[scope];
    return (
      <Message title={scope === "uncommitted" ? "No uncommitted changes" : "No changes"} detail={detail}>
        {scope === "branch" && (
          <Button size="sm" variant="outline" onClick={() => setScope("uncommitted")}>
            Show uncommitted changes
          </Button>
        )}
      </Message>
    );
  }
  return <Files result={r} scope={scope} layout={layout} wrap={wrap} list={list} />;
}

function Centered({ children }: { children: ReactNode }) {
  return <div className={sx(paint.s20)}>{children}</div>;
}

function Message({ title, detail, children }: { title: string; detail: ReactNode; children?: ReactNode }) {
  return (
    <Centered>
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription measure="md">{detail}</EmptyDescription>
        </EmptyHeader>
        {children}
      </Empty>
    </Centered>
  );
}

const STATUS = {
  new: { letter: "A", label: "Added", tone: sx(paint.q65) },
  deleted: { letter: "D", label: "Deleted", tone: sx(paint.q66) },
  change: { letter: "M", label: "Modified", tone: sx(paint.q67) },
  "rename-pure": { letter: "R", label: "Renamed", tone: sx(paint.q68) },
  "rename-changed": { letter: "R", label: "Renamed", tone: sx(paint.q69) },
} as const;

interface Entry {
  stat: FileStat;
  // The shortest end of its path no other file shares ("de/payments.json"),
  // and the folders before it.
  label: { short: string; rest: string };
  fileDiff?: DiffFile;
  // Why it starts folded: a lockfile, generated, large.
  why?: string;
}

function Files({ result, scope, layout, wrap, list }: { result: DiffResult & { kind: "ok" }; scope: Scope; layout: Layout; wrap: boolean; list: boolean }) {
  const dark = useDark();
  const [mod, setMod] = useState<{ value: DiffsModule } | { error: string }>();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState<string>();
  const [jump, setJump] = useState<{ id: string; n: number }>();
  const [filter, setFilter] = useState("");
  // Each item's version: new for each diff read and each fold or unfold, so
  // the view redraws exactly the files that changed.
  const versions = useRef({ n: 0, of: new WeakMap<object, { open?: number; folded?: number }>() });

  useEffect(() => {
    let live = true;
    loadDiffs().then(
      (value) => live && setMod({ value }),
      (err) => live && setMod({ error: String(err?.message ?? err) }),
    );
    return () => {
      live = false;
    };
  }, []);

  const parsed = useMemo(() => (mod && "value" in mod ? mod.value.parse(result.patch) : undefined), [mod, result.patch]);

  const entries = useMemo<Entry[]>(() => {
    const byName = new Map(parsed?.map((f) => [f.name, f]));
    const short = uniqueEnds(result.files.map((f) => f.path));
    return result.files.map((stat, i) => {
      const fileDiff = byName.get(stat.path);
      return { stat, fileDiff, label: short[i], why: stat.binary ? "Binary" : startsCollapsed(stat) };
    });
  }, [parsed, result.files]);

  const isOpen = useCallback((e: Entry) => (e.fileDiff?.hunks.length ? (open[e.stat.path] ?? !e.why) : false), [open]);

  const items = useMemo<DiffViewerItem[]>(
    () =>
      entries.flatMap((e) => {
        if (!e.fileDiff) return [];
        const collapsed = !isOpen(e);
        const v = versions.current;
        const known = v.of.get(e.fileDiff) ?? {};
        v.of.set(e.fileDiff, known);
        if (collapsed) known.folded ??= ++v.n;
        else known.open ??= ++v.n;
        const version = (collapsed ? known.folded : known.open) ?? 0;
        return [{ id: e.stat.path, fileDiff: e.fileDiff, collapsed, version }];
      }),
    [entries, isOpen],
  );

  const missing = entries.filter((e) => !e.fileDiff).length;
  const byId = useMemo(() => new Map(entries.map((e) => [e.stat.path, e])), [entries]);
  const toggle = useCallback((id: string) => {
    const e = byId.get(id);
    if (e) setOpen((o) => ({ ...o, [id]: !isOpen(e) }));
  }, [byId, isOpen]);

  // A jump names the file it went to, even when the view can't scroll it
  // to the top (the last few files).
  const jumpedAt = useRef(0);
  const follow = useCallback((id: string) => {
    if (Date.now() - jumpedAt.current > 800) setActive(id);
  }, []);
  const goTo = (e: Entry) => {
    if (!e.fileDiff) return;
    jumpedAt.current = Date.now();
    setActive(e.stat.path);
    setJump((j) => ({ id: e.stat.path, n: (j?.n ?? 0) + 1 }));
  };

  const shown = filter.trim() ? entries.filter((e) => e.stat.path.toLowerCase().includes(filter.trim().toLowerCase())) : entries;

  return (
    <div className={sx(paint.s26)}>
      {/* A narrow panel gives all its width to the diff. */}
      <aside className={[[sx(paint.s27), sx(paint.q70)].filter(Boolean).join(" "), !list && sx(paint.s28)].filter(Boolean).join(" ")}>
        <div className={sx(paint.s29)}>
          <Input size="sm" value={filter} onChange={(ev: React.ChangeEvent<HTMLInputElement>) => setFilter(ev.target.value)} placeholder={`Filter ${entries.length} file${entries.length === 1 ? "" : "s"}`} aria-label="Filter files" />
        </div>
        <ul className={sx(paint.s30)}>
          {shown.map((e) => (
            <FileRow key={e.stat.path} entry={e} active={e.stat.path === (active ?? items[0]?.id)} onSelect={() => goTo(e)} />
          ))}
          {shown.length === 0 && <li className={sx(paint.s31)}>No file matches.</li>}
        </ul>
      </aside>
      <section className={sx(paint.s32)}>
        {result.truncated && (
          <p className={sx(paint.s33)}>
            <Icon name="TriangleAlert" className={sx(paint.s34)} />
            The diff is longer than {LIMIT >> 20} MB, so it stops there: {missing} file{missing === 1 ? " isn't" : "s aren't"} shown.
          </p>
        )}
        {!mod ? (
          <Centered>
            <Spinner className={sx(paint.s35)} />
          </Centered>
        ) : "error" in mod ? (
          <Message title="Couldn't load the diff viewer" detail={<span className={sx(paint.s36)}>{mod.error}</span>} />
        ) : (
          <div className={sx(paint.s37)}>
            <mod.value.default
              items={items}
              layout={layout}
              wrap={wrap}
              dark={dark}
              jump={jump}
              resetKey={scope}
              onActive={follow}
              renderHeader={(id) => {
                const e = byId.get(id);
                return e ? <FileHeader entry={e} open={isOpen(e)} onToggle={() => toggle(id)} /> : null;
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

// uniqueEnds names each path by its file name, or by as many of its last
// folders as it takes to tell it apart from the others.
function uniqueEnds(paths: string[]) {
  const parts = paths.map((p) => p.split("/"));
  const depth = parts.map(() => 1);
  for (let round = 0; round < 8; round++) {
    const seen = new Map<string, number>();
    const ends = parts.map((p, i) => p.slice(-depth[i]).join("/"));
    for (const e of ends) seen.set(e, (seen.get(e) ?? 0) + 1);
    let again = false;
    ends.forEach((e, i) => {
      if ((seen.get(e) ?? 0) > 1 && depth[i] < parts[i].length) {
        depth[i]++;
        again = true;
      }
    });
    if (!again) break;
  }
  return parts.map((p, i) => ({ short: p.slice(-depth[i]).join("/"), rest: p.slice(0, -depth[i]).join("/") }));
}

function Counts({ stat }: { stat: FileStat }) {
  if (stat.binary) return <span className={sx(paint.s38)}>binary</span>;
  return (
    <span className={sx(paint.s39)}>
      <span className={sx(paint.s40)}>+{stat.added}</span> <span className={sx(paint.s41)}>−{stat.removed}</span>
    </span>
  );
}

function status(e: Entry) {
  if (e.fileDiff) return STATUS[e.fileDiff.type];
  if (e.stat.from) return STATUS["rename-changed"];
  return { letter: "M", label: "Changed", tone: sx(paint.q71) };
}

function FileRow({ entry, active, onSelect }: { entry: Entry; active: boolean; onSelect(): void }) {
  const { stat, fileDiff, label } = entry;
  const s = status(entry);
  return (
    <li>
      <Tip side="right" label={fileDiff ? `${s.label}: ${stat.from ? `${stat.from} → ` : ""}${stat.path}` : `${stat.path}: past the ${LIMIT >> 20} MB limit, not shown`}>
        <button
          type="button"
          onClick={onSelect}
          aria-current={active || undefined}
          className={[sx(paint.s43), active && sx(paint.s44), !fileDiff && sx(paint.s45)].filter(Boolean).join(" ")}
        >
          <span className={[sx(paint.s46), s.tone].filter(Boolean).join(" ")}>{s.letter}</span>
          <span className={sx(paint.s47)}>
            {label.short}
            {label.rest && <span className={sx(paint.s48)}>{label.rest}</span>}
          </span>
          <Counts stat={stat} />
        </button>
      </Tip>
    </li>
  );
}

function FileHeader({ entry, open, onToggle }: { entry: Entry; open: boolean; onToggle(): void }) {
  const { stat, fileDiff, why } = entry;
  const s = status(entry);
  const { name, dir } = splitPath(stat.path);
  const empty = !fileDiff?.hunks.length;
  const note = stat.binary ? "Binary file, not shown" : empty ? (fileDiff?.type === "rename-pure" ? "Renamed, no changes" : "No content changes") : !open && why ? (why === "Large" ? "Large diff, folded" : `${why}, folded`) : undefined;
  return (
    <div className={sx(paint.s49)}>
      <Button size="icon-xs" variant="ghost" aria-label={open ? "Fold this file" : "Unfold this file"} aria-expanded={open} disabled={empty} onClick={onToggle} className={sx(paint.s50)}>
        <Icon name="ChevronRight" className={[sx(paint.s51), open && sx(paint.s52)].filter(Boolean).join(" ")} />
      </Button>
      <Tip label={s.label}>
        <span className={[sx(paint.s53), s.tone].filter(Boolean).join(" ")}>{s.letter}</span>
      </Tip>
      <button type="button" onClick={empty ? undefined : onToggle} className={[sx(paint.s54), empty && sx(paint.s55)].filter(Boolean).join(" ")}>
        {stat.from && <span className={sx(paint.s56)}>{stat.from} →</span>}
        {dir && <span className={sx(paint.s57)}>{dir}/</span>}
        <span className={sx(paint.s58)}>{name}</span>
      </button>
      {note && <span className={sx(paint.s59)}>{note}</span>}
      <span className={sx(paint.s60)} />
      <Counts stat={stat} />
    </div>
  );
}
