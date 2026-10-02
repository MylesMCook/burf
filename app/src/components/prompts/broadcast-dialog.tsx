import { AlertTriangleIcon, CheckIcon, ChevronRightIcon, CircleDashedIcon, CircleIcon, CircleXIcon, ClockIcon, CloudOffIcon, ListStartIcon, MessageCircleQuestionIcon, SendIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Tip } from "@/components/tip";
import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { VariableFields, useTargetLabel, withDefaults } from "@/components/prompts/shared";
import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StepHeader } from "@/components/step-header";
import { Dialog, DialogFooter, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { type SessionEntry, useAllSessions } from "@/hooks/use-agent-counts";
import { ENDED, type RowState, type RunRow, clearBroadcast, queueRow, startBroadcast, stopBroadcast, summarize, useBroadcastRun } from "@/lib/broadcast";
import { agentOf, sessionState } from "@/lib/derive";
import { openQueue } from "@/lib/queue";
import { load, save } from "@/lib/storage";
import { type BroadcastDraft, askedVariables, builtinValues, closeBroadcast, fill, isBuiltin, promptsFor, type Target, usePromptUi, usePrompts, variablesIn } from "@/lib/prompts";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/workspaces";

const keyOf = (t: Target) => `${t.box}/${t.session}`;
const CUSTOM = "custom";
// Agents with nothing on: ready for a prompt, or done with their turn.
const free = (e: SessionEntry) => e.state === "ready" || e.state === "finished";

// BroadcastDialog sends one prompt to several agents, each with its own
// variables filled in, and shows how each one got on.
export function BroadcastDialog() {
  const d = usePromptUi((s) => s.broadcast);
  return (
    <Dialog open={!!d} onOpenChange={(open) => !open && closeBroadcast()}>
      {/* Anchored at the top: the form and the results differ in height, and a centred dialog would move its title. */}
      <DialogPopup anchored className="sm:max-w-[44rem]" showCloseButton={false}>
        {d && <Body d={d} />}
      </DialogPopup>
    </Dialog>
  );
}

function Body({ d }: { d: BroadcastDraft }) {
  const run = useBroadcastRun((s) => s.run);
  // A draft from somewhere new starts a new broadcast once the last one is
  // over; an empty one (the toast's "Results") shows the last run.
  const fresh = !!(d.targets || d.promptId || d.text);
  const [view, setView] = useState<"compose" | "run">(() => (run && (!run.done || !fresh) ? "run" : "compose"));
  if (view === "run" && run) return <RunView onAgain={() => setView("compose")} />;
  return <Compose d={d} onStarted={() => setView("run")} />;
}

function Compose({ d, onStarted }: { d: BroadcastDraft; onStarted(): void }) {
  const prompts = usePrompts((s) => s.prompts);
  const boxes = useStore((s) => s.boxes);
  const all = useAllSessions();
  const [promptId, setPromptId] = useState(d.promptId ?? (d.text ? CUSTOM : (promptsFor(prompts)[0]?.id ?? CUSTOM)));
  const [custom, setCustom] = useState(d.text ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [onlyFree, setOnlyFree] = useState(!d.targets?.length);
  const [selected, setSelected] = useState<Set<string>>(() => new Set((d.targets ?? []).map(keyOf)));
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string>();
  const [waitTurns, setWaitTurns] = useState(() => load("berth.broadcast.wait", true));
  const [queueOffline, setQueueOffline] = useState(true);
  const status = useStore((s) => s.status);

  useEffect(() => {
    void usePrompts.getState().load();
  }, []);

  const prompt = prompts.find((p) => p.id === promptId);
  const body = prompt?.body ?? custom;
  const vars = useMemo(() => askedVariables({ body, variables: prompt?.variables }), [body, prompt]);
  const asked = withDefaults(vars, values);
  const builtinsUsed = variablesIn(body).filter(isBuiltin);

  const agents = all.filter((e) => e.state !== "exited" && agentOf(e.session));
  // Agents on boxes that are away, as the app last saw them: their prompts
  // wait in the offline queue until the box is back.
  const away = useMemo(() => {
    const off = new Set(status?.boxes.filter((b) => b.state !== "online").map((b) => b.name));
    return Object.entries(boxes)
      .filter(([box]) => off.has(box))
      .flatMap(([box, bd]) => (bd.sessions ?? []).map((session) => ({ box, session, state: sessionState(session, bd.stats) })))
      .filter((e) => e.state !== "exited" && agentOf(e.session));
  }, [boxes, status]);
  const awayBoxes = new Set(away.map((e) => e.box));
  const preselected = new Set((d.targets ?? []).map(keyOf));
  const shown = [...agents.filter((e) => !onlyFree || free(e) || preselected.has(keyOf({ box: e.box, session: e.session.name }))), ...away];
  const byBox = [...new Set(shown.map((e) => e.box))].map((box) => [box, shown.filter((e) => e.box === box)] as const);
  const chosen = shown.filter((e) => selected.has(keyOf({ box: e.box, session: e.session.name })));

  const textFor = (e: SessionEntry) => overrides[keyOf({ box: e.box, session: e.session.name })] ?? fill(body, { ...builtinValues(e.box, e.session, boxes[e.box]?.locations), ...asked });
  const missingFor = (e: SessionEntry) => {
    const v = builtinValues(e.box, e.session, boxes[e.box]?.locations);
    return builtinsUsed.filter((n) => !v[n]);
  };
  const ready = !!body.trim() && chosen.length > 0;
  const chosenAway = chosen.filter((e) => awayBoxes.has(e.box)).length;

  const toggle = (k: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(k);
      else n.delete(k);
      return n;
    });

  const submit = () => {
    if (!ready) return;
    save("berth.broadcast.wait", waitTurns);
    if (prompt) usePrompts.getState().used([prompt.id]);
    startBroadcast({
      title: prompt?.title ?? (custom.trim().split("\n")[0].slice(0, 60) || "Prompt"),
      wait: waitTurns,
      queueOffline,
      items: chosen.map((e) => ({ box: e.box, session: e.session.name, text: textFor(e) })),
    });
    onStarted();
  };

  const options = [...prompts.map((p) => ({ value: p.id, label: p.title })), { value: CUSTOM, label: "Write a prompt…" }];

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          submit();
        }
      }}
    >
      <StepHeader title="Send to several agents" description="One prompt, filled in for each agent, sent one after another." />

      <DialogPanel className="flex flex-col gap-4 px-5 pb-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-medium text-[13px]">Prompt</span>
          <SimpleSelect options={options} value={promptId} onChange={(v) => setPromptId(v || CUSTOM)} />
          {promptId === CUSTOM && <Textarea autoFocus rows={4} value={custom} placeholder="e.g. Pull main, run the tests, and fix what fails. Variables like {{branch}} fill in per agent." onChange={(e) => setCustom(e.target.value)} />}
        </div>

        <VariableFields vars={vars} values={values} onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} />

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <span className="font-medium text-[13px]">
              Agents <span className="font-normal text-muted-foreground tabular-nums">{chosen.length ? `· ${chosen.length} chosen` : ""}</span>
            </span>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
              <Switch checked={onlyFree} onCheckedChange={setOnlyFree} />
              Only ready and finished
            </label>
            <Button type="button" size="xs" variant="ghost" className="h-6 text-xs" onClick={() => setSelected(new Set(chosen.length === shown.length ? [] : shown.map((e) => keyOf({ box: e.box, session: e.session.name }))))}>
              {chosen.length === shown.length && shown.length ? "None" : "All"}
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            {byBox.length === 0 && <p className="px-3 py-6 text-center text-muted-foreground text-sm">{onlyFree && agents.length ? "Every agent is busy. Turn off the filter to queue behind them." : "No agents are running."}</p>}
            {byBox.map(([box, entries]) => (
              <div key={box}>
                <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1 font-medium text-[11px] text-muted-foreground">
                  {awayBoxes.has(box) && <CloudOffIcon className="size-3" />}
                  {box}
                  {awayBoxes.has(box) && <span className="font-normal">· offline, as last seen</span>}
                </div>
                {entries.map((e) => {
                  const k = keyOf({ box: e.box, session: e.session.name });
                  return (
                    <TargetRow
                      key={k}
                      entry={e}
                      checked={selected.has(k)}
                      onCheck={(on) => toggle(k, on)}
                      expanded={open === k}
                      onExpand={() => setOpen(open === k ? undefined : k)}
                      text={textFor(e)}
                      edited={k in overrides}
                      missing={missingFor(e)}
                      onEdit={(t) => setOverrides((s) => (t == null ? Object.fromEntries(Object.entries(s).filter(([x]) => x !== k)) : { ...s, [k]: t }))}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Switch checked={waitTurns} onCheckedChange={setWaitTurns} />
          Then wait for each turn to end, and show what they said
        </label>
        {chosenAway > 0 && (
          <label className="-mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <Switch checked={queueOffline} onCheckedChange={setQueueOffline} />
            Queue for the {chosenAway === 1 ? "agent" : `${chosenAway} agents`} on offline boxes, to send when they're back
          </label>
        )}
      </DialogPanel>

      <DialogFooter className="items-center px-5 py-3">
        <Button type="button" variant="ghost" onClick={closeBroadcast}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready}>
          <SendIcon />
          {chosen.length ? `Send to ${chosen.length} agent${chosen.length === 1 ? "" : "s"}` : "Send"}
          <Kbd className="-me-1 bg-primary-foreground/16 text-primary-foreground/80">⌘↵</Kbd>
        </Button>
      </DialogFooter>
    </form>
  );
}

function TargetRow({
  entry,
  checked,
  onCheck,
  expanded,
  onExpand,
  text,
  edited,
  missing,
  onEdit,
}: {
  entry: SessionEntry;
  checked: boolean;
  onCheck(on: boolean): void;
  expanded: boolean;
  onExpand(): void;
  text: string;
  edited: boolean;
  missing: string[];
  onEdit(text?: string): void;
}) {
  const { title, short, detail } = useTargetLabel(entry.box, entry.session.name);
  return (
    <div className="border-b last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5 px-3 py-1.5">
        <Checkbox checked={checked} onCheckedChange={(v: boolean) => onCheck(v)} aria-label={`Send to ${short}`} />
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onCheck(!checked)}>
          <AgentIcon agent={agentOf(entry.session)} />
          <span className="min-w-0 truncate text-[13px]">{title}</span>
          <span className="min-w-0 shrink truncate text-muted-foreground text-xs">{detail.replace(new RegExp(` · ${entry.box}$`), "")}</span>
        </button>
        {missing.length > 0 && (
          <Tip label="Not known for this agent; left out of its prompt">
            <span className="shrink-0 font-mono text-[11px] text-warning-foreground">no {missing.map((m) => `{{${m}}}`).join(" ")}</span>
          </Tip>
        )}
        {edited && <span className="shrink-0 text-[11px] text-info-foreground">edited</span>}
        <StateGlyph state={entry.state} className="size-3" />
        <Tip label="See and edit this agent's prompt">
          <Button type="button" size="icon-xs" variant="ghost" aria-expanded={expanded} aria-label={`Prompt for ${short}`} onClick={onExpand}>
            <ChevronRightIcon className={cn("transition-transform", expanded && "rotate-90")} />
          </Button>
        </Tip>
      </div>
      {expanded && (
        <div className="flex flex-col gap-1 px-3 pb-2.5 pl-10">
          <Textarea rows={4} className="text-[13px]" value={text} onChange={(e) => onEdit(e.target.value)} aria-label={`Prompt for ${short}`} />
          {edited && (
            <Button type="button" size="xs" variant="ghost" className="self-start text-muted-foreground" onClick={() => onEdit(undefined)}>
              Use the prompt again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

const stateInfo: Record<RowState, { label: string; Icon?: typeof CheckIcon; className: string; spin?: boolean }> = {
  queued: { label: "Queued", Icon: CircleDashedIcon, className: "text-muted-foreground" },
  sending: { label: "Sending", className: "text-muted-foreground", spin: true },
  sent: { label: "Sent", Icon: CheckIcon, className: "text-success-foreground" },
  working: { label: "Working", className: "text-info-foreground", spin: true },
  finished: { label: "Finished", Icon: CheckIcon, className: "text-success-foreground" },
  waiting: { label: "Needs you", Icon: MessageCircleQuestionIcon, className: "text-warning-foreground" },
  "timed-out": { label: "Still going", Icon: ClockIcon, className: "text-muted-foreground" },
  exited: { label: "Exited", Icon: CircleIcon, className: "text-muted-foreground" },
  failed: { label: "Failed", Icon: CircleXIcon, className: "text-destructive-foreground" },
  stopped: { label: "Not sent", Icon: CircleIcon, className: "text-muted-foreground" },
  offline: { label: "Box offline", Icon: CloudOffIcon, className: "text-warning-foreground" },
  deferred: { label: "Queued for later", Icon: ListStartIcon, className: "text-info-foreground" },
};

function RunView({ onAgain }: { onAgain(): void }) {
  const run = useBroadcastRun((s) => s.run)!;
  const sent = run.rows.filter((r) => !["queued", "sending", "stopped", "failed", "offline", "deferred"].includes(r.state)).length;
  const offline = run.rows.flatMap((r, i) => (r.state === "offline" ? [i] : []));
  const ended = run.rows.filter((r) => ENDED.includes(r.state) || (!run.wait && r.state === "sent")).length;
  const problems = run.rows.some((r) => r.state === "failed");
  return (
    <>
      {/* The same header as the form's, so the title stays where it was;
          how the run is going leads it. */}
      <StepHeader
        title={
          <span className="flex min-w-0 items-center gap-2.5">
            {run.done ? problems ? <AlertTriangleIcon aria-hidden className="size-4 shrink-0 text-warning" /> : <CheckIcon aria-hidden className="size-4 shrink-0 text-success" /> : <Spinner className="size-4 shrink-0" />}
            <span className="min-w-0 truncate">{run.title}</span>
          </span>
        }
        description={
          <span className="tabular-nums" aria-live="polite">
            {run.done ? summarize(run.rows) : `Sent to ${sent} of ${run.rows.length}${run.wait ? ` · ${ended} done` : ""}`}
          </span>
        }
      />
      <DialogPanel className="flex flex-col gap-2 px-5 pb-5">
        {run.rows.map((r, i) => (
          <ResultRow key={`${r.box}/${r.session}`} row={r} onQueue={() => void queueRow(run.id, i)} />
        ))}
      </DialogPanel>
      <DialogFooter className="items-center px-5 py-3">
        {!run.done ? (
          <>
            <Button type="button" variant="ghost" onClick={stopBroadcast}>
              Stop
            </Button>
            <Button type="button" variant="outline" onClick={closeBroadcast}>
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
                clearBroadcast();
                onAgain();
              }}
            >
              Send another
            </Button>
            <Button
              type="button"
              onClick={() => {
                clearBroadcast();
                closeBroadcast();
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
    <div className="rounded-lg border bg-card">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        <AgentIcon agent={session && agentOf(session)} />
        <span className="min-w-0 truncate font-medium text-[13px]">{title}</span>
        <span className="min-w-0 shrink truncate text-muted-foreground text-xs">{detail}</span>
        <span className={cn("ml-auto flex shrink-0 items-center gap-1 text-xs", info.className)}>
          {info.spin ? <Spinner className="size-3" /> : info.Icon && <info.Icon className="size-3.5" />}
          {info.label}
        </span>
        {row.state === "offline" && (
          <Tip label={`Send it when ${row.box} is back`}>
            <Button type="button" size="xs" variant="outline" className="h-6 text-[11px]" onClick={onQueue}>
              Queue
            </Button>
          </Tip>
        )}
        {row.state === "deferred" ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="h-6 text-[11px]"
            onClick={() => {
              closeBroadcast();
              openQueue();
            }}
          >
            View queue
          </Button>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="h-6 text-[11px]"
            onClick={() => {
              closeBroadcast();
              void focusSession(row.box, row.session);
            }}
          >
            Open
          </Button>
        )}
      </div>
      {row.error && <p className="border-t px-3 py-1.5 text-destructive-foreground text-xs">{row.error}</p>}
      {row.tail && row.tail.length > 0 && (
        <div className="space-y-px border-t bg-muted/40 px-3 py-2 font-mono text-[11px] text-foreground/80 leading-snug">
          {row.tail.map((l, i) => (
            <div key={i} className="truncate whitespace-pre" title={l}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
