import * as stylex from "@stylexjs/stylex";
import { AlertTriangleIcon, CheckIcon, CircleDashedIcon, CircleIcon, CircleXIcon, ClockIcon, CloudOffIcon, ListStartIcon, MessageCircleQuestionIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { type ComposerKind, TaskComposer } from "@/components/conversation/task-composer";
import { useTargetLabel } from "@/components/prompts/shared";
import { StepHeader } from "@/components/step-header";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ENDED, type RowState, type RunRow, clearBroadcast, queueRow, stopBroadcast, summarize, useBroadcastRun } from "@/lib/broadcast";
import { type ComposerDraft, closeComposer, openComposer, useComposer } from "@/lib/composer";
import { agentOf } from "@/lib/derive";
import { openQueue } from "@/lib/queue";
import { useStore } from "@/lib/store";
import { focusSession } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s2: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s3: {
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "0.8125rem",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "color": "var(--muted-foreground)",
  },
  s5: {
    "color": "var(--muted-foreground)",
  },
  s6: {
    "color": "var(--success-foreground)",
  },
  s7: {
    "color": "var(--info-foreground)",
  },
  s8: {
    "color": "var(--success-foreground)",
  },
  s9: {
    "color": "var(--warning-foreground)",
  },
  s10: {
    "color": "var(--muted-foreground)",
  },
  s11: {
    "color": "var(--muted-foreground)",
  },
  s12: {
    "color": "var(--destructive-foreground)",
  },
  s13: {
    "color": "var(--muted-foreground)",
  },
  s14: {
    "color": "var(--warning-foreground)",
  },
  s15: {
    "color": "var(--info-foreground)",
  },
  s16: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "10px",
  },
  s17: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s18: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--success)",
  },
  s19: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s20: {
    "fontVariantNumeric": "tabular-nums",
  },
  s21: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s22: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s23: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "0.8125rem",
  },
  s24: {
    "minWidth": "0px",
    "flexShrink": 1,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s25: {
    "marginLeft": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s26: {
    "width": "14px",
    "height": "14px",
  },
  s27: {
    "height": "24px",
    "fontSize": "0.6875rem",
  },
  s28: {
    "height": "24px",
    "fontSize": "0.6875rem",
  },
  s29: {
    "height": "24px",
    "fontSize": "0.6875rem",
  },
  s30: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s31: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.6875rem",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "lineHeight": "1.375",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "1px",
    },
  },
  s32: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "pre",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// ComposerDialog is the composer in a dialog (⌘N and every "start" or
// "send" entry): the same frame and saved pickers as on home, and, after a
// prompt to several agents, how each of them got on.
export function ComposerDialog() {
  const draft = useComposer((s) => s.draft);
  const seq = useComposer((s) => s.seq);
  const run = useBroadcastRun((s) => s.run);
  useEffect(() => {
    if (draft) useStore.getState().setPaletteOpen(false);
  }, [draft]);
  return (
    <Dialog open={!!draft} onOpenChange={(open) => !open && closeComposer()}>
      {/* Anchored at the top: options open below, and a centred dialog would
          move its title as they do. */}
      <DialogPopup anchored frame="composer" showCloseButton={false} width="40">
        {draft && (draft.results && run ? <Results /> : <Compose key={seq} draft={draft} />)}
      </DialogPopup>
    </Dialog>
  );
}

const titles = {
  start: { title: "New task", description: "One agent is a task; pick several to try it several ways. No agent makes the worktree alone." },
  worktree: { title: "New worktree", description: "Just the worktree, from a name, a branch, a pull request or an issue. Pick an agent to start one in it too." },
  attempts: { title: "Try N ways", description: "Each agent tries the task in its own worktree; a check verifies them, a judge ranks them, and you pick one." },
  send: { title: "Prompt running agents", description: "One prompt, filled in for each agent, typed in one after another." },
  loop: { title: "Loop until a check passes", description: "Prompt, wait for the turn to end, run the check. While it fails, the failure goes back. Stops if the agent asks you something." },
  handoff: { title: "Hand off", description: "Another agent picks up the work, beside this one or in a new worktree." },
  review: { title: "Review with another agent", description: "A second agent reads this worktree's changes and lists problems. It opens beside this one." },
} as const;

function Compose({ draft }: { draft: ComposerDraft }) {
  const [mode, setMode] = useState(draft.mode ?? "start");
  const [kind, setKind] = useState<ComposerKind>(draft.mode === "send" ? (draft.loop ? "loop" : "send") : draft.noAgent ? "worktree" : draft.attempts ? "attempts" : "start");
  const [more, setMore] = useState(false);
  const which = draft.from?.kind ?? kind;
  const t = titles[which];
  return (
    <>
      <StepHeader title={t.title} description={t.description} />
      <DialogPanel inset="tight">
        <TaskComposer
          draft={draft}
          dialog
          autoFocus
          keepOpen={more}
          onMode={setMode}
          onKind={setKind}
          onDone={(how) => {
            if (how.results) openComposer({ results: true });
            else closeComposer();
          }}
        />
      </DialogPanel>
      <DialogFooter pad="split10">
        <span className={sx(paint.s0)}>
          <span className={sx(paint.s1)}>
            <Kbd>⇧⏎</Kbd> new line
          </span>
          <span className={sx(paint.s2)}>
            <Kbd>esc</Kbd> close
          </span>
        </span>
        {mode === "start" && !draft.from && (
          <label className={sx(paint.s3)}>
            <Switch checked={more} onCheckedChange={setMore} />
            Start more
          </label>
        )}
      </DialogFooter>
    </>
  );
}

