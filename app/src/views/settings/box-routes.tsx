import * as stylex from "@stylexjs/stylex";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toastManager } from "@/components/ui/toast";
import { type BoxRoute, type BoxStatus, laptopApi } from "@/lib/api";
import { canTurnOff, routeSummary, routeWords } from "@/lib/box-routes";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";

const paint = stylex.create({
  s0: {
    "marginTop": "2px",
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s1: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "2px",
    "color": {
      ":hover": "var(--foreground)",
    },
  },
  s2: {
    "width": "12px",
    "height": "12px",
  },
  s3: {
    "width": "12px",
    "height": "12px",
  },
  s4: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s5: {
    "marginTop": "12px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s6: {
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s7: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
  },
  s9: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s11: {
    "width": "6px",
    "height": "6px",
    "flexShrink": 0,
    "borderRadius": "999px",
  },
  s12: {
    "backgroundColor": "var(--success)",
  },
  down: {
    "backgroundColor": "var(--destructive)",
  },
  idle: {
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 40%, transparent)",
  },
  s13: {
    "flexShrink": 0,
  },
  s14: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s15: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s16: {
    "flexShrink": 0,
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s17: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s18: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s19: {
    "width": "24px",
    "height": "24px",
    "flexShrink": 0,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// BoxRoutes is how this computer reaches a box: its paired address, SSH,
// other addresses. Burf sends new requests over the fastest one that
// works; this line says which, and opens BoxRouteList, where the person
// adds routes or turns them off.
export function BoxRoutes({ box, open, onOpenChange }: { box: BoxStatus; open: boolean; onOpenChange(open: boolean): void }) {
  const routes = box.routes ?? [];
  if (box.local || routes.length === 0) return null;
  const summary = routes.length > 1 ? routeSummary(box) : "";
  return (
    <div className={sx(paint.s0)} data-testid="box-routes">
      <button type="button" className={sx(paint.s1)} onClick={() => onOpenChange(!open)} aria-expanded={open} data-testid="box-routes-toggle">
        {open ? <ChevronDownIcon className={sx(paint.s2)} /> : <ChevronRightIcon className={sx(paint.s3)} />}
        Routes
      </button>
      {summary && (
        <span className={sx(paint.s4)} data-testid="box-routes-summary">
          {summary}
        </span>
      )}
    </div>
  );
}

async function change(what: string, call: () => Promise<unknown>) {
  try {
    await call();
  } catch (err) {
    toastManager.add({ title: `Couldn't ${what}`, description: errorMessage(err), type: "error" });
  } finally {
    await useStore.getState().refreshStatus();
  }
}

export function BoxRouteList({ box }: { box: BoxStatus }) {
  const routes = box.routes ?? [];
  const client = useStore((s) => s.client);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  if (!client) return null;
  const add = async () => {
    const v = value.trim();
    if (!v) return;
    setBusy(true);
    // host:port is an address; anything else is an SSH host as ssh takes it.
    const route = /^[^@\s]+:\d+$/.test(v) ? ({ kind: "direct", address: v } as const) : ({ kind: "ssh", host: v } as const);
    await change("add the route", () => laptopApi.addRoute(client, box.name, route));
    setBusy(false);
    setValue("");
    setAdding(false);
  };
  return (
    <div className={sx(paint.s5)} data-testid="box-route-list">
      {routes.map((r) => (
        <RouteRow key={r.id} box={box} route={r} />
      ))}
      <div className={sx(paint.s6)}>
        {adding ? (
          <form
            className={sx(paint.s7)}
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <Input
              size="sm"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="An SSH host (alex@devl) or an address (192.168.1.20:7444)"
              aria-label="SSH host or address"
              data-testid="box-route-add-input"
              mono text="xs"
            />
            <Button size="xs" type="submit" loading={busy} disabled={!value.trim()} data-testid="box-route-add">
              Add
            </Button>
            <Button size="xs" variant="ghost" type="button" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <div className={sx(paint.s8)}>
            <p className={sx(paint.s9)}>
              New requests take the fastest route that works. Every route checks the box's pinned key; SSH uses your own ssh and keys.
            </p>
            <Button size="xs" variant="ghost" onClick={() => setAdding(true)} data-testid="box-route-new">
              <PlusIcon /> Add a route
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RouteRow({ box, route: r }: { box: BoxStatus; route: BoxRoute }) {
  const client = useStore((s) => s.client);
  const on = r.state !== "off";
  const removable = r.id !== "paired" && !r.suggested;
  const words = r.suggested ? "in ~/.ssh/config" : routeWords(r);
  const toggle = (next: boolean) => {
    if (!client) return;
    void change(next ? "turn the route on" : "turn the route off", () =>
      r.suggested && next ? laptopApi.addRoute(client, box.name, { kind: "ssh", host: r.detail ?? box.name }) : laptopApi.setRoute(client, box.name, r.id, next),
    );
  };
  return (
    <div className={sx(paint.s10)} data-testid={`box-route-${r.id}`}>
      <span className={[sx(paint.s11), r.state === "up" ? sx(paint.s12) : r.state === "down" || r.state === "stalled" ? sx(paint.down) : sx(paint.idle)].filter(Boolean).join(" ")} />
      <span className={sx(paint.s13)}>{r.label}</span>
      {r.detail && <span className={sx(paint.s14)}>{r.detail}</span>}
      <span className={sx(paint.s15)} />
      {r.active && <span className={sx(paint.s16)}>in use</span>}
      {r.error && r.state !== "up" ? (
        <Tip label={r.error}>
          <span className={sx(paint.s17)}>{words}</span>
        </Tip>
      ) : (
        <span className={sx(paint.s18)}>{words}</span>
      )}
      <Switch
        checked={on}
        disabled={on && !canTurnOff(box, r.id)}
        onCheckedChange={toggle}
        aria-label={`${r.label}${r.detail ? ` (${r.detail})` : ""}: ${on ? "on" : "off"}`}
      />
      {removable ? (
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Remove ${r.label} ${r.detail ?? ""}`.trim()}
          onClick={() => client && void change("remove the route", () => laptopApi.removeRoute(client, box.name, r.id))}
        >
          <XIcon />
        </Button>
      ) : (
        <span className={sx(paint.s19)} />
      )}
    </div>
  );
}
