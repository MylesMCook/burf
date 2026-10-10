import * as stylex from "@stylexjs/stylex";
import { ArrowUpIcon, FolderIcon, GitBranchIcon, LoaderIcon, TriangleAlertIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { shortPath, uniqueName } from "@/components/add-project/unique-name";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogPanel } from "@/components/ui/dialog";
import { Frame, FramePanel } from "@/components/ui/frame";
import type { Location } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { type FsEntry, type FsListing, projectsApi } from "@/lib/projects";
import { useStore } from "@/lib/store";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s1: {
    "height": {
      "default": "36px",
      "@media (min-width: 640px)": {
        "default": "32px",
      },
    },
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--input)",
      ":focus-visible": "var(--ring)",
    },
    "backgroundColor": {
      "default": "light-dark(var(--background), color-mix(in oklab, var(--input) 32%, transparent))",
    },
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "13px",
    "boxShadow": {
      "default": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
      ":focus-visible": "0 0 0 2px color-mix(in oklab, var(--ring) 24%, transparent)",
    },
    "outline": "none",
  },
  s2: {
    "display": "flex",
    "height": "28px",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
    "overflow": "hidden",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s3: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "4px",
  },
  s4: {
    "color": "color-mix(in oklab, var(--muted-foreground) 48%, transparent)",
  },
  s5: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s6: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s7: {
    "marginLeft": "auto",
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
  },
  s8: {
    "height": "256px",
    "overflowY": "auto",
    "padding": "4px",
  },
  s9: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "width": "14px",
    "height": "14px",
  },
  s11: {
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s12: {
    "display": "flex",
    "height": "32px",
    "width": "100%",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s13: {
    "backgroundColor": "var(--accent)",
    "color": "var(--accent-foreground)",
  },
  s14: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s15: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--success)",
  },
  s16: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s17: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s18: {
    "marginLeft": "auto",
    "display": "flex",
    "minWidth": "0px",
    "flexShrink": 1,
    "alignItems": "center",
    "gap": "8px",
  },
  s19: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s21: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s23: {
    "color": "var(--destructive)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s24: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s25: {
    "flexShrink": 0,
  },
  s26: {
    "maxWidth": "160px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// FolderBrowser walks the box's folders. Git repositories are marked; Enter
// on one adds it. Any folder can be added, though only git ones get
// worktrees. Typing a path in the field jumps there.
export function FolderBrowser({ box, start, onAdded }: { box: string; start?: string; onAdded(loc: Location): Promise<void> }) {
  const [listing, setListing] = useState<FsListing>();
  const [typed, setTyped] = useState("");
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    async (path: string, fallback?: string) => {
      const client = useStore.getState().client;
      if (!client) return;
      setLoading(true);
      setError(undefined);
      try {
        const l = await projectsApi.list(client, box, path);
        setListing(l);
        setTyped(shortPath(l.path, l.home));
        setActive(l.entries.length ? 0 : -1);
      } catch (err) {
        if (fallback) return go(fallback);
        setError(plainError(err));
      } finally {
        setLoading(false);
      }
    },
    [box],
  );

  // Start where the field pointed, else ~/work, where projects usually
  // live; home when it is not there.
  useEffect(() => {
    void (start ? go(start, "~/work") : go("~/work", "~"));
    // Only where it starts; browsing moves on from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const entries = listing?.entries ?? [];
  const selected: FsEntry | undefined = entries[active];
  // What Add adds: the selected folder, or the one being shown.
  const target: FsEntry | undefined = selected ?? (listing ? { name: listing.path.split("/").pop() ?? "", path: listing.path } : undefined);

  const projects = useStore((st) => st.boxes[box]?.locations);
  const existing = (e?: FsEntry) => (e ? projects?.find((l) => l.path === e.path) : undefined);

  const add = async (e: FsEntry) => {
    const client = useStore.getState().client;
    if (!client || adding) return;
    // Already a project: open it rather than add it twice.
    const known = existing(e);
    if (known) return onAdded(known);
    setAdding(true);
    setError(undefined);
    try {
      const loc = await projectsApi.add(client, box, uniqueName(box, e.name), e.path);
      await onAdded(loc);
    } catch (err) {
      setError(plainError(err));
      setAdding(false);
    }
  };

  const open = (e: FsEntry) => (e.git ? void add(e) : void go(e.path));

  const crumbs = listing ? crumbsFor(listing) : [];

  return (
    <>
      <DialogPanel inset="body" stack={2}>
        <div className={sx(paint.s0)}>
          <Button size="icon" variant="outline" aria-label="Up a folder" disabled={!listing?.parent} onClick={() => listing?.parent && void go(listing.parent)}>
            <ArrowUpIcon />
          </Button>
          <input
            autoFocus
            value={typed}
            spellCheck={false}
            aria-label="Path"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, entries.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const here = listing ? shortPath(listing.path, listing.home) : "";
                if (typed.trim() && typed.trim() !== here) void go(typed.trim());
                else if (selected) open(selected);
              }
            }}
            className={sx(paint.s1)}
          />
        </div>
        <Frame radius="xl" tray>
          <nav aria-label="Folder" className={sx(paint.s2)}>
            {crumbs.map((c, i) => (
              <span key={c.path} className={sx(paint.s3)}>
                {i > 0 && <span className={sx(paint.s4)}>/</span>}
                <button type="button" onClick={() => void go(c.path)} className={[sx(paint.s5), i === crumbs.length - 1 && sx(paint.s6)].filter(Boolean).join(" ")}>
                  {c.label}
                </button>
              </span>
            ))}
            {loading && listing && <LoaderIcon className={[sx(paint.s7), "burf-spin"].filter(Boolean).join(" ")} />}
          </nav>
          <FramePanel bare>
            <div ref={listRef} role="listbox" aria-label="Folders" className={sx(paint.s8)}>
              {loading && !listing ? (
                <p className={sx(paint.s9)}>
                  <LoaderIcon className={[sx(paint.s10), "burf-spin"].filter(Boolean).join(" ")} /> Reading {box}…
                </p>
              ) : entries.length === 0 ? (
                <p className={sx(paint.s11)}>No folders here.</p>
              ) : (
                entries.map((e, n) => (
                  <button
                    key={e.path}
                    type="button"
                    role="option"
                    data-index={n}
                    aria-selected={n === active}
                    onClick={() => setActive(n)}
                    onDoubleClick={() => open(e)}
                    className={[sx(paint.s12), n === active ? sx(paint.s13) : sx(paint.s14)].filter(Boolean).join(" ")}
                  >
                    {e.git ? <GitBranchIcon className={sx(paint.s15)} /> : <FolderIcon className={sx(paint.s16)} />}
                    <span className={sx(paint.s17)}>{e.name}</span>
                    <span className={sx(paint.s18)}>
                      {e.slug && <span className={sx(paint.s19)}>{e.slug}</span>}
                      {existing(e) && <span className={sx(paint.s20)}>added</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          </FramePanel>
        </Frame>
        {target && !target.git && !existing(target) && (
          <p className={sx(paint.s21)}>
            <TriangleAlertIcon className={sx(paint.s22)} />
            {target.name || "This folder"} is not a git repository: it can be a project, but worktrees need git.
          </p>
        )}
        {error && <ErrorText className={sx(paint.s23)} text={error} />}
      </DialogPanel>
      <DialogFooter pad="split">
        <span className={sx(paint.s24)}>↵ opens a folder or adds a repository</span>
        <span className={sx(paint.s25)}><Button  loading={adding} disabled={!target || loading} onClick={() => target && void add(target)}>
          {existing(target) ? "Go to" : "Add"} {target?.name ? <span className={sx(paint.s26)}>{target.name}</span> : "this folder"}
        </Button></span>
      </DialogFooter>
    </>
  );
}

function crumbsFor(l: FsListing): { label: string; path: string }[] {
  const underHome = l.path === l.home || l.path.startsWith(`${l.home}/`);
  const root = underHome ? l.home : "";
  const rest = (underHome ? l.path.slice(l.home.length) : l.path).split("/").filter(Boolean);
  const out = [{ label: underHome ? "~" : "/", path: underHome ? l.home : "/" }];
  let at = root;
  for (const part of rest) {
    at = `${at}/${part}`;
    out.push({ label: part, path: at });
  }
  return out;
}
