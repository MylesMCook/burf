import * as stylex from "@stylexjs/stylex";
import { ShieldIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { SimpleSelect } from "@/components/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { plainError } from "@/lib/errors";
import { useStore } from "@/lib/store";
import { Tip } from "@/components/tip";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "width": "16px",
    "height": "16px",
  },
  s1: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s2: {
    "display": "flex",
    "alignItems": "baseline",
    "justifyContent": "space-between",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s3: {
    "color": "var(--muted-foreground)",
  },
  s4: {
    "fontFamily": "var(--font-mono)",
    "fontVariantNumeric": "tabular-nums",
  },
  s5: {
    "position": "relative",
    "marginTop": "6px",
    "height": "6px",
    "overflow": "hidden",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
  },
  s6: {
    "height": "100%",
    "borderRadius": "999px",
  },
  s7: {
    "backgroundColor": "var(--warning)",
  },
  s8: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 50%, transparent)",
  },
  s9: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "width": "1px",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 60%, transparent)",
  },
  s10: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s12: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "12px",
  },
  s13: {
    "opacity": 0.6,
  },
  s14: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s15: {
    "width": "160px",
  },
  s16: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s17: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "10px",
  },
  s18: {
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "10px",
  },
  s20: {
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "marginBottom": "6px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "display": "flex",
    "gap": "8px",
  },
  s24: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s25: {
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The resource guard is a box's own: when its memory stays high, it stops
// dev servers in worktrees where no agent is working, then pauses worktrees
// whose agents are all idle or finished. See internal/box/guard.go.

export interface GuardConfig {
  enabled: boolean;
  memory_percent?: number;
  sustain?: string;
  stop_services?: boolean;
  pause_agents?: boolean;
  // A memory ceiling for each session's processes, in GB (Settings ›
  // Boxes, "Browsers and sessions"); kept here, applied by systemd.
  session_memory_gb?: number;
}

export interface GuardAction {
  at: string;
  action: "stop_services" | "pause_worktree";
  location: string;
  worktree: string;
  services?: string[];
  sessions?: string[];
  memory_percent: number;
  reason: string;
}

export interface GuardStatus {
  config: GuardConfig;
  memory: { total: number; used: number };
  memory_percent: number;
  over_since?: string;
  actions: GuardAction[];
  // Sessions run in systemd scopes here, so session_memory_gb applies.
  session_scopes?: boolean;
}

const SUSTAIN = [
  { value: "30s", label: "for 30 seconds" },
  { value: "1m", label: "for a minute" },
  { value: "2m", label: "for 2 minutes" },
  { value: "5m", label: "for 5 minutes" },
];

export function GuardDialog({ box, open, onOpenChange }: { box: string; open: boolean; onOpenChange(open: boolean): void }) {
  const [status, setStatus] = useState<GuardStatus>();
  const [draft, setDraft] = useState<GuardConfig>({ enabled: false });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const client = useStore.getState().client;
    if (!client) return;
    setError(undefined);
    client
      .box<GuardStatus>(box, "GET", "guard")
      .then((s) => {
        setStatus(s);
        setDraft(s.config);
      })
      .catch((err) => setError(plainError(err)));
  }, [box, open]);

  const save = async () => {
    const client = useStore.getState().client;
    if (!client) return;
    setSaving(true);
    try {
      const s = await client.box<GuardStatus>(box, "PUT", "guard", { config: draft });
      setStatus(s);
      toastManager.add({ title: draft.enabled ? `The guard watches ${box}` : `The guard is off on ${box}`, type: "success" });
      onOpenChange(false);
    } catch (err) {
      setError(plainError(err));
    } finally {
      setSaving(false);
    }
  };

  const threshold = draft.memory_percent ?? 90;
  const used = status?.memory_percent ?? 0;
  const stopServices = draft.stop_services ?? true;
  const pauseAgents = draft.pause_agents ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle row>
            <ShieldIcon className={sx(paint.s0)} />
            Resource guard on {box}
          </DialogTitle>
          <DialogDescription>Keeps {box} usable when it runs short of memory, without touching agents that are working or waiting for you.</DialogDescription>
        </DialogHeader>
        <DialogPanel inset="body" stack={4}>
          {status && status.memory.total > 0 && (
            <div className={sx(paint.s1)}>
              <div className={sx(paint.s2)}>
                <span className={sx(paint.s3)}>Memory now</span>
                <span className={sx(paint.s4)}>{used.toFixed(0)}%</span>
              </div>
              <Tip label={`The line is the threshold, ${threshold}%`}>
                <div role="img" aria-label={`${used.toFixed(0)}% in use; threshold ${threshold}%`} className={sx(paint.s5)}>
                  <div className={[sx(paint.s6), used >= threshold ? sx(paint.s7) : sx(paint.s8)].filter(Boolean).join(" ")} style={{ width: `${Math.min(used, 100)}%` }} />
                  <div className={sx(paint.s9)} style={{ left: `${threshold}%` }} />
                </div>
              </Tip>
            </div>
          )}
          {status && status.memory.total === 0 && <p className={sx(paint.s10)}>This box doesn't report its memory, so the guard can't watch it.</p>}

          <label className={sx(paint.s11)}>
            <Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} />
            Watch {box}'s memory
          </label>

          <fieldset disabled={!draft.enabled} className={[sx(paint.s12), !draft.enabled && sx(paint.s13)].filter(Boolean).join(" ")}>
            <div className={sx(paint.s14)}>
              <span>When memory stays above</span>
              <Input
                type="number"
                min={50}
                max={99}
                value={threshold}
                onChange={(e) => setDraft({ ...draft, memory_percent: Number(e.target.value) || undefined })}
                measure="slot" align="end" nums
                aria-label="Memory threshold percent"
              />
              <span>%</span>
              <div className={sx(paint.s15)}>
                <SimpleSelect aria-label="For how long" value={draft.sustain ?? "1m"} onChange={(sustain) => setDraft({ ...draft, sustain })} options={SUSTAIN} size="sm" />
              </div>
            </div>
            <ol className={sx(paint.s16)}>
              <li className={sx(paint.s17)}>
                <Switch checked={stopServices} onCheckedChange={(v) => setDraft({ ...draft, stop_services: v })} />
                <span>
                  First, stop dev servers in worktrees where no agent is working
                  <span className={sx(paint.s18)}>Idle longest first, one worktree at a time. This frees memory straight away.</span>
                </span>
              </li>
              <li className={sx(paint.s19)}>
                <Switch checked={pauseAgents} onCheckedChange={(v) => setDraft({ ...draft, pause_agents: v })} />
                <span>
                  Then, pause worktrees whose agents are all idle or finished
                  <span className={sx(paint.s20)}>Paused agents use no CPU and the box can swap them out. Resume them from the Worktrees view.</span>
                </span>
              </li>
            </ol>
          </fieldset>

          {status && status.actions.length > 0 && (
            <div>
              <h4 className={sx(paint.s21)}>Recently</h4>
              <ul className={sx(paint.s22)}>
                {status.actions
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((a) => (
                    <li key={a.at + a.worktree} className={sx(paint.s23)}>
                      <span className={sx(paint.s24)}>{new Date(a.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span>
                        {a.action === "stop_services" ? `Stopped ${a.services?.join(", ")} in ${a.location}/${a.worktree}` : `Paused ${a.location}/${a.worktree}`} at {a.memory_percent.toFixed(0)}%
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {error && <ErrorText className={sx(paint.s25)} text={error} />}
        </DialogPanel>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!status}>
            Save
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
