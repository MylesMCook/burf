import { definePlugin, useEvent, worktreeLocation, type WorktreePanelProps } from "@berth/plugin";
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
  cn,
} from "@berth/plugin/ui";
import { useCallback, useEffect, useState } from "react";

import { type Check, checkState, type CheckState, FIELDS, type Outcome, type PR, plainText, quote, readOutcome, since } from "./gh";

// Pull request: the branch's PR as GitHub sees it, read with `gh` on the
// box, so what you see is what the box's credentials see.

export default definePlugin((berth) => {
  berth.addWorktreePanel({ id: "pr", title: "Pull request", icon: "GitPullRequest", Component: PullRequestPanel });
  berth.addCommand({ id: "open", title: "Show this worktree's pull request", group: "Git", run: () => berth.openPanel("pr") });
});

function PullRequestPanel({ berth, box, location, worktree, main }: WorktreePanelProps) {
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

  if (!outcome) return <Loading />;
  switch (outcome.kind) {
    case "pr":
      return <PRView pr={outcome.pr} berth={berth} onRefresh={refresh} />;
    case "none":
      return <NoPR run={run} worktree={worktree} onCreated={refresh} berth={berth} />;
    case "no-gh":
      return <Notice icon="Github" title="GitHub CLI isn't installed on this box" body={<>Install <code>gh</code> on {box} and sign in with <code>gh auth login</code> to see pull requests here.</>} onRetry={refresh} />;
    case "no-auth":
      return <Notice icon="KeyRound" title="gh isn't signed in on this box" body={<>Run <code>gh auth login</code> in a terminal on {box}, then refresh.</>} onRetry={refresh} />;
    case "not-github":
      return <Notice icon="GitBranch" title="Not a GitHub repository" body="This worktree's remotes don't point at GitHub, so there are no pull requests to show." onRetry={refresh} />;
    default:
      return <Notice icon="TriangleAlert" title="Couldn't read the pull request" body={<span className="whitespace-pre-wrap font-mono text-xs">{outcome.message}</span>} onRetry={refresh} />;
  }
}

