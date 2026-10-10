import * as stylex from "@stylexjs/stylex";
import { invoke } from "@/lib/desktop";
import { BanIcon, BugIcon, ChevronRightIcon, CircleXIcon, InfoIcon, SendIcon, SquareDashedMousePointerIcon, SquareTerminalIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import type { BrowserContext } from "@/lib/browser-url";
import { clearLog, type PaneLog, setDrawerTab, toggleDrawer, useDrawerOpen, useDrawerTab, useErrorCount, useErrorCountOf, useLog } from "@/lib/devtools";
import { badgeText, type ConsoleEntry, consoleMessage, failed, formatMs, formatSize, isError, type NetEntry, requestMessage, shortAt, statusText } from "@/lib/devtools-model";
import { useAgentTarget } from "@/lib/agent-target";
import { keysFor } from "@/lib/shortcuts";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "width": "26px",
    "height": "26px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":disabled:hover": "transparent",
    },
    "opacity": {
      ":disabled": 0.35,
    },
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
  s1: {
    "position": "relative",
    "display": "inline-flex",
    "height": "26px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":disabled:hover": "transparent",
    },
    "opacity": {
      ":disabled": 0.35,
    },
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
  s2: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s3: {
    "display": "inline-flex",
    "height": "14px",
    "minWidth": "14px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "var(--destructive)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 500,
    "fontSize": "9.5px",
    "color": "#fff",
    "fontVariantNumeric": "tabular-nums",
    "lineHeight": "1",
  },
  s4: {
    "display": "inline-flex",
    "flexShrink": 0,
  },
  s5: {
    "position": "relative",
    "display": "flex",
    "maxHeight": "75%",
    "minHeight": "120px",
    "flexShrink": 0,
    "flexDirection": "column",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s6: {
    "position": "absolute",
    "left": 0,
    "right": 0,
    "zIndex": 10,
    "height": "8px",
    "cursor": "row-resize",
    "outline": "none",
    "backgroundColor": {
      ":focus-visible": "var(--ring)",
    },
  },
  s7: {
    "display": "flex",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "2px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s9: {
    "marginLeft": "8px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s10: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "2px",
  },
  s11: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
  s12: {
    "display": "inline-flex",
    "width": "24px",
    "height": "24px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
    ":not(#\\#) svg": {
      "width": "14px",
      "height": "14px",
    },
  },
  s13: {
    "display": "inline-flex",
    "height": "24px",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontWeight": 500,
    "fontSize": "11.5px",
  },
  s14: {
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s15: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s16: {
    "display": "inline-flex",
    "height": "22px",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "11px",
    "fontVariantNumeric": "tabular-nums",
  },
  s17: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 10%, transparent)",
    "color": "var(--foreground)",
  },
  s18: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s19: {
    "display": "flex",
    "height": "30px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 30%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
  },
  s20: {
    "height": "22px",
    "width": "144px",
    "minWidth": "0px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":focus": "var(--ring)",
    },
    "backgroundColor": "var(--background)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "11px",
    "outline": "none",
    "color": {
      "::placeholder": "color-mix(in oklab, var(--muted-foreground) 70%, transparent)",
    },
  },
  s21: {
    "marginLeft": "2px",
    "marginRight": "2px",
    "height": "14px",
    "width": "1px",
    "backgroundColor": "var(--border)",
  },
  s22: {
    "width": "12px",
    "height": "12px",
    "color": "var(--destructive)",
  },
  s23: {
    "width": "12px",
    "height": "12px",
    "color": "var(--warning)",
  },
  s24: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11.5px",
    "lineHeight": "1.45",
  },
  s25: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "color": "var(--muted-foreground)",
  },
  s26: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "fontFamily": "var(--font-sans)",
    "color": "var(--muted-foreground)",
  },
  s27: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 7%, transparent)",
    "color": "var(--destructive-foreground)",
    "borderColor": "color-mix(in oklab, var(--destructive) 15%, transparent)",
  },
  s28: {
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "color": "var(--warning-foreground)",
    "borderColor": "color-mix(in oklab, var(--warning) 20%, transparent)",
  },
  s29: {
    "color": "var(--muted-foreground)",
  },
  s30: {
    "marginTop": "1px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--destructive)",
  },
  s31: {
    "marginTop": "1px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--warning)",
  },
  s32: {
    "marginTop": "1px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--info)",
  },
  s33: {
    "marginTop": "1px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "opacity": 0.6,
  },
  s34: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s35: {
    "position": "relative",
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "borderColor": "color-mix(in oklab, var(--border) 60%, transparent)",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "paddingRight": "8px",
    "paddingLeft": "8px",
  },
  s36: {
    "boxShadow": "inset 2px 0 0 var(--color-ring)",
  },
  s37: {
    "marginTop": "1px",
    "display": "inline-flex",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "opacity": {
      "default": 0.7,
      ":hover": 1,
    },
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--foreground) 10%, transparent)",
    },
  },
  s38: {
    "width": "12px",
    "height": "12px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s39: {
    "transform": "rotate(90deg)",
  },
  s40: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s41: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s42: {
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
  },
  s43: {
    "cursor": "pointer",
  },
  s44: {
    "marginTop": "2px",
    "whiteSpace": "pre-wrap",
    "wordBreak": "break-all",
    "paddingLeft": "8px",
    "fontSize": "11px",
    "opacity": 0.75,
  },
  s45: {
    "marginTop": "1px",
    "flexShrink": 0,
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 10%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontSize": "10px",
    "fontVariantNumeric": "tabular-nums",
  },
  s46: {
    "wordBreak": "break-all",
    "fontFamily": "var(--font-mono)",
  },
  s47: {
    "marginTop": "1px",
    "maxWidth": "192px",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "textDecoration": "underline",
  },
  s48: {
    "marginTop": "calc(2px * -1)",
    "marginBottom": "calc(2px * -1)",
    "display": "inline-flex",
    "height": "20px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "var(--background)",
      ":hover": "var(--accent)",
    },
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "fontFamily": "var(--font-sans)",
    "fontSize": "10.5px",
    "color": "var(--foreground)",
    "opacity": {
      "default": 0,
      ":focus-visible": 1,
    },
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
    ":is(.group:hover &)": {
      "opacity": 1,
    },
  },
  s49: {
    "width": "12px",
    "height": "12px",
  },
  s50: {
    "width": "12px",
    "height": "12px",
    "color": "var(--destructive)",
  },
  s51: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
    "fontSize": "11.5px",
  },
  s52: {
    "position": "sticky",
    "top": "0px",
    "zIndex": NaN,
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontWeight": 500,
    "fontSize": "10.5px",
    "color": "var(--muted-foreground)",
  },
  s53: {
    "textAlign": "right",
  },
  s54: {
    "textAlign": "right",
  },
  s55: {
    "width": "5.75rem",
  },
  s56: {
    "cursor": "default",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "borderColor": "color-mix(in oklab, var(--border) 60%, transparent)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontFamily": "var(--font-mono)",
  },
  s57: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 7%, transparent)",
    "color": "var(--destructive-foreground)",
  },
  s58: {
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 50%, transparent)",
    },
  },
  s59: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 60%, transparent)",
  },
  s60: {
    "boxShadow": "inset 2px 0 0 var(--color-ring)",
  },
  s61: {
    "fontVariantNumeric": "tabular-nums",
  },
  s62: {
    "color": "var(--muted-foreground)",
  },
  s63: {
    "color": "var(--muted-foreground)",
  },
  s64: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s65: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s66: {
    "color": "var(--muted-foreground)",
  },
  s67: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
  },
  s68: {
    "textAlign": "right",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s69: {
    "textAlign": "right",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s70: {
    "display": "flex",
    "width": "5.75rem",
    "justifyContent": "flex-end",
  },
  s71: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
    "color": "var(--muted-foreground)",
  },
  s72: {
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "4px",
    },
  },
  s73: {
    "wordBreak": "break-all",
  },
  s74: {
    "color": "var(--muted-foreground)",
  },
  s75: {
    "color": "var(--destructive-foreground)",
  },
  s76: {
    "maxHeight": "128px",
    "overflow": "auto",
    "whiteSpace": "pre-wrap",
    "wordBreak": "break-all",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "padding": "6px",
  },
  s77: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--accent) 50%, transparent)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s78: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s79: {
    "maxHeight": "256px",
    "overflow": "hidden",
    "whiteSpace": "pre-wrap",
    "wordBreak": "break-all",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s80: {
    "maxWidth": "40%",
    "flexShrink": 0,
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
  },
  s81: {
    "height": "24px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":focus": "var(--ring)",
    },
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "outline": "none",
  },
  s82: {
    "borderRadius": "var(--radius-md)",
    "padding": "4px",
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "var(--accent)",
    },
  },
  s83: {
    "width": "14px",
    "height": "14px",
  },

  s84: {
    top: -4,
  },
  s85: {
    textDecorationStyle: "dotted",
    textUnderlineOffset: 2,
  },
  s86: {
    opacity: { ":is(.group[data-selected=\"true\"] *)": 1 },
  },
  s87: {
    maxWidth: "32rem",
  },
  s88: {
    backgroundColor: "color-mix(in oklab, var(--destructive) 7%, transparent)",
    color: color.destructiveForeground,
    borderColor: "color-mix(in oklab, var(--destructive) 15%, transparent)",
  },
  s89: {
    backgroundColor: "color-mix(in oklab, var(--warning) 8%, transparent)",
    color: "var(--warning-foreground)",
    borderColor: "color-mix(in oklab, var(--warning) 20%, transparent)",
  },
  s90: {
    color: color.mutedForeground,
  },
  s91: {
    display: "grid",
    gridTemplateColumns: "4rem 3.25rem minmax(0,1fr) 4.5rem 4rem 4.25rem auto",
    alignItems: "center",
    columnGap: 8,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The Browser tab's developer tools: WebKit's own Web Inspector for the
// native page (Inspect), and Burf's Console and Network drawer under the
// page, whose rows go to the worktree's agent in a click.

// Tooltips in the drawer open downward: above it is the page, which in the
// app is a native view that would cover them.
const DOWN = "bottom" as const;

// InspectButton opens WebKit's Web Inspector for the pane's native page, in
// a window of its own. A frame (outside the Burf app) has none.
export function InspectButton({ id, native, disabled }: { id: string; native: boolean; disabled?: boolean }) {
  const label = native ? "Inspect: the Web Inspector for this page (or right-click it → Inspect Element)" : "The Web Inspector is in the Burf app's own browser";
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label="Inspect"
        disabled={disabled || !native}
        onClick={() => void invoke("browser_inspect", { id }).catch((err) => toastManager.add({ type: "error", title: "Couldn't open the Web Inspector", description: String(err) }))}
        className={sx(paint.s0)}
      >
        <SquareDashedMousePointerIcon />
      </button>
    </Tip>
  );
}

