import * as stylex from "@stylexjs/stylex";
import { LockIcon, PlusIcon, Settings2Icon, WorkflowIcon } from "lucide-react";

import { openProjectSettings } from "@/components/skills/project-settings-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { FlowRun, Scope, ScopedFlow } from "@/lib/flows";
import { isOverridden, overrides, scopeLocation } from "@/lib/flows";
import { ago } from "@/lib/format";
import type { Project } from "@/lib/project-groups";
import { STARTERS, type Starter, summary, kindMeta } from "@/views/automations/flows/model";
import { ProjectLabel } from "@/views/automations/flows/project-label";
import { RunStatus } from "@/views/automations/flows/run-status";
import type { BoxFlows } from "@/views/automations/flows/use-flows";
import { Tip } from "@/components/tip";
import { BoxError } from "@/components/upgrade-box";

const paint = stylex.create({
  s0: {
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "32px",
    },
  },
  s1: {
    "marginBottom": "10px",
    "fontWeight": 500,
    "fontSize": "13px",
    "color": "var(--muted-foreground)",
  },
  s2: {
    "display": "grid",
    "gridTemplateColumns": "repeat(auto-fill,minmax(230px,1fr))",
    "gap": "8px",
  },
  s3: {
    "display": "flex",
    "minHeight": "112px",
    "flexDirection": "column",
    "gap": "8px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 40%, transparent)",
    },
    "backgroundColor": "var(--card)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "textAlign": "left",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "opacity": {
      ":disabled": 0.5,
    },
  },
  s4: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s5: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "color": "var(--muted-foreground)",
  },
  s6: {
    "width": "14px",
    "height": "14px",
  },
  s7: {
    "display": "block",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "1.375",
  },
  s8: {
    "marginTop": "2px",
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
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
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "height": "96px",
  },
  s11: {
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s12: {
    "marginBottom": "10px",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s13: {
    "minWidth": "0px",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s14: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s15: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s16: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 40%, transparent)",
    },
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "textAlign": "left",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s17: {
    "width": "16px",
    "height": "16px",
  },
  s18: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s19: {
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "16px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "var(--row-pad)",
    "paddingBottom": "var(--row-pad)",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
  },
  s20: {
    "opacity": 0.6,
  },
  s21: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
  },
  s22: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 2,
    "borderStyle": "solid",
    "borderColor": "var(--card)",
    "backgroundColor": "var(--muted)",
    "color": "var(--muted-foreground)",
  },
  s23: {
    "width": "14px",
    "height": "14px",
  },
  s24: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s25: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s26: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s27: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s28: {
    "width": "10px",
    "height": "10px",
  },
  s29: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--ring) 30%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s30: {
    "marginTop": "2px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s31: {
    "display": "flex",
    "width": "144px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s32: {
    "opacity": 0.6,
  },
  s33: {
    "display": "flex",
    "flexShrink": 0,
  },

  s34: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s35: {
    ":not(#\\#) > :not(:first-child)": {
      marginLeft: -4,
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

interface Group {
  box: string;
  scope: Scope;
  flows: ScopedFlow[];
}

// groupsOf orders a box's flows by where they live: the box's own first,
// then each repository's.
function groupsOf(bf: BoxFlows): Group[] {
  const byScope = new Map<Scope, ScopedFlow[]>([["box", []]]);
  for (const f of bf.flows ?? []) byScope.set(f.scope, [...(byScope.get(f.scope) ?? []), f]);
  return [...byScope.entries()].sort(([a], [b]) => (a === "box" ? -1 : b === "box" ? 1 : a.localeCompare(b))).map(([scope, flows]) => ({ box: bf.box, scope, flows }));
}

export function FlowList({
  boxes,
  byBox,
  projects,
  lastRun,
  onEdit,
  onToggle,
  onNew,
  onStarter,
}: {
  boxes: string[];
  byBox: Record<string, BoxFlows>;
  projects: Project[];
  lastRun(box: string, scope: string, id: string): FlowRun | undefined;
  onEdit(box: string, f: ScopedFlow): void;
  onToggle(box: string, f: ScopedFlow, on: boolean): void;
  onNew(box: string, scope: Scope): void;
  onStarter(s: Starter): void;
}) {
  const loaded = boxes.filter((b) => byBox[b]?.flows);
  const total = loaded.reduce((n, b) => n + (byBox[b].flows?.length ?? 0), 0);
  const firstBox = boxes[0];
  // A flow for a project on every box lives in the project's committed
  // config (.berth/config.json), which every box layers in.
  const many = projects.filter((p) => new Set(p.members.map((m) => m.box.name)).size > 1);

  return (
    <div className={sx(paint.s0)}>
      <section>
        <h2 className={sx(paint.s1)}>{total ? "Start from a template" : "Start with one of these"}</h2>
        <div className={sx(paint.s2)}>
          {STARTERS.map((s) => {
            const kinds = [...new Set(s.flow.steps.map((x) => x.kind))];
            return (
              <button
                key={s.id}
                type="button"
                disabled={!firstBox}
                onClick={() => onStarter(s)}
                className={[sx(paint.s3), "group"].filter(Boolean).join(" ")}
              >
                <span className={sx(paint.s4)}>
                  {kinds.map((k) => {
                    const m = kindMeta(k);
                    return (
                      <span key={k} className={sx(paint.s5)}>
                        <m.Icon className={sx(paint.s6)} />
                      </span>
                    );
                  })}
                </span>
                <span>
                  <span className={sx(paint.s7)}>{s.title}</span>
                  <span className={sx(paint.s8)}>{s.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {many.length > 0 && (
        <p className={sx(paint.s9)}>
          To run a flow for {many[0].name}
          {many.length > 1 ? " and other projects" : ""} on every box that has it, commit it to the repository's <code>.berth/config.json</code>: each box runs it from there. A flow saved here belongs to one box.
        </p>
      )}

      {boxes.map((box) => {
        const bf = byBox[box];
        if (!bf) return <div className={sx(paint.s10)}><Skeleton key={box}  shape="lg" /></div>;
        if (bf.error)
          return (
            <section key={box} className={sx(paint.s11)}>
              <BoxError box={box} error={bf.error} what="its flows" />
            </section>
          );
        return groupsOf(bf).map((g) => <ScopeGroup key={`${box}|${g.scope}`} group={g} lastRun={lastRun} onEdit={onEdit} onToggle={onToggle} onNew={onNew} />);
      })}
    </div>
  );
}

function ScopeGroup({
  group,
  lastRun,
  onEdit,
  onToggle,
  onNew,
}: {
  group: Group;
  lastRun(box: string, scope: string, id: string): FlowRun | undefined;
  onEdit(box: string, f: ScopedFlow): void;
  onToggle(box: string, f: ScopedFlow, on: boolean): void;
  onNew(box: string, scope: Scope): void;
}) {
  const { box, scope, flows } = group;
  const loc = scopeLocation(scope);
  // A committed flow overridden on this box shows once, as the
  // override: the box runs only that one.
  const shown = flows.filter((f) => !isOverridden(f, flows));

  return (
    <section>
      <header className={sx(paint.s12)}>
        <h2 className={sx(paint.s13)}>
          <ProjectLabel box={box} scope={scope} />
        </h2>
        <span className={sx(paint.s14)}>{shown.length}</span>
        <span className={sx(paint.s15)}>
          {loc && (
            <Button size="xs" variant="ghost" onClick={() => openProjectSettings(box, loc)}>
              <Settings2Icon />
              Project settings
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={() => onNew(box, scope)}>
            <PlusIcon />
            New flow
          </Button>
        </span>
      </header>
      {shown.length === 0 ? (
        <button
          type="button"
          onClick={() => onNew(box, scope)}
          className={sx(paint.s16)}
        >
          <WorkflowIcon className={sx(paint.s17)} />
          No flows {loc ? `for ${loc}` : `for every project on ${box}`} yet. Make one, or start from a template above.
        </button>
      ) : (
        <div className={[sx(paint.s18), sx(paint.s34)].filter(Boolean).join(" ")}>
          {shown.map((f) => (
            <FlowRow key={`${f.source}:${f.flow.id}`} f={f} run={lastRun(box, scope, f.flow.id)} onEdit={() => onEdit(box, f)} onToggle={(on) => onToggle(box, f, on)} overridden={overrides(f, flows)} />
          ))}
        </div>
      )}
    </section>
  );
}

// SharedSection is a project's flows on every box that has it, each one
// flow standing for its copies; switching it switches every copy.
function FlowRow({ f, run, onEdit, onToggle, overridden }: { f: ScopedFlow; run?: FlowRun; onEdit(): void; onToggle(on: boolean): void; overridden: boolean }) {
  const { flow } = f;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => e.key === "Enter" && onEdit()}
      className={[[sx(paint.s19), "group"].filter(Boolean).join(" "), !flow.enabled && sx(paint.s20)].filter(Boolean).join(" ")}
    >
      <span className={[sx(paint.s21), sx(paint.s35)].filter(Boolean).join(" ")}>
        {[...new Set(flow.steps.map((s) => s.kind))].slice(0, 3).map((k) => {
          const m = kindMeta(k);
          return (
            <span key={k} className={sx(paint.s22)}>
              <m.Icon className={sx(paint.s23)} />
            </span>
          );
        })}
      </span>
      <div className={sx(paint.s24)}>
        <div className={sx(paint.s25)}>
          <span className={sx(paint.s26)}>{flow.name}</span>
          {f.source === "repo" && (
            <Tip label="Committed in the repository's .berth/config.json">
              <span className={sx(paint.s27)}>
                <LockIcon className={sx(paint.s28)} />
                In repo
              </span>
            </Tip>
          )}
          {overridden && <span className={sx(paint.s29)}>Overridden here</span>}
        </div>
        <p className={sx(paint.s30)}>{summary(flow)}</p>
      </div>
      <div className={sx(paint.s31)}>
        {run ? (
          <>
            <RunStatus status={run.status} />
            <Tip label={new Date(run.started).toLocaleString()}>
              <span>{ago(run.started)}</span>
            </Tip>
          </>
        ) : (
          <span className={sx(paint.s32)}>Never run</span>
        )}
      </div>
      {/* The switch acts on the flow, not the row that opens it. */}
      <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className={sx(paint.s33)}>
        <Switch checked={flow.enabled} onCheckedChange={onToggle} aria-label={flow.enabled ? `Turn off ${flow.name}` : `Turn on ${flow.name}`} />
      </span>
    </div>
  );
}
