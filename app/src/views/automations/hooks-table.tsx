import * as stylex from "@stylexjs/stylex";
import { LaptopIcon, LockIcon, PlusIcon, ServerIcon, ShieldIcon, Trash2Icon, ZapIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Hook } from "@/lib/api";
import { describe } from "@/views/automations/catalog";
import { LAPTOP, type MachineHooks } from "@/views/automations/use-hooks";
import { Tip } from "@/components/tip";
import { ErrorText } from "@/components/error-note";
import { BoxError } from "@/components/upgrade-box";

const paint = stylex.create({
  s0: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s1: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
  },
  s2: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s3: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s4: {
    "display": "none",
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s5: {
    "marginLeft": "auto",
  },
  s6: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "marginLeft": "16px",
    "marginRight": "16px",
    "marginTop": "12px",
    "marginBottom": "12px",
  },
  s8: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s9: {
    "height": "16px",
  },
  s10: {
    "height": "16px",
  },
  s11: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "textAlign": "left",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
  },
  s12: {
    "width": "14px",
    "height": "14px",
  },
  s13: {
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s14: {
    "display": "grid",
    "gridTemplateColumns": "repeat(1, minmax(0, 1fr))",
    "columnGap": "12px",
    "rowGap": "6px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "var(--row-pad)",
    "paddingBottom": "var(--row-pad)",
    "outline": "none",
  },
  s15: {
    "cursor": "pointer",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
  },
  s16: {
    "minWidth": "0px",
  },
  s17: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s18: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s19: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s20: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s21: {
    "marginTop": "2px",
    "display": "block",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingLeft": "20px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s22: {
    "display": "block",
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s23: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "6px",
  },
  s24: {
    "width": "10px",
    "height": "10px",
  },
  s25: {
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "transitionProperty": "opacity",
    "transitionDuration": "150ms",
    ":is(.group:hover &)": {
      "opacity": 1,
    },
    ":is(.group:focus-within &)": {
      "opacity": 1,
    },
  },
  s26: {
    "display": "inline-flex",
    "height": "20px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s27: {
    "fontFamily": "var(--font-mono)",
  },

  s28: {
    containerType: "inline-size",
  },
  s29: {
    "@container (min-width: 768px)": {
      display: "block",
    },
  },
  s30: {
    width: "66.6667%",
  },
  s31: {
    width: "50%",
  },
  s32: {
    ":not(#\\#) > :not(:last-child)": {
      borderBottomColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  s33: {
    "@container (min-width: 1536px)": {
      gridTemplateColumns: "minmax(0,15rem) minmax(0,1fr) auto",
      alignItems: "center",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// HooksTable is one machine's hooks: when each runs, what it runs, and
// anything else about it. Rows stack into cards when the table is narrow.
export function HooksTable({ data, label, onAdd, onEdit, onDelete }: { data: MachineHooks; label: string; onAdd(): void; onEdit(index: number): void; onDelete(index: number): void }) {
  const hooks = data.file?.hooks ?? [];
  const MachineIcon = data.machine === LAPTOP ? LaptopIcon : ServerIcon;

  return (
    <section className={[sx(paint.s0), sx(paint.s28)].filter(Boolean).join(" ")}>
      <header className={sx(paint.s1)}>
        <MachineIcon className={sx(paint.s2)} />
        <h2 className={sx(paint.s3)}>{label}</h2>
        {data.file?.path && <code className={[sx(paint.s4), sx(paint.s29)].filter(Boolean).join(" ")}>{data.file.path}</code>}
        <span className={sx(paint.s5)} />
        <Button size="xs" variant="ghost" onClick={onAdd} disabled={!data.file}>
          <PlusIcon />
          Add
        </Button>
      </header>

      {data.error ? (
        data.machine === LAPTOP ? (
          <ErrorText className={sx(paint.s6)} text={`Couldn't read this computer's hooks. ${data.error}`} />
        ) : (
          <BoxError className={sx(paint.s7)} box={data.machine} error={data.error} what="its hooks" />
        )
      ) : !data.file ? (
        <div className={sx(paint.s8)}>
          <div className={[sx(paint.s9), sx(paint.s30)].filter(Boolean).join(" ")}><Skeleton  /></div>
          <div className={[sx(paint.s10), sx(paint.s31)].filter(Boolean).join(" ")}><Skeleton  /></div>
        </div>
      ) : hooks.length === 0 ? (
        <button type="button" onClick={onAdd} className={sx(paint.s11)}>
          <PlusIcon className={sx(paint.s12)} />
          No hooks yet. Add one, or start from a template above.
        </button>
      ) : (
        <div role="list" className={[sx(paint.s13), sx(paint.s32)].filter(Boolean).join(" ")}>
          {hooks.map((h, i) => (
            <HookRow key={`${h.on}-${i}`} hook={h} onEdit={() => onEdit(i)} onDelete={() => onDelete(i)} />
          ))}
        </div>
      )}
    </section>
  );
}

function HookRow({ hook, onEdit, onDelete }: { hook: Hook; onEdit(): void; onDelete(): void }) {
  const d = describe(hook.on);
  const plugin = hook.source?.startsWith("plugin:") ? hook.source.slice("plugin:".length) : undefined;
  const meta = [hook.timeout && <Chip key="t" mono>{hook.timeout}</Chip>, hook.tool && <Chip key="i">{hook.tool}</Chip>].filter(Boolean);

  return (
    <div
      role="listitem"
      tabIndex={plugin ? undefined : 0}
      onClick={plugin ? undefined : onEdit}
      onKeyDown={(e) => !plugin && e.key === "Enter" && e.target === e.currentTarget && onEdit()}
      aria-label={plugin ? undefined : `Edit hook: ${d.label}`}
      className={[[sx(paint.s14), [sx(paint.s33), "group"].filter(Boolean).join(" ")].filter(Boolean).join(" "), !plugin && sx(paint.s15)].filter(Boolean).join(" ")}
    >
      <div className={sx(paint.s16)}>
        <div className={sx(paint.s17)}>
          {d.gate ? <ShieldIcon className={sx(paint.s18)} /> : <ZapIcon className={sx(paint.s19)} />}
          <span className={sx(paint.s20)}>{d.label}</span>
        </div>
        <code className={sx(paint.s21)}>{hook.on}</code>
      </div>
      <code className={sx(paint.s22)} title={hook.run}>
        {hook.run}
      </code>
      <div className={sx(paint.s23)}>
        {meta}
        {plugin && (
          <Chip title="Change it by changing the plugin">
            <LockIcon className={sx(paint.s24)} />
            {plugin}
          </Chip>
        )}
        {!plugin && (
          <span className={sx(paint.s25)}><Button
            size="icon-xs"
            variant="ghost"
            aria-label="Delete hook"
            
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}>
            <Trash2Icon />
          </Button></span>
        )}
      </div>
    </div>
  );
}

function Chip({ children, mono, title }: { children: React.ReactNode; mono?: boolean; title?: string }) {
  return (
    <Tip label={title}>
      <span className={[sx(paint.s26), mono && sx(paint.s27)].filter(Boolean).join(" ")}>{children}</span>
    </Tip>
  );
}