// DevtoolsToggle shows and hides the drawer, with the page's error count.
export function DevtoolsToggle({ logKey, disabled }: { logKey: string; disabled?: boolean }) {
  const open = useDrawerOpen(logKey);
  const errors = useErrorCount(logKey);
  const keys = keysFor("devtools");
  const label = `Console and network${keys ? ` (${keys})` : ""}${errors ? ` · ${errors} error${errors === 1 ? "" : "s"} since the page loaded` : ""}`;
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label="Console and network"
        aria-pressed={open}
        data-testid="devtools-toggle"
        disabled={disabled}
        onClick={() => toggleDrawer(logKey)}
        className={[sx(paint.s1), open && sx(paint.s2)].filter(Boolean).join(" ")}
      >
        <SquareTerminalIcon />
        {errors > 0 && <ErrorBadge n={errors} testId="devtools-badge" />}
      </button>
    </Tip>
  );
}

function ErrorBadge({ n, testId, className }: { n: number; testId?: string; className?: string }) {
  return (
    <span data-testid={testId} className={[sx(paint.s3), className].filter(Boolean).join(" ")}>
      {badgeText(n)}
    </span>
  );
}

// TabErrorBadge is the count on a Browser tab in the tab strip: its panes'
// page errors since they loaded.
export function TabErrorBadge({ paneIds }: { paneIds: string[] }) {
  const n = useErrorCountOf(paneIds);
  if (!n) return null;
  // The tab is a tooltip's trigger already: the count says it all.
  return (
    <span role="img" aria-label={`${n} page error${n === 1 ? "" : "s"}`} className={sx(paint.s4)}>
      <ErrorBadge n={n} testId="tab-devtools-badge" />
    </span>
  );
}

