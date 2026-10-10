import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef } from "react";

import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { guessSessionName, sessionName, sessionPlace, worktreeOf } from "@/lib/derive";
import { type PromptVariable, type SavedPrompt, segments, variableLabel } from "@/lib/prompts";
import { useStore } from "@/lib/store";
import { useRegistry } from "@/plugins/registry";
import { describeAgent, startedAt } from "@/views/dashboard/names";

const paint = stylex.create({
  s0: {
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontSize": "13px",
    "lineHeight": "1.625",
  },
  s1: {
    "borderRadius": "3px",
    "paddingLeft": "2px",
    "paddingRight": "2px",
  },
  s2: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 12%, transparent)",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "var(--warning-foreground)",
  },
  s3: {
    "backgroundColor": "color-mix(in oklab, var(--primary) 10%, transparent)",
    "color": "var(--foreground)",
  },
  s4: {
    "display": "grid",
    "gap": "12px",
  },
  s5: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "6px",
  },
  s6: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s7: {
    "fontFamily": "var(--font-mono)",
    "fontWeight": 400,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s8: {
    "display": "flex",
    "width": "100%",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "2px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "textAlign": "left",
    "outline": "none",
  },
  s9: {
    "backgroundColor": "var(--accent)",
  },
  s10: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s11: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s12: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s13: {
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

// The prompts plugin's library screen, when that plugin is on.
export const LIBRARY_SCREEN = "prompt-library";

export function openLibrary(): boolean {
  if (!useRegistry.getState().screens.some((c) => c.item.id === LIBRARY_SCREEN)) return false;
  useStore.getState().setView({ kind: "plugin", screen: LIBRARY_SCREEN });
  return true;
}

// What a target session is called, the way the rest of the app names it:
// name is sessionName's "Claude Code 2", short adds the worktree for a chip
// ("order-export · Claude Code 2"), and detail says where and, when
// several agents share the worktree, when this one started.
export function useTargetLabel(box: string, session: string) {
  const d = useStore((s) => s.boxes[box]);
  const s = d?.sessions?.find((x) => x.name === session);
  if (!s) {
    const guess = guessSessionName(session);
    return { session: s, name: guess, title: guess, short: guess, place: "", detail: box };
  }
  const where = worktreeOf(d?.locations, s);
  const name = sessionName(s, { sessions: d?.sessions });
  const place = sessionPlace(s, d?.locations);
  const here = where ? (where.worktree.main ? where.location.name : where.worktree.name) : place;
  const crowded = describeAgent(s, d?.sessions, d?.locations).crowded;
  return {
    session: s,
    name,
    title: name,
    short: `${here} · ${name}`,
    place,
    detail: [place, where?.worktree.branch, crowded ? `started ${startedAt(s.created)}` : undefined, box].filter(Boolean).join(" · "),
  };
}

// PromptPreview is the prompt as it will be typed: what variables filled
// is marked, and what is still missing stands out.
export function PromptPreview({ body, values, className }: { body: string; values: Record<string, string | undefined>; className?: string }) {
  return (
    <div className={[sx(paint.s0), className].filter(Boolean).join(" ")}>
      {segments(body, values).map((s, i) =>
        s.variable ? (
          <Tip key={i} label={s.missing ? `{{${s.variable}}} has no value yet` : `{{${s.variable}}}`}>
            <span className={[sx(paint.s1), s.missing ? sx(paint.s2) : sx(paint.s3)].filter(Boolean).join(" ")}>{s.text}</span>
          </Tip>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </div>
  );
}

// VariableFields asks for a prompt's own variables; built-ins fill
// themselves.
export function VariableFields({ vars, values, onChange, autoFocus }: { vars: PromptVariable[]; values: Record<string, string>; onChange(name: string, value: string): void; autoFocus?: boolean }) {
  if (!vars.length) return null;
  return (
    <div className={sx(paint.s4)}>
      {vars.map((v, i) => (
        <label key={v.name} className={sx(paint.s5)}>
          <span className={sx(paint.s6)}>
            {variableLabel(v)}
            <span className={sx(paint.s7)}>{`{{${v.name}}}`}</span>
          </span>
          {v.multiline ? (
            <Textarea autoFocus={autoFocus && i === 0} rows={3} value={values[v.name] ?? ""} placeholder={v.default} onChange={(e) => onChange(v.name, e.target.value)} />
          ) : (
            <Input autoFocus={autoFocus && i === 0} value={values[v.name] ?? ""} placeholder={v.default} onChange={(e) => onChange(v.name, e.target.value)} />
          )}
        </label>
      ))}
    </div>
  );
}

// With nothing typed, a variable takes its default.
export const withDefaults = (vars: PromptVariable[], values: Record<string, string>) =>
  Object.fromEntries(vars.map((v) => [v.name, values[v.name]?.trim() ? values[v.name] : (v.default ?? "")]));

// PromptRow is one prompt in a list: its title, tags, and how it starts.
export function PromptRow({ p, active, onPick, onHover }: { p: SavedPrompt; active?: boolean; onPick(): void; onHover?(): void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={active}
      onClick={onPick}
      onMouseMove={onHover}
      className={[sx(paint.s8), active ? sx(paint.s9) : sx(paint.s10)].filter(Boolean).join(" ")}
    >
      <span className={sx(paint.s11)}>
        <span className={sx(paint.s12)}>{p.title}</span>
        {p.project && (
          <Badge size="sm" variant="info">
            project
          </Badge>
        )}
        {p.tags.slice(0, 3).map((t) => (
          <Badge key={t} size="sm" variant="secondary">
            {t}
          </Badge>
        ))}
      </span>
      <span className={sx(paint.s13)}>{p.body.replace(/\s+/g, " ")}</span>
    </button>
  );
}
