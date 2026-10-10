import { ChevronRightIcon, FileCode2Icon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";

import { AgentIcon, StateGlyph } from "@/components/agent-glyph";
import { nice } from "@/components/conversation/composer-pickers";
import { StartFrom } from "@/components/new-worktree/smart-input";
import { VariableFields, useTargetLabel } from "@/components/prompts/shared";
import { SimpleSelect } from "@/components/simple-select";
import { Tip } from "@/components/tip";
import { NeedsUpdate } from "@/components/upgrade-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SessionEntry } from "@/hooks/use-agent-counts";
import type { AgentPreset, Location, TaskTemplate, TemplateVariable } from "@/lib/api";
import type { AgentPick } from "@/lib/composer";
import type { Branch, ResolveKind, Resolution } from "@/lib/projects";
import type { PromptVariable } from "@/lib/prompts";
import { labelFor } from "@/lib/templates";
import { color, font, radius } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "fontVariantNumeric": "tabular-nums",
  },
  s1: {
    "width": "14px",
    "height": "14px",
  },
  s2: {
    "width": "14px",
    "height": "14px",
  },
  s3: {
    "width": "12px",
    "height": "12px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  section: { display: "flex", minWidth: 0, flexDirection: "column", gap: 8 },
  heading: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontWeight: 500, color: color.mutedForeground, fontSize: 12 },
  labelled: { display: "flex", minWidth: 0, flexDirection: "column", gap: 4 },
  caption: { color: color.mutedForeground, fontSize: 12 },
  three: { display: "grid", gridTemplateColumns: "1fr 1fr 9rem", gap: 8 },
  two: { display: "grid", gridTemplateColumns: "1fr 10rem", gap: 8 },
  note: { display: "flex", alignItems: "flex-start", gap: 6, color: color.mutedForeground, fontSize: 12, lineHeight: 1.625 },
  noteIcon: { width: 14, height: 14, marginTop: 2, flexShrink: 0 },
  noteText: { display: "flex", minWidth: 0, flexDirection: "column", gap: 2 },
  code: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: font.mono, color: "color-mix(in oklab, var(--foreground) 80%, transparent)" },
  stack: { display: "flex", flexDirection: "column", gap: 6 },
  attempt: { display: "flex", minWidth: 0, alignItems: "center", gap: 8 },
  index: { width: 16, flexShrink: 0, textAlign: "right", color: color.mutedForeground, fontSize: 12, fontVariantNumeric: "tabular-nums" },
  who: { display: "flex", width: 160, minWidth: 0, flexShrink: 0, alignItems: "center", gap: 6, fontSize: 13 },
  clip: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  box: { width: 112, flexShrink: 0 },
  checks: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, fontSize: 13 },
  check: { display: "flex", cursor: "pointer", alignItems: "center", gap: 8 },
  dim: { opacity: 0.5 },
  targets: { overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderStyle: "solid", borderColor: color.border, backgroundColor: color.background },
  then: { display: "flex", flexDirection: "column", gap: 8, fontSize: 13 },
  loop: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, paddingLeft: 44 },
  target: { borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: color.border, ":last-child": { borderBottomWidth: 0 } },
  targetButton: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    gap: 8,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 6,
    paddingBottom: 6,
    textAlign: "left",
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  chevron: {
    width: 14,
    height: 14,
    flexShrink: 0,
    color: color.mutedForeground,
    transitionProperty: "transform",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
  open: { transform: "rotate(90deg)" },
  title: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 },
  detail: { minWidth: 0, flexShrink: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: color.mutedForeground, fontSize: 12 },
  aside: { marginLeft: "auto", display: "flex", flexShrink: 0, alignItems: "center", gap: 8 },
  missing: { fontFamily: font.mono, fontSize: 11, color: "var(--warning-foreground)" },
  edited: { fontSize: 11, color: "var(--info-foreground)" },
  edit: { display: "flex", flexDirection: "column", gap: 4, paddingLeft: 36, paddingRight: 12, paddingBottom: 10 },
  reset: { alignSelf: "flex-start" },
});

function cls(...parts: readonly (false | null | undefined | object)[]): string | undefined {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className;
}

// The composer's options, below what to do: the new worktree (what it
// starts from, its name, branch, base and template), the attempts (each
// one's extra words and box, the check, the judge, what happens to the
// pick), and for a prompt to running agents, its variables, each agent's
// own copy, and whether to wait, queue or loop.

