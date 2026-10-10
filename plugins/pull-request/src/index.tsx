import * as stylex from "@stylexjs/stylex";
import { definePlugin, sessionName, useEvent, useSessions, worktreeLocation, type WorktreePanelProps } from "@berth/plugin";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
  Icon,
  Input,
  Kbd,
  Menu,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  Skeleton,
  Switch,
  Textarea,
} from "@berth/plugin/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CiWidget, PullRequestsWidget, usePRCount } from "./home";
import { type Check, checkState, type CheckState, FIELDS, type Outcome, type PR, plainText, quote, readOutcome, since } from "./gh";

const paint = stylex.create({
  s0: {
    "whiteSpace": "pre-wrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "padding": "20px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s2: {
    "height": "24px",
  },
  s3: {
    "height": "16px",
  },
  s4: {
    "height": "112px",
    "width": "100%",
  },
  s5: {
    "height": "80px",
    "width": "100%",
  },
  s6: {
    "display": "flex",
    "height": "100%",
    "minHeight": "240px",
    "alignItems": "center",
    "justifyContent": "center",
    "padding": "24px",
  },
  s7: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "marginBottom": "8px",
    "width": "20px",
    "height": "20px",
    "color": "var(--muted-foreground)",
  },
  s8: {
    "backgroundColor": "color-mix(in oklab, var(--success) 12%, transparent)",
    "color": "var(--success)",
    "borderColor": "color-mix(in oklab, var(--success) 24%, transparent)",
  },
  s9: {
    "backgroundColor": "var(--muted)",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "backgroundColor": "color-mix(in oklab, oklch(0.6 0.18 300) 12%, transparent)",
    "color": "oklch(0.62 0.18 300)",
    "borderColor": "color-mix(in oklab, oklch(0.6 0.18 300) 24%, transparent)",
  },
  s11: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 10%, transparent)",
    "color": "var(--destructive)",
    "borderColor": "color-mix(in oklab, var(--destructive) 24%, transparent)",
  },
  s12: {
    "color": "var(--success)",
  },
  s13: {
    "color": "var(--destructive)",
  },
  s14: {
    "color": "var(--warning)",
  },
  s15: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "padding": "20px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "16px",
    },
  },
  s16: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s17: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "12px",
  },
  s18: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "fontWeight": 600,
    "fontSize": "16px",
    "lineHeight": "1.375",
  },
  s19: {
    "fontWeight": 400,
    "color": "var(--muted-foreground)",
  },
  s20: {
    "width": "14px",
    "height": "14px",
  },
  s21: {
    "width": "14px",
    "height": "14px",
  },
  s22: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "gap": "4px",
  },
  s24: {
    "width": "12px",
    "height": "12px",
  },
  s25: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s26: {
    "fontVariantNumeric": "tabular-nums",
  },
  s27: {
    "color": "var(--success)",
  },
  s28: {
    "color": "var(--destructive)",
  },
  s29: {
    "marginLeft": "auto",
    "display": "flex",
    "gap": "12px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s30: {
    "color": "var(--destructive)",
  },
  s31: {
    "color": "var(--warning)",
  },
  s32: {
    "color": "var(--muted-foreground)",
  },
  s33: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "20px",
    "paddingBottom": "20px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s34: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s35: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s36: {
    "width": "16px",
    "height": "16px",
  },
  s37: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s38: {
    "width": "16px",
    "height": "16px",
  },
  s39: {
    "marginLeft": "auto",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s40: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "20px",
    "paddingBottom": "20px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s41: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s42: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s43: {
    "width": "16px",
    "flexShrink": 0,
  },
  s44: {
    "width": "16px",
    "height": "16px",
  },
  s45: {
    "color": "var(--success)",
  },
  s46: {
    "fontWeight": 500,
  },
  s47: {
    "color": "var(--muted-foreground)",
  },
  s48: {
    "marginLeft": "auto",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s49: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s50: {
    "display": "flex",
    "gap": "10px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s51: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 40%, transparent)",
  },
  s52: {
    "marginTop": "2px",
  },
  s53: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s54: {
    "marginBottom": "4px",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s55: {
    "fontWeight": 500,
  },
  s56: {
    "color": "var(--muted-foreground)",
  },
  s57: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 4,
    "WebkitBoxOrient": "vertical",
    "whiteSpace": "pre-wrap",
    "color": "var(--muted-foreground)",
  },
  s58: {
    "flexShrink": 0,
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
  },
  s59: {
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    ":is(.group\\/row:hover &)": {
      "opacity": 1,
    },
  },
  s60: {
    "position": "sticky",
    "bottom": "12px",
    "zIndex": 10,
    "display": "flex",
    "width": "fit-content",
    "maxWidth": "100%",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "boxShadow": "0 10px 15px color-mix(in oklab, var(--foreground) 12%, transparent)",
  },
  s61: {
    "fontVariantNumeric": "tabular-nums",
  },
  s62: {
    "width": "14px",
    "height": "14px",
  },
  s63: {
    "width": "14px",
    "height": "14px",
  },
  s64: {
    "width": "14px",
    "height": "14px",
  },
  s65: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s66: {
    "width": "14px",
    "height": "14px",
  },
  s67: {
    "width": "14px",
    "height": "14px",
  },
  s68: {
    "color": "var(--success)",
  },
  s69: {
    "color": "var(--destructive)",
  },
  s70: {
    "color": "var(--warning)",
  },
  s71: {
    "color": "var(--muted-foreground)",
  },
  s72: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s73: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 40%, transparent)",
  },
  s74: {
    "width": "16px",
    "flexShrink": 0,
  },
  s75: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s76: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s77: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s78: {
    "marginLeft": "auto",
  },
  s79: {
    "display": "flex",
    "height": "100%",
    "minHeight": "240px",
    "alignItems": "center",
    "justifyContent": "center",
    "padding": "24px",
  },
  s80: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "marginBottom": "8px",
    "width": "20px",
    "height": "20px",
    "color": "var(--muted-foreground)",
  },
  s81: {
    "paddingLeft": "24px",
    "paddingRight": "24px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s82: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s83: {
    "whiteSpace": "pre-wrap",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "color": "var(--destructive)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  n0: {
    "width": "16px",
    "height": "16px",
  },
  n1: {
    "color": "var(--success)",
  },
  n2: {
    "color": "var(--destructive)",
  },
  n3: {
    "color": "var(--muted-foreground)",
  },
  q84: {
    "color": "var(--success)",
  },
  q85: {
    "color": "var(--destructive)",
  },
  q86: {
    "color": "var(--warning)",
  },
  q87: {
    "width": "66.67%",
  },
  q88: {
    "width": "33.33%",
  },
  q89: {
    "maxWidth": "48rem",
  },
  q90: {
    "color": "var(--success)",
  },
  q91: {
    "color": "var(--destructive)",
  },
  q92: {
    "color": "var(--warning)",
  },
  q93: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Pull request: the branch's PR as GitHub sees it, read with `gh` on the
