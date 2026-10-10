import * as stylex from "@stylexjs/stylex";
import { FolderGitIcon, LayersIcon } from "lucide-react";

import { type Scope, scopeLocation } from "@/lib/flows";
import { useStore } from "@/lib/store";
import { hereRef } from "@/lib/workspaces";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "height": "16px",
    "flexShrink": 0,
    "alignItems": "center",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
    "lineHeight": "1",
  },
  s1: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
  },
  s2: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s3: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s4: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s5: {
    "color": "var(--muted-foreground)",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// BoxChip names a box the way the sidebar does.
export function BoxChip({ box, className }: { box: string; className?: string }) {
  return <span className={[sx(paint.s0), className].filter(Boolean).join(" ")}>{box}</span>;
}

// ProjectLabel names where a flow runs: a project as "shop · acme/shop" on
// its box, or every project on a box.
export function ProjectLabel({ box, scope, className, chip = true }: { box: string; scope: Scope; className?: string; chip?: boolean }) {
  return <OneBoxLabel box={box} scope={scope} className={className} chip={chip} />;
}

function OneBoxLabel({ box, scope, className, chip }: { box: string; scope: Scope; className?: string; chip: boolean }) {
  const loc = scopeLocation(scope);
  const slug = useStore((s) => (loc ? s.boxes[box]?.locations?.find((l) => l.name === loc)?.slug : undefined));
  return (
    <span className={[sx(paint.s1), className].filter(Boolean).join(" ")}>
      {loc ? <FolderGitIcon className={sx(paint.s2)} /> : <LayersIcon className={sx(paint.s3)} />}
      <span className={sx(paint.s4)}>
        {loc ?? "All projects"}
        {slug && <span className={sx(paint.s5)}> · {slug}</span>}
      </span>
      {chip && <BoxChip box={box} />}
    </span>
  );
}

// savedWhere says in a line where a flow lives, so it is never a surprise.
// A read-only flow is committed in the repository.
export function savedWhere(box: string, scope: Scope, readOnlyFrom?: "repo"): string {
  const loc = scopeLocation(scope);
  if (readOnlyFrom) return "Saved in the repo's .berth/config.json";
  return loc ? `Saved on ${box} for ${loc} · not committed` : `Saved on ${box} · runs for every project there`;
}

// defaultScope is where a new flow goes: the project you are working in,
// else the first project on the first box that has one.
export function defaultScope(): { box: string; scope: Scope } | undefined {
  const ref = hereRef();
  if (ref) return { box: ref.box, scope: `repo:${ref.location}` };
  const { status, boxes } = useStore.getState();
  const online = status?.boxes.filter((b) => b.state === "online").map((b) => b.name) ?? [];
  for (const b of online) {
    const loc = boxes[b]?.locations?.[0];
    if (loc) return { box: b, scope: `repo:${loc.name}` };
  }
  return online[0] ? { box: online[0], scope: "box" } : undefined;
}
