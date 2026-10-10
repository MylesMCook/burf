import * as stylex from "@stylexjs/stylex";
import { AlertTriangleIcon, GitCommitHorizontalIcon, GitPullRequestIcon, UploadIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { AttachmentChips, useAttachments } from "@/components/conversation/attachments";
import { PickOne } from "@/components/pick-one";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { boxApi } from "@/lib/api";
import { withAttachments } from "@/lib/attachments";
import { agentLabel } from "@/lib/derive";
import { plainError } from "@/lib/errors";
import { describeCode, quote } from "@/lib/git/parse";
import { useStore } from "@/lib/store";
import { forgetPullRequest, markReviewed, type ReviewEntry, refreshReview, reviewName, useReview, where } from "@/views/review/review-store";
import { commitMessage, lastMessage } from "@/views/review/summary";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--foreground)",
  },
  s2: {
    "flexShrink": 0,
  },
  s3: {
    "width": "14px",
    "height": "14px",
  },
  s4: {
    "width": "14px",
    "height": "14px",
  },
  s5: {
    "width": "14px",
    "height": "14px",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "12px",
  },
  s7: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s8: {
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "8px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--warning) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "marginTop": "1px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s12: {
    "fontFamily": "var(--font-mono)",
  },
  s13: {
    "maxHeight": "160px",
    "overflow": "auto",
    "whiteSpace": "pre-wrap",
    "borderRadius": "var(--radius-md)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s14: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "color": "var(--destructive-foreground)",
  },
  s15: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "color": "var(--muted-foreground)",
  },
  s16: {
    "marginLeft": "4px",
    "height": "18px",
    "backgroundColor": "color-mix(in oklab, var(--primary-foreground) 15%, transparent)",
    "fontSize": "10px",
    "color": "var(--primary-foreground)",
  },
  s17: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "12px",
  },
  s18: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "padding": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--destructive-foreground)",
  },
  s19: {
    "marginLeft": "4px",
    "height": "18px",
    "backgroundColor": "color-mix(in oklab, var(--primary-foreground) 15%, transparent)",
    "fontSize": "10px",
    "color": "var(--primary-foreground)",
  },
  s20: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "12px",
  },
  s21: {
    "display": "flex",
    "alignItems": "baseline",
    "justifyContent": "space-between",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "fontWeight": 500,
  },
  s23: {
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s24: {
    "maxHeight": "208px",
    "overflow": "auto",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s25: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s26: {
    "width": "64px",
    "flexShrink": 0,
    "fontFamily": "var(--font-sans)",
    "color": "var(--muted-foreground)",
  },
  s27: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s28: {
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
  s29: {
    "color": "var(--success-foreground)",
  },
  s30: {
    "color": "var(--destructive-foreground)",
  },
  s31: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s32: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "padding": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "color": "var(--destructive-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The three things to do with an agent's finished work: approve it
// (commit, push, open a PR), send it back with a note, or discard it.
// Every command runs with git (and gh) in the worktree on its box.

export type ApproveMode = "commit" | "push" | "pr";

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

const baseBranch = (e: ReviewEntry) => (e.base ?? "main").replace(/^origin\//, "");

// approveCommand is the shell for one approval. Messages travel as base64,
// so no quoting can break them.
export function approveCommand(e: ReviewEntry, mode: ApproveMode, message: string, openPR: boolean): string {
  const parts: string[] = [];
  const msg = message.trim();
  if (e.files.length > 0) parts.push(`git add -A && printf %s '${b64(msg)}' | base64 -d | git commit -q -F -`);
  if (mode !== "commit") parts.push("git push -u origin HEAD 2>&1");
  if (mode === "pr" && openPR) {
    const [subject, ...rest] = (msg || e.commits[0]?.subject || e.branch || e.worktree).split("\n");
    const body = rest.join("\n").trim() || `Opened from Burf after ${agentLabel(e.agent)} finished in ${e.worktree}.`;
    parts.push(`printf %s '${b64(body)}' | base64 -d | gh pr create --title ${quote(subject.trim())} --body-file - --base ${quote(baseBranch(e))} 2>&1`);
  }
  return parts.join(" && ");
}

// submitOnCmdEnter submits a dialog on ⌘↵ wherever focus is inside it.
const submitOnCmdEnter = (go: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    go();
  }
};

export const DISCARD_COMMAND = "git restore --staged . && git checkout -- . && git clean -fd";

function useExec(entry?: ReviewEntry) {
  const client = useStore((s) => s.client);
  return async (command: string) => {
    if (!client || !entry) throw new Error("Not connected");
    const r = await boxApi.exec(client, entry.box, where(entry), command, "5m");
    if (r.exit_code !== 0) throw new Error(r.output.trim() || `exited with ${r.exit_code}`);
    return r.output;
  };
}

// After acting on an item, refresh and set its new state aside as reviewed,
// so committed-but-unmerged work does not come straight back.
async function settle(entry: ReviewEntry) {
  await refreshReview();
  const next = useReview.getState().entries.find((e) => e.key === entry.key);
  if (next) markReviewed(next);
}

function Target({ entry }: { entry: ReviewEntry }) {
  return (
    <span className={sx(paint.s0)}>
      <AgentIcon agent={entry.agent} />
      <span className={sx(paint.s1)}>{reviewName(entry)}</span>
      <span className={sx(paint.s2)}>· {entry.box}</span>
    </span>
  );
}

export function ApproveDialog({ entry, initial, onClose }: { entry?: ReviewEntry; initial: ApproveMode; onClose(): void }) {
  const client = useStore((s) => s.client);
  const pr = useReview((s) => (entry ? s.prs[entry.key] : undefined));
  const run = useExec(entry);
  const hasFiles = (entry?.files.length ?? 0) > 0;
  const [mode, setMode] = useState<ApproveMode>(initial);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string>();
  const [error, setError] = useState<string>();
  const openPR = !(pr && pr.state === "OPEN");

  // The message starts as the agent's own summary of what it did.
  useEffect(() => {
    if (!entry) return;
    setMode(!hasFiles && initial === "commit" ? "push" : initial);
    setOutput(undefined);
    setError(undefined);
    setMessage("");
    if (!client || !hasFiles) return;
    let live = true;
    boxApi
      .screen(client, entry.box, entry.session)
      .then((r) => live && setMessage((m) => m || commitMessage(lastMessage(r.screen ?? ""), entry.branch)))
      .catch(() => live && setMessage((m) => m || commitMessage([], entry.branch)));
    return () => {
      live = false;
    };
  }, [entry, client, hasFiles, initial]);

  const options = useMemo(
    () =>
      [
        ...(hasFiles ? [{ value: "commit" as const, label: "Commit", icon: <GitCommitHorizontalIcon className={sx(paint.s3)} /> }] : []),
        { value: "push" as const, label: hasFiles ? "Commit & push" : "Push", icon: <UploadIcon className={sx(paint.s4)} /> },
        { value: "pr" as const, label: openPR ? (hasFiles ? "Commit, push & open PR" : "Push & open PR") : `${hasFiles ? "Commit & push" : "Push"} to PR #${pr?.number}`, icon: <GitPullRequestIcon className={sx(paint.s5)} /> },
      ] satisfies { value: ApproveMode; label: string; icon: React.ReactNode }[],
    [hasFiles, openPR, pr?.number],
  );

  if (!entry) return null;
  const pushes = mode !== "commit";
  const valid = !hasFiles || message.trim().length > 0;
  const go = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const out = await run(approveCommand(entry, mode, message, openPR));
      setOutput(out.trim());
      const url = /https:\/\/\S+\/pull\/\d+/.exec(out)?.[0];
      toastManager.add({
        title: mode === "commit" ? `Committed on ${entry.branch}` : mode === "push" ? `Pushed ${entry.branch}` : url ? "Opened a pull request" : `Pushed to PR #${pr?.number}`,
        description: url ?? message.split("\n")[0],
        type: "success",
      });
      if (mode === "pr") forgetPullRequest(entry.key);
      await settle(entry);
      onClose();
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogPopup width="34" showCloseButton={false} onKeyDown={submitOnCmdEnter(() => void go())}>
        <DialogHeader pad="step">
          <div className={sx(paint.s6)}>
            <DialogTitle>Approve</DialogTitle>
            <Target entry={entry} />
          </div>
          <DialogDescription>
            {hasFiles ? `Commits ${entry.files.length} changed file${entry.files.length === 1 ? "" : "s"} on ${entry.branch}` : `${entry.ahead || entry.base_ahead} commit${(entry.ahead || entry.base_ahead) === 1 ? "" : "s"} on ${entry.branch}`}
            {pushes && `, then pushes ${entry.branch} to origin`}
            {mode === "pr" && openPR && ` and opens a pull request into ${baseBranch(entry)}`}.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel inset="body" stack={3}>
          <PickOne<ApproveMode> label="What to do" value={mode} options={options} onChange={setMode} />
          {hasFiles && (
            <label className={sx(paint.s7)}>
              <span className={sx(paint.s8)}>Commit message</span>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="What the agent changed, in one line, then details"
                mono text="xs"
                autoFocus
              />
              <span className={sx(paint.s9)}>Drafted from {agentLabel(entry.agent)}'s last message. The first line is the subject{mode === "pr" && openPR ? " and the PR's title" : ""}.</span>
            </label>
          )}
          {pushes && (
            <p className={sx(paint.s10)}>
              <AlertTriangleIcon className={sx(paint.s11)} />
              <span>
                This pushes <span className={sx(paint.s12)}>{entry.branch}</span> to origin from {entry.box}, with that box's git credentials.
              </span>
            </p>
          )}
          {(error || output) && <pre className={[sx(paint.s13), error ? sx(paint.s14) : sx(paint.s15)].filter(Boolean).join(" ")}>{error ?? output}</pre>}
        </DialogPanel>
        <DialogFooter pad="actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void go()} loading={busy} disabled={!valid}>
            {options.find((o) => o.value === mode)?.label}
            <span className={sx(paint.s16)}><Kbd>⌘↵</Kbd></span>
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export function SendBackDialog({ entry, onClose }: { entry?: ReviewEntry; onClose(): void }) {
  const client = useStore((s) => s.client);
  const [note, setNote] = useState("Changes requested: ");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // A screenshot of what's wrong, say: it goes up to the agent's worktree.
  const files = useAttachments(entry ? { box: entry.box, session: entry.session } : undefined);
  useEffect(() => {
    setNote("Changes requested: ");
    setError(undefined);
    files.clear();
    // Only when the entry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry]);
  if (!entry) return null;
  const go = async () => {
    if (!client || busy || files.blocker || !note.replace(/^Changes requested:\s*/, "").trim()) return;
    setBusy(true);
    try {
      // The person writes this note, so it goes in even at a question.
      await boxApi.send(client, entry.box, entry.session, withAttachments(note.trim(), files.paths), true, { when: "now", force: true });
      toastManager.add({ title: `Sent back to ${agentLabel(entry.agent)}`, description: reviewName(entry), type: "success" });
      void refreshReview();
      onClose();
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogPopup showCloseButton={false} onKeyDown={submitOnCmdEnter(() => void go())}>
        <DialogHeader pad="step">
          <div className={sx(paint.s17)}>
            <DialogTitle>Send back</DialogTitle>
            <Target entry={entry} />
          </div>
          <DialogDescription>Typed into {agentLabel(entry.agent)}'s session as your next prompt. It leaves the inbox while it works.</DialogDescription>
        </DialogHeader>
        <DialogPanel {...files.dropProps} drop={files.dragging} inset="body" stack={2}>
          <AttachmentChips items={files.items} onRemove={files.remove} onRetry={files.retry} />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onPaste={files.onPaste}
            rows={5}
            autoFocus
            onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          />
          {error && <ErrorText className={sx(paint.s18)} text={error} />}
        </DialogPanel>
        <DialogFooter pad="actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void go()} loading={busy} disabled={!!files.blocker || !note.replace(/^Changes requested:\s*/, "").trim()}>
            Send back
            <span className={sx(paint.s19)}><Kbd>⌘↵</Kbd></span>
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export function DiscardDialog({ entry, onClose }: { entry?: ReviewEntry; onClose(): void }) {
  const run = useExec(entry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => setError(undefined), [entry]);
  if (!entry) return null;
  const go = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await run(DISCARD_COMMAND);
      toastManager.add({ title: `Discarded changes in ${reviewName(entry)}`, type: "success" });
      await refreshReview();
      onClose();
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  };
  const lost = entry.added + entry.removed;
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogPopup showCloseButton={false}>
        <DialogHeader pad="step">
          <div className={sx(paint.s20)}>
            <DialogTitle>Discard these changes?</DialogTitle>
            <Target entry={entry} />
          </div>
          <DialogDescription>
            Throws away every uncommitted change in this worktree, new files included. This can't be undone.
            {entry.base_ahead > 0 && ` Its ${entry.base_ahead} commit${entry.base_ahead === 1 ? "" : "s"} on ${entry.branch} are kept.`}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel inset="body" stack={2}>
          <div className={sx(paint.s21)}>
            <span className={sx(paint.s22)}>
              {entry.files.length} file{entry.files.length === 1 ? "" : "s"} lost
            </span>
            {lost > 0 && <span className={sx(paint.s23)}>{lost} line{lost === 1 ? "" : "s"}</span>}
          </div>
          <ul className={sx(paint.s24)}>
            {entry.files.map((f) => (
              <li key={f.path} className={sx(paint.s25)}>
                <span className={sx(paint.s26)}>{describeCode(f.code).label}</span>
                <span className={sx(paint.s27)}>{f.path}</span>
                {!f.binary && (
                  <span className={sx(paint.s28)}>
                    <span className={sx(paint.s29)}>+{f.added}</span> <span className={sx(paint.s30)}>−{f.removed}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className={sx(paint.s31)}>{DISCARD_COMMAND}</p>
          {error && <ErrorText className={sx(paint.s32)} text={error} />}
        </DialogPanel>
        <DialogFooter pad="actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep them
          </Button>
          <Button variant="destructive" onClick={() => void go()} loading={busy}>
            Discard {entry.files.length} file{entry.files.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