const stateInfo: Record<RowState, { label: string; Icon?: typeof CheckIcon; className: string; spin?: boolean }> = {
  queued: { label: "Queued", Icon: CircleDashedIcon, className: sx(paint.s4) },
  sending: { label: "Sending", className: sx(paint.s5), spin: true },
  sent: { label: "Sent", Icon: CheckIcon, className: sx(paint.s6) },
  working: { label: "Working", className: sx(paint.s7), spin: true },
  finished: { label: "Done", Icon: CheckIcon, className: sx(paint.s8) },
  waiting: { label: "Needs you", Icon: MessageCircleQuestionIcon, className: sx(paint.s9) },
  "timed-out": { label: "Still going", Icon: ClockIcon, className: sx(paint.s10) },
  exited: { label: "Exited", Icon: CircleIcon, className: sx(paint.s11) },
  failed: { label: "Failed", Icon: CircleXIcon, className: sx(paint.s12) },
  stopped: { label: "Not sent", Icon: CircleIcon, className: sx(paint.s13) },
  offline: { label: "Box offline", Icon: CloudOffIcon, className: sx(paint.s14) },
  deferred: { label: "Queued for later", Icon: ListStartIcon, className: sx(paint.s15) },
};

// Results is a prompt to several agents as it goes: each one's state, and
// once its turn ends, the last thing on its screen.
function Results() {
  const run = useBroadcastRun((s) => s.run)!;
  const sent = run.rows.filter((r) => !["queued", "sending", "stopped", "failed", "offline", "deferred"].includes(r.state)).length;
  const offline = run.rows.flatMap((r, i) => (r.state === "offline" ? [i] : []));
  const ended = run.rows.filter((r) => ENDED.includes(r.state) || (!run.wait && r.state === "sent")).length;
  const problems = run.rows.some((r) => r.state === "failed");
  return (
    <>
      <StepHeader
        title={
          <span className={sx(paint.s16)}>
            {run.done ? problems ? <AlertTriangleIcon aria-hidden className={sx(paint.s17)} /> : <CheckIcon aria-hidden className={sx(paint.s18)} /> : <Spinner size="lg" />}
            <span className={sx(paint.s19)}>{run.title}</span>
          </span>
        }
        description={
          <span className={sx(paint.s20)} aria-live="polite">
            {run.done ? summarize(run.rows) : `Sent to ${sent} of ${run.rows.length}${run.wait ? ` · ${ended} done` : ""}`}
          </span>
        }
      />
      <DialogPanel inset="body" stack={2}>
        {run.rows.map((r, i) => (
          <ResultRow key={`${r.box}/${r.session}`} row={r} onQueue={() => void queueRow(run.id, i)} />
        ))}
      </DialogPanel>
      <DialogFooter pad="actions">
        {!run.done ? (
          <>
            <Button type="button" variant="ghost" onClick={stopBroadcast}>
              Stop
            </Button>
            <Button type="button" variant="outline" onClick={closeComposer}>
              Keep going in the background
            </Button>
          </>
        ) : (
          <>
            {offline.length > 0 && (
              <Button type="button" variant="outline" onClick={() => offline.forEach((i) => void queueRow(run.id, i))}>
                <ListStartIcon />
                Queue {offline.length} for when {offline.length === 1 ? "its box is" : "their boxes are"} back
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const targets = run.rows.map((r) => ({ box: r.box, session: r.session }));
                clearBroadcast();
                openComposer({ mode: "send", targets });
              }}
            >
              Send another
            </Button>
            <Button
              type="button"
              autoFocus
              onClick={() => {
                clearBroadcast();
                closeComposer();
              }}
            >
              Done
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}

function ResultRow({ row, onQueue }: { row: RunRow; onQueue(): void }) {
  const { session, title, detail } = useTargetLabel(row.box, row.session);
  const info = stateInfo[row.state];
  return (
    <div className={sx(paint.s21)}>
      <div className={sx(paint.s22)}>
        <AgentIcon agent={session && agentOf(session)} />
        <span className={sx(paint.s23)}>{title}</span>
        <span className={sx(paint.s24)}>{detail}</span>
        <span className={[sx(paint.s25), info.className].filter(Boolean).join(" ")}>
          {info.spin ? <Spinner  size="sm"/> : info.Icon && <info.Icon className={sx(paint.s26)} />}
          {info.label}
        </span>
        {row.state === "offline" && (
          <Tip label={`Send it when ${row.box} is back`}>
            <span className={sx(paint.s27)}><Button type="button" size="xs" variant="outline"  onClick={onQueue}>
              Queue
            </Button></span>
          </Tip>
        )}
        {row.state === "deferred" ? (
          <span className={sx(paint.s28)}><Button
            type="button"
            size="xs"
            variant="ghost"
            
            onClick={() => {
              closeComposer();
              openQueue();
            }}>
            View queue
          </Button></span>
        ) : (
          <span className={sx(paint.s29)}><Button
            type="button"
            size="xs"
            variant="ghost"
            
            onClick={() => {
              closeComposer();
              void focusSession(row.box, row.session);
            }}>
            Open
          </Button></span>
        )}
      </div>
      {row.error && <p className={sx(paint.s30)}>{row.error}</p>}
      {row.tail && row.tail.length > 0 && (
        <div className={sx(paint.s31)}>
          {row.tail.map((l, i) => (
            <Tip key={i} label={l} width="lg">
              <div className={sx(paint.s32)}>{l}</div>
            </Tip>
          ))}
        </div>
      )}
    </div>
  );
}
