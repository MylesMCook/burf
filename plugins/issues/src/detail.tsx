import * as stylex from "@stylexjs/stylex";
import type { BerthPluginContext, Project } from "@berth/plugin";
import {
  AgentIcon,
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  Button,
  Icon,
  Kbd,
  Skeleton,
  Spinner,
  Textarea,
  Tip,
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@berth/plugin/ui";
import { useEffect, useState } from "react";

import * as gh from "./gh";
import { Markdown } from "./markdown";
import { type Run, describeProblem, detailOf, loadDetail, postComment, runnerOf, useIssuesStore } from "./store";

const paint = stylex.create({
  s0: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "flexDirection": "column",
    "gap": "16px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "20px",
    "paddingBottom": "20px",
  },
  s1: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
  },
  s2: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s3: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--success) 12%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--success-foreground)",
  },
  s4: {
    "width": "12px",
    "height": "12px",
  },
  s5: {
    "fontFamily": "var(--font-mono)",
  },
  s6: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s7: {
    "fontWeight": 600,
    "fontSize": "18px",
    "lineHeight": "1.375",
    "letterSpacing": "-0.025em",
  },
  s8: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "6px",
  },
  s9: {
    "marginLeft": "4px",
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "width": "12px",
    "height": "12px",
  },
  s11: {
    "marginTop": "4px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
  },
  s12: {
    "width": "14px",
    "height": "14px",
  },
  s13: {
    "marginLeft": "4px",
    "height": "18px",
    "backgroundColor": "color-mix(in oklab, var(--primary-foreground) 15%, transparent)",
    "fontSize": "10px",
    "color": "var(--primary-foreground)",
  },
  s14: {
    "width": "14px",
    "height": "14px",
  },
  s15: {
    "width": "14px",
    "height": "14px",
  },
  s16: {
    "display": "flex",
    "flexDirection": "column",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s17: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s18: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "fontSize": "13px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s19: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s21: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "padding": "16px",
  },
  s23: {
    "height": "14px",
  },
  s24: {
    "height": "14px",
    "width": "100%",
  },
  s25: {
    "height": "14px",
  },
  s26: {
    "height": "14px",
  },
  s27: {
    "color": "var(--muted-foreground)",
    "fontSize": "13px",
    "fontStyle": "italic",
  },
  s28: {
    "alignSelf": "center",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s29: {
    "display": "flex",
    "flexDirection": "column",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s30: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s31: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "13px",
  },
  s32: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s33: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s34: {
    "fontWeight": 500,
  },
  s35: {
    "color": "var(--muted-foreground)",
  },
  s36: {
    "backgroundColor": "var(--info)",
  },
  s37: {
    "color": "var(--info-foreground)",
  },
  s38: {
    "backgroundColor": "var(--warning)",
  },
  s39: {
    "color": "var(--warning-foreground)",
  },
  s40: {
    "backgroundColor": "var(--success)",
  },
  s41: {
    "color": "var(--success-foreground)",
  },
  s42: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  s43: {
    "color": "var(--muted-foreground)",
  },
  s44: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s45: {
    "width": "12px",
    "height": "12px",
  },
  s46: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "fontWeight": 500,
    "fontSize": "11px",
  },
  s47: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s48: {
    "display": "flex",
    "gap": "12px",
  },
  s49: {
    "marginTop": "2px",
    "width": "24px",
    "height": "24px",
    "fontSize": "10px",
  },
  s50: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s51: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s52: {
    "fontWeight": 500,
  },
  s53: {
    "color": "var(--muted-foreground)",
  },
  s54: {
    "color": "var(--muted-foreground)",
  },
  s55: {
    "marginLeft": "auto",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s56: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s57: {
    "display": "flex",
    "gap": "12px",
  },
  s58: {
    "marginTop": "2px",
    "width": "24px",
    "height": "24px",
    "fontSize": "10px",
  },
  s59: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "8px",
  },
  s60: {
    "minHeight": "80px",
    "fontSize": "13px",
  },
  s61: {
    "color": "var(--destructive)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s62: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "8px",
  },
  s63: {
    "marginRight": "auto",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s64: {
    "width": "14px",
    "height": "14px",
  },
  s65: {
    "width": "14px",
    "height": "14px",
  },
  s66: {
    "marginLeft": "24px",
    "marginRight": "24px",
    "marginBottom": "20px",
    "maxHeight": "192px",
    "overflowY": "auto",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s67: {
    "width": "14px",
    "height": "14px",
  },
  s68: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "12px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s69: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s70: {
    "minWidth": "0px",
  },
  s71: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s72: {
    "marginTop": "2px",
    "whiteSpace": "pre-wrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s73: {
    "display": "inline-flex",
    "maxWidth": "176px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "11px",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "lineHeight": "18px",
  },
  s74: {
    "width": "8px",
    "height": "8px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s75: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s76: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": {
      "default": "light-dark(#8250df, #a371f7)",
    },
  },
  s77: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--destructive)",
  },
  s78: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s79: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--success)",
  },
  s80: {
    "display": "grid",
    "width": "20px",
    "height": "20px",
    "flexShrink": 0,
    "placeItems": "center",
    "borderRadius": "999px",
    "fontWeight": 600,
    "fontSize": "9px",
    "color": "#fff",
    "textTransform": "uppercase",
  },
  q81: {
    "backgroundColor": "var(--info)",
  },
  q82: {
    "backgroundColor": "var(--warning)",
  },
  q83: {
    "backgroundColor": "var(--success)",
  },
  q84: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  q85: {
    "maxWidth": "48rem",
  },
  q86: {
    "width": "33.33%",
  },
  q87: {
    "width": "83.33%",
  },
  q88: {
    "width": "66.67%",
  },
  q89: {
    "color": "var(--info-foreground)",
  },
  q90: {
    "color": "var(--warning-foreground)",
  },
  q91: {
    "color": "var(--success-foreground)",
  },
  q92: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The right-hand pane: one issue, its thread, the agents on it, and
