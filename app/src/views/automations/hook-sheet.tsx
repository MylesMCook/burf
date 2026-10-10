import * as stylex from "@stylexjs/stylex";
import { ShieldIcon, ZapIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Hook } from "@/lib/api";
import { plainError } from "@/lib/errors";
import { ALWAYS_ENV, catalogFor, describe, envName } from "@/views/automations/catalog";
import { LAPTOP } from "@/views/automations/use-hooks";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "marginTop": "6px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "marginTop": "6px",
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s2: {
    "marginTop": "2px",
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s3: {
    "marginTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "marginTop": "6px",
    "display": "flex",
    "flexWrap": "wrap",
    "gap": "4px",
  },
  s5: {
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 40%, transparent)",
    },
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s6: {
    "display": "grid",
    "gridTemplateColumns": "8rem 1fr",
    "gap": "12px",
  },
  s7: {
    "marginTop": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "marginBottom": "6px",
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s11: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s12: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s13: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s14: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s15: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s16: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s17: {
    "maxHeight": "240px",
    "overflowY": "auto",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s18: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s19: {
    "width": "14px",
    "height": "14px",
    "color": "var(--warning)",
  },
  s20: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s21: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "10px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "textAlign": "left",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s23: {
    "backgroundColor": "var(--accent)",
  },
  s24: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s25: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s26: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "flexShrink": 0,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A valid "on": an event, a prefix like worktree.*, *, or before: one of those.
const VALID_ON = /^(before:)?(\*|[a-z][a-z0-9-]*\.(\*|[a-z][a-z0-9.-]*))$/;

export interface Editing {
  machine: string;
  // The hook's index in the machine's list; absent for a new one.
  index?: number;
  hook: Hook;
}

// HookSheet adds or edits one hook. Saving writes the machine's whole list,
// and the server's validation error, if any, is shown here.
export function HookSheet({ editing, onSave, onClose }: { editing?: Editing; onSave(e: Editing): Promise<void>; onClose(): void }) {
  const [hook, setHook] = useState<Hook>({ on: "", run: "" });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const run = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setHook(editing.hook);
      setError(undefined);
    }
  }, [editing]);

  const machine = editing?.machine ?? LAPTOP;
  const isNew = editing?.index === undefined;
  const d = describe(hook.on);
  const onValid = VALID_ON.test(hook.on);

  const insert = (raw: string) => {
    const el = run.current;
    const at = el?.selectionStart ?? hook.run.length;
    // Its own word: a space unless the cursor already follows one.
    const text = at > 0 && !/\s/.test(hook.run[at - 1]) ? ` ${raw}` : raw;
    const next = hook.run.slice(0, at) + text + hook.run.slice(el?.selectionEnd ?? at);
    setHook({ ...hook, run: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + text.length, at + text.length);
    });
  };

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    setError(undefined);
    try {
      const clean: Hook = { on: hook.on.trim(), run: hook.run.trim() };
      if (hook.tool?.trim()) clean.tool = hook.tool.trim();
      if (hook.timeout?.trim()) clean.timeout = hook.timeout.trim();
      await onSave({ ...editing, hook: clean });
      onClose();
    } catch (err) {
      setError(plainError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!editing} onOpenChange={(open) => !open && onClose()}>
      <SheetPopup width="512">
        <SheetHeader>
          <SheetTitle>{isNew ? "New hook" : "Edit hook"}</SheetTitle>
          <SheetDescription>Runs on {machine === LAPTOP ? "this laptop" : machine}.</SheetDescription>
        </SheetHeader>
        <SheetPanel stack={5}>
          <section>
            <Label>When</Label>
            <EventPicker machine={machine} value={hook.on} onChange={(on) => setHook({ ...hook, on })} />
            {hook.on && !onValid && <p className={sx(paint.s0)}>Use an event like agent.finished, a prefix like worktree.*, *, or before: one of those.</p>}
            {d.gate && onValid && (
              <p className={sx(paint.s1)}>
                <ShieldIcon className={sx(paint.s2)} />A gate: it runs first, and exiting non-zero stops the action. What it prints is the reason shown.
              </p>
            )}
          </section>

          <section>
            <Label>Run</Label>
            <Textarea
              ref={run}
              value={hook.run}
              onChange={(e) => setHook({ ...hook, run: e.target.value })}
              placeholder={d.gate ? 'test "$BERTH_NAME" != main' : 'cd "$BERTH_PATH" && pnpm install'}
              rows={2}
              mono text="xs" span="script"
              spellCheck={false}
            />
            <p className={sx(paint.s3)}>Through /bin/sh, with the event as JSON on stdin. Click to insert:</p>
            <div className={sx(paint.s4)}>
              {[...d.fields.map(envName), ...ALWAYS_ENV].map((v) => (
                <button key={v} type="button" onClick={() => insert(`"$${v}"`)} className={sx(paint.s5)}>
                  ${v}
                </button>
              ))}
            </div>
          </section>

          <section className={sx(paint.s6)}>
            <div>
              <Label>Timeout</Label>
              <Input value={hook.timeout ?? ""} onChange={(e) => setHook({ ...hook, timeout: e.target.value })} placeholder={d.gate ? "30s" : "1m"} mono text="xs" />
            </div>
            <div>
              <Label>Integration (optional)</Label>
              <Input value={hook.tool ?? ""} onChange={(e) => setHook({ ...hook, tool: e.target.value })} placeholder="e.g. slack" mono text="xs" />
              <p className={sx(paint.s7)}>Skips events this integration caused, so two integrations can't loop.</p>
            </div>
          </section>

          {error && <ErrorText className={sx(paint.s8)} text={error} />}
        </SheetPanel>
        <SheetFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!onValid || !hook.run.trim() || saving} loading={saving}>
            {isNew ? "Add hook" : "Save"}
          </Button>
        </SheetFooter>
      </SheetPopup>
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className={sx(paint.s9)}>{children}</div>;
}

