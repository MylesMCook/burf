import * as stylex from "@stylexjs/stylex";
import { ArrowLeftIcon, ChevronsUpDownIcon, ClockIcon, GitPullRequestIcon, FlaskConicalIcon, LayersIcon, LockIcon, PlusIcon, ServerIcon, Trash2Icon, ZapIcon } from "lucide-react";

import { confirm } from "@/components/sidebar/confirm";
import { Fragment, useMemo, useState } from "react";

import { PickOne } from "@/components/pick-one";
import { SimpleSelect } from "@/components/simple-select";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuSeparator, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";
import { sortedWorktrees } from "@/lib/derive";
import { DEFAULT_MAX_RUNS_PER_HOUR, type Flow, type FlowRun, type FlowSource, flowsApi, type GitHubOn, type Scope, type Step, type StepKind, scopeLocation, slug, type TriggerKind, triggerKind, triggerType } from "@/lib/flows";
import { plainError } from "@/lib/errors";
import { NONE, useStore } from "@/lib/store";
import { isEditableKind, blankStep, describeCron, GITHUB_ONS, KIND_ORDER, SCHEDULE_PRESETS, STEP_KINDS, summary, TRIGGERS, variablesAt } from "@/views/automations/flows/model";
import { ProjectLabel, savedWhere } from "@/views/automations/flows/project-label";
import { StepCard } from "@/views/automations/flows/step-card";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
  },
  s1: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s2: {
    "height": "16px",
    "width": "1px",
    "backgroundColor": "var(--border)",
  },
  s3: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
  },
  s5: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "24px",
    "paddingBottom": "96px",
  },
  s6: {
    "marginBottom": "20px",
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s7: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s8: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s9: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "marginBottom": "20px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s11: {
    "marginBottom": "20px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s12: {
    "marginBottom": "16px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s13: {
    "position": "relative",
  },
  s14: {
    "marginLeft": "40px",
    "position": {
      "::before": "absolute",
    },
    "top": {
      "::before": "0px",
    },
    "bottom": {
      "::before": "0px",
    },
    "width": {
      "::before": "2px",
    },
    "borderRadius": {
      "::before": "999px",
    },
    "backgroundColor": {
      "::before": "color-mix(in oklab, var(--warning) 40%, transparent)",
    },
  },
  s15: {
    "marginTop": "12px",
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
  },
  s16: {
    "height": "20px",
    "width": "1px",
    "backgroundColor": "var(--border)",
  },
  s17: {
    "marginTop": "40px",
    "display": "flex",
    "alignItems": "center",
    "gap": "16px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--card) 40%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s18: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s19: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s20: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s22: {
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--ring) 25%, transparent)",
    "backgroundColor": "var(--card)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s23: {
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
  s24: {
    "display": "inline-flex",
    "width": "28px",
    "height": "28px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "color-mix(in oklab, var(--primary) 12%, transparent)",
    "color": "var(--primary)",
  },
  s25: {
    "width": "16px",
    "height": "16px",
  },
  s26: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s27: {
    "display": "grid",
    "gridTemplateColumns": "repeat(2, minmax(0, 1fr))",
    "gap": "12px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s28: {
    "gridColumn": "span 2 / span 2",
  },
  s29: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s30: {
    "marginTop": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s31: {
    "marginTop": "4px",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "textDecoration": {
      ":hover": "underline",
    },
  },
  s33: {
    "gridColumn": "span 2 / span 2",
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
  },
  s34: {
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s35: {
    "width": "14px",
    "height": "14px",
  },
  s36: {
    "width": "14px",
    "height": "14px",
  },
  s37: {
    "width": "14px",
    "height": "14px",
  },
  s38: {
    "display": "grid",
    "gridTemplateColumns": "minmax(0,1fr) auto",
    "gap": "8px",
  },
  s39: {
    "gridColumn": "span 2 / span 2",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s40: {
    "fontFamily": "var(--font-mono)",
  },
  s41: {
    "gridColumn": "span 2 / span 2",
    "display": "block",
  },
  s42: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s43: {
    "marginTop": "4px",
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s44: {
    "display": "none",
  },
  s45: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s46: {
    "display": "block",
  },
  s47: {
    "gridColumn": "span 2 / span 2",
  },
  s48: {
    "marginBottom": "4px",
    "display": "block",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s49: {
    "display": "grid",
    "gridTemplateColumns": "minmax(0,1fr) minmax(0,1fr)",
    "gap": "8px",
  },
  s50: {
    "gridColumn": "span 2 / span 2",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s51: {
    "width": "14px",
    "height": "14px",
  },
  s52: {
    "gridColumn": "span 2 / span 2",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s53: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s54: {
    "display": "flex",
    "height": {
      "default": "36px",
      "@media (min-width: 640px)": {
        "default": "32px",
      },
    },
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--input)",
    "backgroundColor": {
      "default": "light-dark(var(--background), color-mix(in oklab, var(--input) 32%, transparent))",
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "textAlign": "left",
    "fontSize": "14px",
    "lineHeight": "20px",
    "boxShadow": {
      "default": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
    "outline": "none",
    "cursor": {
      ":disabled": "default",
    },
    "opacity": {
      ":disabled": 0.8,
    },
  },
  s55: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s56: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "opacity": 0.6,
  },
  s57: {
    "width": "12px",
    "height": "12px",
  },
  s58: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s59: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s60: {
    "position": "relative",
    "display": "flex",
    "height": "40px",
    "alignItems": "center",
    "justifyContent": "center",
  },
  s61: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "width": "1px",
  },
  s62: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 50%, transparent)",
  },
  s63: {
    "position": "relative",
    "zIndex": 10,
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "11px",
  },
  s64: {
    "borderColor": "color-mix(in oklab, var(--warning) 40%, transparent)",
    "color": "var(--warning-foreground)",
  },
  s65: {
    "color": "var(--muted-foreground)",
  },
  s66: {
    "position": "absolute",
    "zIndex": 10,
    "display": "inline-flex",
    "width": "20px",
    "height": "20px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    ":is(.group:hover &)": {
      "opacity": 1,
    },
  },
  s67: {
    "left": "calc(50%+64px)",
  },
  s68: {
    "width": "12px",
    "height": "12px",
  },
  s69: {
    "display": "flex",
    "flexDirection": "column",
  },
  s70: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s71: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s72: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s73: {
    "marginBottom": "20px",
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s74: {
    "borderColor": "color-mix(in oklab, var(--success) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--success) 6%, transparent)",
  },
  s75: {
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 6%, transparent)",
  },
  s76: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s77: {
    "color": "var(--success)",
  },
  s78: {
    "color": "var(--destructive-foreground)",
  },
  s79: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  n0: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "width": "1px",
  },
  n1: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 50%, transparent)",
  },
  n2: {
    "borderLeftWidth": 1,
    "borderLeftStyle": "solid",
    "borderLeftColor": "var(--border)",
    "borderStyle": "dashed",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
    "backgroundColor": "transparent",
  },
  n3: {
    "backgroundColor": "var(--border)",
  },

  s80: {
    maxWidth: "42rem",
  },
  s81: {
    "::before": {
      left: -24,
      content: "\"\"",
    },
  },
  s82: {
    textUnderlineOffset: 2,
  },
  s83: {
    left: "50%",
    translate: "-50%",
  },
  s84: {
    top: "50%",
    left: "50%",
    translate: "0px -50%",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface EditTarget {
  box: string;
  scope: Scope;
  flow: Flow;
  // The id it was saved under; absent for a new flow.
  savedId?: string;
  readOnly?: boolean;
  // Where it comes from; a read-only flow is committed ("repo").
  source?: FlowSource;
}

// FlowEditor is a flow as a vertical canvas: the trigger, then each step
// joined by a line, with failure steps branched off on an amber rail.
export function FlowEditor({
  target,
  scopes,
  onSave,
  onDelete,
  onOverride,
  onClose,
}: {
  target: EditTarget;
  // Where a new flow can go: [box, scope] pairs.
  scopes: { box: string; scope: Scope }[];
  onSave(box: string, scope: Scope, flow: Flow, previousId?: string): Promise<void>;
  onDelete?(): Promise<void>;
  onOverride?(): void;
  onClose(): void;
}) {
  const [flow, setFlow] = useState<Flow>(target.flow);
  const [where, setWhere] = useState({ box: target.box, scope: target.scope });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [run, setRun] = useState<FlowRun>();
  // A flow with run steps the editor can't change (loop, gate, map, …) is
  // edited in its JSON; here it is shown.
  const runSteps = target.flow.steps.some((s) => !isEditableKind(s.kind));
  const readOnly = target.readOnly || runSteps;
  const isNew = !target.savedId;
  const agents = useStore((s) => s.boxes[where.box]?.info?.agents) ?? NONE;
  const dirty = JSON.stringify(flow) !== JSON.stringify(target.flow) || where.scope !== target.scope || where.box !== target.box;

  const setStep = (i: number, s: Step) => setFlow((f) => ({ ...f, steps: f.steps.map((x, j) => (j === i ? s : x)) }));
  const insertStep = (at: number, kind: StepKind) => setFlow((f) => ({ ...f, steps: [...f.steps.slice(0, at), blankStep(kind), ...f.steps.slice(at)] }));
  const moveStep = (i: number, d: -1 | 1) =>
    setFlow((f) => {
      const steps = [...f.steps];
      [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
      return { ...f, steps };
    });

  // Deleting asks first.
  const askDelete = () => {
    if (!onDelete) return;
    const name = flow.name.trim() || target.savedId || "this flow";
    confirm({
      title: `Delete ${name}?`,
      description: `It stops running on ${target.box} straight away.`,
      confirm: "Delete flow",
      destructive: true,
      run: async () => {
        await onDelete();
        onClose();
      },
    });
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const id = flow.id || slug(flow.name);
      // A flow kept in a project already runs only there.
      const trigger = scopeLocation(where.scope) && flow.trigger.where?.location ? { ...flow.trigger, where: { ...flow.trigger.where, location: undefined } } : flow.trigger;
      await onSave(where.box, where.scope, { ...flow, trigger, id, name: flow.name.trim() || id }, target.savedId);
      onClose();
    } catch (err) {
      setError(plainError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={sx(paint.s0)}>
      <header className={sx(paint.s1)}>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <ArrowLeftIcon />
          Automations
        </Button>
        <span className={sx(paint.s2)} />
        <Input
          value={flow.name}
          // A new flow starts by being named.
          autoFocus={isNew && !readOnly}
          readOnly={readOnly}
          onChange={(e) => setFlow({ ...flow, name: e.target.value })}
          placeholder="Name this flow"
          unstyled
          plain="title"
          aria-label="Flow name"
        />
        <label className={sx(paint.s3)}>
          <Switch checked={flow.enabled} disabled={readOnly} onCheckedChange={(enabled) => setFlow({ ...flow, enabled })} />
          {flow.enabled ? "On" : "Off"}
        </label>
        {!isNew && <TestRun box={where.box} scope={where.scope} flow={flow} dirty={dirty} onRun={setRun} />}
        {!readOnly && onDelete && (
          <Tip label="Delete flow…">
            <Button size="icon-sm" variant="ghost" aria-label="Delete flow…" onClick={askDelete}>
              <Trash2Icon />
            </Button>
          </Tip>
        )}
        {!readOnly && (
          <Tip label={!flow.name.trim() ? "Name it first" : !dirty ? "Nothing changed" : undefined}>
            <Button size="sm" onClick={save} loading={saving} disabled={!flow.name.trim() || !dirty}>
              {isNew ? "Create flow" : "Save"}
            </Button>
          </Tip>
        )}
      </header>

      <div className={sx(paint.s4)}>
        <div className={[sx(paint.s5), sx(paint.s80)].filter(Boolean).join(" ")}>
          {readOnly && (
            <div className={sx(paint.s6)}>
              <LockIcon className={sx(paint.s7)} />
              <span className={sx(paint.s8)}>
                Committed in the repository's <code className={sx(paint.s9)}>.berth/config.json</code>. Change it there, or override it on this box.
              </span>
              {onOverride && (
                <Button size="sm" variant="outline" onClick={onOverride}>
                  Override on {target.box}
                </Button>
              )}
            </div>
          )}
          {runSteps && !target.readOnly && <p className={sx(paint.s10)}>This flow uses run steps (loop, gate, map…) that the editor shows but does not change. Edit it in its JSON: the box's config or the repository's .berth/config.json.</p>}
          {error && <ErrorText className={sx(paint.s11)} text={error} />}
          {run && <RunBanner run={run} onClear={() => setRun(undefined)} />}

          <p className={sx(paint.s12)}>{summary(flow)}</p>

          <TriggerCard flow={flow} setFlow={setFlow} readOnly={readOnly} where={where} setWhere={setWhere} scopes={scopes} />

          {flow.steps.map((s, i) => (
            <Fragment key={i}>
              <Connector branch={s.when ?? "success"} onAdd={readOnly ? undefined : (k) => insertStep(i, k)} />
              <div className={[sx(paint.s13), s.when === "failure" && [sx(paint.s14), sx(paint.s81)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
                <StepCard
                  step={s}
                  index={i}
                  count={flow.steps.length}
                  variables={variablesAt(flow, i)}
                  agents={agents}
                  readOnly={readOnly}
                  result={run?.steps[i]}
                  onChange={(n) => setStep(i, n)}
                  onMove={(d) => moveStep(i, d)}
                  onRemove={() => setFlow((f) => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))}
                />
              </div>
            </Fragment>
          ))}

          {!readOnly && (
            <div className={sx(paint.s15)}>
              <span className={sx(paint.s16)} />
              <AddStep onPick={(k) => insertStep(flow.steps.length, k)}>
                <Button size="sm" variant="outline">
                  <PlusIcon />
                  Add a step
                </Button>
              </AddStep>
            </div>
          )}

          <section className={sx(paint.s17)}>
            <div className={sx(paint.s18)}>
              <div className={sx(paint.s19)}>At most</div>
              <div className={sx(paint.s20)}>Stops a flow that triggers itself, or a busy repo, from running away. Empty means {DEFAULT_MAX_RUNS_PER_HOUR}, the default.</div>
            </div>
            <Input
              type="number"
              min={0}
              value={flow.max_runs_per_hour ?? ""}
              readOnly={readOnly}
              onChange={(e) => setFlow({ ...flow, max_runs_per_hour: Number(e.target.value) || undefined })}
              placeholder={`${DEFAULT_MAX_RUNS_PER_HOUR} (default)`}
              size="sm"
              measure="time" align="end" nums
            />
            <span className={sx(paint.s21)}>runs an hour</span>
          </section>
        </div>
      </div>
    </div>
  );
}

function TriggerCard({
  flow,
  setFlow,
  readOnly,
  where,
  setWhere,
  scopes,
}: {
  flow: Flow;
  setFlow(f: Flow): void;
  readOnly?: boolean;
  where: { box: string; scope: Scope };
  setWhere(w: { box: string; scope: Scope }): void;
  scopes: { box: string; scope: Scope }[];
}) {
  const agents = useStore((s) => s.boxes[where.box]?.info?.agents) ?? NONE;
  const w = flow.trigger.where ?? {};
  const setW = (patch: Partial<typeof w>) => {
    const next = { ...w, ...patch };
    for (const k of Object.keys(next) as (keyof typeof next)[]) if (!next[k] || (Array.isArray(next[k]) && !next[k].length)) delete next[k];
    setFlow({ ...flow, trigger: { ...flow.trigger, where: Object.keys(next).length ? next : undefined } });
  };
  const kind = triggerKind(flow.trigger);
  // Switching what starts it keeps where it applies, and drops the rest.
  const setKind = (k: TriggerKind) => {
    const base = { where: flow.trigger.where };
    // An agent filter is for events, an author filter for GitHub.
    const where = base.where && { ...base.where, agent: k === "event" ? base.where.agent : undefined, author: k === "github" ? base.where.author : undefined };
    if (k === "event") setFlow({ ...flow, trigger: { where, event: "agent.finished" } });
    if (k === "schedule") setFlow({ ...flow, trigger: { where, schedule: "0 2 * * *" } });
    if (k === "github") setFlow({ ...flow, trigger: { where, github: { on: "review_comment", poll: "2m" } } });
  };

  return (
    <article className={sx(paint.s22)}>
      <header className={sx(paint.s23)}>
        <span className={sx(paint.s24)}>
          <ZapIcon className={sx(paint.s25)} />
        </span>
        <h3 className={sx(paint.s26)}>{kind === "schedule" ? "When it runs" : kind === "github" ? "When this happens on GitHub" : "When this happens"}</h3>
      </header>
      <div className={sx(paint.s27)}>
        <div className={sx(paint.s28)}>
          <span className={sx(paint.s29)}>Runs for</span>
          <RunsFor value={where} options={scopes} disabled={readOnly} onChange={setWhere} />
          <p className={sx(paint.s30)}>{savedWhere(where.box, where.scope, readOnly ? "repo" : undefined)}</p>
          {where.scope === "box" && w.location && (
            <p className={sx(paint.s31)}>
              Only events from {w.location}.
              {!readOnly && (
                <button type="button" className={[sx(paint.s32), sx(paint.s82)].filter(Boolean).join(" ")} onClick={() => setW({ location: undefined })}>
                  Any project
                </button>
              )}
            </p>
          )}
        </div>
        <div className={sx(paint.s33)}>
          <span className={sx(paint.s34)}>Starts</span>
          {!readOnly && (
            <PickOne<TriggerKind>
              label="What starts it"
              value={kind}
              onChange={setKind}
              options={[
                { value: "event", label: "On an event", icon: <ZapIcon className={sx(paint.s35)} /> },
                { value: "schedule", label: "On a schedule", icon: <ClockIcon className={sx(paint.s36)} /> },
                { value: "github", label: "On GitHub", icon: <GitPullRequestIcon className={sx(paint.s37)} /> },
              ]}
            />
          )}
          {kind === "event" && (
            <SimpleSelect
              value={flow.trigger.event ?? ""}
              disabled={readOnly}
              onChange={(event) => setFlow({ ...flow, trigger: { ...flow.trigger, event } })}
              options={TRIGGERS.map((t) => ({ value: t.on, label: `${t.label} · ${t.on}` }))}
            />
          )}
          {kind === "schedule" && <ScheduleFields flow={flow} setFlow={setFlow} readOnly={readOnly} />}
          {kind === "github" && (
            <div className={sx(paint.s38)}>
              <SimpleSelect
                value={flow.trigger.github?.on ?? "review_comment"}
                disabled={readOnly}
                onChange={(on) => setFlow({ ...flow, trigger: { ...flow.trigger, github: { ...flow.trigger.github, on: on as GitHubOn } } })}
                options={GITHUB_ONS.map((g) => ({ value: g.on, label: g.label }))}
              />
              <SimpleSelect
                value={flow.trigger.github?.poll ?? "2m"}
                disabled={readOnly}
                onChange={(poll) => setFlow({ ...flow, trigger: { ...flow.trigger, github: { on: flow.trigger.github?.on ?? "review_comment", poll } } })}
                options={["1m", "2m", "5m", "15m"].map((p) => ({ value: p, label: `Check every ${p.replace("m", " min")}` }))}
              />
              <p className={sx(paint.s39)}>
                The box checks each worktree's pull request with <code className={sx(paint.s40)}>gh</code>. Only what's new after the flow is turned on starts it.
              </p>
              {(flow.trigger.github?.on ?? "review_comment") !== "check_failed" && (flow.trigger.github?.on ?? "review_comment") !== "pr_merged" && (
                <label className={sx(paint.s41)}>
                  <span className={sx(paint.s42)}>From</span>
                  <Input
                    value={(w.author ?? []).join(", ")}
                    readOnly={readOnly}
                    onChange={(e) => setW({ author: e.target.value.split(/[\s,]+/).filter(Boolean) })}
                    placeholder="collaborators · or logins, or * for anyone"
                    mono text="xs"
                  />
                  <span className={sx(paint.s43)}>Comments reach the agent's prompt, marked as someone else's words. Anyone can comment on a public repository, so only collaborators count unless you list people.</span>
                </label>
              )}
            </div>
          )}
        </div>
        <div className={kind !== "event" ? sx(paint.s44) : undefined}>
          <span className={sx(paint.s45)}>From agent</span>
          <SimpleSelect
            value={w.agent ?? ""}
            disabled={readOnly}
            onChange={(agent) => setW({ agent })}
            options={[{ value: "", label: "Any agent" }, ...(agents.length ? agents : [{ id: "claude", name: "Claude Code" }, { id: "codex", name: "Codex" }]).map((a) => ({ value: a.id, label: a.name }))]}
          />
        </div>
        <label className={[sx(paint.s46), kind !== "event" && sx(paint.s47)].filter(Boolean).join(" ")}>
          <span className={sx(paint.s48)}>On branch</span>
          <Input value={w.branch ?? ""} readOnly={readOnly} onChange={(e) => setW({ branch: e.target.value })} placeholder="Any · fix/* for a prefix" mono text="xs" />
        </label>
      </div>
    </article>
  );
}

// ScheduleFields picks when a scheduled flow runs: a preset or a cron
// expression, said back in plain words, and whether it runs per worktree.
function ScheduleFields({ flow, setFlow, readOnly }: { flow: Flow; setFlow(f: Flow): void; readOnly?: boolean }) {
  const expr = flow.trigger.schedule ?? "";
  const set = (patch: Partial<Flow["trigger"]>) => setFlow({ ...flow, trigger: { ...flow.trigger, ...patch } });
  const preset = SCHEDULE_PRESETS.some((p) => p.value === expr) ? expr : "custom";
  return (
    <div className={sx(paint.s49)}>
      <SimpleSelect
        value={preset}
        disabled={readOnly}
        onChange={(v) => v !== "custom" && set({ schedule: v })}
        options={[...SCHEDULE_PRESETS, { value: "custom", label: "Custom…" }]}
      />
      <Input value={expr} readOnly={readOnly} onChange={(e) => set({ schedule: e.target.value })} placeholder="0 2 * * *" mono text="xs" aria-label="Cron expression" />
      <p className={sx(paint.s50)}>
        <ClockIcon className={sx(paint.s51)} />
        {describeCron(expr)} · the box's local time
      </p>
      <label className={sx(paint.s52)}>
        <Switch checked={!!flow.trigger.each_worktree} disabled={readOnly} onCheckedChange={(v) => set({ each_worktree: v || undefined })} />
        <span>Run once for each worktree</span>
        <span className={sx(paint.s53)}>{flow.trigger.each_worktree ? "every worktree matching the branch below" : "otherwise once, in the repo's main checkout"}</span>
      </label>
    </div>
  );
}

// RunsFor picks the project a flow runs for, grouped by box: every project
// on a box, or one of its repos.
function RunsFor({ value, options, disabled, onChange }: { value: { box: string; scope: Scope }; options: { box: string; scope: Scope }[]; disabled?: boolean; onChange(v: { box: string; scope: Scope }): void }) {
  const boxes = [...new Set(options.map((o) => o.box))];
  return (
    <Menu>
      <MenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={sx(paint.s54)}
          />
        }
      >
        <ProjectLabel box={value.box} scope={value.scope} className={sx(paint.s55)} />
        {!disabled && <ChevronsUpDownIcon className={sx(paint.s56)} />}
      </MenuTrigger>
      <MenuPopup align="start" width={menuWidths.anchor}>
        {boxes.map((box, i) => (
          <MenuGroup key={box}>
            {i > 0 && <MenuSeparator />}
            <MenuGroupLabel>
              <ServerIcon className={sx(paint.s57)} />
              {box}
            </MenuGroupLabel>
            {options
              .filter((o) => o.box === box)
              .map((o) => (
                <MenuItem key={o.scope} onClick={() => onChange(o)} current={o.box === value.box && o.scope === value.scope}>
                  {o.scope === "box" ? (
                    <span className={sx(paint.s58)}>
                      <LayersIcon className={sx(paint.s59)} />
                      Any project on {box}
                    </span>
                  ) : (
                    <ProjectLabel box={box} scope={o.scope} chip={false} />
                  )}
                </MenuItem>
              ))}
          </MenuGroup>
        ))}
      </MenuPopup>
    </Menu>
  );
}

// Connector joins two cards, with a "+" to insert a step there, and says
// when the step below it runs.
function Connector({ branch, onAdd }: { branch: string; onAdd?(k: StepKind): void }) {
  const amber = branch === "failure";
  return (
    <div className={[sx(paint.s60), "group"].filter(Boolean).join(" ")}>
      <span className={[[sx(paint.n0), sx(paint.s83)].filter(Boolean).join(" "), amber ? sx(paint.n1) : branch === "always" ? sx(paint.n2) : sx(paint.n3)].filter(Boolean).join(" ")} />
      {branch !== "success" && (
        <span className={[sx(paint.s63), amber ? sx(paint.s64) : sx(paint.s65)].filter(Boolean).join(" ")}>{amber ? "if it fails" : "always"}</span>
      )}
      {onAdd && (
        <AddStep onPick={onAdd}>
          <button
            type="button"
            aria-label="Add a step here"
            className={[[sx(paint.s66), sx(paint.s84)].filter(Boolean).join(" "), branch !== "success" && sx(paint.s67)].filter(Boolean).join(" ")}
          >
            <PlusIcon className={sx(paint.s68)} />
          </button>
        </AddStep>
      )}
    </div>
  );
}

function AddStep({ onPick, children }: { onPick(k: StepKind): void; children: React.ReactElement }) {
  return (
    <Menu>
      <MenuTrigger render={children} />
      <MenuPopup align="center" width={menuWidths.w64}>
        <MenuGroup>
          <MenuGroupLabel>Add a step</MenuGroupLabel>
          {KIND_ORDER.map((k) => {
            const m = STEP_KINDS[k];
            return (
              <MenuItem key={k} onClick={() => onPick(k)}>
                <m.Icon className={m.tone} />
                <span className={sx(paint.s69)}>
                  <span>{m.label}</span>
                  <span className={sx(paint.s70)}>{m.hint}</span>
                </span>
              </MenuItem>
            );
          })}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

// TestRun runs the saved flow now, for a worktree you pick, and shows how
// each step went on the canvas.
function TestRun({ box, scope, flow, dirty, onRun }: { box: string; scope: Scope; flow: Flow; dirty: boolean; onRun(r: FlowRun): void }) {
  const client = useStore((s) => s.client);
  const locations = useStore((s) => s.boxes[box]?.locations) ?? NONE;
  const sessions = useStore((s) => s.boxes[box]?.sessions) ?? NONE;
  const [busy, setBusy] = useState(false);
  const loc = scopeLocation(scope);
  const choices = useMemo(
    () => locations.filter((l) => !loc || l.name === loc).flatMap((l) => sortedWorktrees(l).map((wt) => ({ l, wt }))),
    [locations, loc],
  );

  const go = async (l: (typeof choices)[number]["l"], wt: (typeof choices)[number]["wt"]) => {
    if (!client) return;
    setBusy(true);
    try {
      const session = sessions.find((s) => s.dir === wt.path && s.agent);
      const data: Record<string, unknown> = { path: wt.path, location: l.name, name: wt.name, branch: wt.branch ?? "" };
      if (session) Object.assign(data, { session: session.name, agent: session.agent });
      onRun(await flowsApi.test(client, box, flow.id, scope, data));
    } catch (err) {
      onRun({ id: "", flow: flow.id, scope, started: new Date().toISOString(), status: "failed", event: { type: triggerType(flow.trigger), time: "" }, steps: [], error: plainError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="outline" loading={busy} />}>
        <FlaskConicalIcon />
        Test run
      </MenuTrigger>
      <MenuPopup align="end" width={menuWidths.w64}>
        <MenuGroup>
          <MenuGroupLabel>{dirty ? "Runs the saved version, for real, in" : "Runs it now, for real, in"}</MenuGroupLabel>
          {choices.length === 0 && <MenuItem disabled>No worktrees on {box}</MenuItem>}
          {choices.map(({ l, wt }) => (
            <MenuItem key={wt.path} onClick={() => void go(l, wt)}>
              <span className={sx(paint.s71)}>{wt.main ? l.name : wt.name}</span>
              <span className={sx(paint.s72)}>{loc ? wt.branch : l.name}</span>
            </MenuItem>
          ))}
        </MenuGroup>
        {dirty && (
          <>
            <MenuSeparator />
            <MenuItem disabled>Save first to test your changes</MenuItem>
          </>
        )}
      </MenuPopup>
    </Menu>
  );
}

function RunBanner({ run, onClear }: { run: FlowRun; onClear(): void }) {
  const ok = run.status === "succeeded";
  const ran = run.steps.filter((s) => s.status !== "skipped").length;
  // A step failed and a later on-failure step dealt with it, as designed.
  const caught = ok ? run.steps.findIndex((s) => s.status === "failed") : -1;
  const summary = run.error
    ? `Test run failed: ${run.error}`
    : run.status === "running"
      ? `Test run still running: ${ran} of ${run.steps.length} steps ran so far.`
      : caught >= 0
        ? `Test run succeeded: step ${caught + 1} failed and the steps after it handled that, as designed. Results are on each step below.`
        : `Test run ${run.status}: ${ran} of ${run.steps.length} steps ran. Results are on each step below.`;
  return (
    <div className={[sx(paint.s73), ok ? sx(paint.s74) : sx(paint.s75)].filter(Boolean).join(" ")}>
      <FlaskConicalIcon className={[sx(paint.s76), ok ? sx(paint.s77) : sx(paint.s78)].filter(Boolean).join(" ")} />
      <span className={sx(paint.s79)}>
        {summary}
      </span>
      <Button size="xs" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