function Loading() {
  return (
    <div className="space-y-3 p-5">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function Notice({ icon, title, body, onRetry }: { icon: string; title: string; body: React.ReactNode; onRetry(): void }) {
  return (
    <div className="flex h-full min-h-60 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <Icon name={icon} className="mx-auto mb-2 size-5 text-muted-foreground" />
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription className="max-w-md">{body}</EmptyDescription>
        </EmptyHeader>
        <Button size="sm" variant="outline" onClick={onRetry}>Refresh</Button>
      </Empty>
    </div>
  );
}

const stateBadge: Record<string, { label: string; className: string; icon: string }> = {
  OPEN: { label: "Open", className: "bg-success/12 text-success border-success/24", icon: "GitPullRequest" },
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground", icon: "GitPullRequestDraft" },
  MERGED: { label: "Merged", className: "bg-[oklch(0.6_0.18_300)]/12 text-[oklch(0.62_0.18_300)] border-[oklch(0.6_0.18_300)]/24", icon: "GitMerge" },
  CLOSED: { label: "Closed", className: "bg-destructive/10 text-destructive border-destructive/24", icon: "GitPullRequestClosed" },
};

const decision: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Approved", tone: "text-success" },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "text-destructive" },
  REVIEW_REQUIRED: { label: "Review required", tone: "text-warning" },
};

function PRView({ pr, berth, onRefresh }: { pr: PR; berth: WorktreePanelProps["berth"]; onRefresh(): void }) {
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-5">
      <header className="space-y-2">
        <div className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 font-semibold text-base leading-snug">
            {pr.title} <span className="font-normal text-muted-foreground">#{pr.number}</span>
          </h2>
          <Button size="sm" variant="outline" onClick={onRefresh} aria-label="Refresh">
            <Icon name="RefreshCw" className="size-3.5" />
          </Button>
          <Button size="sm" onClick={() => berth.openUrl(pr.url)}>
            Open on GitHub <Icon name="ArrowUpRight" className="size-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
          <Badge variant="outline" className={cn("gap-1", st.className)}>
            <Icon name={st.icon} className="size-3" />
            {st.label}
          </Badge>
          <span>
            {pr.author?.login && <b className="font-medium text-foreground">{pr.author.login}</b>} {pr.state === "OPEN" ? "wants to merge" : pr.state === "MERGED" ? "merged" : "wanted to merge"} <Kbd>{pr.headRefName}</Kbd> into <Kbd>{pr.baseRefName}</Kbd>
          </span>
          <span className="tabular-nums">
            <span className="text-success">+{pr.additions}</span> <span className="text-destructive">−{pr.deletions}</span> · {pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}
          </span>
          {pr.updatedAt && <span>updated {since(pr.updatedAt)}</span>}
        </div>
      </header>

      <Frame>
        <FrameHeader className="flex-row items-center gap-2 py-3">
          <FrameTitle>Checks</FrameTitle>
          <span className="ml-auto flex gap-3 text-xs tabular-nums">
            {counts.fail > 0 && <span className="text-destructive">{counts.fail} failing</span>}
            {counts.pending > 0 && <span className="text-warning">{counts.pending} running</span>}
            <span className="text-muted-foreground">{counts.pass} passed</span>
          </span>
        </FrameHeader>
        <FramePanel className="p-0">
          {checks.length === 0 ? (
            <p className="px-4 py-5 text-center text-muted-foreground text-sm">No checks on this pull request.</p>
          ) : (
            <ul className="divide-y">
              {visible.map((c, i) => (
                <CheckRow key={i} check={c} berth={berth} />
              ))}
              {hidden > 0 && (
                <li>
                  <button type="button" className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-muted-foreground text-sm hover:bg-accent/50" onClick={() => setShowPassed(true)}>
                    <Icon name="ChevronsUpDown" className="size-4" />
                    Show {hidden} passed or skipped check{hidden === 1 ? "" : "s"}
                  </button>
                </li>
              )}
              {fold === false && checks.length > 8 && (
                <li>
                  <button type="button" className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-muted-foreground text-sm hover:bg-accent/50" onClick={() => setShowPassed(false)}>
                    <Icon name="ChevronsDownUp" className="size-4" />
                    Hide passed checks
                  </button>
                </li>
              )}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader className="flex-row items-center gap-2 py-3">
          <FrameTitle>Reviews</FrameTitle>
          {pr.reviewDecision && decision[pr.reviewDecision] && <span className={cn("ml-auto text-xs", decision[pr.reviewDecision].tone)}>{decision[pr.reviewDecision].label}</span>}
        </FrameHeader>
        <FramePanel className="p-0">
          {reviews.length === 0 ? (
            <p className="px-4 py-5 text-center text-muted-foreground text-sm">Nobody has reviewed it yet.</p>
          ) : (
            <ul className="divide-y">
              {reviews.map((r, i) => (
                <li key={i} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <Icon name={r.state === "APPROVED" ? "CircleCheck" : r.state === "CHANGES_REQUESTED" ? "CircleX" : "MessageSquare"} className={cn("size-4", r.state === "APPROVED" ? "text-success" : r.state === "CHANGES_REQUESTED" ? "text-destructive" : "text-muted-foreground")} />
                  <span className="font-medium">{r.author?.login ?? "someone"}</span>
                  <span className="text-muted-foreground">{reviewLabel(r.state)}</span>
                  <span className="ml-auto text-muted-foreground text-xs">{since(r.submittedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      {comments.length > 0 && (
        <Frame>
          <FrameHeader className="py-3">
            <FrameTitle>Latest comments</FrameTitle>
          </FrameHeader>
          <FramePanel className="p-0">
            <ul className="divide-y">
              {comments.map((c, i) => (
                <li key={i} className="px-4 py-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <span className="font-medium">{c.author?.login ?? "someone"}</span>
                    <span className="text-muted-foreground">{since(c.createdAt)}</span>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-muted-foreground">{plainText(c.body)}</p>
                </li>
              ))}
            </ul>
          </FramePanel>
        </Frame>
      )}
    </div>
  );
}

const order = (s: CheckState) => ({ fail: 0, pending: 1, pass: 2, skip: 3 })[s];

function CheckRow({ check, berth }: { check: Check; berth: WorktreePanelProps["berth"] }) {
  const s = checkState(check);
  const url = check.detailsUrl || check.targetUrl;
  const icon = { pass: "CircleCheck", fail: "CircleX", pending: "LoaderCircle", skip: "CircleMinus" }[s];
  const tone = { pass: "text-success", fail: "text-destructive", pending: "text-warning animate-spin", skip: "text-muted-foreground" }[s];
  return (
    <li className="flex items-center gap-2.5 px-4 py-2 text-sm">
      <Icon name={icon} className={cn("size-4 shrink-0", tone)} />
      <span className="min-w-0 truncate">{check.name ?? check.context}</span>
      {check.workflowName && <span className="truncate text-muted-foreground text-xs">{check.workflowName}</span>}
      {url && (
        <Button size="xs" variant="ghost" className="ml-auto" onClick={() => berth.openUrl(url)}>
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
    <div className="flex h-full min-h-60 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <Icon name="GitPullRequestCreate" className="mx-auto mb-2 size-5 text-muted-foreground" />
          <EmptyTitle>No pull request for this branch</EmptyTitle>
          <EmptyDescription>Open one when the work is ready for eyes. It pushes the branch first.</EmptyDescription>
        </EmptyHeader>
        <Button size="sm" onClick={() => void start()}>Create pull request…</Button>
      </Empty>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogPopup className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Create a pull request</AlertDialogTitle>
            <AlertDialogDescription>Pushes this branch to origin, then opens the pull request with gh on the box.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 px-6">
            <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
            <Textarea value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} placeholder="What changed and why (optional)" rows={4} aria-label="Description" />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={draft} onCheckedChange={setDraft} /> Open as a draft
            </label>
            {error && <p className="whitespace-pre-wrap rounded-md bg-destructive/8 p-2 font-mono text-destructive text-xs">{error}</p>}
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
