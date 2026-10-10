import * as stylex from "@stylexjs/stylex";
import { BookMarkedIcon, ChevronsUpDownIcon, CloudOffIcon, FolderPlusIcon, MinusIcon, PinIcon, UsersIcon } from "lucide-react";
import { useEffect } from "react";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger, menuWidths } from "@/components/ui/menu";
import type { SessionEntry } from "@/hooks/use-agent-counts";
import type { AgentPreset } from "@/lib/api";
import type { AgentPick } from "@/lib/composer";
import { BASE_PERMISSIONS, chatPermissions } from "@/lib/local-computer";
import { sessionAgent, sessionName, sessionPlace } from "@/lib/derive";
import { promptsFor, usePrompts } from "@/lib/prompts";
import { useStore } from "@/lib/store";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "width": "12px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
  },
  s1: {
    "visibility": "hidden",
  },
  s2: {
    "width": "12px",
    "height": "12px",
  },
  s3: {
    "minWidth": "0px",
    "maxWidth": "240px",
    "flexShrink": 1,
  },
  s4: {
    "display": "flex",
    "flexShrink": 0,
    "gap": "2px",
  },
  s5: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s6: {
    "opacity": 0.6,
  },
  s7: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s9: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s10: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "display": "flex",
    "flexDirection": "column",
  },
  s12: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s14: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s15: {
    "minWidth": "0px",
    "flexShrink": 1,
  },
  s16: {
    "maxWidth": "288px",
  },
  s17: {
    "maxWidth": "192px",
  },
  s18: {
    "color": "var(--muted-foreground)",
  },
  s19: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s20: {
    "opacity": 0.6,
  },
  s21: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "minWidth": "0px",
    "maxWidth": "256px",
  },
  s23: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s24: {
    "opacity": 0.6,
  },
  s25: {
    "minWidth": "0px",
    "maxWidth": "176px",
    "flexShrink": 0,
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s26: {
    "pointerEvents": "none",
  },
  s27: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s28: {
    "opacity": 0.6,
  },
  s29: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "baseline",
    "justifyContent": "space-between",
    "gap": "12px",
  },
  s30: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s31: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "minWidth": "0px",
    "maxWidth": "320px",
    "flexShrink": 1,
  },
  s33: {
    "color": "var(--muted-foreground)",
  },
  s34: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s35: {
    "opacity": 0.6,
  },
  s36: {
    "paddingInlineStart": "20px",
  },
  s37: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s38: {
    "width": "12px",
    "height": "12px",
  },
  s39: {
    "fontWeight": 400,
  },
  s40: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "gap": "8px",
  },
  s41: {
    "width": "14px",
    "height": "14px",
  },
  s42: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s43: {
    "minWidth": "0px",
    "flexShrink": 1,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s44: {
    "marginLeft": "auto",
    "width": "12px",
    "height": "12px",
  },
  s45: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s46: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s47: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s48: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The composer's pickers: where (project, box, worktree or main checkout),
// which agents (with their models and efforts, and how many of each), the
// running agents a prompt goes to, and saved prompts to start from.

// What the agents picker holds: per agent, its models (each one attempt; ""
// the default) and one effort.
export type Chosen = Record<string, { models: string[]; effort: string }>;

export const expand = (sel: Chosen, copies: number): AgentPick[] =>
  Object.entries(sel).flatMap(([agent, c]) => c.models.flatMap((model) => Array.from({ length: copies }, () => ({ agent, model, effort: c.effort }))));

// toChosen groups picks back into the picker's shape.
export function toChosen(picks: { agent: string; model?: string; effort?: string }[]): Chosen {
  const out: Chosen = {};
  for (const p of picks) {
    const c = (out[p.agent] ??= { models: [], effort: p.effort ?? "" });
    if (!c.models.includes(p.model ?? "")) c.models.push(p.model ?? "");
  }
  return out;
}

// nice shows a CLI's name for a model or an effort as people say it:
// "opus" → "Opus", "xhigh" → "Extra high"; ids like gpt-5-codex stay.
export const nice = (m: string) => (m === "xhigh" ? "Extra high" : /^[a-z]+$/.test(m) ? m[0].toUpperCase() + m.slice(1) : m);

// pickLabel is the trigger's text: "Claude Code · Opus · High",
// "Claude Code (Opus vs Sonnet)", "Claude Code + Codex", "Codex ×3".
export function pickLabel(sel: Chosen, copies: number, presets: AgentPreset[]): string {
  const name = (id: string) => presets.find((p) => p.id === id)?.name ?? id;
  const entries = Object.entries(sel);
  if (!entries.length) return "No agent";
  let s: string;
  if (entries.length === 1 && entries[0][1].models.length === 1) {
    const [id, c] = entries[0];
    s = [name(id), c.models[0] && nice(c.models[0]), c.effort && nice(c.effort)].filter(Boolean).join(" · ");
  } else {
    const parts = entries.map(([id, c]) => {
      const named = c.models.filter(Boolean).map(nice);
      if (!named.length) return name(id);
      return `${name(id)} (${c.models.map((m) => (m ? nice(m) : "Default")).join(" vs ")})`;
    });
    s = parts.length > 2 ? `${parts[0]} + ${parts.length - 1} more` : parts.join(" + ");
  }
  return copies > 1 ? `${s} ×${copies}` : s;
}

const Tick = ({ on }: { on: boolean }) => (
  <span className={[sx(paint.s0), !on && sx(paint.s1)].filter(Boolean).join(" ")} aria-hidden>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={sx(paint.s2)}>
      <path d="M5.25 12.7 10.2 18.63 18.75 5.37" />
    </svg>
  </span>
);

// AgentsPicker chooses the agents to start: one is a task; several, or one
// model against another, or ×2 of the same, are attempts. single keeps it
// to one (a hand-off, a review); allowNone offers the worktree alone.
export function AgentsPicker({
  presets,
  sel,
  copies,
  none,
  missing,
  single,
  allowNone,
  onChange,
  onCopies,
  onNone,
  onCompare,
  permission,
  permissions,
  onPermission,
}: {
  presets: PickerPreset[];
  sel: Chosen;
  copies: number;
  none?: boolean;
  // A remembered agent this box does not have. Nothing else is started in its place.
  missing?: string;
  single?: boolean;
  allowNone?: boolean;
  onChange(c: Chosen): void;
  onCopies(n: number): void;
  onNone?(on: boolean): void;
  onCompare?(on: boolean): void;
  // A structured chat's permission mode, where the box takes one.
  permission?: ChatPermission;
  permissions?: string[];
  onPermission?(p: ChatPermission): void;
}) {
  if (single) return <SingleAgentPicker presets={presets} sel={sel} none={none} missing={missing} allowNone={allowNone} onChange={onChange} onNone={onNone} onCompare={onCompare} permission={permission} permissions={permissions} onPermission={onPermission} />;
  const ids = none ? [] : Object.keys(sel);
  const label = missing && !ids.length ? missing : none ? "No agent" : pickLabel(sel, copies, presets);
  // Unticking the last pick leaves it: there is always one agent, unless
  // "No agent" is ticked instead.
  const set = (id: string, next: { models: string[]; effort: string } | undefined) => {
    onNone?.(false);
    if (single) {
      if (next?.models.length) onChange({ [id]: { models: next.models.slice(-1), effort: next.effort } });
      return;
    }
    const out: Chosen = { ...sel };
    if (next?.models.length) out[id] = next;
    else delete out[id];
    if (Object.keys(out).length) onChange(out);
  };
  return (
    <Menu>
      <span className={sx(paint.s3)}><MenuTrigger render={<Button fill size="sm" variant="ghost" aria-label={`Agents: ${label}`} />}>
        {ids.length > 0 && (
          <span className={sx(paint.s4)}>
            {ids.map((id) => (
              <AgentIcon key={id} agent={id} />
            ))}
          </span>
        )}
        <span data-slot="picker-label" className={sx(paint.s5)}>{label}</span>
        <ChevronsUpDownIcon className={sx(paint.s6)} />
      </MenuTrigger></span>
      <MenuPopup align="end" width={menuWidths.w64}>
        {onCompare && <><MenuItem onClick={() => onCompare(false)}>Use one agent</MenuItem><MenuSeparator /></>}
        <MenuGroup>
          <MenuGroupLabel>{single ? "Agent" : "Agents"}</MenuGroupLabel>
          {presets.length === 0 && <p className={sx(paint.s7)}>No agent CLI on this box. Settings → Agents shows how to add one.</p>}
          {presets.map((p) => {
            const c = none ? undefined : sel[p.id];
            const models = p.model_flag ? (p.models ?? []) : [];
            const efforts = p.effort_flag ? (p.efforts ?? []) : [];
            if (!models.length && !efforts.length) {
              return (
                <MenuCheckboxItem key={p.id} checked={!!c} onCheckedChange={(on) => set(p.id, on ? { models: [""], effort: "" } : undefined)}>
                  <span className={sx(paint.s8)}>
                    <AgentIcon agent={p.id} />
                    {p.name}
                  </span>
                </MenuCheckboxItem>
              );
            }
            const cur = c ?? { models: [], effort: "" };
            const toggle = (m: string, on: boolean) => set(p.id, { ...cur, models: on ? [...cur.models.filter((x) => x !== m), m] : cur.models.filter((x) => x !== m) });
            return (
              <MenuSub key={p.id}>
                <MenuSubTrigger>
                  <Tick on={!!c} />
                  <AgentIcon agent={p.id} />
                  <span className={sx(paint.s9)}>{p.name}</span>
                  {c && <span className={sx(paint.s10)}>{[...c.models.map((m) => (m ? nice(m) : "Default")), c.effort && nice(c.effort)].filter(Boolean).join(", ")}</span>}
                </MenuSubTrigger>
                <MenuSubPopup width={menuWidths.w44}>
                  <MenuGroup>
                    <MenuGroupLabel>Model</MenuGroupLabel>
                    {["", ...models].map((m) => (
                      <MenuCheckboxItem key={m || "default"} checked={cur.models.includes(m)} onCheckedChange={(on) => toggle(m, on)}>
                        {m ? nice(m) : "Default"}
                      </MenuCheckboxItem>
                    ))}
                  </MenuGroup>
                  {efforts.length > 0 && (
                    <>
                      <MenuSeparator />
                      <MenuGroup>
                        <MenuGroupLabel>Effort</MenuGroupLabel>
                        <MenuRadioGroup value={cur.effort} onValueChange={(v) => set(p.id, { models: cur.models.length ? cur.models : [""], effort: String(v) })}>
                          {["", ...efforts].map((e) => (
                            <MenuRadioItem key={e || "default"} value={e}>
                              {e ? nice(e) : "Default"}
                            </MenuRadioItem>
                          ))}
                        </MenuRadioGroup>
                      </MenuGroup>
                    </>
                  )}
                </MenuSubPopup>
              </MenuSub>
            );
          })}
          {allowNone && (
            <MenuCheckboxItem checked={!!none} onCheckedChange={(on) => onNone?.(on)}>
              <span className={sx(paint.s11)}>
                No agent
                <span className={sx(paint.s12)}>Just the worktree</span>
              </span>
            </MenuCheckboxItem>
          )}
        </MenuGroup>
        {!single && !none && (
          <>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>Attempts of each</MenuGroupLabel>
              <MenuRadioGroup value={copies} onValueChange={(v) => onCopies(Number(v))}>
                {[1, 2, 3].map((n) => (
                  <MenuRadioItem key={n} value={n}>
                    {n === 1 ? "One" : `×${n}`}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}

const coreProviders = new Set(["codex", "claude", "cursor", "grok"]);

type ChatPermission = keyof typeof chatPermissions;
// What a structured provider calls its models, by id; CLI presets have only the ids.
export type PickerPreset = AgentPreset & { model_names?: Record<string, string> };
const permissionLabels = Object.fromEntries(Object.entries(chatPermissions).map(([id, p]) => [id, p.label]));

function SingleAgentPicker({ presets, sel, none, missing, allowNone, onChange, onNone, onCompare, permission, permissions, onPermission }: {
  presets: PickerPreset[];
  sel: Chosen;
  none?: boolean;
  missing?: string;
  allowNone?: boolean;
  onChange(c: Chosen): void;
  onNone?(on: boolean): void;
  onCompare?(on: boolean): void;
  permission?: ChatPermission;
  permissions?: string[];
  onPermission?(p: ChatPermission): void;
}) {
  const id = Object.keys(sel)[0] ?? "";
  const preset = presets.find((p) => p.id === id);
  const choice = sel[id] ?? { models: [""], effort: "" };
  const label = none ? "No agent" : missing && !preset ? missing : (preset?.name ?? "Choose agent");
  const value = none ? "__none__" : id;
  const select = (next: unknown) => {
    if (next === "__none__") return onNone?.(true);
    onNone?.(false);
    onChange({ [String(next)]: sel[String(next)] ?? { models: [""], effort: "" } });
  };
  const provider = (p: PickerPreset) => (
    <MenuRadioItem key={p.id} value={p.id} closeOnClick>
      <span className={sx(paint.s13)}>
        <AgentIcon agent={p.id} />
        <span className={sx(paint.s14)}>{p.name}</span>
      </span>
    </MenuRadioItem>
  );
  const others = presets.filter((p) => !coreProviders.has(p.id));
  return (
    <>
      <Menu>
        <span className={[sx(paint.s15), missing && !preset ? sx(paint.s16) : sx(paint.s17)].filter(Boolean).join(" ")}><MenuTrigger render={<Button fill size="sm" variant="ghost" aria-label={`Provider: ${label}`} />}>
          {!none && preset && <AgentIcon agent={id} />}
          {!none && !preset && missing && <MinusIcon className={sx(paint.s18)} />}
          <span data-slot="picker-label" className={sx(paint.s19)}>{label}</span>
          <ChevronsUpDownIcon className={sx(paint.s20)} />
        </MenuTrigger></span>
        <MenuPopup align="end" width={menuWidths.w52}>
          <MenuGroup>
            <MenuGroupLabel>Provider</MenuGroupLabel>
            {presets.length === 0 && <p className={sx(paint.s21)}>No agent CLI on this box. Settings → Agents shows how to add one.</p>}
            <MenuRadioGroup value={value} onValueChange={select}>
              {presets.filter((p) => coreProviders.has(p.id)).map(provider)}
              {others.length > 0 && (
                <MenuSub>
                  <MenuSubTrigger>Other providers</MenuSubTrigger>
                  <MenuSubPopup>
                    <MenuRadioGroup value={value} onValueChange={select}>
                      {others.map(provider)}
                    </MenuRadioGroup>
                  </MenuSubPopup>
                </MenuSub>
              )}
              {allowNone && (
                <>
                  <MenuSeparator />
                  <MenuRadioItem value="__none__" closeOnClick>
                    No agent · Worktree only
                  </MenuRadioItem>
                </>
              )}
            </MenuRadioGroup>
          </MenuGroup>
          {onCompare && (
            <>
              <MenuSeparator />
              <MenuItem disabled={presets.length < 1} onClick={() => onCompare(true)}>
                <UsersIcon />
                Compare agents…
              </MenuItem>
            </>
          )}
        </MenuPopup>
      </Menu>
      {!none && preset?.model_flag && !!preset.models?.length && <AgentOption label="Model" value={choice.models[0] ?? ""} values={preset.models} labels={preset.model_names} onChange={(model) => onChange({ [id]: { ...choice, models: [model] } })} />}
      {!none && preset?.effort_flag && !!preset.efforts?.length && <AgentOption label="Reasoning" value={choice.effort} values={preset.efforts} onChange={(effort) => onChange({ [id]: { ...choice, effort } })} />}
      {!none && permission && onPermission && <AgentOption label="Permissions" value={permission} values={permissions ?? BASE_PERMISSIONS} labels={permissionLabels} required onChange={(p) => onPermission(p as ChatPermission)} />}
    </>
  );
}

function AgentOption({ label, value, values, labels, required, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; required?: boolean; onChange(value: string): void }) {
  const text = (option: string) => labels?.[option] ?? (option ? nice(option) : "Default");
  const shown = text(value);
  return (
    <Menu>
      <span className={sx(paint.s22)}><MenuTrigger render={<Button fill size="sm" variant="ghost" aria-label={`${label}: ${shown}`} muted />}>
        <span data-slot="picker-label" className={sx(paint.s23)}>
          {label}: {shown}
        </span>
        <ChevronsUpDownIcon className={sx(paint.s24)} />
      </MenuTrigger></span>
      <MenuPopup align="end">
        <MenuGroup>
          <MenuGroupLabel>{label}</MenuGroupLabel>
          <MenuRadioGroup value={value} onValueChange={(next) => onChange(String(next))}>
            {[...(required ? [] : [""]), ...new Set(values.filter(Boolean))].map((option) => (
              <MenuRadioItem key={option || "default"} value={option} closeOnClick>
                {text(option)}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

export interface PickOption {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
}

// Pick is one of the footer's quiet pickers: Project, Box, Where.
export function Pick({
  label,
  icon,
  value,
  options,
  onPick,
  empty,
  footer,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: PickOption[];
  onPick(v: string): void;
  empty?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  const shown = options.find((o) => o.value === value)?.label ?? empty ?? "";
  // One choice and nothing else to do: a label, not a menu.
  const fixed = options.length <= 1 && !footer;
  return (
    <Menu>
      <span className={[sx(paint.s25), fixed && sx(paint.s26), className].filter(Boolean).join(" ")}><MenuTrigger render={<Button fill size="sm" variant="ghost" aria-label={`${label}: ${shown}`} disabled={fixed && !options.length} />}
      >
        {icon}
        <span data-slot="picker-label" className={sx(paint.s27)}>{shown}</span>
        {!fixed && <ChevronsUpDownIcon className={sx(paint.s28)} />}
      </MenuTrigger></span>
      <MenuPopup align="start" width={menuWidths.w52}>
        <MenuGroup>
          <MenuGroupLabel>{label}</MenuGroupLabel>
          <MenuRadioGroup value={value} onValueChange={(v) => onPick(String(v))}>
            {options.map((o) => (
              <MenuRadioItem key={o.value} value={o.value} disabled={o.disabled} closeOnClick>
                <span className={sx(paint.s29)}>
                  <span className={sx(paint.s30)}>{o.label}</span>
                  {o.detail && <span className={sx(paint.s31)}>{o.detail}</span>}
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
        {footer}
      </MenuPopup>
    </Menu>
  );
}

export function AddProjectItem({ box }: { box?: string }) {
  return (
    <>
      <MenuSeparator />
      <MenuItem onClick={() => useStore.getState().openAddProject(box || undefined)}>
        <FolderPlusIcon />
        Add a project…
      </MenuItem>
    </>
  );
}

export function DefaultBoxItem({ box, onSet }: { box: string; onSet(): void }) {
  return (
    <>
      <MenuSeparator />
      <MenuItem onClick={onSet}>
        <PinIcon />
        Make {box} this project's default box
      </MenuItem>
    </>
  );
}

const keyOf = (e: { box: string; session: string }) => `${e.box}/${e.session}`;
export const entryKey = (e: SessionEntry) => keyOf({ box: e.box, session: e.session.name });

// TargetsPicker chooses the running agents a prompt goes to, by box, each
// named by its work. Agents on boxes that are away, as last seen, get the
// prompt once their box is back.
export function TargetsPicker({
  shown,
  away,
  selected,
  onlyFree,
  onOnlyFree,
  onToggle,
  onAll,
}: {
  shown: SessionEntry[];
  away: Set<string>;
  selected: Set<string>;
  onlyFree: boolean;
  onOnlyFree(on: boolean): void;
  onToggle(key: string, on: boolean): void;
  onAll(on: boolean): void;
}) {
  const boxes = useStore((s) => s.boxes);
  const chosen = shown.filter((e) => selected.has(entryKey(e)));
  const byBox = [...new Set(shown.map((e) => e.box))].map((box) => [box, shown.filter((e) => e.box === box)] as const);
  const label = chosen.length === 0 ? "Pick agents" : chosen.length === 1 ? sessionName(chosen[0].session, { sessions: boxes[chosen[0].box]?.sessions }) : `${chosen.length} agents`;
  return (
    <Menu>
      <span className={[sx(paint.s32), !chosen.length && sx(paint.s33)].filter(Boolean).join(" ")}><MenuTrigger render={<Button fill size="sm" variant="ghost" aria-label={`Send to: ${label}`} />}>
        {chosen.length === 1 ? <AgentIcon agent={chosen[0].session.agent} /> : <UsersIcon />}
        <span data-slot="picker-label" className={sx(paint.s34)}>{label}</span>
        <ChevronsUpDownIcon className={sx(paint.s35)} />
      </MenuTrigger></span>
      <MenuPopup align="start" width={menuWidths.w80}>
        <MenuCheckboxItem checked={onlyFree} onCheckedChange={onOnlyFree}>
          Only agents that are ready or done
        </MenuCheckboxItem>
        {shown.length > 0 && (
          <MenuItem closeOnClick={false} onClick={() => onAll(chosen.length !== shown.length)}>
            <span className={sx(paint.s36)}>{chosen.length === shown.length ? "Pick none" : `Pick all ${shown.length}`}</span>
          </MenuItem>
        )}
        {byBox.length === 0 && <p className={sx(paint.s37)}>{onlyFree ? "Every agent is busy. Untick the filter to queue behind them." : "No agents are running."}</p>}
        {byBox.map(([box, entries]) => (
          <MenuGroup key={box}>
            <MenuSeparator />
            <MenuGroupLabel>
              {away.has(box) && <CloudOffIcon className={sx(paint.s38)} />}
              {box}
              {away.has(box) && <span className={sx(paint.s39)}>· offline, as last seen</span>}
            </MenuGroupLabel>
            {entries.map((e) => {
              const k = entryKey(e);
              const d = boxes[e.box];
              return (
                <MenuCheckboxItem key={k} checked={selected.has(k)} closeOnClick={false} onCheckedChange={(on) => onToggle(k, on)}>
                  <span className={sx(paint.s40)}>
                    <AgentIcon agent={e.session.agent} className={sx(paint.s41)} />
                    <span className={sx(paint.s42)}>{sessionName(e.session, { sessions: d?.sessions })}</span>
                    <span className={sx(paint.s43)}>{[sessionAgent(e.session), sessionPlace(e.session, d?.locations)].filter(Boolean).join(" · ")}</span>
                    <StateGlyph state={e.state} className={sx(paint.s44)} />
                  </span>
                </MenuCheckboxItem>
              );
            })}
          </MenuGroup>
        ))}
      </MenuPopup>
    </Menu>
  );
}

// SavedPrompts starts the text from a saved prompt: its body, variables
// and all, which fill in for each agent when it is sent.
export function SavedPrompts({ onPick }: { onPick(id: string, body: string): void }) {
  const prompts = usePrompts((s) => s.prompts);
  useEffect(() => {
    void usePrompts.getState().load();
  }, []);
  const list = promptsFor(prompts).slice(0, 12);
  return (
    <Menu>
      <Tip label="Start from a saved prompt">
        <MenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Saved prompts" muted />}>
          <BookMarkedIcon />
        </MenuTrigger>
      </Tip>
      <MenuPopup align="end" width={menuWidths.fixed72}>
        <MenuGroup>
          <MenuGroupLabel>Saved prompts</MenuGroupLabel>
          {list.length === 0 && <p className={sx(paint.s45)}>None yet. Save prompts you use often from ⌘K → Send a saved prompt.</p>}
          {list.map((p) => (
            <MenuItem key={p.id} onClick={() => onPick(p.id, p.body)}>
              <span className={sx(paint.s46)}>
                <span className={sx(paint.s47)}>{p.title}</span>
                <span className={sx(paint.s48)}>{p.body.split("\n")[0]}</span>
              </span>
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
