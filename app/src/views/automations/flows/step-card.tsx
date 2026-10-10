import * as stylex from "@stylexjs/stylex";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronRightIcon, EllipsisIcon, MinusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { PickOne } from "@/components/pick-one";
import { SimpleSelect } from "@/components/simple-select";
import { Input } from "@/components/ui/input";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import type { AgentPreset } from "@/lib/api";
import type { Step, StepRun, StepWhen } from "@/lib/flows";
import { type Variable, kindMeta } from "@/views/automations/flows/model";
import { TemplateField } from "@/views/automations/flows/template-field";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s1: {
    "borderColor": "color-mix(in oklab, var(--warning) 30%, transparent)",
  },
  s2: {
    "borderColor": "color-mix(in oklab, var(--destructive) 40%, transparent)",
  },
  s3: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s4: {
    "display": "inline-flex",
    "width": "28px",
    "height": "28px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "var(--muted)",
  },
  s5: {
    "width": "16px",
    "height": "16px",
  },
  s6: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s7: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s8: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s9: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s10: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "display": "inline-flex",
    "width": "28px",
    "height": "28px",
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
  s12: {
    "width": "16px",
    "height": "16px",
  },
  s13: {
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "12px",
    },
  },
  s14: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "8px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s15: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s16: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s18: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s19: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s20: {
    "display": "block",
    "width": "128px",
  },
  s21: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "display": "block",
  },
  s24: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s25: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "flex-end",
    "gap": "12px",
  },
  s26: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s27: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s28: {
    "display": "inline-flex",
    "height": "28px",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s29: {
    "borderColor": "color-mix(in oklab, var(--ring) 40%, transparent)",
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s30: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s31: {
    "width": "12px",
    "height": "12px",
  },
  s32: {
    "width": "12px",
    "height": "12px",
    "opacity": 0.4,
  },
  s33: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "flex-end",
    "gap": "16px",
  },
  s34: {
    "width": "192px",
  },
  s35: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s36: {
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s37: {
    "display": "block",
    "width": "176px",
  },
  s38: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s39: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s40: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s41: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "11px",
  },
  s42: {
    "width": "12px",
    "height": "12px",
  },
  s43: {
    "opacity": 0.7,
  },
  s44: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
  },
  s45: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "textAlign": "left",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s46: {
    "width": "12px",
    "height": "12px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s47: {
    "transform": "rotate(90deg)",
  },
  s48: {
    "marginLeft": "14px",
    "marginRight": "14px",
    "marginBottom": "12px",
    "maxHeight": "224px",
    "overflow": "auto",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "padding": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "lineHeight": "1.375",
  },
  s49: {
    backgroundColor: "color-mix(in oklab, var(--success) 12%, transparent)",
    color: "var(--success)",
  },
  s50: {
    backgroundColor: "color-mix(in oklab, var(--destructive) 12%, transparent)",
    color: "var(--destructive-foreground)",
  },
  s51: {
    backgroundColor: "var(--muted)",
    color: "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const WHENS: { value: StepWhen; label: string }[] = [
  { value: "success", label: "On success" },
  { value: "failure", label: "On failure" },
  { value: "always", label: "Always" },
];

const WAIT_STATES = [
  { value: "finished", label: "Finished" },
  { value: "waiting", label: "Needs you" },
  { value: "idle", label: "Idle" },
];