// "Start an agent".

export interface Row extends gh.Issue {
  key: string;
  repo: string;
  project: Project;
}

export function Detail({ berth, row, runs, viewer, onStart }: { berth: BerthPluginContext; row: Row; runs: Run[]; viewer?: string; onStart(): void }) {
  useIssuesStore();
  const load = detailOf(row.repo, row.number);
  useEffect(() => {
    void loadDetail(berth, row.project, row.number);
  }, [berth, row.project, row.number]);
  const detail = load?.status === "ok" ? load.value : load?.status === "loading" ? load.prev : undefined;
  const url = gh.issueUrl(row.repo, row.number);
  const open = (u: string) => berth.openUrl(u);

  return (
    <article className={[sx(paint.s0), sx(paint.q85)].filter(Boolean).join(" ")}>
      <header className={sx(paint.s1)}>
        <p className={sx(paint.s2)}>
          <span className={sx(paint.s3)}>
            <Icon name="CircleDot" className={sx(paint.s4)} />
            Open
          </span>
          <span className={sx(paint.s5)}>
            {row.repo}#{row.number}
          </span>
          <span>·</span>
          <span>
            opened {gh.since(row.createdAt)} by <b className={sx(paint.s6)}>{row.author ?? "ghost"}</b>
          </span>
        </p>
        <h2 className={sx(paint.s7)}>{row.title}</h2>
        {(row.labels.length > 0 || row.assignees.length > 0) && (
          <div className={sx(paint.s8)}>
            {row.labels.map((l) => (
              <LabelChip key={l.name} label={l} />
            ))}
            {row.assignees.length > 0 && (
              <span className={sx(paint.s9)}>
                <Icon name="UserRound" className={sx(paint.s10)} />
                {row.assignees.map((a) => (a === viewer ? "you" : a)).join(", ")}
              </span>
            )}
          </div>
        )}
        <div className={sx(paint.s11)}>
          <Button size="sm" onClick={onStart}>
            <Icon name="Bot" className={sx(paint.s12)} />
            Start an agent
            <Kbd className={sx(paint.s13)}>S</Kbd>
          </Button>
          <Button size="sm" variant="outline" onClick={() => open(url)}>
            <Icon name="ExternalLink" className={sx(paint.s14)} />
            Open on GitHub
          </Button>
          <Tooltip>
            <TooltipTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Refresh this issue" onClick={() => void loadDetail(berth, row.project, row.number, true)} />}>
              <Icon name="RefreshCw" className={[sx(paint.s15), load?.status === "loading" && "burf-spin"].filter(Boolean).join(" ")} />
            </TooltipTrigger>
            <TooltipPopup>Refresh this issue</TooltipPopup>
          </Tooltip>
        </div>
      </header>

      {runs.length > 0 && <Runs berth={berth} runs={runs} />}

      {detail && detail.prs.length > 0 && (
        <section className={sx(paint.s16)}>
          <h3 className={sx(paint.s17)}>Pull requests that close it</h3>
          {detail.prs.map((pr) => (
            <button key={pr.number} type="button" onClick={() => open(pr.url ?? gh.pullUrl(row.repo, pr.number))} className={sx(paint.s18)}>
              <PrIcon pr={pr} />
              <span className={sx(paint.s19)}>#{pr.number}</span>
              <span className={sx(paint.s20)}>{pr.title}</span>
              <span className={sx(paint.s21)}>{pr.draft ? "Draft" : pr.state === "OPEN" ? "Open" : pr.state === "MERGED" ? "Merged" : "Closed"}</span>
            </button>
          ))}
        </section>
      )}

      {load?.status === "problem" && !detail ? (
        <Problem problem={load.problem} box={runnerOf(row.project)?.box} />
      ) : !detail ? (
        <div className={sx(paint.s22)}>
          <Skeleton className={[sx(paint.s23), sx(paint.q86)].filter(Boolean).join(" ")} />
          <Skeleton className={sx(paint.s24)} />
          <Skeleton className={[sx(paint.s25), sx(paint.q87)].filter(Boolean).join(" ")} />
          <Skeleton className={[sx(paint.s26), sx(paint.q88)].filter(Boolean).join(" ")} />
        </div>
      ) : (
        <>
          <Post author={detail.author} at={detail.createdAt} viewer={viewer} badge="Author">
            {detail.body.trim() ? <Markdown source={detail.body} repo={row.repo} onLink={open} /> : <p className={sx(paint.s27)}>No description.</p>}
          </Post>
          {detail.totalComments > detail.comments.length && (
            <button type="button" onClick={() => open(url)} className={sx(paint.s28)}>
              {detail.totalComments - detail.comments.length} earlier comments on GitHub
            </button>
          )}
          {detail.comments.map((c, i) => (
            <Post key={c.url ?? i} author={c.author} at={c.createdAt} viewer={viewer} badge={c.author && c.author === detail.author ? "Author" : undefined}>
              <Markdown source={c.body} repo={row.repo} onLink={open} />
            </Post>
          ))}
          <Composer berth={berth} row={row} viewer={viewer} />
        </>
      )}
    </article>
  );
}

