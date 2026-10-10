import * as stylex from "@stylexjs/stylex";
import { AlertTriangleIcon, BrushCleaningIcon, CheckIcon, EllipsisIcon, ListChecksIcon, SquareIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { create } from "zustand";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { sessionWord } from "@/lib/state-model";
import { PickOne } from "@/components/pick-one";
import { removeWorktree } from "@/components/sidebar/actions";
import { confirm } from "@/components/sidebar/confirm";
import { Tip } from "@/components/tip";
import { AlertDialog, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import type { SessionEntry } from "@/hooks/use-agent-counts";
import { boxApi } from "@/lib/api";
import { agentOf, type SessionState } from "@/lib/derive";
import { plainError } from "@/lib/errors";
import { load, save } from "@/lib/storage";
import { scheduleRefresh, useStore } from "@/lib/store";
import { duration } from "@/views/dashboard/agent-card";
import { type AgentNames, describeAgent, startedAt } from "@/views/dashboard/names";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "color": "var(--muted-foreground)",
  },
  s1: {
    "color": "var(--muted-foreground)",
  },
  s2: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s3: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "marginLeft": "24px",
    "marginRight": "24px",
    "marginBottom": "12px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "color": "var(--muted-foreground)",
  },
  s6: {
    "marginLeft": "24px",
    "marginRight": "24px",
    "maxHeight": "288px",
    "overflowY": "auto",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s7: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "position": "sticky",
    "top": "0px",
    "zIndex": 1,
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 80%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s9: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s10: {
    "fontVariantNumeric": "tabular-nums",
  },
  s11: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s12: {
    "marginLeft": "24px",
    "marginRight": "24px",
    "marginTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s14: {
    "cursor": "pointer",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s15: {
    "color": "var(--muted-foreground)",
  },
  s16: {
    "display": "flex",
    "width": "16px",
    "flexShrink": 0,
    "justifyContent": "center",
  },
  s17: {
    "width": "14px",
    "height": "14px",
    "color": "var(--success)",
  },
  s18: {
    "width": "14px",
    "height": "14px",
    "color": "var(--destructive-foreground)",
  },
  s19: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s20: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s21: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s22: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "display": "block",
    "whiteSpace": "normal",
    "overflowWrap": "break-word",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s24: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s25: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "11px",
    "color": "var(--warning-foreground)",
  },
  s26: {
    "width": "12px",
    "height": "12px",
  },
  s27: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s28: {
    "display": "inline-flex",
    "width": "20px",
    "height": "20px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s29: {
    "width": "14px",
    "height": "14px",
  },

  s30: {
    backdropFilter: "blur(4px)",
  },
  s31: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 60%, transparent)",
    },
  },
  s32: {
    backgroundColor: { "[data-popup-open]": color.accent },
    color: { "[data-popup-open]": color.foreground },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Stopping agents from the board: one from its card, the picked ones, a
// column, or the ones that have sat idle. Stopping ends the agent's session
// on its box; its worktree and files stay, so another agent can pick up
// there. Nothing working or waiting on you is stopped unless you picked it.

export const entryKey = (e: SessionEntry) => `${e.box}/${e.session.name}`;
const sinceOf = (e: SessionEntry) => new Date(e.session.state_since ?? e.session.created).getTime();
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Busy agents: stopping one loses the turn it is in.
const busy = (s: SessionState) => s === "running" || s === "waiting";

// A few at a time, so a long list is quick without every request landing
// on a box at once.
const CONCURRENCY = 3;

// stopOne ends one session and drops it from the board straight away; the
// box's next listing confirms it.
async function stopOne(box: string, name: string) {
  const client = useStore.getState().client;
  if (!client) throw new Error("Not connected to the laptop agent");
  await boxApi.stopSession(client, box, name);
  useStore.setState((s) => {
    const d = s.boxes[box];
    return d ? { boxes: { ...s.boxes, [box]: { ...d, sessions: d.sessions?.filter((x) => x.name !== name) } } } : {};
  });
  scheduleRefresh(box, ["sessions"]);
}

interface Progress {
  state: "running" | "ok" | "failed";
  message?: string;
}

// stopAgents stops several, CONCURRENCY at a time, and reports each.
async function stopAgents(entries: SessionEntry[], onEach: (key: string, p: Progress) => void): Promise<number> {
  const queue = [...entries];
  let failed = 0;
  const worker = async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const key = entryKey(e);
      onEach(key, { state: "running" });
      try {
        await stopOne(e.box, e.session.name);
        onEach(key, { state: "ok" });
      } catch (err) {
        failed++;
        onEach(key, { state: "failed", message: plainError(err) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));
  return failed;
}

function namesOf(e: SessionEntry): AgentNames {
  const d = useStore.getState().boxes[e.box];
  return describeAgent(e.session, d?.sessions, d?.locations);
}

// "shop / checkout-fix", or "shop" for the main checkout.
const atOf = (n: AgentNames) => (n.where ? (n.where.worktree.main ? n.where.location.name : `${n.where.location.name} / ${n.where.worktree.name}`) : n.place);

// confirmStop asks before stopping one agent, naming it and where it runs.
export function confirmStop(e: SessionEntry) {
  const n = namesOf(e);
  const at = atOf(n);
  confirm({
    title: `Stop ${n.name} in ${n.place}?`,
    description: `Its session in ${at} on ${e.box} ends${busy(e.state) ? `, along with the turn it is ${e.state === "waiting" ? "waiting on you in" : "in the middle of"}` : ""}. The worktree and its files are kept, so you can start another agent there.`,
    detail: (
      <>
        {e.box} · {at}
        <br />
        {n.where?.worktree.branch && (
          <>
            <span className={sx(paint.s0)}>branch {n.where.worktree.branch}</span>
            <br />
          </>
        )}
        <span className={sx(paint.s1)}>
          {e.session.name} · started {startedAt(e.session.created)}
        </span>
      </>
    ),
    confirm: "Stop agent",
    destructive: true,
    run: async () => {
      await stopOne(e.box, e.session.name);
      toastManager.add({ title: `Stopped ${n.name}`, description: `${at} on ${e.box}. Its worktree is kept.`, type: "success" });
    },
  });
}

// StopMenuItems go at the end of a card's ⋯ menu.
export function StopMenuItems({ entry }: { entry: SessionEntry }) {
  const where = namesOf(entry).where;
  const others = (useStore.getState().boxes[entry.box]?.sessions ?? []).filter((s) => s.dir === entry.session.dir && !s.exited && s.name !== entry.session.name).length;
  return (
    <>
      <MenuSeparator />
      <MenuItem variant="destructive" onClick={() => confirmStop(entry)}>
        <SquareIcon />
        Stop agent…
      </MenuItem>
      {where && !where.worktree.main && (
        // The sidebar's own removal, with its checks: git refuses to lose
        // uncommitted work unless told to.
        <MenuItem variant="destructive" onClick={() => removeWorktree(entry.box, where.location, where.worktree)}>
          <Trash2Icon />
          <span className={sx(paint.s2)}>Stop and remove worktree…</span>
          {others > 0 && <span className={sx(paint.s3)}>+{others} more</span>}
        </MenuItem>
      )}
    </>
  );
}

// The bulk dialog: "stop" for picked agents or a column, "cleanup" for the
// idle ones in Done and Ready.
interface StopRequest {
  kind: "stop" | "cleanup";
  entries: SessionEntry[];
  // The column it came from, for the title.
  column?: string;
  id: number;
}

const useStopDialog = create<{ req?: StopRequest }>()(() => ({}));
let nextId = 0;

export const openStop = (req: Omit<StopRequest, "id">) => req.entries.length > 0 && useStopDialog.setState({ req: { ...req, id: ++nextId } });

type After = "1h" | "4h" | "1d";
const AFTER: { value: After; label: string; ms: number }[] = [
  { value: "1h", label: "1 hour", ms: 3_600_000 },
  { value: "4h", label: "4 hours", ms: 4 * 3_600_000 },
  { value: "1d", label: "1 day", ms: 86_400_000 },
];

// StopDialog is the host; the dashboard renders it once.
export function StopDialog() {
  const req = useStopDialog((s) => s.req);
  const [running, setRunning] = useState(false);
  const close = () => !running && useStopDialog.setState({ req: undefined });
  return (
    <AlertDialog open={!!req} onOpenChange={(o) => !o && close()}>
      {req && <Body key={req.id} req={req} onRunning={setRunning} onClose={() => useStopDialog.setState({ req: undefined })} />}
    </AlertDialog>
  );
}

interface Row {
  entry: SessionEntry;
  key: string;
  names: AgentNames;
  idle: number;
}

function Body({ req, onRunning, onClose }: { req: StopRequest; onRunning(r: boolean): void; onClose(): void }) {
  const cleanup = req.kind === "cleanup";
  // Names are taken when the dialog opens: they renumber as agents stop.
  const [rows] = useState<Row[]>(() => {
    const now = Date.now();
    return req.entries.map((entry) => ({ entry, key: entryKey(entry), names: namesOf(entry), idle: now - sinceOf(entry) })).sort((a, b) => b.idle - a.idle);
  });
  const [after, setAfter] = useState<After>(() => load("berth.dashboard.cleanupAfter", "4h"));
  const overFor = (a: After) => new Set(rows.filter((r) => r.idle > AFTER.find((x) => x.value === a)!.ms).map((r) => r.key));
  const [ticked, setTicked] = useState<Set<string>>(() => (cleanup ? overFor(after) : new Set(rows.map((r) => r.key))));
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [phase, setPhase] = useState<"confirm" | "running" | "done">("confirm");
  const cancel = useRef<HTMLButtonElement>(null);

  const chosen = rows.filter((r) => ticked.has(r.key));
  const busyCount = chosen.filter((r) => busy(r.entry.state)).length;
  const ok = rows.filter((r) => progress[r.key]?.state === "ok").length;
  const failed = rows.filter((r) => progress[r.key]?.state === "failed");
  const boxes = [...new Set(rows.map((r) => r.entry.box))].sort();
  const toggle = (key: string, on: boolean) =>
    setTicked((s) => {
      const n = new Set(s);
      if (on) n.add(key);
      else n.delete(key);
      return n;
    });

  const run = async () => {
    const targets = chosen.map((r) => r.entry);
    setPhase("running");
    onRunning(true);
    const failures = await stopAgents(targets, (key, p) => setProgress((s) => ({ ...s, [key]: p })));
    onRunning(false);
    if (failures) {
      setPhase("done");
      return;
    }
    const perBox = [...new Set(targets.map((t) => t.box))].map((b) => `${targets.filter((t) => t.box === b).length} on ${b}`);
    toastManager.add({ title: `Stopped ${plural(targets.length, "agent")}`, description: `${perBox.join(", ")}. Their worktrees are kept.`, type: "success" });
    onClose();
  };

  const title =
    phase === "done"
      ? `Stopped ${ok} of ${ok + failed.length}`
      : cleanup
        ? "Clean up idle agents"
        : req.column
          ? `Stop ${chosen.length === rows.length ? "all " : ""}${plural(chosen.length, "agent")} in ${req.column}?`
          : `Stop ${plural(chosen.length, "agent")}?`;
  const description =
    phase === "done"
      ? "The rest were left running. Each one says why below."
      : cleanup
        ? "Stops agents in Done and Ready that have sat idle for a while. Working agents and ones waiting on you are left alone. Worktrees and their files are kept."
        : `Each one's session ends on its box; its worktree and files are kept.${busyCount ? ` ${busyCount === 1 ? "One is" : `${busyCount} are`} still working or waiting on you, and ${busyCount === 1 ? "its turn ends" : "their turns end"} too.` : ""}`;

  return (
    // The keyboard starts on Cancel: Enter right after ⌫ or a menu item must
    // never stop agents mid-turn.
    <AlertDialogPopup initialFocus={cancel}>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>

      {cleanup && phase === "confirm" && (
        <div className={sx(paint.s4)}>
          <span className={sx(paint.s5)}>Idle longer than</span>
          <PickOne
            label="Idle longer than"
            value={after}
            options={AFTER}
            onChange={(a) => {
              setAfter(a);
              save("berth.dashboard.cleanupAfter", a);
              setTicked(overFor(a));
            }}
          />
        </div>
      )}

      <div className={sx(paint.s6)} role="group" aria-label="Agents to stop">
        {rows.length === 0 && <p className={sx(paint.s7)}>Nothing in Done or Ready.</p>}
        {boxes.map((box) => {
          const group = rows.filter((r) => r.entry.box === box);
          return (
            <div key={box}>
              <div className={[sx(paint.s8), sx(paint.s30)].filter(Boolean).join(" ")}>
                <span className={sx(paint.s9)}>{box}</span>
                <span className={sx(paint.s10)}>
                  {group.filter((r) => ticked.has(r.key)).length}/{group.length}
                </span>
              </div>
              <ul className={[sx(paint.s11), sx(paint.s31)].filter(Boolean).join(" ")}>
                {group.map((r) => (
                  <StopRow key={r.key} row={r} ticked={ticked.has(r.key)} progress={progress[r.key]} locked={phase !== "confirm"} cleanup={cleanup} onToggle={(on) => toggle(r.key, on)} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {cleanup && phase === "confirm" && rows.length > 0 && (
        <p className={sx(paint.s12)}>
          {chosen.length ? `${plural(chosen.length, "agent")} of ${rows.length} picked.` : `None idle that long.`} Tick or untick any of them.
        </p>
      )}

      <AlertDialogFooter>
        {phase === "done" ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button ref={cancel} variant="ghost" disabled={phase === "running"} onClick={onClose}>
              Cancel
            </Button>
            <Button variant="destructive" loading={phase === "running"} disabled={!chosen.length} onClick={() => void run()}>
              <SquareIcon />
              {chosen.length ? `Stop ${plural(chosen.length, "agent")}` : "Stop agents"}
            </Button>
          </>
        )}
      </AlertDialogFooter>
    </AlertDialogPopup>
  );
}

function StopRow({ row, ticked, progress, locked, cleanup, onToggle }: { row: Row; ticked: boolean; progress?: Progress; locked: boolean; cleanup: boolean; onToggle(on: boolean): void }) {
  const { entry, names } = row;
  const state = entry.state;
  return (
    <li>
      <label className={[sx(paint.s13), !locked && sx(paint.s14), !ticked && sx(paint.s15)].filter(Boolean).join(" ")}>
        <span className={sx(paint.s16)}>
          {progress?.state === "running" ? (
            <Spinner  size="md"/>
          ) : progress?.state === "ok" ? (
            <CheckIcon className={sx(paint.s17)} />
          ) : progress?.state === "failed" ? (
            <XIcon className={sx(paint.s18)} />
          ) : (
            <Checkbox checked={ticked} disabled={locked} onCheckedChange={(v) => onToggle(!!v)} aria-label={`Stop ${names.name} in ${names.place}`} />
          )}
        </span>
        <AgentIcon agent={agentOf(entry.session)} />
        <span className={sx(paint.s19)}>
          <span className={sx(paint.s20)}>
            <span className={sx(paint.s21)}>{names.place}</span>
            {names.crowded && <span className={sx(paint.s22)}>{names.name}</span>}
          </span>
          {progress?.state === "failed" ? (
            <span className={sx(paint.s23)}>{progress.message}</span>
          ) : (
            <span className={sx(paint.s24)}>
              {[names.where?.location.name, names.crowded && `started ${startedAt(entry.session.created)}`, names.where?.worktree.branch].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        {busy(state) && !cleanup ? (
          <span className={sx(paint.s25)}>
            <AlertTriangleIcon className={sx(paint.s26)} />
            {state === "waiting" ? "needs you" : "working"}
          </span>
        ) : (
          <Tip label={`${sessionWord(state)} for ${duration(row.idle)}`}>
            <span className={sx(paint.s27)}>
              <StateGlyph state={state} />
              {duration(row.idle)}
            </span>
          </Tip>
        )}
      </label>
    </li>
  );
}

// ColumnMenu is a column header's ⋯: pick the column's agents, stop them
// all, or clean up the idle ones (from Done and Ready).
export function ColumnMenu({ title, items, cleanup, onPick }: { title: string; items: SessionEntry[]; cleanup?: SessionEntry[]; onPick(): void }) {
  return (
    <Menu>
      <Tip label={`${title}: actions`}>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label={`${title} column actions`}
              className={[sx(paint.s28), sx(paint.s32)].filter(Boolean).join(" ")}
            />
          }
        >
          <EllipsisIcon className={sx(paint.s29)} />
        </MenuTrigger>
      </Tip>
      <MenuPopup align="end" width={menuWidths.w52}>
        <MenuItem onClick={onPick}>
          <ListChecksIcon />
          Select all {items.length}
        </MenuItem>
        {cleanup && (
          <MenuItem disabled={!cleanup.length} onClick={() => openStop({ kind: "cleanup", entries: cleanup })}>
            <BrushCleaningIcon />
            Clean up idle agents…
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem variant="destructive" onClick={() => openStop({ kind: "stop", entries: items, column: title })}>
          <SquareIcon />
          Stop all {items.length} in {title}…
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