// StepCard is one step on the canvas: what it does, its fields, when it
// runs relative to the step before it, and how it went in the last test.
export function StepCard({
  step,
  index,
  count,
  variables,
  agents,
  readOnly,
  result,
  onChange,
  onMove,
  onRemove,
}: {
  step: Step;
  index: number;
  count: number;
  variables: Variable[];
  agents: AgentPreset[];
  readOnly?: boolean;
  result?: StepRun;
  onChange(s: Step): void;
  onMove(delta: -1 | 1): void;
  onRemove(): void;
}) {
  const meta = kindMeta(step.kind);
  const set = (patch: Partial<Step>) => onChange({ ...step, ...patch });
  const when = step.when ?? "success";

  return (
    <article className={[sx(paint.s0), when === "failure" && sx(paint.s1), result?.status === "failed" && sx(paint.s2)].filter(Boolean).join(" ")}>
      <header className={sx(paint.s3)}>
        <span className={[sx(paint.s4), meta.tone].filter(Boolean).join(" ")}>
          <meta.Icon className={sx(paint.s5)} />
        </span>
        <div className={sx(paint.s6)}>
          <div className={sx(paint.s7)}>
            <span className={sx(paint.s8)}>{index + 1}.</span>
            <h3 className={sx(paint.s9)}>{meta.label}</h3>
            {result && <ResultBadge result={result} />}
          </div>
          <p className={sx(paint.s10)}>{meta.hint}</p>
        </div>
        {!readOnly && (
          <Menu>
            <MenuTrigger render={<button type="button" aria-label="Step options" className={sx(paint.s11)} />}>
              <EllipsisIcon className={sx(paint.s12)} />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem disabled={index === 0} onClick={() => onMove(-1)}>
                <ArrowUpIcon />
                Move up
              </MenuItem>
              <MenuItem disabled={index === count - 1} onClick={() => onMove(1)}>
                <ArrowDownIcon />
                Move down
              </MenuItem>
              <MenuSeparator />
              <MenuItem variant="destructive" onClick={onRemove} disabled={count === 1}>
                <Trash2Icon />
                Remove step
              </MenuItem>
            </MenuPopup>
          </Menu>
        )}
      </header>

      <div className={sx(paint.s13)}>
        <Fields step={step} set={set} variables={variables} agents={agents} readOnly={readOnly} />
      </div>

      <footer className={sx(paint.s14)}>
        <span className={sx(paint.s15)}>Runs</span>
        {index === 0 ? (
          <span className={sx(paint.s16)}>first, when the trigger fires</span>
        ) : readOnly ? (
          <span className={sx(paint.s17)}>{WHENS.find((w) => w.value === when)?.label}</span>
        ) : (
          <PickOne<StepWhen>
            label="Runs when"
            value={when}
            onChange={(w) => set({ when: w === "success" ? undefined : w })}
            // Running only after a failure is the unusual case; it says so.
            options={WHENS.map((w) => ({ ...w, tone: w.value === "failure" ? "warning" as const : undefined }))}
          />
        )}
        <span className={sx(paint.s18)}>
          <span className={sx(paint.s19)}>Name</span>
          <Input
            value={step.id ?? ""}
            readOnly={readOnly}
            onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") || undefined })}
            placeholder="optional"
            size="sm"
            measure="time" mono text="xs"
            aria-label="Step name, for {{steps.NAME.output}}"
          />
        </span>
      </footer>

      {result && (result.output || result.error) && <ResultOutput result={result} />}
    </article>
  );
}

