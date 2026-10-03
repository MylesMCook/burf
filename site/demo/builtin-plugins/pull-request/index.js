// ../plugins/pull-request/src/index.tsx
import { definePlugin, useEvent, worktreeLocation } from "@berth/plugin";
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
  Skeleton,
  Switch,
  Textarea,
  cn
} from "@berth/plugin/ui";
import { useCallback, useEffect, useState } from "react";

// ../plugins/pull-request/src/gh.ts
var FIELDS = "number,title,state,isDraft,url,author,reviewDecision,headRefName,baseRefName,additions,deletions,changedFiles,body,updatedAt,reviews,comments,statusCheckRollup";
function readOutcome(exitCode, output) {
  if (exitCode === 0) {
    try {
      return { kind: "pr", pr: JSON.parse(output) };
    } catch {
      return { kind: "error", message: output.trim() };
    }
  }
  const text = output.toLowerCase();
  if (exitCode === 127 || text.includes("command not found")) return { kind: "no-gh" };
  if (text.includes("no pull requests found")) return { kind: "none" };
  if (text.includes("gh auth login") || text.includes("authentication")) return { kind: "no-auth" };
  if (text.includes("none of the git remotes") || text.includes("no git remotes") || text.includes("not a git repository")) return { kind: "not-github" };
  return { kind: "error", message: output.trim() || `gh exited with ${exitCode}` };
}
function checkState(c) {
  if (c.__typename === "StatusContext") {
    if (c.state === "SUCCESS") return "pass";
    if (c.state === "FAILURE" || c.state === "ERROR") return "fail";
    return "pending";
  }
  if (c.status !== "COMPLETED") return "pending";
  if (c.conclusion === "SUCCESS") return "pass";
  if (c.conclusion === "SKIPPED" || c.conclusion === "NEUTRAL") return "skip";
  return "fail";
}
var quote = (s) => `'${s.replaceAll("'", `'\\''`)}'`;
function since(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1e3);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function plainText(md) {
  return md.replace(/<!--[\s\S]*?-->/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/^[ \t]{0,3}(#{1,6}|>+)[ \t]?/gm, "").replace(/\[!(TIP|NOTE|WARNING|IMPORTANT|CAUTION)\]\s*/g, "").replace(/(\*\*|__|`)/g, "").replace(/<\/?[a-z][^>]*>/gi, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ../plugins/pull-request/src/index.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var index_default = definePlugin((berth) => {
  berth.addWorktreePanel({ id: "pr", title: "Pull request", icon: "GitPullRequest", Component: PullRequestPanel });
  berth.addCommand({ id: "open", title: "Show this worktree's pull request", group: "Git", run: () => berth.openPanel("pr") });
});
function PullRequestPanel({ berth, box, location, worktree, main }) {
  const where = worktreeLocation({ location, worktree, main });
  const [outcome, setOutcome] = useState();
  const [stamp, setStamp] = useState(0);
  const run = useCallback((command, timeout = "60s") => berth.orchestrate.exec(box, where, command, timeout), [berth, box, where]);
  const refresh = useCallback(() => setStamp((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    run(`gh pr view --json ${FIELDS} 2>&1`).then((r) => live && setOutcome(readOutcome(r.exit_code, r.output))).catch((err) => live && setOutcome({ kind: "error", message: String(err?.message ?? err) }));
    return () => {
      live = false;
    };
  }, [run, stamp]);
  useEffect(() => {
    if (outcome?.kind !== "pr" || !(outcome.pr.statusCheckRollup ?? []).some((c) => checkState(c) === "pending")) return;
    const t = setTimeout(refresh, 2e4);
    return () => clearTimeout(t);
  }, [outcome, refresh]);
  useEvent("flow.finished", refresh);
  if (!outcome) return /* @__PURE__ */ jsx(Loading, {});
  switch (outcome.kind) {
    case "pr":
      return /* @__PURE__ */ jsx(PRView, { pr: outcome.pr, berth, onRefresh: refresh });
    case "none":
      return /* @__PURE__ */ jsx(NoPR, { run, worktree, onCreated: refresh, berth });
    case "no-gh":
      return /* @__PURE__ */ jsx(Notice, { icon: "Github", title: "GitHub CLI isn't installed on this box", body: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Install ",
        /* @__PURE__ */ jsx("code", { children: "gh" }),
        " on ",
        box,
        " and sign in with ",
        /* @__PURE__ */ jsx("code", { children: "gh auth login" }),
        " to see pull requests here."
      ] }), onRetry: refresh });
    case "no-auth":
      return /* @__PURE__ */ jsx(Notice, { icon: "KeyRound", title: "gh isn't signed in on this box", body: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Run ",
        /* @__PURE__ */ jsx("code", { children: "gh auth login" }),
        " in a terminal on ",
        box,
        ", then refresh."
      ] }), onRetry: refresh });
    case "not-github":
      return /* @__PURE__ */ jsx(Notice, { icon: "GitBranch", title: "Not a GitHub repository", body: "This worktree's remotes don't point at GitHub, so there are no pull requests to show.", onRetry: refresh });
    default:
      return /* @__PURE__ */ jsx(Notice, { icon: "TriangleAlert", title: "Couldn't read the pull request", body: /* @__PURE__ */ jsx("span", { className: "whitespace-pre-wrap font-mono text-xs", children: outcome.message }), onRetry: refresh });
  }
}
function Loading() {
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3 p-5", children: [
    /* @__PURE__ */ jsx(Skeleton, { className: "h-6 w-2/3" }),
    /* @__PURE__ */ jsx(Skeleton, { className: "h-4 w-1/3" }),
    /* @__PURE__ */ jsx(Skeleton, { className: "h-28 w-full" }),
    /* @__PURE__ */ jsx(Skeleton, { className: "h-20 w-full" })
  ] });
}
function Notice({ icon, title, body, onRetry }) {
  return /* @__PURE__ */ jsx("div", { className: "flex h-full min-h-60 items-center justify-center p-6", children: /* @__PURE__ */ jsxs(Empty, { children: [
    /* @__PURE__ */ jsxs(EmptyHeader, { children: [
      /* @__PURE__ */ jsx(Icon, { name: icon, className: "mx-auto mb-2 size-5 text-muted-foreground" }),
      /* @__PURE__ */ jsx(EmptyTitle, { children: title }),
      /* @__PURE__ */ jsx(EmptyDescription, { className: "max-w-md", children: body })
    ] }),
    /* @__PURE__ */ jsx(Button, { size: "sm", variant: "outline", onClick: onRetry, children: "Refresh" })
  ] }) });
}
var stateBadge = {
  OPEN: { label: "Open", className: "bg-success/12 text-success border-success/24", icon: "GitPullRequest" },
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground", icon: "GitPullRequestDraft" },
  MERGED: { label: "Merged", className: "bg-[oklch(0.6_0.18_300)]/12 text-[oklch(0.62_0.18_300)] border-[oklch(0.6_0.18_300)]/24", icon: "GitMerge" },
  CLOSED: { label: "Closed", className: "bg-destructive/10 text-destructive border-destructive/24", icon: "GitPullRequestClosed" }
};
var decision = {
  APPROVED: { label: "Approved", tone: "text-success" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "text-destructive" },
  REVIEW_REQUIRED: { label: "Review required", tone: "text-warning" }
};
function PRView({ pr, berth, onRefresh }) {
  const st = stateBadge[pr.isDraft && pr.state === "OPEN" ? "DRAFT" : pr.state];
  const checks = pr.statusCheckRollup ?? [];
  const counts = checks.reduce((n, c) => ({ ...n, [checkState(c)]: n[checkState(c)] + 1 }), { pass: 0, fail: 0, pending: 0, skip: 0 });
  const reviews = latestReviews(pr.reviews ?? []);
  const [showPassed, setShowPassed] = useState(false);
  const sorted = [...checks].sort((a, b) => order(checkState(a)) - order(checkState(b)));
  const fold = checks.length > 8 && !showPassed;
  const visible = fold ? sorted.filter((c) => checkState(c) === "fail" || checkState(c) === "pending") : sorted;
  const hidden = sorted.length - visible.length;
  const comments = (pr.comments ?? []).slice(-8).reverse();
  return /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-3xl space-y-4 p-5", children: [
    /* @__PURE__ */ jsxs("header", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsxs("h2", { className: "min-w-0 flex-1 font-semibold text-base leading-snug", children: [
          pr.title,
          " ",
          /* @__PURE__ */ jsxs("span", { className: "font-normal text-muted-foreground", children: [
            "#",
            pr.number
          ] })
        ] }),
        /* @__PURE__ */ jsx(Button, { size: "sm", variant: "outline", onClick: onRefresh, "aria-label": "Refresh", children: /* @__PURE__ */ jsx(Icon, { name: "RefreshCw", className: "size-3.5" }) }),
        /* @__PURE__ */ jsxs(Button, { size: "sm", onClick: () => berth.openUrl(pr.url), children: [
          "Open on GitHub ",
          /* @__PURE__ */ jsx(Icon, { name: "ArrowUpRight", className: "size-3.5" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 text-muted-foreground text-xs", children: [
        /* @__PURE__ */ jsxs(Badge, { variant: "outline", className: cn("gap-1", st.className), children: [
          /* @__PURE__ */ jsx(Icon, { name: st.icon, className: "size-3" }),
          st.label
        ] }),
        /* @__PURE__ */ jsxs("span", { children: [
          pr.author?.login && /* @__PURE__ */ jsx("b", { className: "font-medium text-foreground", children: pr.author.login }),
          " ",
          pr.state === "OPEN" ? "wants to merge" : pr.state === "MERGED" ? "merged" : "wanted to merge",
          " ",
          /* @__PURE__ */ jsx(Kbd, { children: pr.headRefName }),
          " into ",
          /* @__PURE__ */ jsx(Kbd, { children: pr.baseRefName })
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "tabular-nums", children: [
          /* @__PURE__ */ jsxs("span", { className: "text-success", children: [
            "+",
            pr.additions
          ] }),
          " ",
          /* @__PURE__ */ jsxs("span", { className: "text-destructive", children: [
            "\u2212",
            pr.deletions
          ] }),
          " \xB7 ",
          pr.changedFiles,
          " ",
          pr.changedFiles === 1 ? "file" : "files"
        ] }),
        pr.updatedAt && /* @__PURE__ */ jsxs("span", { children: [
          "updated ",
          since(pr.updatedAt)
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Frame, { variant: "card", children: [
      /* @__PURE__ */ jsxs(FrameHeader, { className: "flex-row items-center gap-2 py-3", children: [
        /* @__PURE__ */ jsx(FrameTitle, { children: "Checks" }),
        /* @__PURE__ */ jsxs("span", { className: "ml-auto flex gap-3 text-xs tabular-nums", children: [
          counts.fail > 0 && /* @__PURE__ */ jsxs("span", { className: "text-destructive", children: [
            counts.fail,
            " failing"
          ] }),
          counts.pending > 0 && /* @__PURE__ */ jsxs("span", { className: "text-warning", children: [
            counts.pending,
            " running"
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "text-muted-foreground", children: [
            counts.pass,
            " passed"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(FramePanel, { className: "p-0", children: checks.length === 0 ? /* @__PURE__ */ jsx("p", { className: "px-4 py-5 text-center text-muted-foreground text-sm", children: "No checks on this pull request." }) : /* @__PURE__ */ jsxs("ul", { className: "divide-y", children: [
        visible.map((c, i) => /* @__PURE__ */ jsx(CheckRow, { check: c, berth }, i)),
        hidden > 0 && /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", { type: "button", className: "flex w-full items-center gap-2.5 px-4 py-2 text-left text-muted-foreground text-sm hover:bg-accent/50", onClick: () => setShowPassed(true), children: [
          /* @__PURE__ */ jsx(Icon, { name: "ChevronsUpDown", className: "size-4" }),
          "Show ",
          hidden,
          " passed or skipped check",
          hidden === 1 ? "" : "s"
        ] }) }),
        fold === false && checks.length > 8 && /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", { type: "button", className: "flex w-full items-center gap-2.5 px-4 py-2 text-left text-muted-foreground text-sm hover:bg-accent/50", onClick: () => setShowPassed(false), children: [
          /* @__PURE__ */ jsx(Icon, { name: "ChevronsDownUp", className: "size-4" }),
          "Hide passed checks"
        ] }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs(Frame, { variant: "card", children: [
      /* @__PURE__ */ jsxs(FrameHeader, { className: "flex-row items-center gap-2 py-3", children: [
        /* @__PURE__ */ jsx(FrameTitle, { children: "Reviews" }),
        pr.reviewDecision && decision[pr.reviewDecision] && /* @__PURE__ */ jsx("span", { className: cn("ml-auto text-xs", decision[pr.reviewDecision].tone), children: decision[pr.reviewDecision].label })
      ] }),
      /* @__PURE__ */ jsx(FramePanel, { className: "p-0", children: reviews.length === 0 ? /* @__PURE__ */ jsx("p", { className: "px-4 py-5 text-center text-muted-foreground text-sm", children: "Nobody has reviewed it yet." }) : /* @__PURE__ */ jsx("ul", { className: "divide-y", children: reviews.map((r, i) => /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-2 px-4 py-2 text-sm", children: [
        /* @__PURE__ */ jsx(Icon, { name: r.state === "APPROVED" ? "CircleCheck" : r.state === "CHANGES_REQUESTED" ? "CircleX" : "MessageSquare", className: cn("size-4", r.state === "APPROVED" ? "text-success" : r.state === "CHANGES_REQUESTED" ? "text-destructive" : "text-muted-foreground") }),
        /* @__PURE__ */ jsx("span", { className: "font-medium", children: r.author?.login ?? "someone" }),
        /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: reviewLabel(r.state) }),
        /* @__PURE__ */ jsx("span", { className: "ml-auto text-muted-foreground text-xs", children: since(r.submittedAt) })
      ] }, i)) }) })
    ] }),
    comments.length > 0 && /* @__PURE__ */ jsxs(Frame, { variant: "card", children: [
      /* @__PURE__ */ jsx(FrameHeader, { className: "py-3", children: /* @__PURE__ */ jsx(FrameTitle, { children: "Latest comments" }) }),
      /* @__PURE__ */ jsx(FramePanel, { className: "p-0", children: /* @__PURE__ */ jsx("ul", { className: "divide-y", children: comments.map((c, i) => /* @__PURE__ */ jsxs("li", { className: "px-4 py-3 text-sm", children: [
        /* @__PURE__ */ jsxs("div", { className: "mb-1 flex items-center gap-2 text-xs", children: [
          /* @__PURE__ */ jsx("span", { className: "font-medium", children: c.author?.login ?? "someone" }),
          /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: since(c.createdAt) })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "line-clamp-4 whitespace-pre-wrap text-muted-foreground", children: plainText(c.body) })
      ] }, i)) }) })
    ] })
  ] });
}
var order = (s) => ({ fail: 0, pending: 1, pass: 2, skip: 3 })[s];
function CheckRow({ check, berth }) {
  const s = checkState(check);
  const url = check.detailsUrl || check.targetUrl;
  const icon = { pass: "CircleCheck", fail: "CircleX", pending: "LoaderCircle", skip: "CircleMinus" }[s];
  const tone = { pass: "text-success", fail: "text-destructive", pending: "text-warning animate-spin", skip: "text-muted-foreground" }[s];
  return /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-2.5 px-4 py-2 text-sm", children: [
    /* @__PURE__ */ jsx(Icon, { name: icon, className: cn("size-4 shrink-0", tone) }),
    /* @__PURE__ */ jsx("span", { className: "min-w-0 truncate", children: check.name ?? check.context }),
    check.workflowName && /* @__PURE__ */ jsx("span", { className: "truncate text-muted-foreground text-xs", children: check.workflowName }),
    url && /* @__PURE__ */ jsx(Button, { size: "xs", variant: "ghost", className: "ml-auto", onClick: () => berth.openUrl(url), children: "Details" })
  ] });
}
function reviewLabel(state) {
  return { APPROVED: "approved", CHANGES_REQUESTED: "requested changes", COMMENTED: "commented", DISMISSED: "review dismissed" }[state] ?? state.toLowerCase();
}
function latestReviews(reviews) {
  const by = /* @__PURE__ */ new Map();
  for (const r of reviews) by.set(r.author?.login ?? "?", r);
  return [...by.values()];
}
function NoPR({ run, worktree, onCreated, berth }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState();
  const start = async () => {
    setError(void 0);
    const r = await run("git log -1 --pretty=%s").catch(() => void 0);
    setTitle(r?.exit_code === 0 ? r.output.trim() : worktree);
    setOpen(true);
  };
  const create = async () => {
    setBusy(true);
    setError(void 0);
    const r = await run(`git push -u origin HEAD 2>&1 && gh pr create --title ${quote(title.trim())} --body ${quote(body)}${draft ? " --draft" : ""} 2>&1`, "120s").catch((err) => ({ exit_code: 1, output: String(err) }));
    setBusy(false);
    if (r.exit_code !== 0) return setError(r.output.trim());
    const url = r.output.trim().split("\n").reverse().find((l) => l.startsWith("https://"));
    berth.notify(`Opened ${draft ? "a draft " : "a "}pull request`, url ?? title);
    setOpen(false);
    onCreated();
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex h-full min-h-60 items-center justify-center p-6", children: [
    /* @__PURE__ */ jsxs(Empty, { children: [
      /* @__PURE__ */ jsxs(EmptyHeader, { children: [
        /* @__PURE__ */ jsx(Icon, { name: "GitPullRequestCreate", className: "mx-auto mb-2 size-5 text-muted-foreground" }),
        /* @__PURE__ */ jsx(EmptyTitle, { children: "No pull request for this branch" }),
        /* @__PURE__ */ jsx(EmptyDescription, { children: "Open one when the work is ready for eyes. It pushes the branch first." })
      ] }),
      /* @__PURE__ */ jsx(Button, { size: "sm", onClick: () => void start(), children: "Create pull request\u2026" })
    ] }),
    /* @__PURE__ */ jsx(AlertDialog, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxs(AlertDialogPopup, { className: "sm:max-w-lg", children: [
      /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
        /* @__PURE__ */ jsx(AlertDialogTitle, { children: "Create a pull request" }),
        /* @__PURE__ */ jsx(AlertDialogDescription, { children: "Pushes this branch to origin, then opens the pull request with gh on the box." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3 px-6", children: [
        /* @__PURE__ */ jsx(Input, { value: title, onChange: (e) => setTitle(e.target.value), placeholder: "Title", "aria-label": "Title" }),
        /* @__PURE__ */ jsx(Textarea, { value: body, onChange: (e) => setBody(e.target.value), placeholder: "What changed and why (optional)", rows: 4, "aria-label": "Description" }),
        /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2 text-sm", children: [
          /* @__PURE__ */ jsx(Switch, { checked: draft, onCheckedChange: setDraft }),
          " Open as a draft"
        ] }),
        error && /* @__PURE__ */ jsx("p", { className: "whitespace-pre-wrap rounded-md bg-destructive/8 p-2 font-mono text-destructive text-xs", children: error })
      ] }),
      /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
        /* @__PURE__ */ jsx(AlertDialogClose, { render: /* @__PURE__ */ jsx(Button, { variant: "ghost" }), children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { loading: busy, disabled: !title.trim(), onClick: () => void create(), children: "Push and create" })
      ] })
    ] }) })
  ] });
}
export {
  index_default as default
};