// box, so what you see is what the box's credentials see.

export default definePlugin((berth) => {
  berth.addWorktreePanel({ id: "pr", title: "Pull request", icon: "GitPullRequest", Component: PullRequestPanel });
  berth.addCommand({ id: "open", title: "Show this worktree's pull request", group: "Git", run: () => berth.openPanel("pr") });
  berth.addHomeWidget({
    id: "prs",
    title: "Pull requests",
    description: "Pull requests waiting on your review, and your own with their checks.",
    icon: "GitPullRequest",
    category: "Code",
    sizes: ["l", "m", "t", "w"],
    source: "One GitHub search with gh on a box, every 3 minutes while on screen",
    useCount: usePRCount,
    Component: PullRequestsWidget,
  });
  berth.addHomeWidget({
    id: "ci",
    title: "CI failures",
    description: "Runs that failed on your worktrees' branches, a click from their logs.",
    icon: "CircleX",
    category: "Code",
    sizes: ["m", "s", "l", "w"],
    source: "gh run list in each GitHub project, every 3 minutes while on screen",
    Component: CiWidget,
  });
});

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

function PullRequestPanel({ berth, box, location, worktree, main, path }: WorktreePanelProps) {
  const where = worktreeLocation({ location, worktree, main });
  const [outcome, setOutcome] = useState<Outcome>();
  const [stamp, setStamp] = useState(0);
  const run = useCallback((command: string, timeout = "60s") => berth.orchestrate.exec(box, where, command, timeout), [berth, box, where]);
  const refresh = useCallback(() => setStamp((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    run(`gh pr view --json ${FIELDS} 2>&1`)
      .then((r) => live && setOutcome(readOutcome(r.exit_code, r.output)))
      .catch((err) => live && setOutcome({ kind: "error", message: String(err?.message ?? err) }));
    return () => {
      live = false;
    };
  }, [run, stamp]);

  // Checks move on their own; look again while any are running.
  useEffect(() => {
    if (outcome?.kind !== "pr" || !(outcome.pr.statusCheckRollup ?? []).some((c) => checkState(c) === "pending")) return;
    const t = setTimeout(refresh, 20_000);
    return () => clearTimeout(t);
  }, [outcome, refresh]);
  useEvent("flow.finished", refresh);
  // A new branch has its own PR (or none); a push moves this one.
  useWorktreeWatch(run, refresh);

  if (!outcome) return <Loading />;
  switch (outcome.kind) {
    case "pr":
      return <PRView pr={outcome.pr} berth={berth} box={box} path={path} onRefresh={refresh} />;
    case "none":
      return <NoPR run={run} worktree={worktree} onCreated={refresh} berth={berth} />;
    case "no-gh":
      return <Notice icon="Github" title="GitHub CLI isn't installed on this box" body={<>Install <code>gh</code> on {box} and sign in with <code>gh auth login</code> to see pull requests here.</>} onRetry={refresh} />;
    case "no-auth":
      return <Notice icon="KeyRound" title="gh isn't signed in on this box" body={<>Run <code>gh auth login</code> in a terminal on {box}, then refresh.</>} onRetry={refresh} />;
    case "not-github":
      return <Notice icon="GitBranch" title="Not a GitHub repository" body="This worktree's remotes don't point at GitHub, so there are no pull requests to show." onRetry={refresh} />;
    default:
      return <Notice icon="TriangleAlert" title="Couldn't read the pull request" body={<span className={sx(paint.s0)}>{outcome.message}</span>} onRetry={refresh} />;
  }
}

function Loading() {
  return (
    <div className={sx(paint.s1)}>
      <Skeleton className={[sx(paint.s2), sx(paint.q87)].filter(Boolean).join(" ")} />
      <Skeleton className={[sx(paint.s3), sx(paint.q88)].filter(Boolean).join(" ")} />
      <Skeleton className={sx(paint.s4)} />
      <Skeleton className={sx(paint.s5)} />
    </div>
  );
}

function Notice({ icon, title, body, onRetry }: { icon: string; title: string; body: React.ReactNode; onRetry(): void }) {
  return (
    <div className={sx(paint.s6)}>
      <Empty>
        <EmptyHeader>
          <Icon name={icon} className={sx(paint.s7)} />
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription measure="md">{body}</EmptyDescription>
        </EmptyHeader>
        <Button size="sm" variant="outline" onClick={onRetry}>Refresh</Button>
      </Empty>
    </div>
  );
}

const stateBadge: Record<string, { label: string; className: string; icon: string }> = {
  OPEN: { label: "Open", className: sx(paint.s8), icon: "GitPullRequest" },
  DRAFT: { label: "Draft", className: sx(paint.s9), icon: "GitPullRequestDraft" },
  MERGED: { label: "Merged", className: sx(paint.s10), icon: "GitMerge" },
  CLOSED: { label: "Closed", className: sx(paint.s11), icon: "GitPullRequestClosed" },
};

const decision: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Approved", tone: sx(paint.q84) },
  CHANGES_REQUESTED: { label: "Changes requested", tone: sx(paint.q85) },
  REVIEW_REQUIRED: { label: "Review required", tone: sx(paint.q86) },
};

