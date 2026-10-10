import * as stylex from "@stylexjs/stylex";
import { ChevronRightIcon, PlusIcon, WorkflowIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useEventLog } from "@/lib/events";
import { flowsApi, isOverridden, overrides, type ScopedFlow } from "@/lib/flows";
import { useStore } from "@/lib/store";
import { STEP_KINDS, summary } from "@/views/automations/flows/model";
import { Section, SourceBadge } from "@/views/project/parts";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
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
  s1: {
    "width": "16px",
    "height": "16px",
  },
  s2: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s3: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "textAlign": "left",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
  },
  s4: {
    "opacity": 0.6,
  },
  s5: {
    "display": "flex",
    "flexShrink": 0,
  },
  s6: {
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
  s7: {
    "width": "14px",
    "height": "14px",
  },
  s8: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s9: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s10: {
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s12: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },

  s13: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s14: {
    ":not(#\\#) > :not(:first-child)": {
      marginLeft: -4,
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// FlowsSection lists this repo's flows on this box; they open in the flow
// editor, scoped to the repo.
export function FlowsSection({ box, location }: { box: string; location: string }) {
  const client = useStore((s) => s.client);
  const [flows, setFlows] = useState<ScopedFlow[]>();
  const scope = `repo:${location}`;
  const changed = useEventLog((s) => s.events.find((e) => e.box === box && (e.type === "flows.changed" || e.type === "config.changed")));

  useEffect(() => {
    if (!client) return;
    flowsApi.list(client, box).then(
      (all) => setFlows(all.filter((f) => f.scope === scope)),
      () => setFlows([]),
    );
  }, [client, box, scope, changed]);

  const open = (id?: string) => useStore.getState().setView({ kind: "automations", open: { box, scope, id } });
  // An override hides the committed flow it replaces.
  const shown = (flows ?? []).filter((f) => !isOverridden(f, flows!));

  return (
    <Section
      id="flows"
      title="Automations"
      description={`Flows that run for ${location}'s worktrees: tests after an agent's turn, a review when it finishes, a ping when setup fails.`}
      actions={
        <Button size="xs" variant="ghost" onClick={() => open()}>
          <PlusIcon />
          New flow
        </Button>
      }
    >
      {flows && shown.length === 0 ? (
        <button type="button" onClick={() => open()} className={sx(paint.s0)}>
          <WorkflowIcon className={sx(paint.s1)} />
          No flows for {location} yet. Make one.
        </button>
      ) : (
        <div className={[sx(paint.s2), sx(paint.s13)].filter(Boolean).join(" ")}>
          {shown.map((f) => (
            <button key={`${f.source}:${f.flow.id}`} type="button" onClick={() => open(f.flow.id)} className={[sx(paint.s3), !f.flow.enabled && sx(paint.s4)].filter(Boolean).join(" ")}>
              <span className={[sx(paint.s5), sx(paint.s14)].filter(Boolean).join(" ")}>
                {[...new Set(f.flow.steps.map((s) => s.kind))].slice(0, 3).map((k) => {
                  const m = STEP_KINDS[k];
                  return (
                    <span key={k} className={sx(paint.s6)}>
                      <m.Icon className={sx(paint.s7)} />
                    </span>
                  );
                })}
              </span>
              <span className={sx(paint.s8)}>
                <span className={sx(paint.s9)}>{f.flow.name}</span>
                <span className={sx(paint.s10)}>{summary(f.flow)}</span>
              </span>
              {!f.flow.enabled && <span className={sx(paint.s11)}>Off</span>}
              <SourceBadge source={f.source === "local" ? (overrides(f, flows!) ? "override" : "box") : f.source === "box" ? "box" : f.source} box={box} />
              <ChevronRightIcon className={sx(paint.s12)} />
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