function Runs({ berth, runs }: { berth: BerthPluginContext; runs: Run[] }) {
  return (
    <section className={sx(paint.s29)}>
      <h3 className={sx(paint.s30)}>Agents on this issue</h3>
      {runs.map((r) => (
        <div key={`${r.box}:${r.path}`} className={sx(paint.s31)}>
          {r.session ? <AgentIcon agent={r.session.agent} /> : <Icon name="GitBranch" className={sx(paint.s32)} />}
          <span className={sx(paint.s33)}>
            <span className={sx(paint.s34)}>{r.worktree}</span>
            <span className={sx(paint.s35)}> · {r.box}</span>
          </span>
          <StatePill run={r} />
          <Button size="xs" variant="outline" onClick={() => berth.openWorktree({ box: r.box, location: r.location, worktree: r.worktree, path: r.path })}>
            Open
          </Button>
        </div>
      ))}
    </section>
  );
}

const STATES: Record<string, { label: string; dot: string; text: string }> = {
  running: { label: "Running", dot: [sx(paint.q81), "burf-pulse"].filter(Boolean).join(" "), text: sx(paint.q89) },
  waiting: { label: "Needs you", dot: sx(paint.q82), text: sx(paint.q90) },
  finished: { label: "Done", dot: sx(paint.q83), text: sx(paint.q91) },
  idle: { label: "Idle", dot: sx(paint.q84), text: sx(paint.q92) },
};

// StatePill is how an issue's agent is doing, or that only its worktree is left.
export function StatePill({ run, compact }: { run: Run; compact?: boolean }) {
  const s = run.session ? (STATES[run.session.agent_state ?? ""] ?? STATES.idle) : undefined;
  if (!s) {
    return (
      <span className={sx(paint.s44)}>
        <Icon name="GitBranch" className={sx(paint.s45)} />
        {compact ? "" : "No agent"}
      </span>
    );
  }
  return (
    <span className={[sx(paint.s46), s.text].filter(Boolean).join(" ")}>
      <span className={[sx(paint.s47), s.dot].filter(Boolean).join(" ")} />
      {s.label}
    </span>
  );
}

