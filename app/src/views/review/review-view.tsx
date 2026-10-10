import * as stylex from "@stylexjs/stylex";
import { CheckIcon, GitPullRequestIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { ago } from "@/lib/format";
import { useNotifications } from "@/lib/notifications";
import { useStore } from "@/lib/store";
import { useSessionTitle } from "@/hooks/use-session-name";
import { focusSession } from "@/lib/workspaces";
import { ViewHeader } from "@/views/view-header";
import { type ApproveMode, ApproveDialog, DiscardDialog, SendBackDialog } from "@/views/review/review-actions";
import { ReviewDetail } from "@/views/review/review-detail";
import { CompareStrip, CompareView } from "@/views/review/compare-view";
import { allRuns, useRuns } from "@/lib/runs";
import { markReviewed, type ReviewEntry, refreshReview, reviewName, useReview, useReviewName, visibleEntries, watchReview } from "@/views/review/review-store";
import { Tip } from "@/components/tip";
import { BoxError, NeedsUpdate } from "@/components/upgrade-box";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
  },
  s1: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s3: {
    "display": "flex",
    "width": "320px",
    "flexShrink": 0,
    "flexDirection": "column",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s4: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "padding": "8px",
  },
  s5: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "10px",
    "overflow": "hidden",
    "whiteSpace": "nowrap",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s6: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s7: {
    "height": "16px",
    "minWidth": "16px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "10px",
  },
  s8: {
    "display": "flex",
    "flexShrink": 0,
    "flexDirection": "column",
    "gap": "4px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "fontWeight": 500,
  },
  s11: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "4px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "var(--row-pad)",
    "paddingBottom": "var(--row-pad)",
    "textAlign": "left",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s12: {
    "backgroundColor": {
      "default": "var(--accent)",
      ":hover": "var(--accent)",
    },
  },
  s13: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s14: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s15: {
    "flexShrink": 0,
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s16: {
    "color": "var(--warning-foreground)",
  },
  s17: {
    "color": "var(--muted-foreground)",
  },
  s18: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingLeft": "22px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s19: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
    "overflow": "hidden",
    "whiteSpace": "nowrap",
    "paddingLeft": "22px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s20: {
    "fontFamily": "var(--font-mono)",
    "fontVariantNumeric": "tabular-nums",
  },
  s21: {
    "color": "var(--success-foreground)",
  },
  s22: {
    "color": "var(--destructive-foreground)",
  },
  s23: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s24: {
    "color": "var(--success-foreground)",
  },
  s25: {
    "color": "var(--destructive-foreground)",
  },
  s26: {
    "width": "12px",
    "height": "12px",
  },
  s27: {
    "width": "12px",
    "height": "12px",
  },
  s28: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s29: {
    "width": "12px",
    "height": "12px",
  },

  s30: {
    "@media (max-width: 1279px)": {
      width: 256,
    },
  },
  s31: {
    "@media (max-width: 1279px)": {
      display: "none",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type Dialog = { kind: "approve"; mode: ApproveMode } | { kind: "send" } | { kind: "discard" };

// ReviewView is the inbox of agents' finished work on every box: pick an
// item, read what changed, then approve, send back or discard it.
export function ReviewView() {
  // Select the stable parts; filtering in the selector would make a new
  // array on every read.
  const all = useReview((s) => s.entries);
  const reviewed = useReview((s) => s.reviewed);
  const entries = useMemo(() => visibleEntries({ entries: all, reviewed }), [all, reviewed]);
  const loaded = useReview((s) => s.loaded);
  const loading = useReview((s) => s.loading);
  const outdated = useReview((s) => s.outdated);
  const errors = useReview((s) => s.errors);
  const [selectedKey, setSelectedKey] = useState<string>();
  const [dialog, setDialog] = useState<Dialog>();
  // Compare mode: an attempts run's attempts side by side.
  const view = useStore((s) => s.view);
  const [compare, setCompare] = useState<{ box: string; id: string } | undefined>(view.kind === "review" ? view.run : undefined);
  useEffect(() => {
    if (view.kind === "review" && view.run) setCompare(view.run);
  }, [view]);
  const byBox = useRuns((s) => s.byBox);
  const attempts = useMemo(
    () =>
      allRuns(byBox)
        .filter((r) => r.template === "attempts" && (r.candidates ?? 0) > 0 && (r.status === "waiting_gate" || Date.now() - new Date(r.updated).getTime() < 24 * 3600_000))
        .sort((a, b) => (a.status === "waiting_gate" ? -1 : 0) - (b.status === "waiting_gate" ? -1 : 0))
        .slice(0, 6),
    [byBox],
  );

  useEffect(() => {
    watchReview();
    void refreshReview();
  }, []);

  // A notification's "Open review" picks its item.
  const focus = useNotifications((s) => s.reviewFocus);
  useEffect(() => {
    if (!focus) return;
    setSelectedKey(focus);
    useNotifications.setState({ reviewFocus: undefined });
  }, [focus]);

  const selected = entries.find((e) => e.key === selectedKey) ?? entries[0];
  const index = selected ? entries.indexOf(selected) : -1;

  const actions = useMemo(
    () => ({
      approve: (mode: ApproveMode) => selected && setDialog({ kind: "approve", mode }),
      sendBack: () => selected && setDialog({ kind: "send" }),
      discard: () => selected && selected.files.length > 0 && setDialog({ kind: "discard" }),
      open: () => selected && void focusSession(selected.box, selected.session),
      markReviewed: () => {
        if (!selected) return;
        const next = entries[index + 1] ?? entries[index - 1];
        markReviewed(selected);
        setSelectedKey(next?.key);
        toastManager.add({ title: `Marked ${reviewName(selected)} reviewed`, description: "It comes back if the agent changes anything.", type: "info" });
      },
    }),
    [selected, entries, index],
  );

  // j/k move, a/s/d act, Enter opens, e marks reviewed — unless typing or a
  // dialog or menu is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (compare || dialog || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true], .xterm, [data-terminal]") || document.querySelector("[data-slot=dialog-popup], [data-slot=menu-popup], [role=menu]"))) return;
      // Enter on a focused button presses it.
      if (e.key === "Enter" && t?.closest("button, a")) return;
      const move = (d: number) => {
        const next = entries[Math.min(entries.length - 1, Math.max(0, index + d))];
        if (next) {
          setSelectedKey(next.key);
          document.getElementById(`review-${next.key}`)?.scrollIntoView({ block: "nearest" });
        }
      };
      const keys: Record<string, () => void> = {
        j: () => move(1),
        ArrowDown: () => move(1),
        k: () => move(-1),
        ArrowUp: () => move(-1),
        a: () => actions.approve(selected?.files.length ? "commit" : "push"),
        s: actions.sendBack,
        d: actions.discard,
        e: actions.markReviewed,
        Enter: actions.open,
      };
      const run = keys[e.key];
      if (run && selected) {
        e.preventDefault();
        run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entries, index, selected, actions, dialog, compare]);

  return (
    <div className={sx(paint.s0)}>
      <ViewHeader
        title="Review"
        description="Agents' finished work on every box, to approve, send back or discard."
        actions={
          <Button size="sm" variant="ghost" onClick={() => void refreshReview()} disabled={loading} aria-label="Refresh">
            <RefreshCwIcon className={loading ? "burf-spin" : undefined} />
            Refresh
          </Button>
        }
      />
      <Notices outdated={outdated} errors={errors} />
      {!compare && <CompareStrip runs={attempts} onOpen={(r) => setCompare({ box: r.box, id: r.id })} />}
      {compare ? (
        <CompareView
          box={compare.box}
          id={compare.id}
          onClose={() => {
            setCompare(undefined);
            useStore.getState().setView({ kind: "review" });
          }}
        />
      ) : !loaded ? (
        <div className={sx(paint.s1)}>
          <Spinner  size="lg"/> Reading each box's worktrees…
        </div>
      ) : entries.length === 0 ? null : (
        <div className={sx(paint.s2)}>
          <aside aria-label="Work to review" className={[sx(paint.s3), sx(paint.s30)].filter(Boolean).join(" ")}>
            <ul className={sx(paint.s4)} aria-label="Work to review">
              {entries.map((e) => (
                <Row key={e.key} entry={e} active={e.key === selected?.key} onSelect={() => setSelectedKey(e.key)} onOpen={() => void focusSession(e.box, e.session)} />
              ))}
            </ul>
            <footer className={sx(paint.s5)}>
              {(
                [
                  ["J K", "move"],
                  ["A", "approve"],
                  ["S", "send back"],
                  ["D", "discard"],
                ] as const
              ).map(([keys, label]) => (
                <span key={label} className={[sx(paint.s6), label === "discard" && sx(paint.s31)].filter(Boolean).join(" ")}>
                  {keys.split(" ").map((k) => (
                    <span className={sx(paint.s7)}><Kbd key={k}>
                      {k}
                    </Kbd></span>
                  ))}
                  {label}
                </span>
              ))}
            </footer>
          </aside>
          {selected && <ReviewDetail key={selected.key} entry={selected} actions={actions} />}
        </div>
      )}
      {selected && dialog?.kind === "approve" && <ApproveDialog entry={selected} initial={dialog.mode} onClose={() => setDialog(undefined)} />}
      {selected && dialog?.kind === "send" && <SendBackDialog entry={selected} onClose={() => setDialog(undefined)} />}
      {selected && dialog?.kind === "discard" && <DiscardDialog entry={selected} onClose={() => setDialog(undefined)} />}
    </div>
  );
}

function Notices({ outdated, errors }: { outdated: string[]; errors: Record<string, string> }) {
  const failing = Object.entries(errors);
  if (!outdated.length && !failing.length) return null;
  return (
    <div className={sx(paint.s8)}>
      {outdated.map((box) => (
        <NeedsUpdate key={box} box={box} className={sx(paint.s9)}>
          <span className={sx(paint.s10)}>{box}</span> runs an older berthd without Review. Update it to include its agents' work here.
        </NeedsUpdate>
      ))}
      {failing.map(([box, msg]) => (
        <BoxError key={box} box={box} error={msg} what="its work for review" />
      ))}
    </div>
  );
}

function Row({ entry, active, onSelect, onOpen }: { entry: ReviewEntry; active: boolean; onSelect(): void; onOpen(): void }) {
  const pr = useReview((s) => s.prs[entry.key]);
  const run = useReview((s) => s.runs[entry.key]);
  const files = entry.files.length || entry.committed.length;
  const added = entry.files.length ? entry.added : entry.committed.reduce((n, f) => n + f.added, 0);
  const removed = entry.files.length ? entry.removed : entry.committed.reduce((n, f) => n + f.removed, 0);
  const waiting = entry.agent_state === "waiting";
  // Led by the work the agent did, when its session has a title.
  const work = useSessionTitle(entry.box, entry.session);
  const name = useReviewName(entry);
  return (
    <li id={`review-${entry.key}`}>
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onOpen}
        aria-current={active || undefined}
        className={[sx(paint.s11), active && sx(paint.s12)].filter(Boolean).join(" ")}
      >
        <span className={sx(paint.s13)}>
          <AgentIcon agent={entry.agent} />
          <span className={sx(paint.s14)}>{work ?? name}</span>
          <span className={[sx(paint.s15), waiting ? sx(paint.s16) : sx(paint.s17)].filter(Boolean).join(" ")}>{waiting ? "needs you" : ago(entry.state_since)}</span>
        </span>
        <span className={sx(paint.s18)}>
          {work && `${name} · `}
          {entry.box} · {entry.location}
          {entry.branch && <span> · {entry.branch}</span>}
        </span>
        <span className={sx(paint.s19)}>
          <span>
            {files} file{files === 1 ? "" : "s"}
          </span>
          <span className={sx(paint.s20)}>
            <span className={sx(paint.s21)}>+{added}</span> <span className={sx(paint.s22)}>−{removed}</span>
          </span>
          {!entry.files.length && entry.base_ahead > 0 && <span>committed</span>}
          {run && run.status !== "running" && (
            <Tip label={`Flow ${run.flow} ${run.status}`}>
              <span className={[sx(paint.s23), run.status === "succeeded" ? sx(paint.s24) : sx(paint.s25)].filter(Boolean).join(" ")}>
                {run.status === "succeeded" ? <CheckIcon aria-label="passed" className={sx(paint.s26)} /> : <XIcon aria-label="failed" className={sx(paint.s27)} />}
                check
              </span>
            </Tip>
          )}
          {pr && (
            <Tip label={pr.title}>
              <span className={sx(paint.s28)}>
                <GitPullRequestIcon aria-label="Pull request" className={sx(paint.s29)} />#{pr.number}
              </span>
            </Tip>
          )}
        </span>
      </button>
    </li>
  );
}
