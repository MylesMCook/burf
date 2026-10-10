import * as stylex from "@stylexjs/stylex";
import { CheckIcon, PlugIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { toastManager } from "@/components/ui/toast";
import type { PluginInfo } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { SIZE_ORDER, SIZES, type WidgetSize } from "@/lib/home-layout";
import { builtinOn, setBuiltinOn, usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { builtinPlugins, loadPlugins } from "@/plugins/host";

import { WidgetBoundary, WidgetHeading } from "./card";
import { GAP, HomeWidgetProvider, ROW } from "./env";
import { CATEGORIES, type WidgetDef } from "./registry";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
  },
  s1: {
    "display": "flex",
    "width": "340px",
    "flexShrink": 0,
    "flexDirection": "column",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s2: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "14px",
    "paddingBottom": "10px",
  },
  s3: {
    "marginLeft": "12px",
    "marginRight": "12px",
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "boxShadow": {
      ":focus-within": "0 0 0 2px var(--ring)",
    },
  },
  s4: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s5: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "backgroundColor": "transparent",
    "outline": "none",
    "color": {
      "::placeholder": "var(--muted-foreground)",
    },
  },
  s6: {
    "marginTop": "8px",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingBottom": "8px",
  },
  s7: {
    "paddingBottom": "6px",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "4px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s9: {
    "width": "12px",
    "height": "12px",
  },
  s10: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s11: {
    "display": "flex",
    "minHeight": "0px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
  },
  s12: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "justifyContent": "center",
    "overflow": "hidden",
    "padding": "24px",
  },
  s13: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "12px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "var(--popover)",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
  },
  s14: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "12px",
  },
  s15: {
    "display": "flex",
    "minWidth": "192px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s16: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s17: {
    "borderRadius": "var(--radius-sm)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 400,
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s18: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s19: {
    "display": "flex",
    "alignItems": "center",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "padding": "2px",
  },
  s20: {
    "height": "24px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "outline": "none",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s21: {
    "backgroundColor": "var(--foreground)",
    "color": "var(--background)",
  },
  s22: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s23: {
    "display": "grid",
    "gridTemplateColumns": "64px 1fr",
    "columnGap": "12px",
    "rowGap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s24: {
    "color": "var(--muted-foreground)",
  },
  s25: {
    "display": "flex",
    "width": "100%",
    "alignItems": "flex-start",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "textAlign": "left",
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s26: {
    "backgroundColor": "var(--accent)",
  },
  s27: {
    "marginTop": "2px",
    "display": "flex",
    "width": "28px",
    "height": "28px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
  },
  s28: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s29: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s30: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s31: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
  },
  s32: {
    "marginLeft": "auto",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "2px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s33: {
    "width": "12px",
    "height": "12px",
  },
  s34: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s35: {
    "pointerEvents": "none",
    "position": "relative",
  },
  s36: {
    "position": "absolute",
    "top": "0px",
    "left": "0px",
  },
  s37: {
    "width": "100%",
    "height": "100%",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s38: {
    "display": "flex",
    "width": "100%",
    "height": "100%",
    "flexDirection": "column",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "color": "var(--card-foreground)",
    "boxShadow": "0 4px 6px color-mix(in oklab, var(--foreground) 10%, transparent)",
  },
  s39: {
    "position": "relative",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingBottom": "6px",
  },
  s40: {
    "marginTop": "4px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "10px",
  },
  s41: {
    "paddingBottom": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s42: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s43: {
    "marginTop": "2px",
    "display": "flex",
    "width": "28px",
    "height": "28px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
  },
  s44: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s45: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s46: {
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s47: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },

  s48: {
    "@media (max-width: 720px)": {
      flexDirection: "column",
    },
  },
  s49: {
    "@media (max-width: 720px)": {
      height: "50%",
      width: "100%",
      borderRightWidth: 0,
      borderBottomWidth: 1,
      borderBottomStyle: "solid",
      borderBottomColor: color.border,
    },
  },
  s50: {
    containerType: "inline-size",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// "Add widget": every widget there is, Burf's by what they're about and
// each plugin's under the plugin's name, with the one picked drawn live at
// the size chosen, and where its data comes from. Built-in plugins that are
// off but add widgets are offered too, a click from on.

export function AddWidgetDialog({ open, onOpenChange, defs, have, onAdd }: { open: boolean; onOpenChange(o: boolean): void; defs: WidgetDef[]; have: string[]; onAdd(id: string, size: WidgetSize): void }) {
  const [q, setQ] = useState("");
  const firstFree = defs.find((d) => !have.includes(d.id)) ?? defs[0];
  const [pick, setPick] = useState<string>();
  const def = defs.find((d) => d.id === pick) ?? firstFree;
  const [size, setSize] = useState<WidgetSize>(def?.sizes[0] ?? "m");
  useEffect(() => {
    if (!open) return;
    setQ("");
    setPick(undefined);
  }, [open]);
  useEffect(() => {
    if (def) setSize(def.sizes[0]);
  }, [def]);

  const match = (d: WidgetDef) => !q || `${d.title} ${d.description} ${d.plugin?.name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  const groups = useMemo(() => {
    const out: { label: string; plugin?: boolean; list: WidgetDef[] }[] = [];
    for (const c of CATEGORIES) {
      const list = defs.filter((d) => !d.plugin && d.category === c && match(d));
      if (list.length) out.push({ label: c, list });
    }
    const plugins = [...new Set(defs.filter((d) => d.plugin).map((d) => d.plugin!.name))];
    for (const name of plugins) {
      const list = defs.filter((d) => d.plugin?.name === name && match(d));
      if (list.length) out.push({ label: name, plugin: true, list });
    }
    return out;
    // match reads q.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defs, q]);

  if (!def) return null;
  const on = have.includes(def.id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup bottomStickOnMobile={false} data-testid="widget-picker" frame="picker">
        <div className={[sx(paint.s0), sx(paint.s48)].filter(Boolean).join(" ")}>
          <div className={[sx(paint.s1), sx(paint.s49)].filter(Boolean).join(" ")}>
            <div className={sx(paint.s2)}>
              <DialogTitle size="base">Add a widget</DialogTitle>
              <DialogDescription size="xs">Pick one to see it with your data.</DialogDescription>
            </div>
            <label className={sx(paint.s3)}>
              <SearchIcon className={sx(paint.s4)} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search widgets" aria-label="Search widgets" className={sx(paint.s5)} />
            </label>
            <div className={sx(paint.s6)} role="listbox" aria-label="Widgets">
              {groups.map((g) => (
                <div key={g.label} role="group" aria-label={g.plugin ? `From the ${g.label} plugin` : g.label} className={sx(paint.s7)}>
                  <p className={sx(paint.s8)}>
                    {g.plugin && <PlugIcon className={sx(paint.s9)} />}
                    {g.label}
                  </p>
                  {g.list.map((w) => (
                    <Option key={w.id} w={w} selected={w.id === def.id} on={have.includes(w.id)} onSelect={() => setPick(w.id)} onAdd={() => !have.includes(w.id) && onAdd(w.id, w.sizes[0])} />
                  ))}
                </div>
              ))}
              {!groups.length && <p className={sx(paint.s10)}>No widget matches “{q}”.</p>}
              {!q && <OffPlugins />}
            </div>
          </div>
          <div className={sx(paint.s11)}>
            <div className={sx(paint.s12)}>
              <Preview def={def} size={size} />
            </div>
            <div className={sx(paint.s13)}>
              <div className={sx(paint.s14)}>
                <div className={sx(paint.s15)}>
                  <span className={sx(paint.s16)}>
                    {def.title}
                    {def.plugin && <span className={sx(paint.s17)}>{def.plugin.name} plugin</span>}
                  </span>
                  <span className={sx(paint.s18)}>{def.description}</span>
                </div>
                {def.sizes.length > 1 && (
                  <div role="radiogroup" aria-label="Size" className={sx(paint.s19)}>
                    {SIZE_ORDER.filter((s) => def.sizes.includes(s)).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={s === size}
                        onClick={() => setSize(s)}
                        className={[sx(paint.s20), s === size ? sx(paint.s21) : sx(paint.s22)].filter(Boolean).join(" ")}
                      >
                        {SIZES[s].label}
                      </button>
                    ))}
                  </div>
                )}
                <Button size="sm" onClick={() => onAdd(def.id, size)} disabled={on} data-testid="widget-add">
                  {on ? <CheckIcon /> : <PlusIcon />}
                  {on ? "On Home" : "Add to Home"}
                </Button>
              </div>
              <dl className={sx(paint.s23)}>
                <dt className={sx(paint.s24)}>Data</dt>
                <dd>{def.source}</dd>
              </dl>
            </div>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

function Option({ w, selected, on, onSelect, onAdd }: { w: WidgetDef; selected: boolean; on: boolean; onSelect(): void; onAdd(): void }) {
  const Icon = w.icon;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      onDoubleClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === "Enter" && selected) {
          e.preventDefault();
          onAdd();
        }
      }}
      onFocus={onSelect}
      data-testid="widget-option"
      data-widget-id={w.id}
      className={[sx(paint.s25), selected && sx(paint.s26)].filter(Boolean).join(" ")}
    >
      <span className={sx(paint.s27)}>
        <Icon className={sx(paint.s28)} />
      </span>
      <span className={sx(paint.s29)}>
        <span className={sx(paint.s30)}>
          <span className={sx(paint.s31)}>{w.title}</span>
          {on && (
            <span className={sx(paint.s32)}>
              <CheckIcon className={sx(paint.s33)} /> On Home
            </span>
          )}
        </span>
        <span className={sx(paint.s34)}>{w.description}</span>
      </span>
    </button>
  );
}

// Preview draws the real widget at a size, scaled to fit, unclickable.
function Preview({ def, size }: { def: WidgetDef; size: WidgetSize }) {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 520, h: 360 });
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoom({ w: el.clientWidth - 48, h: el.clientHeight - 48 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sp = SIZES[size];
  const W = sp.c * 270 + (sp.c - 1) * GAP;
  const H = sp.r * ROW + (sp.r - 1) * GAP;
  const scale = Math.max(0.2, Math.min(1, room.w / W, room.h / H));
  const Body = def.Component;
  const body = (
    <WidgetBoundary title={def.title}>
      <Body />
    </WidgetBoundary>
  );
  return (
    <div ref={ref} style={{ width: W * scale, height: H * scale }} className={sx(paint.s35)} aria-label={`Preview of ${def.title}`} role="img" inert>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0" }} className={sx(paint.s36)}>
        <HomeWidgetProvider size={size} cols={4} visible refresh={0} preview bare={def.bare}>
        {def.bare ? (
          <div className={sx(paint.s37)}>{def.wrap ? def.wrap(body) : body}</div>
        ) : (
          <section className={sx(paint.s38)}>
            <WidgetHeading def={def} />
            <div className={[sx(paint.s39), sx(paint.s50)].filter(Boolean).join(" ")}>{def.wrap ? def.wrap(body) : body}</div>
          </section>
        )}
        </HomeWidgetProvider>
      </div>
    </div>
  );
}

// OffPlugins: built-in plugins that are off but add widgets, to turn on.
function OffPlugins() {
  const disabledPlugins = usePrefs((p) => p.disabledPlugins);
  const enabledPlugins = usePrefs((p) => p.enabledPlugins);
  const [list, setList] = useState<PluginInfo[]>([]);
  const [busy, setBusy] = useState<string>();
  useEffect(() => {
    let alive = true;
    void builtinPlugins().then((all) => alive && setList(all));
    return () => {
      alive = false;
    };
  }, []);
  const off = list.filter((p) => p.homeWidgets?.length && !builtinOn(p, { disabledPlugins, enabledPlugins }));
  if (!off.length) return null;
  const turnOn = async (p: PluginInfo) => {
    const client = useStore.getState().client;
    if (!client) return;
    setBusy(p.id);
    try {
      setBuiltinOn(p, true);
      await loadPlugins(client);
    } catch (err) {
      toastManager.add({ title: `Couldn't turn on ${p.name}`, description: errorMessage(err), type: "error" });
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <div className={sx(paint.s40)}>
      <p className={sx(paint.s41)}>More with plugins that are off</p>
      {off.map((p) => (
        <div key={p.id} className={sx(paint.s42)}>
          <span className={sx(paint.s43)}>
            <PlugIcon className={sx(paint.s44)} />
          </span>
          <span className={sx(paint.s45)}>
            <span className={sx(paint.s46)}>{p.homeWidgets!.join(", ")}</span>
            <span className={sx(paint.s47)}>From {p.name}</span>
          </span>
          <Button size="xs" variant="outline" disabled={busy === p.id} onClick={() => void turnOn(p)}>
            Turn on
          </Button>
        </div>
      ))}
    </div>
  );
}