function Post({ author, at, viewer, badge, children }: { author?: string; at: string; viewer?: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className={sx(paint.s48)}>
      <Avatar login={author} className={sx(paint.s49)} />
      <div className={sx(paint.s50)}>
        <div className={sx(paint.s51)}>
          <b className={sx(paint.s52)}>{author ?? "ghost"}</b>
          {author && author === viewer && <span className={sx(paint.s53)}>(you)</span>}
          <span className={sx(paint.s54)}>· {gh.since(at)}</span>
          {badge && <span className={sx(paint.s55)}>{badge}</span>}
        </div>
        <div className={sx(paint.s56)}>{children}</div>
      </div>
    </div>
  );
}

// Comments go out as whoever gh is logged in as on the box, publicly, so
// they are always confirmed first.
function Composer({ berth, row, viewer }: { berth: BerthPluginContext; row: Row; viewer?: string }) {
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string>();
  const box = runnerOf(row.project)?.box;

  async function post() {
    setPosting(true);
    setError(undefined);
    try {
      await postComment(berth, row.project, row.number, text.trim());
      setText("");
      setConfirming(false);
      berth.notify(`Commented on #${row.number}`, row.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConfirming(false);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className={sx(paint.s57)}>
      <Avatar login={viewer} className={sx(paint.s58)} />
      <div className={sx(paint.s59)}>
        <Textarea
          className={sx(paint.s60)}
          placeholder="Leave a comment (Markdown)"
          value={text}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
              e.preventDefault();
              setConfirming(true);
            }
          }}
        />
        {error && <p className={sx(paint.s61)}>{error}</p>}
        <div className={sx(paint.s62)}>
          <span className={sx(paint.s63)}>{viewer && box ? `Posts as @${viewer}, with gh on ${box}.` : null}</span>
          <Button size="sm" variant="outline" disabled={!text.trim() || posting} onClick={() => setConfirming(true)}>
            {posting ? <Spinner className={sx(paint.s64)} /> : <Icon name="MessageSquare" className={sx(paint.s65)} />}
            Comment
          </Button>
        </div>
      </div>
      <AlertDialog open={confirming} onOpenChange={(o: boolean) => !posting && setConfirming(o)}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Comment on {row.repo}#{row.number}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It's posted publicly{viewer ? ` as @${viewer}` : ""} and everyone watching the issue is notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className={sx(paint.s66)}>
            <Markdown source={text} repo={row.repo} onLink={() => undefined} />
          </div>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" disabled={posting} />}>Cancel</AlertDialogClose>
            <Button onClick={() => void post()} disabled={posting}>
              {posting && <Spinner className={sx(paint.s67)} />}
              Post comment
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}

export function Problem({ problem, box, className }: { problem: gh.Problem; box?: string; className?: string }) {
  const d = describeProblem(problem, box);
  return (
    <div className={[sx(paint.s68), className].filter(Boolean).join(" ")}>
      <Icon name={d.icon} className={sx(paint.s69)} />
      <div className={sx(paint.s70)}>
        <p className={sx(paint.s71)}>{d.title}</p>
        <p className={sx(paint.s72)}>{d.body}</p>
      </div>
    </div>
  );
}

// LabelChip shows an issue's label in its colour. Filtering by labels is
// FilterChip's, in the toolbar.
export function LabelChip({ label }: { label: gh.Label }) {
  return (
    <span className={sx(paint.s73)}>
      <span className={sx(paint.s74)} style={{ backgroundColor: `#${label.color}` }} />
      <span className={sx(paint.s75)}>{label.name}</span>
    </span>
  );
}

function PrIcon({ pr }: { pr: gh.LinkedPR }) {
  if (pr.state === "MERGED") return <Icon name="GitMerge" className={sx(paint.s76)} />;
  if (pr.state === "CLOSED") return <Icon name="GitPullRequestClosed" className={sx(paint.s77)} />;
  if (pr.draft) return <Icon name="GitPullRequestDraft" className={sx(paint.s78)} />;
  return <Icon name="GitPullRequest" className={sx(paint.s79)} />;
}

export { PrIcon };

// Avatar is a login's initial on a colour of its own: no images are
// fetched, so nothing about who looks at what leaves the app.
export function Avatar({ login, className }: { login?: string; className?: string }) {
  const name = login ?? "?";
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <Tip label={login}>
      <span
        role="img"
        aria-label={login ?? "Unknown"}
        className={[sx(paint.s80), className].filter(Boolean).join(" ")}
        style={{ backgroundColor: `hsl(${h} 45% 45%)` }}
      >
        {name.replace(/^app\//, "").slice(0, 1)}
      </span>
    </Tip>
  );
}