export function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cls(styles.section)}>
      <h3 className={cls(styles.heading)}>
        {title}
        {aside}
      </h3>
      {children}
    </section>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={cls(styles.labelled)}>
      <span className={cls(styles.caption)}>{label}</span>
      {children}
    </label>
  );
}

export interface WorktreeValues {
  name: string;
  branch: string;
  base: string;
  template: string;
  vars: Record<string, string>;
}

// WorktreeOptions is the new worktree: what it starts from (unless the
// text above already is that, with no agent), and its name, branch and base
// as worked out, to change by hand.
export function WorktreeOptions({
  showStartFrom,
  startFrom,
  onStartFrom,
  kind,
  onKind,
  resolution,
  pending,
  error,
  branches,
  location,
  v,
  set,
  placeholders,
  templates,
  variables,
  nameOnly,
}: {
  showStartFrom: boolean;
  startFrom: string;
  onStartFrom(v: string): void;
  kind: ResolveKind;
  onKind(k: ResolveKind): void;
  resolution?: Resolution;
  pending: boolean;
  error?: string;
  branches?: { default?: string; branches: Branch[] };
  location?: Location;
  v: WorktreeValues;
  set(patch: Partial<WorktreeValues>, edited?: (keyof WorktreeValues)[]): void;
  placeholders: { name: string; branch: string; base: string };
  templates: TaskTemplate[];
  variables: TemplateVariable[];
  // A hand-off's new worktree: its name only.
  nameOnly?: boolean;
}) {
  if (nameOnly) {
    return (
      <Section title="New worktree">
        <Labelled label="Name">
          <Input size="sm" mono value={v.name} placeholder={placeholders.name} spellCheck={false} onChange={(e) => set({ name: e.target.value }, ["name"])} />
        </Labelled>
      </Section>
    );
  }
  const scripts = location?.scripts;
  return (
    <Section title="New worktree">
      {showStartFrom && (
        <StartFrom value={startFrom} onChange={onStartFrom} kind={kind} onKind={onKind} resolution={resolution} pending={pending} error={error} branches={branches} defaultBranch={location?.default_branch} focus={false} />
      )}
      <div className={cls(styles.three)}>
        <Labelled label="Folder">
          <Input size="sm" mono value={v.name} placeholder={placeholders.name} spellCheck={false} onChange={(e) => set({ name: e.target.value }, ["name"])} />
        </Labelled>
        <Labelled label="Branch">
          <Input size="sm" mono value={v.branch} placeholder={placeholders.branch} spellCheck={false} onChange={(e) => set({ branch: e.target.value }, ["branch"])} />
        </Labelled>
        <Labelled label="From">
          <Input size="sm" mono value={v.base} placeholder={placeholders.base} spellCheck={false} onChange={(e) => set({ base: e.target.value }, ["base"])} />
        </Labelled>
      </div>
      {templates.length > 0 && (
        <Labelled label="Template">
          <SimpleSelect size="sm" value={v.template} onChange={(id) => set({ template: id })} options={[{ value: "", label: "None" }, ...templates.map((t) => ({ value: t.id, label: t.name }))]} />
        </Labelled>
      )}
      {variables.map((variable) => (
        <Labelled key={variable.id} label={labelFor(variable)}>
          {variable.multiline ? (
            <Textarea size="sm" rows={2} value={v.vars[variable.id] ?? ""} onChange={(e) => set({ vars: { ...v.vars, [variable.id]: e.target.value } })} />
          ) : (
            <Input size="sm" value={v.vars[variable.id] ?? ""} onChange={(e) => set({ vars: { ...v.vars, [variable.id]: e.target.value } })} />
          )}
        </Labelled>
      ))}
      <p className={cls(styles.note)}>
        <FileCode2Icon className={cls(styles.noteIcon)} />
        {scripts?.setup ? (
          <span className={cls(styles.noteText)}>
            <span>Setup script {scripts.from === "repo" ? "from .berth/config.json" : "set on this project"}, runs after creating</span>
            <Tip label={scripts.setup} width="lg">
              <code className={cls(styles.code)}>{scripts.setup}</code>
            </Tip>
          </span>
        ) : (
          <span>No setup script. One in the repository's .berth/config.json runs in every new worktree.</span>
        )}
      </p>
    </Section>
  );
}

export interface AttemptValues {
  check: string;
  judge: string;
  auto: boolean;
  pr: boolean;
  extras: { suffix?: string; box?: string }[];
}

