// The diff itself, drawn by @pierre/diffs (diffs.com): Shiki highlighting in
// a worker, and a virtualized list so only the files on screen are in the
// DOM. This module and its chunks load the first time a Diff panel has
// something to show, never with the app.
import { type FileDiffMetadata, parsePatchFiles } from "@pierre/diffs";
import { CodeView, type CodeViewHandle, type CodeViewItem, WorkerPoolContextProvider } from "@pierre/diffs/react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";

export type { FileDiffMetadata };

// The highlighter caches by key, so a key names the patch's contents: the
// same diff read again reuses its highlighting, a changed one never does.
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

export function parse(patch: string): FileDiffMetadata[] {
  if (!patch.trim()) return [];
  return parsePatchFiles(patch, `berth-diff-${hash(patch)}-${patch.length}`).flatMap((p) => p.files);
}

export interface ViewItem {
  id: string;
  fileDiff: FileDiffMetadata;
  collapsed: boolean;
  version: number;
}

export interface ViewerProps {
  items: ViewItem[];
  layout: "split" | "unified";
  wrap: boolean;
  dark: boolean;
  // Scrolls to a file; n changes for each jump, so the same file can be
  // jumped to twice.
  jump?: { id: string; n: number };
  // The file at the top of the view, as it scrolls.
  onActive?(id: string): void;
  renderHeader(id: string): ReactNode;
  // A different diff (another scope): start again from its top.
  resetKey?: string;
}

const THEMES = { dark: "pierre-dark", light: "pierre-light" };

// The app's look inside the library's shadow DOM: its background, borders
// and mono font, and the diff colours the app uses elsewhere.
const CSS = `
:host {
  --diffs-font-family: "JetBrains Mono Variable", ui-monospace, monospace;
  --diffs-header-font-family: "Inter Variable", system-ui, sans-serif;
  --diffs-font-size: 12px;
  --diffs-line-height: 20px;
  --diffs-font-features: "calt" 0, "liga" 0;
  --diffs-light-bg: var(--background);
  --diffs-dark-bg: var(--background);
  --diffs-addition-color-override: var(--success);
  --diffs-deletion-color-override: var(--destructive);
  --diffs-modified-color-override: var(--info);
  --diffs-fg-number-override: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
  --diffs-bg-buffer-override: color-mix(in srgb, var(--background) 97%, var(--foreground));
  --diffs-bg-separator-override: color-mix(in srgb, var(--background) 96%, var(--foreground));
}
pre, code { font-variant-ligatures: none; }
[data-content-buffer], [data-gutter-buffer] { background-image: none; }
[data-separator] { font-size: 11px; color: var(--muted-foreground); }
`;

function workerFactory() {
  return new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
}

export default function Viewer(props: ViewerProps) {
  return (
    <WorkerPoolContextProvider
      // Two workers: enough to keep up with scrolling, without the eight a
      // pool starts by default.
      poolOptions={{ workerFactory, poolSize: 2, totalASTLRUCacheSize: 40 }}
      highlighterOptions={{ theme: THEMES, langs: [] }}
    >
      <Files key={props.resetKey} {...props} />
    </WorkerPoolContextProvider>
  );
}

function Files({ items, layout, wrap, dark, jump, onActive, renderHeader }: ViewerProps) {
  const ref = useRef<CodeViewHandle<undefined, undefined>>(null);
  const ids = useRef<string[]>([]);
  ids.current = items.map((i) => i.id);
  const frame = useRef(0);

  const viewItems = useMemo<CodeViewItem<undefined>[]>(
    () => items.map((i) => ({ id: i.id, type: "diff", fileDiff: i.fileDiff, collapsed: i.collapsed, version: i.version })),
    [items],
  );

  const options = useMemo(
    () => ({
      theme: THEMES,
      themeType: dark ? ("dark" as const) : ("light" as const),
      diffStyle: layout,
      overflow: wrap ? ("wrap" as const) : ("scroll" as const),
      diffIndicators: "bars" as const,
      lineDiffType: "word-alt" as const,
      hunkSeparators: "line-info" as const,
      stickyHeaders: true,
      unsafeCSS: CSS,
    }),
    [dark, layout, wrap],
  );

  useEffect(() => {
    if (!jump) return;
    const go = () => ref.current?.scrollTo({ type: "item", id: jump.id, align: "start", offset: 8 });
    go();
    // Files between here and there are measured as they render, which can
    // move the target: settle on it once they have.
    const t = setTimeout(go, 150);
    return () => clearTimeout(t);
  }, [jump]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Stable callbacks: a new one each render would reset the view's options,
  // and with them a scroll on its way to a file.
  const latest = useRef({ renderHeader, onActive });
  latest.current = { renderHeader, onActive };
  const header = useCallback((item: CodeViewItem<undefined>) => latest.current.renderHeader(item.id), []);
  const scrolled = useCallback((top: number, viewer: { getTopForItem(id: string): number | undefined }) => {
    if (!latest.current.onActive) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      let active = ids.current[0];
      for (const id of ids.current) {
        const t = viewer.getTopForItem(id);
        if (t === undefined || t > top + 8) break;
        active = id;
      }
      if (active) latest.current.onActive?.(active);
    });
  }, []);

  return (
    <CodeView
      ref={ref}
      className="berth-diff-view h-full min-h-0 overflow-auto overscroll-contain"
      items={viewItems}
      options={options}
      renderCustomHeader={header}
      onScroll={scrolled}
    />
  );
}
