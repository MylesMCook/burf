import * as stylex from "@stylexjs/stylex";
import { CircleArrowUpIcon, RefreshCwIcon } from "lucide-react";

import { ErrorDetails } from "@/components/error-note";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { explain } from "@/lib/errors";
import { updateBoxes, useOutdated, useOutdatedBoxes } from "@/lib/outdated";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--info) 32%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 4%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s1: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--info)",
  },
  s2: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s3: {
    "color": "var(--muted-foreground)",
  },
  s4: {
    "color": "var(--muted-foreground)",
  },
  s5: {
    "fontWeight": 500,
  },
  s6: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "fontWeight": 500,
    "color": "var(--foreground)",
  },
  s8: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "12px",
    "rowGap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--info) 32%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 4%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s9: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// UpgradeBox updates a box's berthd to the build this Burf ships: the same
// upgrade as Settings → Boxes and the status bar's Update all, sharing their
// progress, so pressing it in one place shows it running in all of them.
// Agents keep running; once the box answers with the new build, whatever
// was waiting on it loads by itself.
export function UpgradeBox({ box, size = "default", variant = "default", label, className }: { box: string; size?: "default" | "sm" | "xs"; variant?: "default" | "outline" | "ghost"; label?: string; className?: string }) {
  const u = useOutdated((s) => s.updating[box]);
  const busy = u?.state === "queued" || u?.state === "running";
  const button = (
    <span className={className}><Button size={size} variant={variant}  onClick={() => void updateBoxes([box])} disabled={busy}>
      {busy ? <Spinner /> : <RefreshCwIcon />}
      {busy ? (u?.state === "queued" ? `${box} is next…` : `Updating ${box}…`) : (label ?? `Install bundled agent on ${box}`)}
    </Button></span>
  );
  // While it runs, the upgrade's latest line is a hover away.
  return busy && u?.line ? <Tip label={u.line}>{button}</Tip> : button;
}

// useUpdateAll is the app-wide notice's state: the outdated boxes, which
// are being updated, and Update all.
export function useUpdateAll() {
  const outdated = useOutdatedBoxes();
  const updating = useOutdated((s) => s.updating);
  const active = Object.entries(updating).filter(([, u]) => u.state === "queued" || u.state === "running");
  const running = active.find(([, u]) => u.state === "running")?.[0];
  const total = active.length + Object.values(updating).filter((u) => u.state === "done").length;
  const done = Object.values(updating).filter((u) => u.state === "done").length;
  return {
    outdated,
    busy: active.length > 0,
    running,
    progress: active.length ? `${Math.min(done + 1, total)} of ${total}` : undefined,
    updateAll: () => void updateBoxes(outdated),
  };
}

// Build hashes identify content, not version order. Keep the legacy API's
// "outdated" field, but describe only the comparison it actually proves.
export function OutdatedNotice({ className }: { className?: string }) {
  const { outdated, busy, running, progress, updateAll } = useUpdateAll();
  if (!outdated.length && !busy) return null;
  return (
    <div role="status" className={[sx(paint.s0), className].filter(Boolean).join(" ")}>
      <CircleArrowUpIcon className={sx(paint.s1)} />
      <span className={sx(paint.s2)}>
        {busy ? (
          <>
            Installing bundled agent on {running ?? "boxes"}… <span className={sx(paint.s3)}>({progress})</span>
          </>
        ) : (
          <>
            {outdated.length === 1 ? `${outdated[0]} has` : `${outdated.length} boxes have`} a different agent build.{" "}
            <span className={sx(paint.s4)}>Build IDs do not indicate which is newer.</span>
          </>
        )}
      </span>
      <Button size="xs" variant="outline" disabled={busy} onClick={updateAll}>
        {busy ? <Spinner /> : <RefreshCwIcon />}
        {busy ? "Installing…" : outdated.length === 1 ? "Install bundled agent" : "Install bundled agents"}
      </Button>
    </div>
  );
}

// BoxError is what a view says when a box couldn't give it what it asked
// for: the one-click update when the box is too old for it, or else the
// error in plain words with the box's own behind Details.
export function BoxError({ box, error, what, className }: { box: string; error: string; what: string; className?: string }) {
  const e = explain(error, { box });
  if (e.step === "update-box") {
    return (
      <NeedsUpdate box={box} className={className}>
        <span className={sx(paint.s5)}>{box}</span>'s box agent does not support {what}. The install action uses Burf's bundled agent.
      </NeedsUpdate>
    );
  }
  return (
    <div className={[sx(paint.s6), className].filter(Boolean).join(" ")}>
      <span>
        <span className={sx(paint.s7)}>{box}</span>: couldn't read {what}. {e.message}
      </span>
      <ErrorDetails text={e.details} />
    </div>
  );
}

// NeedsUpdate is the inline note a feature shows on a box too old for it:
// what's missing, and the one button that fixes it.
export function NeedsUpdate({ box, children, className }: { box: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={[sx(paint.s8), className].filter(Boolean).join(" ")}>
      <span className={sx(paint.s9)}>{children}</span>
      <UpgradeBox box={box} size="xs" variant="outline" />
    </div>
  );
}