type Sending = { kind: "console"; entry: ConsoleEntry } | { kind: "request"; entry: NetEntry };

const HEIGHT_KEY = "berth.devtools.height";

function savedHeight(): number {
  try {
    const n = Number(localStorage.getItem(HEIGHT_KEY));
    return n >= 120 && n <= 2000 ? n : 260;
  } catch {
    return 260;
  }
}

export interface DrawerProps {
  logKey: string;
  // The page the entries are from, for what the agent is sent.
  pageUrl: string;
  ctx: BrowserContext;
  // The page's requests can be listed: it goes through the laptop's proxy.
  proxied: boolean;
  // The agent's own browser's log, from its box: read only, no clear.
  agent?: boolean;
}

// DevtoolsDrawer is the Console and Network drawer under the page.
export function DevtoolsDrawer({ logKey, pageUrl, ctx, proxied, agent }: DrawerProps) {
  const log = useLog(logKey);
  const tab = useDrawerTab(logKey);
  const [height, setHeight] = useState(savedHeight);
  const [sending, setSending] = useState<Sending>();
  const root = useRef<HTMLElement>(null);
  const consoleErrors = useMemo(() => (log?.console ?? []).reduce((n, e) => n + (isError(e) ? e.count : 0), 0), [log?.console]);
  const failures = useMemo(() => (log?.network ?? []).filter(failed).length, [log?.network]);

  useEffect(() => setSending(undefined), [logKey]);

  // Drag the top edge to resize; the page above follows.
  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const start = height;
    const max = Math.max(160, (root.current?.parentElement?.clientHeight ?? 800) - 120);
    const move = (ev: PointerEvent) => setHeight(Math.round(Math.min(max, Math.max(120, start + startY - ev.clientY))));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const h = Math.round(Math.min(max, Math.max(120, start + startY - ev.clientY)));
      try {
        localStorage.setItem(HEIGHT_KEY, String(h));
      } catch {
        // Only a convenience.
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  // Or focus the edge: ↑ and ↓ (⇧ for bigger steps), Home and End.
  const nudge = (e: React.KeyboardEvent) => {
    const max = Math.max(160, (root.current?.parentElement?.clientHeight ?? 800) - 120);
    const step = e.shiftKey ? 64 : 16;
    const next = e.key === "ArrowUp" ? height + step : e.key === "ArrowDown" ? height - step : e.key === "Home" ? 120 : e.key === "End" ? max : undefined;
    if (next === undefined) return;
    e.preventDefault();
    const h = Math.round(Math.min(max, Math.max(120, next)));
    setHeight(h);
    try {
      localStorage.setItem(HEIGHT_KEY, String(h));
    } catch {
      // Only a convenience.
    }
  };

  return (
    <section ref={root} data-testid="devtools-drawer" aria-label="Console and network" style={{ height }} className={sx(paint.s5)}>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label="Resize the drawer"
        aria-valuenow={height}
        aria-valuemin={120}
        onPointerDown={drag}
        onKeyDown={nudge}
        className={[sx(paint.s6), sx(paint.s84)].filter(Boolean).join(" ")}
      />
      <div className={sx(paint.s7)}>
        <div
          role="tablist"
          aria-label="Console and network"
          className={sx(paint.s8)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const next = tab === "console" ? "network" : "console";
            setDrawerTab(logKey, next);
            e.currentTarget.querySelector<HTMLElement>(`[data-drawer-tab=${next}]`)?.focus();
          }}
        >
          <DrawerTab id="console" active={tab === "console"} onClick={() => setDrawerTab(logKey, "console")} count={consoleErrors}>
            Console
          </DrawerTab>
          <DrawerTab id="network" active={tab === "network"} onClick={() => setDrawerTab(logKey, "network")} count={failures}>
            Network
          </DrawerTab>
        </div>
        {agent && <span className={sx(paint.s9)}>The agent's browser, on its box</span>}
        <div className={sx(paint.s10)}>
          {!agent && (
            <Tip label={tab === "console" ? "Clear the console" : "Clear the requests"} side={DOWN}>
              <button type="button" aria-label="Clear" onClick={() => clearLog(logKey, tab)} className={sx(paint.s11)}>
                <BanIcon />
              </button>
            </Tip>
          )}
          <Tip label={`Close${keysFor("devtools") ? ` (${keysFor("devtools")})` : ""}`} side={DOWN}>
            <button type="button" aria-label="Close the drawer" onClick={() => toggleDrawer(logKey, false)} className={sx(paint.s12)}>
              <XIcon />
            </button>
          </Tip>
        </div>
      </div>
      {sending && <Sender sending={sending} pageUrl={pageUrl} ctx={ctx} agent={agent} onDone={() => setSending(undefined)} />}
      {tab === "console" ? (
        <ConsoleList log={log} agent={agent} sending={sending?.kind === "console" ? sending.entry : undefined} onSend={(entry) => setSending({ kind: "console", entry })} />
      ) : (
        <NetworkList log={log} pageUrl={pageUrl} proxied={proxied || !!agent} agent={agent} sending={sending?.kind === "request" ? sending.entry : undefined} onSend={(entry) => setSending({ kind: "request", entry })} />
      )}
    </section>
  );
}

function DrawerTab({ id, active, onClick, count, children }: { id: string; active: boolean; onClick(): void; count: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      data-drawer-tab={id}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={[sx(paint.s13), active ? sx(paint.s14) : sx(paint.s15)].filter(Boolean).join(" ")}
    >
      {children}
      {count > 0 && <ErrorBadge n={count} />}
    </button>
  );
}

// Chips filter a list: by level, or failed only.
function Chip({ on, onClick, children, label }: { on: boolean; onClick(): void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={[sx(paint.s16), on ? sx(paint.s17) : sx(paint.s18)].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}

function FilterBar({ children, filter, onFilter }: { children: React.ReactNode; filter: string; onFilter(v: string): void }) {
  return (
    <div className={sx(paint.s19)}>
      <input
        aria-label="Filter"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        placeholder="Filter"
        spellCheck={false}
        className={sx(paint.s20)}
      />
      <span className={sx(paint.s21)} />
      {children}
    </div>
  );
}

type LevelFilter = "all" | "error" | "warn" | "info";

function ConsoleList({ log, agent, sending, onSend }: { log?: PaneLog; agent?: boolean; sending?: ConsoleEntry; onSend(e: ConsoleEntry): void }) {
  const [level, setLevel] = useState<LevelFilter>("all");
  const [filter, setFilter] = useState("");
  const list = log?.console ?? [];
  const count = (l: ConsoleEntry["level"]) => list.reduce((n, e) => n + (e.level === l ? e.count : 0), 0);
  const shown = list.filter(
    (e) => (level === "all" || e.level === level || (level === "info" && (e.level === "log" || e.level === "debug"))) && (!filter || e.text.toLowerCase().includes(filter.toLowerCase())),
  );
  const end = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Follow new lines while scrolled to the end, as a console does.
  const pinned = useRef(true);
  useEffect(() => {
    if (pinned.current) end.current?.scrollIntoView({ block: "end" });
  }, [shown.length]);
  return (
    <>
      <FilterBar filter={filter} onFilter={setFilter}>
        <Chip on={level === "all"} onClick={() => setLevel("all")}>
          All
        </Chip>
        <Chip on={level === "error"} onClick={() => setLevel("error")} label="Errors">
          <CircleXIcon className={sx(paint.s22)} />
          Errors {count("error")}
        </Chip>
        <Chip on={level === "warn"} onClick={() => setLevel("warn")} label="Warnings">
          <TriangleAlertIcon className={sx(paint.s23)} />
          Warnings {count("warn")}
        </Chip>
        <Chip on={level === "info"} onClick={() => setLevel("info")} label="Logs">
          Logs {count("info") + count("log") + count("debug")}
        </Chip>
      </FilterBar>
      <div
        ref={scroller}
        role="log"
        aria-label="Console"
        data-testid="devtools-console"
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className={sx(paint.s24)}
      >
        {log?.dropped ? <p className={sx(paint.s25)}>{log.dropped} earlier messages were dropped: the page logged faster than they could be kept.</p> : null}
        {shown.map((e) => (
          <ConsoleRow key={rowKey(e)} e={e} sending={e === sending} onSend={onSend} />
        ))}
        {!shown.length && (
          <p className={sx(paint.s26)}>
            {list.length
              ? "Nothing matches the filter."
              : agent
                ? "The agent's page hasn't logged anything."
                : log?.heard
                  ? "Nothing logged since the page loaded. What it logs, and any error it throws, shows here."
                  : "Waiting for the page. Its console shows here once it loads in the Burf app, or through a worktree's address."}
          </p>
        )}
        <div ref={end} />
      </div>
    </>
  );
}

const LEVEL_STYLE: Record<ConsoleEntry["level"], string> = {
  error: (sx(paint.s88) ?? ""),
  warn: (sx(paint.s89) ?? ""),
  info: "",
  log: "",
  debug: (sx(paint.s90) ?? ""),
};

function LevelIcon({ level }: { level: ConsoleEntry["level"] }) {
  if (level === "error") return <CircleXIcon aria-label="Error" className={sx(paint.s30)} />;
  if (level === "warn") return <TriangleAlertIcon aria-label="Warning" className={sx(paint.s31)} />;
  if (level === "info") return <InfoIcon aria-label="Info" className={sx(paint.s32)} />;
  if (level === "debug") return <BugIcon aria-label="Debug" className={sx(paint.s33)} />;
  return <span className={sx(paint.s34)} />;
}

// Each entry's row keeps its key while newer lines push older ones out of
// the kept list (lib/devtools-model, CONSOLE_LIMIT): keyed by place, a page
// logging once a second remade every row of a full console every second.
const rowKeys = new WeakMap<ConsoleEntry, number>();
let nextRowKey = 0;
function rowKey(e: ConsoleEntry): number {
  let k = rowKeys.get(e);
  if (k === undefined) rowKeys.set(e, (k = ++nextRowKey));
  return k;
}

// A row draws again only when its entry or selection changes, not for each
// new line below it. onSend is the drawer's, which only sets state.
const ConsoleRow = memo(ConsoleRowView, (a, b) => a.e === b.e && a.sending === b.sending);

function ConsoleRowView({ e, sending, onSend }: { e: ConsoleEntry; sending: boolean; onSend(e: ConsoleEntry): void }) {
  const [open, setOpen] = useState(false);
  const stack = !!e.stack;
  const sendable = e.level === "error" || e.level === "warn";
  return (
    <div data-testid="console-row" data-level={e.level} data-selected={sending} className={[[sx(paint.s35), "group"].filter(Boolean).join(" "), LEVEL_STYLE[e.level], sending && sx(paint.s36)].filter(Boolean).join(" ")}>
      <LevelIcon level={e.level} />
      {stack ? (
        <button type="button" aria-label={open ? "Hide the stack" : "Show the stack"} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={sx(paint.s37)}>
          <ChevronRightIcon className={[sx(paint.s38), open && sx(paint.s39)].filter(Boolean).join(" ")} />
        </button>
      ) : (
        <span className={sx(paint.s40)} />
      )}
      <div className={sx(paint.s41)}>
        <div className={[sx(paint.s42), stack && sx(paint.s43)].filter(Boolean).join(" ")} onClick={stack ? () => setOpen((o) => !o) : undefined}>
          {e.text}
        </div>
        {open && e.stack && <pre className={sx(paint.s44)}>{e.stack}</pre>}
      </div>
      {e.count > 1 && <span className={sx(paint.s45)}>{e.count}</span>}
      {e.at && (
        <Tip label={<span className={sx(paint.s46)}>{e.at}</span>} side={DOWN} width="md">
          <span className={[sx(paint.s47), sx(paint.s85)].filter(Boolean).join(" ")}>{shortAt(e.at)}</span>
        </Tip>
      )}
      {sendable && <SendButton onClick={() => onSend(e)} />}
    </div>
  );
}

function SendButton({ onClick }: { onClick(): void }) {
  return (
    <Tip label="Send this to the worktree's agent, with the page's address" side={DOWN}>
      <button
        type="button"
        aria-label="Send to agent"
        onClick={(ev) => {
          ev.stopPropagation();
          onClick();
        }}
        className={[sx(paint.s48), sx(paint.s86)].filter(Boolean).join(" ")}
      >
        <SendIcon className={sx(paint.s49)} />
        Send to agent
      </button>
    </Tip>
  );
}

const COLS = (sx(paint.s91) ?? "");

function NetworkList({ log, pageUrl, proxied, agent, sending, onSend }: { log?: PaneLog; pageUrl: string; proxied: boolean; agent?: boolean; sending?: NetEntry; onSend(n: NetEntry): void }) {
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number>();
  const list = log?.network ?? [];
  const failures = list.filter(failed).length;
  const pageHost = (() => {
    try {
      return new URL(pageUrl).hostname;
    } catch {
      return "";
    }
  })();
  const shown = list.filter((n) => (!onlyFailed || failed(n)) && (!filter || `${n.method} ${n.host}${n.path} ${n.status} ${n.type}`.toLowerCase().includes(filter.toLowerCase())));
  return (
    <>
      <FilterBar filter={filter} onFilter={setFilter}>
        <Chip on={!onlyFailed} onClick={() => setOnlyFailed(false)}>
          All {list.length}
        </Chip>
        <Chip on={onlyFailed} onClick={() => setOnlyFailed(true)} label="Failed">
          <CircleXIcon className={sx(paint.s50)} />
          Failed {failures}
        </Chip>
      </FilterBar>
      <div role="table" aria-label="Requests" data-testid="devtools-network" className={sx(paint.s51)}>
        {proxied && list.length > 0 && (
          <div role="row" className={[COLS, sx(paint.s52)].filter(Boolean).join(" ")}>
            <span role="columnheader">Status</span>
            <span role="columnheader">Method</span>
            <span role="columnheader">Path</span>
            <span role="columnheader">Type</span>
            <span role="columnheader" className={sx(paint.s53)}>
              Time
            </span>
            <span role="columnheader" className={sx(paint.s54)}>
              Size
            </span>
            <span className={sx(paint.s55)} />
          </div>
        )}
        {shown.map((n) => {
          const bad = failed(n);
          const open = selected === n.seq;
          return (
            <div key={`${n.seq}:${n.path}`} role="rowgroup">
              <div
                role="row"
                data-testid="network-row"
                data-failed={bad}
                data-selected={open}
                aria-selected={open}
                onClick={() => setSelected(open ? undefined : n.seq)}
                className={[COLS, [sx(paint.s56), "group"].filter(Boolean).join(" "), bad ? sx(paint.s57) : sx(paint.s58), open && !bad && sx(paint.s59), (open || n === sending) && sx(paint.s60)].filter(Boolean).join(" ")}
              >
                <span role="cell" className={[sx(paint.s61), !bad && n.status >= 300 && sx(paint.s62), n.error === "canceled" && sx(paint.s63)].filter(Boolean).join(" ")}>
                  {statusText(n)}
                </span>
                <span role="cell" className={sx(paint.s64)}>
                  {n.method}
                </span>
                <span role="cell" className={sx(paint.s65)}>
                  {n.host && n.host !== pageHost && <span className={sx(paint.s66)}>{n.host}</span>}
                  {n.path}
                </span>
                <span role="cell" className={sx(paint.s67)}>
                  {n.type}
                </span>
                <span role="cell" className={sx(paint.s68)}>
                  {n.start || n.ms ? formatMs(n.ms) : ""}
                </span>
                <span role="cell" className={sx(paint.s69)}>
                  {n.start || n.size ? formatSize(n.size) : ""}
                </span>
                <span role="cell" className={sx(paint.s70)}>
                  {bad && <SendButton onClick={() => onSend(n)} />}
                </span>
              </div>
              {open && <RequestDetail n={n} pageUrl={pageUrl} />}
            </div>
          );
        })}
        {!shown.length && (
          <p className={sx(paint.s71)}>
            {list.length
              ? "Nothing matches the filter."
              : agent
                ? "No failed requests in the agent's browser."
                : proxied
                  ? "No requests since the page loaded."
                  : "Requests show here for a worktree's page, which goes through Burf's proxy. This page doesn't: use the Web Inspector's Network tab for it."}
          </p>
        )}
      </div>
    </>
  );
}

function RequestDetail({ n, pageUrl }: { n: NetEntry; pageUrl: string }) {
  const box = useRef<HTMLDivElement>(null);
  // Opened at the foot of the list, it scrolls into view.
  // (A block body: scrollIntoView may return a promise, which an effect
  // must not.)
  useEffect(() => {
    box.current?.scrollIntoView({ block: "nearest" });
  }, []);
  let url = n.path;
  try {
    const page = new URL(pageUrl);
    url = n.host ? `${page.protocol}//${n.host}${page.port && !n.host.includes(":") ? `:${page.port}` : ""}${n.path}` : n.path;
  } catch {
    // The path alone.
  }
  return (
    <div ref={box} className={sx(paint.s72)}>
      <p className={sx(paint.s73)}>{url}</p>
      <p className={sx(paint.s74)}>
        {statusText(n)}
        {n.mime ? ` · ${n.mime}` : ""}
        {n.start ? ` · ${new Date(n.start).toLocaleTimeString()}` : ""}
      </p>
      {n.error && n.error !== "canceled" && <p className={sx(paint.s75)}>{n.error}</p>}
      {n.body && <pre className={sx(paint.s76)}>{n.body}</pre>}
    </div>
  );
}

// Sender sends a console entry or a request to the worktree's agent, with
// an optional note.
function Sender({ sending, pageUrl, ctx, agent, onDone }: { sending: Sending; pageUrl: string; ctx: BrowserContext; agent?: boolean; onDone(): void }) {
  const ref = ctx.ref;
  const target = useAgentTarget(ref);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const page = agent ? `${pageUrl} (in your own browser on the box)` : pageUrl;
  const message = sending.kind === "console" ? consoleMessage(sending.entry, page, note) : requestMessage(sending.entry, page, note);
  const summary = sending.kind === "console" ? sending.entry.text : `${sending.entry.method} ${sending.entry.path} → ${statusText(sending.entry)}`;
  const submit = async () => {
    if (!target || target.blocked) return;
    setBusy(true);
    try {
      await target.send(message);
      toastManager.add({ type: "success", title: "Sent to the agent", description: summary.slice(0, 120) });
      onDone();
    } catch (err) {
      toastManager.add({ type: "error", title: "Couldn't send it", description: String(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      data-testid="devtools-sender"
      className={sx(paint.s77)}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <SendIcon className={sx(paint.s78)} />
      <Tip label={<pre className={[sx(paint.s79), sx(paint.s87)].filter(Boolean).join(" ")}>{message}</pre>} side={DOWN} width="lg">
        <span className={sx(paint.s80)}>{summary}</span>
      </Tip>
      <input
        autoFocus
        aria-label="A note for the agent"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={target ? (target.blocked ?? "Add a note (optional)") : "No agent runs in this worktree"}
        disabled={!target || !!target.blocked}
        className={sx(paint.s81)}
      />
      <Button type="submit" size="xs" disabled={!target || !!target.blocked || busy}>
        <SendIcon />
        Send to agent
      </Button>
      <button type="button" aria-label="Cancel" className={sx(paint.s82)} onClick={onDone}>
        <XIcon className={sx(paint.s83)} />
      </button>
    </form>
  );
}
