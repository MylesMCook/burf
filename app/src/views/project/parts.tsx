import * as stylex from "@stylexjs/stylex";
import { GitCommitHorizontalIcon, LaptopMinimalIcon, ServerIcon, Undo2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tip } from "@/components/tip";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "marginBottom": "10px",
    "display": "flex",
    "alignItems": "flex-end",
    "gap": "12px",
  },
  s1: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s2: {
    "fontWeight": 600,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s3: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s4: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
  },
  s5: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s6: {
    "color": "var(--muted-foreground)",
  },
  s7: {
    "color": "var(--warning-foreground)",
    "borderColor": "color-mix(in oklab, var(--warning) 30%, transparent)",
  },
  s8: {
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
  },
  s9: {
    "width": "12px",
    "height": "12px",
  },
  s10: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "14px",
    "paddingBottom": "14px",
  },
  s11: {
    "marginBottom": "6px",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s12: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s13: {
    "marginLeft": "auto",
    "display": "flex",
    "gap": "4px",
  },
  s14: {
    "marginBottom": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "overflowX": "auto",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },

  s16: {
    scrollMarginTop: 24,
  },
  s17: {
    color: color.mutedForeground,
  },
  s18: {
    color: "var(--color-sky-400)",
    borderColor: "color-mix(in oklab, var(--color-sky-400) 25%, transparent)",
  },
  s19: {
    color: "var(--warning-foreground)",
    borderColor: "color-mix(in oklab, var(--warning) 30%, transparent)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// Section is one titled part of Project settings, framed like the rest of
// the app's settings.
export function Section({ id, title, description, actions, children }: { id: string; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className={sx(paint.s16)}>
      <div className={sx(paint.s0)}>
        <div className={sx(paint.s1)}>
          <h2 className={sx(paint.s2)}>{title}</h2>
          {description && <p className={sx(paint.s3)}>{description}</p>}
        </div>
        {actions && <div className={sx(paint.s4)}>{actions}</div>}
      </div>
      <div className={sx(paint.s5)}>{children}</div>
    </section>
  );
}

export type Source = "repo" | "box" | "override";

// SourceBadge says where a value comes from: committed in the repository,
// set on this box, or this box overriding the committed value.
export function SourceBadge({ source, box }: { source: Source; box: string }) {
  const map = {
    repo: { Icon: GitCommitHorizontalIcon, label: "Repo", cls: (sx(paint.s17) ?? ""), title: "Committed in the repository's .berth/config.json" },
    box: { Icon: ServerIcon, label: box, cls: (sx(paint.s18) ?? ""), title: `Set on ${box} only` },
    override: { Icon: ServerIcon, label: `${box} override`, cls: (sx(paint.s19) ?? ""), title: `${box} replaces the committed value` },
  }[source];
  return (
    <Tip label={map.title}>
      <span className={[sx(paint.s8), map.cls].filter(Boolean).join(" ")}>
        <map.Icon className={sx(paint.s9)} />
        {map.label}
      </span>
    </Tip>
  );
}

// LayeredScript is a script the repository may commit and this box may
// override: the committed one shows read-only until overridden.
export function LayeredScript({
  label,
  hint,
  repo,
  local,
  box,
  placeholder,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  repo?: string;
  local?: string;
  box: string;
  placeholder: string;
  onChange(v: string | undefined): void;
}) {
  const overriding = local !== undefined && local !== "";
  const source: Source | undefined = overriding ? (repo ? "override" : "box") : repo ? "repo" : undefined;
  return (
    <div className={sx(paint.s10)}>
      <div className={sx(paint.s11)}>
        <span className={sx(paint.s12)}>{label}</span>
        {source && <SourceBadge source={source} box={box} />}
        <span className={sx(paint.s13)}>
          {repo && !overriding && (
            <Button size="xs" variant="ghost" onClick={() => onChange(repo)}>
              <LaptopMinimalIcon />
              Override on {box}
            </Button>
          )}
          {overriding && repo && (
            <Button size="xs" variant="ghost" onClick={() => onChange(undefined)}>
              <Undo2Icon />
              Use the repo's
            </Button>
          )}
        </span>
      </div>
      <p className={sx(paint.s14)}>{hint}</p>
      {repo && !overriding ? (
        <pre className={sx(paint.s15)}>{repo}</pre>
      ) : (
        <Textarea value={local ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} mono text="xs" span="note" spellCheck={false} />
      )}
    </div>
  );
}
