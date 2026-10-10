import * as stylex from "@stylexjs/stylex";
import { GlobeIcon, SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SimpleSelect } from "@/components/simple-select";
import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { bytes, errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { type BoxBrowser, type BoxProcesses, type BoxSessionProcs, OWNER_WORDS, SESSION_LIMITS, age, busy, cpu, memory, summary } from "@/lib/processes";
import { useStore } from "@/lib/store";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "height": "6px",
    "width": "24px",
    "overflow": "hidden",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 20%, transparent)",
  },
  s1: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "left": "0px",
    "borderRadius": "999px",
  },
  s2: {
    "backgroundColor": "var(--warning)",
  },
  s3: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s4: {
    "fontVariantNumeric": "tabular-nums",
  },
  s5: {
    "marginLeft": "calc(4px * -1)",
    "marginRight": "calc(4px * -1)",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s6: {
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
  },
  s7: {
    "display": "flex",
    "maxHeight": "min(34rem,70vh)",
    "flexDirection": "column",
  },
  s8: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "10px",
  },
  s9: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s10: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s11: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
  },
  s13: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s14: {
    "display": "flex",
    "justifyContent": "center",
    "paddingTop": "24px",
    "paddingBottom": "24px",
  },
  s15: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s16: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s17: {
    "position": "sticky",
    "top": "0px",
    "zIndex": 1,
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s18: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s19: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s21: {
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
  },
  s22: {
    "color": "var(--muted-foreground)",
  },
  s23: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s24: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s25: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s26: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s27: {
    "width": "48px",
    "flexShrink": 0,
    "textAlign": "right",
    "fontVariantNumeric": "tabular-nums",
  },
  s28: {
    "fontWeight": 500,
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
  },
  s29: {
    "width": "56px",
    "flexShrink": 0,
    "textAlign": "right",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s30: {
    "display": "flex",
    "width": "48px",
    "flexShrink": 0,
    "justifyContent": "flex-end",
  },
  s31: {
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s32: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s33: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s34: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s35: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s36: {
    "width": "48px",
    "flexShrink": 0,
    "textAlign": "right",
    "fontVariantNumeric": "tabular-nums",
  },
  s37: {
    "width": "104px",
    "flexShrink": 0,
    "textAlign": "right",
    "fontVariantNumeric": "tabular-nums",
  },
  s38: {
    "fontWeight": 500,
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
  },
  s39: {
    "color": "var(--muted-foreground)",
  },
  s40: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s41: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s42: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s43: {
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s44: {
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s45: {
    "maxHeight": "28rem",
    "overflowY": "auto",
    ":not(#\\#) .sticky": {
      "backgroundColor": "var(--background)",
    },
  },
  s46: {
    "width": "176px",
  },
  s47: {
    "opacity": 0.6,
  },
  n0: {
    "marginLeft": "calc(4px * -1)",
    "marginRight": "calc(4px * -1)",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  n1: {
    "color": {
      "default": "light-dark(var(--warning-foreground), var(--warning))",
    },
  },

  s48: {
    backgroundColor: { "[data-popup-open]": color.accent },
    color: { "[data-popup-open]": color.foreground },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A box's browsers and what its sessions use (GET /v1/processes): from the
// status bar's memory meter, and in Settings › Boxes. Anything Burf or
// its sessions started has Stop; the box user's own browsers are listed
// but left alone.

// boxHasProcesses says the box can list them (berthd with "processes").
export function useBoxHasProcesses(box: string): boolean {
  return useStore((s) => !!s.boxes[box]?.info?.capabilities?.includes("processes"));
}

// useBoxProcesses polls the list every few seconds while on.
export function useBoxProcesses(box: string, on: boolean) {
  const [data, setData] = useState<BoxProcesses>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    const client = useStore.getState().client;
    if (!client) return;
    try {
      setData(await client.box<BoxProcesses>(box, "GET", "processes"));
      setError(undefined);
    } catch (err) {
      setError(plainError(err));
    }
  }, [box]);
  useEffect(() => {
    if (!on) return;
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [on, load]);
  return { data, error, reload: load };
}

async function stop(box: string, id: string): Promise<boolean> {
  const client = useStore.getState().client;
  if (!client) return false;
  try {
    const r = await client.box<{ text: string }>(box, "POST", `processes/${encodeURIComponent(id)}/stop`);
    toastManager.add({ title: r.text, type: "success" });
    return true;
  } catch (err) {
    toastManager.add({ title: "Couldn't stop it", description: errorMessage(err), type: "error" });
    return false;
  }
}

// BoxMeter is a box's memory in the status bar; clicked, it lists the box's
// browsers and heavy sessions. A box without the list opens Settings.
export function BoxMeter({ box, mem, route, className }: { box: string; mem: { used: number; total: number }; route?: string; className?: string }) {
  const has = useBoxHasProcesses(box);
  const [open, setOpen] = useState(false);
  const used = mem.used / mem.total;
  const tip = [`${box} memory: ${bytes(mem.used)} of ${bytes(mem.total)} in use`, route].filter(Boolean).join(" · ");
  const body = (
    <>
      {box}
      <span className={sx(paint.s0)}>
        <span className={[sx(paint.s1), used > 0.85 ? sx(paint.s2) : sx(paint.s3)].filter(Boolean).join(" ")} style={{ width: `${Math.round(used * 100)}%` }} />
      </span>
      <span className={sx(paint.s4)}>{Math.round(used * 100)}%</span>
    </>
  );
  const cls = [[sx(paint.n0), (sx(paint.s48) ?? "")].filter(Boolean).join(" "), used > 0.85 && sx(paint.n1), className].filter(Boolean).join(" ");
  if (!has) {
    return (
      <Tip label={tip}>
        <button type="button" className={cls} onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })}>
          {body}
        </button>
      </Tip>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tip label={`${tip}. Click for its browsers and sessions`}>
        <PopoverTrigger render={<button type="button" data-testid={`box-meter-${box}`} className={cls} />}>{body}</PopoverTrigger>
      </Tip>
      <PopoverPopup side="top" align="end" sideOffset={6} flush width="32">
        <BoxProcessesPopover box={box} mem={mem} on={open} onSettings={() => setOpen(false)} />
      </PopoverPopup>
    </Popover>
  );
}

function BoxProcessesPopover({ box, mem, on, onSettings }: { box: string; mem: { used: number; total: number }; on: boolean; onSettings(): void }) {
  const { data, error, reload } = useBoxProcesses(box, on);
  return (
    <div data-testid="box-processes" className={sx(paint.s7)}>
      <div className={sx(paint.s8)}>
        <div className={sx(paint.s9)}>
          <div className={sx(paint.s10)}>{box}</div>
          <p className={sx(paint.s11)}>
            {bytes(mem.used)} of {bytes(mem.total)} in use{data ? ` · ${summary(data.browsers)}` : ""}
          </p>
        </div>
        <Tip label="Settings › Boxes">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Box settings"
            onClick={() => {
              onSettings();
              useStore.getState().setView({ kind: "settings", section: "boxes" });
            }}
          >
            <SettingsIcon />
          </Button>
        </Tip>
      </div>
      <div className={sx(paint.s12)}>
        <ProcessesBody box={box} data={data} error={error} reload={reload} />
      </div>
    </div>
  );
}

// ProcessesBody is the list itself, shared by the popover and Settings.
function ProcessesBody({ box, data, error, reload }: { box: string; data?: BoxProcesses; error?: string; reload(): Promise<void> }) {
  if (error && !data) return <p className={sx(paint.s13)}>{error}</p>;
  if (!data)
    return (
      <div className={sx(paint.s14)}>
        <Spinner  size="lg"/>
      </div>
    );
  const sessions = (data.sessions ?? []).slice(0, 5);
  return (
    <>
      <Section title="Browsers">
        {data.browsers.length === 0 && <li className={sx(paint.s15)}>No browsers running on {box}.</li>}
        {data.browsers.map((b) => (
          <BrowserRow key={b.id} box={box} b={b} onStopped={reload} />
        ))}
      </Section>
      {sessions.length > 0 && (
        <Section title="Sessions using the most memory">
          {sessions.map((s) => (
            <SessionRow key={s.id} s={s} />
          ))}
        </Section>
      )}
      <p className={sx(paint.s16)}>
        {data.scopes ? "Each new session runs in a scope of its own: ending it stops everything it started." : "Ending a session stops the processes Burf finds for it (this box has no systemd scopes)."}
      </p>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={sx(paint.s17)}>{title}</div>
      <ul className={sx(paint.s18)}>{children}</ul>
    </div>
  );
}

function BrowserRow({ box, b, onStopped }: { box: string; b: BoxBrowser; onStopped(): Promise<void> }) {
  const [stopping, setStopping] = useState(false);
  const hot = busy(b);
  return (
    <li data-testid="box-browser" data-owner={b.owner} className={sx(paint.s19)}>
      <GlobeIcon className={[sx(paint.s20), hot ? sx(paint.s21) : sx(paint.s22)].filter(Boolean).join(" ")} aria-hidden />
      <div className={sx(paint.s23)}>
        <div className={sx(paint.s24)}>{b.label}</div>
        <div className={sx(paint.s25)}>
          <Badge size="sm" variant={b.owner === "orphan" ? "warning" : "outline"} >
            {OWNER_WORDS[b.owner]}
          </Badge>
          <span className={sx(paint.s26)}>
            {b.engine} · {b.processes} {b.processes === 1 ? "process" : "processes"}
            {b.started ? ` · ${age(b.started)} old` : ""}
          </span>
        </div>
      </div>
      <span className={[sx(paint.s27), b.cpu_percent >= 100 && sx(paint.s28)].filter(Boolean).join(" ")}>{cpu(b.cpu_percent)}</span>
      <span className={sx(paint.s29)}>{memory(b.memory)}</span>
      <div className={sx(paint.s30)}>
        {b.stoppable ? (
          <Button
            size="xs"
            variant="outline"
            loading={stopping}
            aria-label={`Stop ${b.label}`}
            onClick={async () => {
              setStopping(true);
              if (await stop(box, b.id)) await onStopped();
              setStopping(false);
            }}
          >
            Stop
          </Button>
        ) : (
          <Tip label="Burf didn't start this browser, so it leaves it alone">
            <span className={sx(paint.s31)}>—</span>
          </Tip>
        )}
      </div>
    </li>
  );
}

function SessionRow({ s }: { s: BoxSessionProcs }) {
  const u = s.usage;
  return (
    <li data-testid="box-session" className={sx(paint.s32)}>
      <div className={sx(paint.s33)}>
        <div className={sx(paint.s34)}>{s.title || s.name}</div>
        <div className={sx(paint.s35)}>
          {s.location ?? s.name}
          {u.processes ? ` · ${u.processes} ${u.processes === 1 ? "process" : "processes"}` : ""}
        </div>
      </div>
      <span className={sx(paint.s36)}>{cpu(u.cpu_percent)}</span>
      <span className={[sx(paint.s37), u.near_limit ? sx(paint.s38) : sx(paint.s39)].filter(Boolean).join(" ")}>
        {memory(u.memory)}
        {u.memory_high ? ` of ${memory(u.memory_high)}` : ""}
      </span>
    </li>
  );
}

// BoxProcessesCard is the same list in Settings › Boxes, with the
// per-session memory limit.
export function BoxProcessesCard({ box, className }: { box: string; className?: string }) {
  const has = useBoxHasProcesses(box);
  const { data, error, reload } = useBoxProcesses(box, has);
  if (!has) return null;
  return (
    <div data-testid="box-processes-card" data-box={box} className={[sx(paint.s40), className].filter(Boolean).join(" ")}>
      <div className={sx(paint.s41)}>
        <div className={sx(paint.s42)}>
          <div className={sx(paint.s43)}>Browsers and sessions</div>
          <div className={sx(paint.s44)}>{data ? summary(data.browsers) : " "}</div>
        </div>
        <SessionLimit box={box} scopes={!!data?.scopes} />
      </div>
      <div className={sx(paint.s45)}>
        <ProcessesBody box={box} data={data} error={error} reload={reload} />
      </div>
    </div>
  );
}

// SessionLimit is the box's per-session memory ceiling, kept with its
// resource guard (session_memory_gb).
function SessionLimit({ box, scopes }: { box: string; scopes: boolean }) {
  const [gb, setGb] = useState<number>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const client = useStore.getState().client;
    client
      ?.box<{ config: { session_memory_gb?: number } }>(box, "GET", "guard")
      .then((g) => setGb(g.config.session_memory_gb ?? 0))
      .catch(() => setGb(undefined));
  }, [box]);
  if (gb === undefined) return null;
  const save = async (next: number) => {
    const client = useStore.getState().client;
    if (!client) return;
    setSaving(true);
    try {
      const g = await client.box<{ config: Record<string, unknown> }>(box, "GET", "guard");
      await client.box(box, "PUT", "guard", { config: { ...g.config, session_memory_gb: next || undefined } });
      setGb(next);
      toastManager.add({ title: next ? `Sessions on ${box} slow down near ${next} GB` : `Sessions on ${box} have no memory limit`, type: "success" });
    } catch (err) {
      toastManager.add({ title: "Couldn't set the limit", description: errorMessage(err), type: "error" });
    } finally {
      setSaving(false);
    }
  };
  const options = SESSION_LIMITS.map((n) => ({ value: String(n), label: n ? `${n} GB per session` : "No memory limit" }));
  return (
    <Tip label={scopes ? "Near it, a session is slowed down and Burf says so in its chat; nothing is stopped" : "Needs a box with systemd (Linux), where each session runs in a scope of its own"}>
      <div className={[sx(paint.s46), !scopes && sx(paint.s47)].filter(Boolean).join(" ")}>
        <SimpleSelect aria-label="Memory limit per session" value={String(gb)} onChange={(v) => void save(Number(v))} options={options} size="sm" disabled={!scopes || saving} />
      </div>
    </Tip>
  );
}