function PRView({ pr, berth, box, path, onRefresh }: { pr: PR; berth: WorktreePanelProps["berth"]; box: string; path: string; onRefresh(): void }) {
  const st = stateBadge[pr.isDraft && pr.state === "OPEN" ? "DRAFT" : pr.state];
  const checks = pr.statusCheckRollup ?? [];
  const counts = checks.reduce<Record<CheckState, number>>((n, c) => ({ ...n, [checkState(c)]: n[checkState(c)] + 1 }), { pass: 0, fail: 0, pending: 0, skip: 0 });
  const reviews = latestReviews(pr.reviews ?? []);
  // Passed checks matter least; past a handful they fold away.
  const [showPassed, setShowPassed] = useState(false);
  const sorted = [...checks].sort((a, b) => order(checkState(a)) - order(checkState(b)));
  const fold = checks.length > 8 && !showPassed;
  const visible = fold ? sorted.filter((c) => checkState(c) === "fail" || checkState(c) === "pending") : sorted;
  const hidden = sorted.length - visible.length;
  const comments = (pr.comments ?? []).slice(-8).reverse();
  // Pick failing checks, reviews and comments, and hand them to the agent.
  const [picked, setPicked] = useState<Map<string, PrItem>>(new Map());
  const toggle = (p: PrItem) =>
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(p.key)) n.delete(p.key);
      else n.set(p.key, p);
      return n;
    });

  return (
    <div className={[sx(paint.s15), sx(paint.q89)].filter(Boolean).join(" ")}>
      <header className={sx(paint.s16)}>
        <div className={sx(paint.s17)}>
          <h2 className={sx(paint.s18)}>
            {pr.title} <span className={sx(paint.s19)}>#{pr.number}</span>
          </h2>
          <Button size="sm" variant="outline" onClick={onRefresh} aria-label="Refresh">
            <Icon name="RefreshCw" className={sx(paint.s20)} />
          </Button>
          <Button size="sm" onClick={() => berth.openUrl(pr.url)}>
            Open on GitHub <Icon name="ArrowUpRight" className={sx(paint.s21)} />
          </Button>
        </div>
        <div className={sx(paint.s22)}>
          <Badge variant="outline" className={[sx(paint.s23), st.className].filter(Boolean).join(" ")}>
            <Icon name={st.icon} className={sx(paint.s24)} />
            {st.label}
          </Badge>
          <span>
            {pr.author?.login && <b className={sx(paint.s25)}>{pr.author.login}</b>} {pr.state === "OPEN" ? "wants to merge" : pr.state === "MERGED" ? "merged" : "wanted to merge"} <Kbd>{pr.headRefName}</Kbd> into <Kbd>{pr.baseRefName}</Kbd>
          </span>
          <span className={sx(paint.s26)}>
            <span className={sx(paint.s27)}>+{pr.additions}</span> <span className={sx(paint.s28)}>−{pr.deletions}</span> · {pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}
          </span>
          {pr.updatedAt && <span>updated {since(pr.updatedAt)}</span>}
        </div>
      </header>

      <Frame variant="card">
        <FrameHeader row gap={2} pad="tight">
          <FrameTitle>Checks</FrameTitle>
          <span className={sx(paint.s29)}>
            {counts.fail > 0 && <span className={sx(paint.s30)}>{counts.fail} failing</span>}
            {counts.pending > 0 && <span className={sx(paint.s31)}>{counts.pending} running</span>}
            <span className={sx(paint.s32)}>{counts.pass} passed</span>
          </span>
        </FrameHeader>
        <FramePanel pad="none">
          {checks.length === 0 ? (
            <p className={sx(paint.s33)}>No checks on this pull request.</p>
          ) : (
            <ul className={sx(paint.s34)}>
              {visible.map((c, i) => (
                <CheckRow key={i} check={c} berth={berth} pick={checkPick(c)} picked={picked} onToggle={toggle} />
              ))}
              {hidden > 0 && (
                <li>
                  <button type="button" className={sx(paint.s35)} onClick={() => setShowPassed(true)}>
                    <Icon name="ChevronsUpDown" className={sx(paint.s36)} />
                    Show {hidden} passed or skipped check{hidden === 1 ? "" : "s"}
                  </button>
                </li>
              )}
              {fold === false && checks.length > 8 && (
                <li>
                  <button type="button" className={sx(paint.s37)} onClick={() => setShowPassed(false)}>
                    <Icon name="ChevronsDownUp" className={sx(paint.s38)} />
                    Hide passed checks
                  </button>
                </li>
              )}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Frame variant="card">
        <FrameHeader row gap={2} pad="tight">
          <FrameTitle>Reviews</FrameTitle>
          {pr.reviewDecision && decision[pr.reviewDecision] && <span className={[sx(paint.s39), decision[pr.reviewDecision].tone].filter(Boolean).join(" ")}>{decision[pr.reviewDecision].label}</span>}
        </FrameHeader>
        <FramePanel pad="none">
          {reviews.length === 0 ? (
            <p className={sx(paint.s40)}>Nobody has reviewed it yet.</p>
          ) : (
            <ul className={sx(paint.s41)}>
              {reviews.map((r, i) => (
                <li key={i} className={[sx(paint.s42), "group/row"].filter(Boolean).join(" ")}>
                  {r.body?.trim() ? <PickBox pick={reviewPick(r)} picked={picked} onToggle={toggle} /> : <span className={sx(paint.s43)} />}
                  <Icon name={r.state === "APPROVED" ? "CircleCheck" : r.state === "CHANGES_REQUESTED" ? "CircleX" : "MessageSquare"} className={[sx(paint.n0), r.state === "APPROVED" ? sx(paint.n1) : r.state === "CHANGES_REQUESTED" ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")} />
                  <span className={sx(paint.s46)}>{r.author?.login ?? "someone"}</span>
                  <span className={sx(paint.s47)}>{reviewLabel(r.state)}</span>
                  <span className={sx(paint.s48)}>{since(r.submittedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      {comments.length > 0 && (
        <Frame variant="card">
          <FrameHeader pad="tight">
            <FrameTitle>Latest comments</FrameTitle>
          </FrameHeader>
          <FramePanel pad="none">
            <ul className={sx(paint.s49)}>
              {comments.map((c, i) => (
                <li key={i} className={[[sx(paint.s50), "group/row"].filter(Boolean).join(" "), picked.has(commentPick(c).key) && sx(paint.s51)].filter(Boolean).join(" ")}>
                  <PickBox pick={commentPick(c)} picked={picked} onToggle={toggle} className={sx(paint.s52)} />
                  <div className={sx(paint.s53)}>
                    <div className={sx(paint.s54)}>
                      <span className={sx(paint.s55)}>{c.author?.login ?? "someone"}</span>
                      <span className={sx(paint.s56)}>{since(c.createdAt)}</span>
                    </div>
                    <p className={sx(paint.s57)}>{plainText(c.body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </FramePanel>
        </Frame>
      )}
      {picked.size > 0 && <SendBar pr={pr} picked={[...picked.values()]} berth={berth} box={box} path={path} onClear={() => setPicked(new Map())} />}
    </div>
  );
}

// A thing on the PR someone picked to hand to the agent: a failing check, a
// review or a comment, as a line of the prompt.
interface PrItem {
  key: string;
  label: string;
  text: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

function checkPick(c: Check): PrItem {
  const url = c.detailsUrl || c.targetUrl || "";
  const run = url.match(/\/actions\/runs\/(\d+)/)?.[1];
  const name = c.name ?? c.context ?? "a check";
  return {
    key: `check:${name}:${url}`,
    label: name,
    text: `The check "${name}" ${checkState(c) === "fail" ? "failed" : "is not passing"}${url ? ` (${url})` : ""}.${run ? ` See why with \`gh run view ${run} --log-failed\`.` : ""}`,
  };
}

function reviewPick(r: NonNullable<PR["reviews"]>[number]): PrItem {
  const who = r.author?.login ?? "a reviewer";
  return { key: `review:${who}:${r.submittedAt}`, label: `${who}'s review`, text: `${who} ${reviewLabel(r.state)}: ${clip(plainText(r.body ?? ""), 800)}` };
}

function commentPick(c: NonNullable<PR["comments"]>[number]): PrItem {
  const who = c.author?.login ?? "someone";
  return { key: `comment:${who}:${c.createdAt}`, label: `${who}'s comment`, text: `${who} commented${c.url ? ` (${c.url})` : ""}: ${clip(plainText(c.body), 800)}` };
}

function PickBox({ pick, picked, onToggle, className }: { pick: PrItem; picked: Map<string, PrItem>; onToggle(p: PrItem): void; className?: string }) {
  const on = picked.has(pick.key);
  return (
    <Checkbox
      checked={on}
      onCheckedChange={() => onToggle(pick)}
      aria-label={`Pick ${pick.label}`}
      className={[sx(paint.s58), !on && picked.size === 0 && sx(paint.s59), className].filter(Boolean).join(" ")}
    />
  );
}

// The prompt the picked items make: short, one line each, links rather than
// whole logs (the agent can read those itself).
function promptFor(pr: PR, picks: PrItem[]): string {
  const lines = picks.map((p, i) => `${i + 1}. ${p.text}`);
  return clip(`On pull request #${pr.number} (${pr.url}), please look at ${picks.length === 1 ? "this" : `these ${picks.length}`} and fix what needs fixing:\n\n${lines.join("\n")}`, 6000);
}

function SendBar({ pr, picked, berth, box, path, onClear }: { pr: PR; picked: PrItem[]; berth: WorktreePanelProps["berth"]; box: string; path: string; onClear(): void }) {
  const sessions = useSessions(box);
  const agents = useMemo(() => (sessions ?? []).filter((s) => s.agent && !s.exited && s.dir === path), [sessions, path]);
  const [busy, setBusy] = useState(false);
  const text = promptFor(pr, picked);
  const send = async (name: string) => {
    setBusy(true);
    try {
      await berth.orchestrate.send(box, name, text, { when: "idle" });
      berth.notify("Sent to the agent", `${picked.length} item${picked.length === 1 ? "" : "s"} from #${pr.number}; queued if it's busy.`);
      onClear();
    } catch (err) {
      berth.notify("Couldn't send it", String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      berth.notify("Copied", "Paste it to any agent.");
    } catch {
      berth.notify("Couldn't copy", "The clipboard refused it.");
    }
  };
  return (
    <div className={sx(paint.s60)}>
      <span className={sx(paint.s61)}>{picked.length} picked</span>
      {agents.length === 1 ? (
        <Button size="sm" loading={busy} onClick={() => void send(agents[0].name)}>
          <Icon name="Send" className={sx(paint.s62)} />
          Send to {sessionName(agents[0], { sessions })}
        </Button>
      ) : agents.length > 1 ? (
        <Menu>
          <MenuTrigger render={<Button size="sm" loading={busy} />}>
            <Icon name="Send" className={sx(paint.s63)} />
            Send to agent
            <Icon name="ChevronDown" className={sx(paint.s64)} />
          </MenuTrigger>
          <MenuPopup align="start">
            {agents.map((a) => (
              <MenuItem key={a.name} onClick={() => void send(a.name)}>
                {sessionName(a, { sessions })}
              </MenuItem>
            ))}
          </MenuPopup>
        </Menu>
      ) : (
        <span className={sx(paint.s65)}>No agent in this worktree</span>
      )}
      <Button size="sm" variant="outline" onClick={() => void copy()}>
        <Icon name="Copy" className={sx(paint.s66)} />
        Copy
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear">
        <Icon name="X" className={sx(paint.s67)} />
      </Button>
    </div>
  );
}

const order = (s: CheckState) => ({ fail: 0, pending: 1, pass: 2, skip: 3 })[s];

function CheckRow({ check, berth, pick, picked, onToggle }: { check: Check; berth: WorktreePanelProps["berth"]; pick: PrItem; picked: Map<string, PrItem>; onToggle(p: PrItem): void }) {
  const s = checkState(check);
  const url = check.detailsUrl || check.targetUrl;
  const icon = { pass: "CircleCheck", fail: "CircleX", pending: "LoaderCircle", skip: "CircleMinus" }[s];
  const tone = { pass: sx(paint.q90), fail: sx(paint.q91), pending: [sx(paint.q92), "burf-spin"].filter(Boolean).join(" "), skip: sx(paint.q93) }[s];
  return (
    <li className={[[sx(paint.s72), "group/row"].filter(Boolean).join(" "), picked.has(pick.key) && sx(paint.s73)].filter(Boolean).join(" ")}>
      {s === "fail" ? <PickBox pick={pick} picked={picked} onToggle={onToggle} /> : <span className={sx(paint.s74)} />}
      <Icon name={icon} className={[sx(paint.s75), tone].filter(Boolean).join(" ")} />
      <span className={sx(paint.s76)}>{check.name ?? check.context}</span>
      {check.workflowName && <span className={sx(paint.s77)}>{check.workflowName}</span>}
      {url && (
        <Button size="xs" variant="ghost" className={sx(paint.s78)} onClick={() => berth.openUrl(url)}>
          Details
        </Button>
      )}
    </li>
  );
}

function reviewLabel(state: string) {
  return { APPROVED: "approved", CHANGES_REQUESTED: "requested changes", COMMENTED: "commented", DISMISSED: "review dismissed" }[state] ?? state.toLowerCase();
}

// latestReviews keeps each reviewer's most recent review.
function latestReviews(reviews: NonNullable<PR["reviews"]>) {
  const by = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) by.set(r.author?.login ?? "?", r);
  return [...by.values()];
}

type Run = (command: string, timeout?: string) => Promise<{ exit_code: number; output: string }>;

function NoPR({ run, worktree, onCreated, berth }: { run: Run; worktree: string; onCreated(): void; berth: WorktreePanelProps["berth"] }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const start = async () => {
    setError(undefined);
    // The last commit's subject is usually the best first title.
    const r = await run("git log -1 --pretty=%s").catch(() => undefined);
    setTitle(r?.exit_code === 0 ? r.output.trim() : worktree);
    setOpen(true);
  };

  const create = async () => {
    setBusy(true);
    setError(undefined);
    const r = await run(`git push -u origin HEAD 2>&1 && gh pr create --title ${quote(title.trim())} --body ${quote(body)}${draft ? " --draft" : ""} 2>&1`, "120s").catch((err) => ({ exit_code: 1, output: String(err) }));
    setBusy(false);
    if (r.exit_code !== 0) return setError(r.output.trim());
    const url = r.output.trim().split("\n").reverse().find((l) => l.startsWith("https://"));
    berth.notify(`Opened ${draft ? "a draft " : "a "}pull request`, url ?? title);
    setOpen(false);
    onCreated();
  };

  return (
    <div className={sx(paint.s79)}>
      <Empty>
        <EmptyHeader>
          <Icon name="GitPullRequestCreate" className={sx(paint.s80)} />
          <EmptyTitle>No pull request for this branch</EmptyTitle>
          <EmptyDescription>Open one when the work is ready for eyes. It pushes the branch first.</EmptyDescription>
        </EmptyHeader>
        <Button size="sm" onClick={() => void start()}>Create pull request…</Button>
      </Empty>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Create a pull request</AlertDialogTitle>
            <AlertDialogDescription>Pushes this branch to origin, then opens the pull request with gh on the box.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className={sx(paint.s81)}>
            <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
            <Textarea value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} placeholder="What changed and why (optional)" rows={4} aria-label="Description" />
            <label className={sx(paint.s82)}>
              <Switch checked={draft} onCheckedChange={setDraft} /> Open as a draft
            </label>
            {error && <p className={sx(paint.s83)}>{error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button loading={busy} disabled={!title.trim()} onClick={() => void create()}>
              Push and create
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