function Fields({ step, set, variables, agents, readOnly }: { step: Step; set(p: Partial<Step>): void; variables: Variable[]; agents: AgentPreset[]; readOnly?: boolean }) {
  const timeout = (placeholder: string) => (
    <label className={sx(paint.s20)}>
      <span className={sx(paint.s21)}>Timeout</span>
      <Input value={step.timeout ?? ""} readOnly={readOnly} onChange={(e) => set({ timeout: e.target.value || undefined })} placeholder={placeholder} mono text="xs" />
    </label>
  );
  switch (step.kind) {
    case "run":
      return (
        <>
          <TemplateField label="Command" mono value={step.command ?? ""} onChange={(command) => set({ command })} variables={variables} placeholder="pnpm test" readOnly={readOnly} />
          <p className={sx(paint.s22)}>Variables reach the command as quoted environment variables ($BERTH_FLOW_…), so a PR comment or branch name is always text, never run.</p>
          {timeout("10m")}
        </>
      );
    case "prompt":
      return (
        <>
          <TemplateField label="Prompt" multiline value={step.text ?? ""} onChange={(text) => set({ text })} variables={variables} placeholder="The tests failed: {{prev.output}} — fix them." readOnly={readOnly} />
          <label className={sx(paint.s23)}>
            <span className={sx(paint.s24)}>Session</span>
            <Input value={step.session ?? ""} readOnly={readOnly} onChange={(e) => set({ session: e.target.value || undefined })} placeholder="The agent that triggered this flow" mono text="xs" />
          </label>
        </>
      );
    case "wait":
      return (
        <div className={sx(paint.s25)}>
          <div>
            <span className={sx(paint.s26)}>Until the agent is</span>
            <div className={sx(paint.s27)}>
              {WAIT_STATES.map((s) => {
                const on = (step.for ?? ["finished", "waiting"]).includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={on}
                    onClick={() => {
                      const cur = step.for ?? ["finished", "waiting"];
                      const next = on ? cur.filter((x) => x !== s.value) : [...cur, s.value];
                      set({ for: next.length ? next : undefined });
                    }}
                    className={[sx(paint.s28), on ? sx(paint.s29) : sx(paint.s30)].filter(Boolean).join(" ")}
                  >
                    {on ? <CheckIcon className={sx(paint.s31)} /> : <MinusIcon className={sx(paint.s32)} />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          {timeout("30m")}
        </div>
      );
    case "start_agent":
      return (
        <>
          <div className={sx(paint.s33)}>
            <div className={sx(paint.s34)}>
              <span className={sx(paint.s35)}>Agent</span>
              <SimpleSelect
                value={step.agent ?? ""}
                disabled={readOnly}
                onChange={(agent) => set({ agent })}
                options={(agents.length ? agents : [{ id: "claude", name: "Claude Code", command: "claude" }, { id: "codex", name: "Codex", command: "codex" }]).map((a) => ({ value: a.id, label: a.name }))}
              />
            </div>
            <label className={sx(paint.s36)}>
              <Switch checked={!!step.new_worktree} disabled={readOnly} onCheckedChange={(v) => set({ new_worktree: v || undefined })} />
              In a new worktree
            </label>
            {step.new_worktree && (
              <label className={sx(paint.s37)}>
                <span className={sx(paint.s38)}>Worktree name</span>
                <Input value={step.name ?? ""} readOnly={readOnly} onChange={(e) => set({ name: e.target.value || undefined })} placeholder="{{worktree.name}}-review" mono text="xs" />
              </label>
            )}
          </div>
          <TemplateField label="Its first prompt" multiline value={step.text ?? ""} onChange={(text) => set({ text })} variables={variables} placeholder="Review the changes in {{worktree.path}}." readOnly={readOnly} />
          <div className={sx(paint.s39)}>
            <AgentIcon agent={step.agent} />
            Starts beside the agent that triggered this, in {step.new_worktree ? "a fresh worktree" : "the same worktree"}.
          </div>
        </>
      );
    case "notify":
      return (
        <>
          <TemplateField label="Title" value={step.title ?? ""} onChange={(title) => set({ title })} variables={variables} placeholder="{{worktree.name}} needs you" readOnly={readOnly} />
          <TemplateField label="Body" value={step.text ?? ""} onChange={(text) => set({ text: text || undefined })} variables={variables} placeholder="optional" readOnly={readOnly} />
        </>
      );
    case "webhook":
      return (
        <>
          <TemplateField label="URL" mono value={step.url ?? ""} onChange={(url) => set({ url })} variables={variables} placeholder="https://hooks.slack.com/services/…" readOnly={readOnly} />
          <TemplateField label="JSON body" mono multiline value={step.text ?? ""} onChange={(text) => set({ text: text || undefined })} variables={variables} placeholder="Empty sends the run's context" readOnly={readOnly} />
          <p className={sx(paint.s40)}>Public addresses only; private ones must be allowed in ~/.berth/network.json on the box.</p>
        </>
      );
  }
}

function ResultBadge({ result }: { result: StepRun }) {
  const tone = result.status === "succeeded" ? sx(paint.s49) : result.status === "failed" ? sx(paint.s50) : sx(paint.s51);
  const Icon = result.status === "succeeded" ? CheckIcon : result.status === "failed" ? XIcon : MinusIcon;
  return (
    <span className={[sx(paint.s41), tone].filter(Boolean).join(" ")}>
      <Icon className={sx(paint.s42)} />
      {result.status === "skipped" ? "skipped" : result.duration || result.status}
      {result.kind === "run" && result.status !== "skipped" && <span className={sx(paint.s43)}>· exit {result.exit_code}</span>}
    </span>
  );
}

function ResultOutput({ result }: { result: StepRun }) {
  const [open, setOpen] = useState(result.status === "failed");
  return (
    <div className={sx(paint.s44)}>
      <button type="button" onClick={() => setOpen(!open)} className={sx(paint.s45)}>
        <ChevronRightIcon className={[sx(paint.s46), open && sx(paint.s47)].filter(Boolean).join(" ")} />
        {result.error ? "Error" : "Output"}
      </button>
      {open && (
        <pre className={sx(paint.s48)}>
          {[result.error, result.output].filter(Boolean).join("\n")}
        </pre>
      )}
    </div>
  );
}