// AttemptsOptions is "Try N ways": each attempt in its own worktree, a
// check that verifies it, a judge that ranks them, and what the pick gets.
export function AttemptsOptions({
  picks,
  presets,
  box,
  otherBoxes,
  v,
  set,
  runsHere,
  names,
}: {
  picks: AgentPick[];
  presets: AgentPreset[];
  box: string;
  otherBoxes: string[];
  v: AttemptValues;
  set(patch: Partial<AttemptValues>): void;
  runsHere: boolean;
  // The attempts' worktrees: the name they share (each gets a suffix) and
  // the branch they start from.
  names: { name: string; base: string; namePlaceholder: string; basePlaceholder: string; set(patch: { name?: string; base?: string }): void };
}) {
  const name = (id: string) => presets.find((p) => p.id === id)?.name ?? id;
  const extra = (i: number, patch: { suffix?: string; box?: string }) => {
    const next = [...v.extras];
    next[i] = { ...next[i], ...patch };
    set({ extras: next });
  };
  return (
    <Section title={`${picks.length} attempts, each in its own worktree`}>
      {!runsHere && <NeedsUpdate box={box}>{box} runs an older berthd without runs, which trying several ways needs.</NeedsUpdate>}
      <div className={cls(styles.two)}>
        <Labelled label="Worktree names">
          <Input size="sm" mono value={names.name} placeholder={names.namePlaceholder} spellCheck={false} onChange={(e) => names.set({ name: e.target.value })} />
        </Labelled>
        <Labelled label="From">
          <Input size="sm" mono value={names.base} placeholder={names.basePlaceholder} spellCheck={false} onChange={(e) => names.set({ base: e.target.value })} />
        </Labelled>
      </div>
      <div className={cls(styles.stack)}>
        {picks.map((p, i) => (
          <div key={i} className={cls(styles.attempt)}>
            <span className={cls(styles.index)}>{i + 1}</span>
            <span className={cls(styles.who)}>
              <AgentIcon agent={p.agent} className={sx(paint.s1)} />
              <span className={cls(styles.clip)}>{[name(p.agent), p.model && nice(p.model), p.effort && nice(p.effort)].filter(Boolean).join(" · ")}</span>
            </span>
            <Input size="sm" aria-label={`Extra words for attempt ${i + 1}`} value={v.extras[i]?.suffix ?? ""} placeholder="and, for this one… (optional)" onChange={(e) => extra(i, { suffix: e.target.value })} />
            {otherBoxes.length > 0 && (
              <div className={cls(styles.box)}>
                <SimpleSelect aria-label={`Box for attempt ${i + 1}`} size="sm" measure="grow" value={v.extras[i]?.box || box} onChange={(b) => extra(i, { box: b })} options={[box, ...otherBoxes].map((b) => ({ value: b, label: b }))} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={cls(styles.two)}>
        <Labelled label="Check, optional (exit 0 passes; a failure goes back once)">
          <Input size="sm" mono value={v.check} placeholder="none: the judge reads the changes" onChange={(e) => set({ check: e.target.value })} />
        </Labelled>
        <Labelled label="Judge">
          <SimpleSelect size="sm" measure="grow" value={v.judge} onChange={(judge) => set({ judge })} options={presets.map((p) => ({ value: p.id, label: p.name }))} />
        </Labelled>
      </div>
      <div className={cls(styles.checks)}>
        <label className={cls(styles.check)}>
          <Switch checked={v.auto} onCheckedChange={(auto) => set({ auto })} />
          Take the judge's pick
        </label>
        <label className={cls(styles.check)}>
          <Switch checked={v.pr} onCheckedChange={(pr) => set({ pr })} />
          Open a draft PR for the pick
        </label>
      </div>
    </Section>
  );
}

export interface SendValues {
  wait: boolean;
  queueOffline: boolean;
  loop: boolean;
  check: string;
  rounds: number;
}

// SendOptions is a prompt to running agents: its variables, each agent's
// copy to read and change, and what happens after it is typed in.
export function SendOptions({
  vars,
  values,
  onValue,
  chosen,
  textFor,
  edited,
  missingFor,
  onEdit,
  open,
  onOpen,
  awayChosen,
  v,
  set,
}: {
  vars: PromptVariable[];
  values: Record<string, string>;
  onValue(name: string, value: string): void;
  chosen: SessionEntry[];
  textFor(e: SessionEntry): string;
  edited(e: SessionEntry): boolean;
  missingFor(e: SessionEntry): string[];
  onEdit(e: SessionEntry, text?: string): void;
  open?: string;
  onOpen(key?: string): void;
  awayChosen: number;
  v: SendValues;
  set(patch: Partial<SendValues>): void;
}) {
  return (
    <>
      {vars.length > 0 && (
        <Section title="Variables">
          <VariableFields vars={vars} values={values} onChange={onValue} />
        </Section>
      )}
      {chosen.length > 0 && (
        <Section title={chosen.length === 1 ? "Goes to" : `Goes to ${chosen.length} agents, one after another`}>
          <div className={cls(styles.targets)}>
            {chosen.map((e) => {
              const k = `${e.box}/${e.session.name}`;
              return <TargetRow key={k} entry={e} expanded={open === k} onExpand={() => onOpen(open === k ? undefined : k)} text={textFor(e)} edited={edited(e)} missing={missingFor(e)} onEdit={(t) => onEdit(e, t)} />;
            })}
          </div>
        </Section>
      )}
      <Section title="Then">
        <div className={cls(styles.then)}>
          <label className={cls(styles.check, v.loop && styles.dim)}>
            <Switch checked={v.wait && !v.loop} disabled={v.loop} onCheckedChange={(wait) => set({ wait })} />
            Wait for each turn to end, and show what they said
          </label>
          {awayChosen > 0 && (
            <label className={cls(styles.check)}>
              <Switch checked={v.queueOffline} onCheckedChange={(queueOffline) => set({ queueOffline })} />
              Queue for the {awayChosen === 1 ? "agent" : `${awayChosen} agents`} on offline boxes, to send when they're back
            </label>
          )}
          <label className={cls(styles.check)}>
            <Switch checked={v.loop} onCheckedChange={(loop) => set({ loop })} />
            Loop until a check passes: while it fails, the failure goes back
          </label>
          {v.loop && (
            <div className={cls(styles.loop)}>
              <Labelled label="Check (runs in each agent's worktree; exit 0 means done)">
                <Input size="sm" mono value={v.check} onChange={(e) => set({ check: e.target.value })} />
              </Labelled>
              <Labelled label="Rounds">
                <NumberField measure="28" size="sm" value={v.rounds} min={1} max={20} onValueChange={(n) => n != null && set({ rounds: n })}>
                  <NumberFieldGroup>
                    <NumberFieldDecrement />
                    <NumberFieldInput />
                    <NumberFieldIncrement />
                  </NumberFieldGroup>
                </NumberField>
              </Labelled>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

function TargetRow({ entry, expanded, onExpand, text, edited, missing, onEdit }: { entry: SessionEntry; expanded: boolean; onExpand(): void; text: string; edited: boolean; missing: string[]; onEdit(text?: string): void }) {
  const { title, short, detail } = useTargetLabel(entry.box, entry.session.name);
  return (
    <div className={cls(styles.target)}>
      <button type="button" aria-expanded={expanded} onClick={onExpand} className={cls(styles.targetButton)}>
        <ChevronRightIcon className={cls(styles.chevron, expanded && styles.open)} />
        <AgentIcon agent={entry.session.agent} className={sx(paint.s2)} />
        <span className={cls(styles.title)}>{title}</span>
        <span className={cls(styles.detail)}>{detail.replace(new RegExp(` · ${entry.box}$`), "")}</span>
        <span className={cls(styles.aside)}>
          {missing.length > 0 && (
            <Tip label="Not known for this agent; left out of its prompt">
              <span className={cls(styles.missing)}>no {missing.map((m) => `{{${m}}}`).join(" ")}</span>
            </Tip>
          )}
          {edited && <span className={cls(styles.edited)}>edited</span>}
          <StateGlyph state={entry.state} className={sx(paint.s3)} />
        </span>
      </button>
      {expanded && (
        <div className={cls(styles.edit)}>
          <Textarea rows={4} text="prompt" value={text} onChange={(e) => onEdit(e.target.value)} aria-label={`Prompt for ${short}`} />
          {edited && (
            <span className={cls(styles.reset)}><Button type="button" size="xs" variant="ghost"  onClick={() => onEdit(undefined)} muted>
              Use the prompt above again
            </Button></span>
          )}
        </div>
      )}
    </div>
  );
}
