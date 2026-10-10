import * as stylex from "@stylexjs/stylex";
import { EllipsisIcon, EyeOffIcon, LayoutGridIcon, PlugIcon, RefreshCwIcon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";

import { Tip } from "@/components/tip";
import { Menu, MenuGroupLabel, MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger, menuWidths } from "@/components/ui/menu";
import { SIZE_ORDER, SIZES, type WidgetSize } from "@/lib/home-layout";

import type { WidgetDef } from "./registry";
import { WidgetEmpty } from "./parts";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "borderRadius": "var(--radius-sm)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 500,
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s1: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 14%, transparent)",
    "color": "var(--warning-foreground)",
  },
  s2: {
    "color": "var(--muted-foreground)",
  },
  s3: {
    "display": "flex",
    "height": "36px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "paddingRight": "6px",
    "paddingLeft": "12px",
  },
  s4: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s5: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s6: {
    "display": "inline-flex",
    "flexShrink": 0,
    "color": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
  },
  s7: {
    "width": "12px",
    "height": "12px",
  },
  s8: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s9: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "outline": "none",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
    ":is(.group\\/w:focus-within &)": {
      "opacity": 1,
    },
    ":is(.group\\/w:hover &)": {
      "opacity": 1,
    },
  },
  s10: {
    "width": "14px",
    "height": "14px",
  },
  s11: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "12px",
  },
  s12: {
    "marginLeft": "auto",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },

  s13: {
    backgroundColor: { "[data-popup-open]": color.accent },
    opacity: { "[data-popup-open]": 1 },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A widget's card: one bordered surface (rounded-lg) with a 36px heading
// (its icon, title, count and, for a plugin's, the plugin), a menu, and its
// body under an error boundary, so one broken widget never blanks Home.

function Count({ use }: { use: NonNullable<WidgetDef["useCount"]> }) {
  const c = use();
  if (!c || c.n <= 0) return null;
  return (
    <span className={[sx(paint.s0), c.urgent ? sx(paint.s1) : sx(paint.s2)].filter(Boolean).join(" ")} aria-label={`${c.n}${c.urgent ? ", needs you" : ""}`}>
      {c.n}
    </span>
  );
}

export function CountBadge({ def }: { def: WidgetDef }) {
  if (!def.useCount) return null;
  const node = (
    <Quiet>
      <Count use={def.useCount} />
    </Quiet>
  );
  return <>{def.wrap ? def.wrap(node) : node}</>;
}

export function WidgetHeading({ def, id, actions, className }: { def: WidgetDef; id?: string; actions?: ReactNode; className?: string }) {
  const Icon = def.icon;
  return (
    <div className={[sx(paint.s3), className].filter(Boolean).join(" ")}>
      <Icon className={sx(paint.s4)} />
      <h2 id={id} className={sx(paint.s5)}>
        {def.title}
      </h2>
      <CountBadge def={def} />
      {def.plugin && (
        <Tip label={`From the ${def.plugin.name} plugin`}>
          <span className={sx(paint.s6)} role="img" aria-label={`From the ${def.plugin.name} plugin`}>
            <PlugIcon className={sx(paint.s7)} />
          </span>
        </Tip>
      )}
      <span className={sx(paint.s8)} />
      {actions}
    </div>
  );
}

export function WidgetMenu({ def, size, onSize, onRefresh, onRemove, onCustomize, className }: { def: WidgetDef; size: WidgetSize; onSize(s: WidgetSize): void; onRefresh(): void; onRemove(): void; onCustomize(): void; className?: string }) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={`${def.title} options`}
            className={[[sx(paint.s9), sx(paint.s13)].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
          />
        }
      >
        <EllipsisIcon className={sx(paint.s10)} />
      </MenuTrigger>
      <MenuPopup align="end" width={menuWidths.w48}>
        {def.sizes.length > 1 && (
          <>
            <MenuGroupLabel>Size</MenuGroupLabel>
            <MenuRadioGroup value={size} onValueChange={(v) => onSize(v as WidgetSize)}>
              {SIZE_ORDER.filter((s) => def.sizes.includes(s)).map((s) => (
                <MenuRadioItem key={s} value={s}>
                  <span className={sx(paint.s11)}>
                    {SIZES[s].label}
                    <span className={sx(paint.s12)}>
                      {SIZES[s].c}×{SIZES[s].r}
                    </span>
                  </span>
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
            <MenuSeparator />
          </>
        )}
        <MenuItem onClick={onRefresh}>
          <RefreshCwIcon />
          Refresh now
        </MenuItem>
        <MenuItem onClick={onCustomize}>
          <LayoutGridIcon />
          Customize Home
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={onRemove}>
          <EyeOffIcon />
          Remove from Home
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}

// useOnScreen says whether el is within (or near) the scrolling view and
// the window is showing: a widget reads its data only then.
export function useOnScreen(el: HTMLElement | null): boolean {
  const [near, setNear] = useState(false);
  const [shown, setShown] = useState(() => typeof document === "undefined" || !document.hidden);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => setNear(entries.some((e) => e.isIntersecting)), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  useEffect(() => {
    const sync = () => setShown(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return near && shown;
}

// WidgetBoundary keeps a widget's error inside its card, with a way to try
// again.
export class WidgetBoundary extends Component<{ title: string; children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Home widget ${this.props.title} failed`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <WidgetEmpty scene="storm" title={`${this.props.title} hit an error`} hint={this.state.error.message} action="Try again" onAction={() => this.setState({ error: undefined })} compact hold />;
  }
}

// Quiet drops what a count throws: a heading never breaks over a badge.
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