// EventPicker is a filterable list of what this machine can follow. Typing
// filters it, and anything that is a valid pattern can be kept as typed.
function EventPicker({ machine, value, onChange }: { machine: string; value: string; onChange(on: string): void }) {
  const [query, setQuery] = useState("");
  // Collapsed to the chosen event, so it is always visible; open to change.
  const [picking, setPicking] = useState(!value);
  const entries = useMemo(() => catalogFor(machine), [machine]);
  const pick = (on: string) => {
    onChange(on);
    setPicking(false);
    setQuery("");
  };
  if (!picking && value) {
    const d = describe(value);
    return (
      <div className={sx(paint.s10)}>
        {d.gate ? <ShieldIcon className={sx(paint.s11)} /> : <ZapIcon className={sx(paint.s12)} />}
        <span className={sx(paint.s13)}>
          <span className={sx(paint.s14)}>{d.label}</span>
          <code className={sx(paint.s15)}>{value}</code>
        </span>
        <Button size="xs" variant="outline" onClick={() => setPicking(true)}>
          Change
        </Button>
      </div>
    );
  }
  const q = query.trim().toLowerCase();
  const shown = q ? entries.filter((e) => e.on.includes(q) || e.label.toLowerCase().includes(q)) : entries;
  const custom = q && VALID_ON.test(q) && !entries.some((e) => e.on === q);

  return (
    <div className={sx(paint.s16)}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && custom) pick(q);
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            setPicking(false);
          }
        }}
        autoFocus={!!value}
        placeholder="Search events, or type a pattern like worktree.*"
        unstyled
        plain="line"
      />
      <ul className={sx(paint.s17)} role="listbox">
        {custom && (
          <Row selected={value === q} onPick={() => pick(q)} icon={<ZapIcon className={sx(paint.s18)} />} label={describe(q).label} on={q} />
        )}
        {shown.map((e) => (
          <Row
            key={e.on}
            selected={value === e.on}
            onPick={() => pick(e.on)}
            icon={e.gate ? <ShieldIcon className={sx(paint.s19)} /> : <ZapIcon className={sx(paint.s20)} />}
            label={e.label}
            on={e.on}
            hint={e.hint}
          />
        ))}
        {!custom && shown.length === 0 && <li className={sx(paint.s21)}>Nothing matches. A valid pattern can be typed and kept with Enter.</li>}
      </ul>
    </div>
  );
}

function Row({ selected, onPick, icon, label, on, hint }: { selected: boolean; onPick(): void; icon: React.ReactNode; label: string; on: string; hint?: string }) {
  return (
    <li>
      <button type="button" role="option" aria-selected={selected} onClick={onPick} className={[sx(paint.s22), selected && sx(paint.s23)].filter(Boolean).join(" ")}>
        {icon}
        <span className={sx(paint.s24)}>
          <span className={sx(paint.s25)}>{label}</span>
          {hint && <span className={sx(paint.s26)}>{hint}</span>}
        </span>
        <code className={sx(paint.s27)}>{on}</code>
      </button>
    </li>
  );
}
