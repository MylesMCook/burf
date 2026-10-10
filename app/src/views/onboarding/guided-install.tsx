import * as stylex from "@stylexjs/stylex";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, CircleIcon, CopyIcon, KeyRoundIcon, LaptopIcon, MinusIcon, RotateCwIcon, ServerIcon, ShieldCheckIcon, SquareTerminalIcon, XIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Tip } from "@/components/tip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { toastManager } from "@/components/ui/toast";
import { useActiveTheme } from "@/hooks/use-theme";
import { useMediaQuery } from "@/hooks/use-media-query";
import { type AgentChoice, boxApi, type GuidedInstallRequest, type InstallEvent, type InstallPlan, type InstallPlanStep, laptopApi, type SshFailure, type TerminalConnection } from "@/lib/api";
import { useCustomTerminalPrefs } from "@/lib/custom-fonts";
import { plainError } from "@/lib/errors";
import { openUrl } from "@/lib/open-url";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { createTerminal, type TermHandle } from "@/lib/terminal";
import { FailurePanel } from "@/views/onboarding/ssh-setup";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "position": "fixed",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "zIndex": 50,
    "backgroundColor": "var(--background)",
  },
  s1: {
    "position": "fixed",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "zIndex": 50,
    "display": "flex",
    "flexDirection": "column",
    "backgroundColor": "var(--background)",
    "color": "var(--foreground)",
    "outline": "none",
  },
  s2: {
    "display": "flex",
    "height": "56px",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "20px",
    "paddingRight": "20px",
  },
  s3: {
    "display": "flex",
    "width": "32px",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "color": "var(--muted-foreground)",
  },
  s4: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s5: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 600,
    "fontSize": "15px",
    "lineHeight": "1.25",
  },
  s6: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "width": "16px",
    "height": "16px",
  },
  s8: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
  },
  s9: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "grid",
    "width": "100%",
    "columnGap": "40px",
    "rowGap": "32px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "28px",
    "paddingBottom": "40px",
  },
  s10: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s11: {
    "marginTop": "2px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s12: {
    "display": "flex",
    "alignItems": "baseline",
    "gap": "8px",
  },
  s13: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s14: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s15: {
    "marginTop": "8px",
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s16: {
    "marginTop": "12px",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s17: {
    "marginTop": "12px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    ":not(#\\#) > :not(:first-child)": {
      "borderTopWidth": 1,
      "borderTopStyle": "solid",
      "borderTopColor": "var(--border)",
    },
  },
  s18: {
    "flexShrink": 0,
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--background) 95%, transparent)",
  },
  s19: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "width": "100%",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "12px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s20: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "flex-start",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s21: {
    "marginTop": "2px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s22: {
    "color": "var(--foreground)",
  },
  s23: {
    "marginTop": "12px",
    "height": "200px",
  },
  s24: {
    "marginTop": "12px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s25: {
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "flex-start",
    "gap": "10px",
    "borderBottomWidth": {
      "default": 1,
      ":last-child": 0,
    },
    "borderBottomStyle": {
      "default": "solid",
      ":last-child": "solid",
    },
    "borderBottomColor": {
      "default": "var(--border)",
      ":last-child": "var(--border)",
    },
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
  },
  s26: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 30%, transparent)",
  },
  s27: {
    "cursor": "default",
    "backgroundColor": {
      ":hover": "transparent",
    },
  },
  s28: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s29: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "13px",
  },
  s30: {
    "marginTop": "2px",
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.375",
  },
  s31: {
    "marginTop": "10px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s32: {
    "color": "var(--foreground)",
  },
  s33: {
    "fontFamily": "var(--font-mono)",
    "fontSize": "11.5px",
  },
  s34: {
    "display": "flex",
    "width": "100%",
    "alignItems": "flex-start",
    "gap": "12px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "textAlign": "left",
    "outline": "none",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 30%, transparent)",
      ":focus-visible": "color-mix(in oklab, var(--accent) 40%, transparent)",
    },
  },
  s35: {
    "marginTop": "1px",
    "display": "flex",
    "width": "20px",
    "height": "20px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s36: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s37: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "8px",
    "rowGap": "4px",
  },
  s38: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s39: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s40: {
    "marginTop": "2px",
    "display": "block",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s41: {
    "marginTop": "2px",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "8px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s42: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s43: {
    "width": "12px",
    "height": "12px",
  },
  s44: {
    "width": "12px",
    "height": "12px",
  },
  s45: {
    "width": "14px",
    "height": "14px",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
  },
  s46: {
    "transform": "rotate(90deg)",
  },
  s47: {
    "marginLeft": "48px",
    "marginRight": "16px",
    "marginBottom": "12px",
    "overflowX": "auto",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--muted) 60%, transparent), color-mix(in oklab, var(--input) 24%, transparent))",
    },
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s48: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s49: {
    "width": "16px",
    "height": "16px",
  },
  s50: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s51: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s52: {
    "flexDirection": "column",
  },
  s53: {
    "flexDirection": "row",
  },
  s54: {
    "flexShrink": 0,
    "overflowY": "auto",
  },
  s55: {
    "maxHeight": "38%",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
  },
  s56: {
    "width": "320px",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s57: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingBottom": "16px",
  },
  s58: {
    "marginLeft": "16px",
    "marginRight": "16px",
    "marginTop": "8px",
    "marginBottom": "16px",
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "6px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingTop": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s59: {
    "marginTop": "2px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s60: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingBottom": "16px",
  },
  s61: {
    "display": "flex",
    "minHeight": "0px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s62: {
    "display": "flex",
    "width": "20px",
    "height": "20px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
  },
  s63: {
    "borderColor": "var(--success)",
    "backgroundColor": "var(--success)",
    "color": "#fff",
  },
  s64: {
    "borderColor": "var(--destructive)",
    "backgroundColor": "var(--destructive)",
    "color": "#fff",
  },
  s65: {
    "borderColor": "color-mix(in oklab, var(--foreground) 40%, transparent)",
  },
  s66: {
    "borderStyle": "dashed",
    "color": "var(--muted-foreground)",
  },
  s67: {
    "color": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s68: {
    "width": "12px",
    "height": "12px",
  },
  s69: {
    "width": "12px",
    "height": "12px",
  },
  s70: {
    "width": "12px",
    "height": "12px",
  },
  s71: {
    "width": "6px",
    "height": "6px",
    "fill": "currentColor",
  },
  s72: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s73: {
    "display": "grid",
    "gridTemplateColumns": "repeat(2, minmax(0, 1fr))",
    "columnGap": "8px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s74: {
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s75: {
    "backgroundColor": "color-mix(in oklab, var(--accent) 50%, transparent)",
  },
  s76: {
    "backgroundColor": "color-mix(in oklab, var(--destructive) 6%, transparent)",
  },
  s77: {
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s78: {
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
  },
  s79: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontSize": "13px",
  },
  s80: {
    "color": "var(--muted-foreground)",
  },
  s81: {
    "color": "var(--muted-foreground)",
  },
  s82: {
    "fontWeight": 500,
  },
  s83: {
    "width": "12px",
    "height": "12px",
    "flexShrink": 0,
    "color": "var(--warning-foreground)",
  },
  s84: {
    "marginTop": "2px",
    "marginLeft": "30px",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--warning-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s85: {
    "width": "12px",
    "height": "12px",
  },
  s86: {
    "marginTop": "2px",
    "marginLeft": "30px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s87: {
    "marginTop": "6px",
    "marginLeft": "30px",
    ":not(#\\#) > :not(:first-child)": {
      "marginTop": "8px",
    },
  },
  s88: {
    "gridColumn": "span 2 / span 2",
  },
  s89: {
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s90: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--muted) 40%, transparent), color-mix(in oklab, var(--input) 16%, transparent))",
    },
  },
  s91: {
    "display": "block",
    "overflowX": "auto",
    "whiteSpace": "pre",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11.5px",
    "lineHeight": "1.625",
  },
  s92: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s93: {
    "display": "flex",
    "flexShrink": 0,
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--success) 6%, transparent)",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s94: {
    "display": "flex",
    "width": "32px",
    "height": "32px",
    "flexShrink": 0,
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "var(--success)",
    "color": "#fff",
  },
  s95: {
    "width": "16px",
    "height": "16px",
  },
  s96: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s97: {
    "fontWeight": 500,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s98: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s99: {
    "width": "14px",
    "height": "14px",
  },
  s100: {
    "fontWeight": 500,
  },
  s101: {
    "width": "14px",
    "height": "14px",
  },
  s102: {
    "fontWeight": 500,
  },
  s103: {
    "fontWeight": 500,
  },
  s104: {
    "width": "14px",
    "height": "14px",
  },
  s105: {
    "textDecoration": {
      "default": "underline",
      ":hover": "none",
    },
  },
  s106: {
    "color": "var(--muted-foreground)",
  },
  s107: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "10px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s108: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s109: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "lineHeight": "1.625",
  },
  s110: {
    "position": "relative",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s111: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "overflow": "hidden",
    "paddingTop": "12px",
    "paddingBottom": "8px",
    ":not(#\\#) canvas": {
      "display": "block",
    },
  },
  s112: {
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s113: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
  },
  s114: {
    "position": "fixed",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "zIndex": 50,
    "backgroundColor": "var(--background)",
  },
  s115: {
    "position": "fixed",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "zIndex": 50,
    "display": "flex",
    "flexDirection": "column",
    "backgroundColor": "var(--background)",
    "color": "var(--foreground)",
    "outline": "none",
  },
  s116: {
    "width": "16px",
    "height": "16px",
  },
  s117: {
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowY": "auto",
  },
  s118: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "width": "100%",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "32px",
    "paddingBottom": "40px",
  },
  s119: {
    "color": "var(--destructive-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s120: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s121: {
    "flexShrink": 0,
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
  },
  s122: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "justifyContent": "flex-end",
    "gap": "12px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s123: {
    "width": "16px",
    "height": "16px",
  },
  s124: {
    "display": "flex",
    "minHeight": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s125: {
    "width": "300px",
    "flexShrink": 0,
    "overflowY": "auto",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
  },
  s126: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "1.625",
  },
  s127: {
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "4px",
  },
  s128: {
    "position": "relative",
    "minHeight": "0px",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s129: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "overflow": "hidden",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "12px",
    "paddingBottom": "8px",
    ":not(#\\#) canvas": {
      "display": "block",
    },
  },

  s130: {
    maxWidth: "72rem",
    "@media (min-width: 1100px)": {
      gridTemplateColumns: "340px 1fr",
    },
  },
  s131: {
    maxWidth: "72rem",
  },
  s132: {
    flexBasis: 320,
  },
  s133: {
    flexBasis: 288,
  },
  s134: {
    textUnderlineOffset: 2,
  },
  s135: {
    maxWidth: "28rem",
  },
  s136: {
    backgroundColor: "color-mix(in oklab, var(--warning) 8%, transparent)",
    color: color.foreground,
  },
  s137: {
    backgroundColor: "color-mix(in oklab, var(--info) 8%, transparent)",
    color: color.foreground,
  },
  s138: {
    backgroundColor: "color-mix(in oklab, var(--destructive) 6%, transparent)",
  },
  s139: {
    height: "100%",
    width: "100%",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The guided install: adding a box over SSH as one flow the person can see
// through. First the plan, in words, with the exact commands a click away
// and the steps that need sudo marked, and the agent CLIs to put on the
// box. Then burf add ssh runs in a terminal here, full screen, beside a
// checklist its step markers keep up to date: the person presses Enter to
// start and types their password when sudo asks for it on the box. The
// bytes go straight to the box; Burf never reads, keeps or logs them. A
// failed step offers Retry from it. It ends with Ready.

export interface InstallTarget {
  host: string;
  name?: string;
  network?: string;
  identity?: string;
  trust_host_key?: string;
  // Host key fingerprints the tailnet vouches for: trusted without asking.
  knownHostKeys?: string[];
}

type Stage = "plan" | "run";

export function GuidedInstall({ target, onClose, onReady, readyLabel }: { target: InstallTarget | undefined; onClose(): void; onReady(box: string): void; readyLabel?: string }) {
  const [stage, setStage] = useState<Stage>("plan");
  const [agents, setAgents] = useAgentChoice();
  const run = useInstallRun();
  const busy = run.state === "running";

  useEffect(() => {
    if (!target) {
      setStage("plan");
      run.reset();
    }
    // A new target starts again at the plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.host]);

  const start = () => {
    if (!target) return;
    setStage("run");
    run.start({ ...target, agents, guided: true });
  };

  return (
    <DialogPrimitive.Root
      open={!!target}
      onOpenChange={(open) => {
        // While steps run, closing would cut the box off mid-step: Stop first.
        if (!open && !busy) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={sx(paint.s0)} />
        <DialogPrimitive.Popup aria-label={`Set up ${target?.host ?? "a box"}`} data-testid="guided-install" data-stage={stage} className={sx(paint.s1)}>
          {target && stage === "plan" && <PlanStage target={target} agents={agents} onAgents={setAgents} onStart={start} onClose={onClose} />}
          {target && stage === "run" && (
            <RunStage
              target={target}
              run={run}
              agents={agents}
              onClose={onClose}
              onReady={onReady}
              readyLabel={readyLabel}
              onBack={() => {
                run.reset();
                setStage("plan");
              }}
            />
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// useAgentChoice is the agents to install, remembered for the next box.
export function useAgentChoice(): [string[], (ids: string[]) => void] {
  const saved = usePrefs((p) => p.installAgents);
  const agents = saved ?? ["claude"];
  return [agents, (ids) => setPrefs({ installAgents: ids })];
}

function useInstallPlan(host: string, agents: string[]) {
  const client = useStore((s) => s.client);
  const [plan, setPlan] = useState<InstallPlan>();
  const [error, setError] = useState<string>();
  const key = agents.join(",");
  useEffect(() => {
    if (!client) return;
    let live = true;
    laptopApi.installPlan(client, host, agents).then(
      (p) => {
        if (!live) return;
        setPlan(p);
        setError(undefined);
      },
      (err) => live && setError(plainError(err)),
    );
    return () => {
      live = false;
    };
    // agents by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, host, key]);
  return { plan, error };
}

function Header({ icon, title, sub, right }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <header className={sx(paint.s2)} data-tauri-drag-region>
      <span className={sx(paint.s3)}>{icon}</span>
      <div className={sx(paint.s4)}>
        <h1 className={sx(paint.s5)}>{title}</h1>
        {sub && <p className={sx(paint.s6)}>{sub}</p>}
      </div>
      {right}
    </header>
  );
}

function CloseButton({ onClick, disabled, label = "Close" }: { onClick(): void; disabled?: boolean; label?: string }) {
  return (
    <Tip label={disabled ? "Stop the install first" : label}>
      <Button size="icon-sm" variant="ghost" aria-label={label} disabled={disabled} onClick={onClick}>
        <XIcon />
      </Button>
    </Tip>
  );
}

// ---------------------------------------------------------------- the plan

function PlanStage({ target, agents, onAgents, onStart, onClose }: { target: InstallTarget; agents: string[]; onAgents(ids: string[]): void; onStart(): void; onClose(): void }) {
  const { plan, error } = useInstallPlan(target.host, agents);
  const sudo = plan?.steps.filter((s) => s.sudo) ?? [];
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (plan) primary.current?.focus();
  }, [plan]);
  return (
    <>
      <Header
        icon={<ServerIcon className={sx(paint.s7)} />}
        title={`Set up ${target.host}`}
        sub="Burf installs what this box needs, in a terminal here. Nothing runs until you start it."
        right={<CloseButton onClick={onClose} />}
      />
      <div className={sx(paint.s8)}>
        <div className={[sx(paint.s9), sx(paint.s130)].filter(Boolean).join(" ")}>
          <section aria-labelledby="agents-heading" data-testid="install-agents">
            <h2 id="agents-heading" className={sx(paint.s10)}>
              Agents
            </h2>
            <p className={sx(paint.s11)}>Installed on the box without sudo. You sign in to each the first time it starts.</p>
            <AgentPicker choices={plan?.agents ?? []} value={agents} onChange={onAgents} />
          </section>

          <section aria-labelledby="plan-heading">
            <div className={sx(paint.s12)}>
              <h2 id="plan-heading" className={sx(paint.s13)}>
                What will run
              </h2>
              {plan && <span className={sx(paint.s14)}>{plan.steps.length} steps · each is skipped if the box already has it</span>}
            </div>
            {error && <p className={sx(paint.s15)}>{error}</p>}
            {!plan && !error && (
              <p className={sx(paint.s16)}>
                <Spinner  size="md"/> Reading the plan…
              </p>
            )}
            {plan && (
              <ol data-testid="install-plan" className={sx(paint.s17)}>
                {plan.steps.map((s, i) => (
                  <PlanRow key={s.id} step={s} n={i + 1} bundledTmux={plan.tmux.bundled} />
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
      <footer className={sx(paint.s18)}>
        <div className={[sx(paint.s19), sx(paint.s131)].filter(Boolean).join(" ")}>
          <p className={[sx(paint.s20), sx(paint.s132)].filter(Boolean).join(" ")}>
            <KeyRoundIcon className={sx(paint.s21)} />
            <span>
              {sudo.length > 0 ? (
                <>
                  <span className={sx(paint.s22)}>{sudo.length === 1 ? "One step" : `${sudo.length} steps`} may ask for your password.</span> sudo asks on the box, in the terminal; Burf never sees it or keeps it.
                </>
              ) : (
                "Nothing here needs your password."
              )}
            </span>
          </p>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button ref={primary} data-testid="install-start" disabled={!plan} onClick={onStart}>
            <SquareTerminalIcon /> Open the terminal and install
          </Button>
        </div>
      </footer>
    </>
  );
}

function AgentPicker({ choices, value, onChange, installed = [] }: { choices: AgentChoice[]; value: string[]; onChange(ids: string[]): void; installed?: string[] }) {
  if (!choices.length) return <div className={sx(paint.s23)} />;
  const offered = choices.filter((a) => a.offered || installed.includes(a.id));
  const left = choices.filter((a) => !a.offered && !installed.includes(a.id));
  return (
    <>
      <div className={sx(paint.s24)}>
        {offered.map((a) => {
          const done = installed.includes(a.id);
          const on = done || value.includes(a.id);
          return (
            <label
              key={a.id}
              data-testid={`agent-${a.id}`}
              data-checked={on || undefined}
              className={[sx(paint.s25), on && sx(paint.s26), done && sx(paint.s27)].filter(Boolean).join(" ")}
            >
              <Checkbox
                offset
                checked={on}
                disabled={done}
                onCheckedChange={(c) => onChange(c ? [...value.filter((v) => v !== a.id), a.id].sort((x, y) => order(x) - order(y)) : value.filter((v) => v !== a.id))}
                aria-label={a.name}
              />
              <span className={sx(paint.s28)}>
                <span className={sx(paint.s29)}>
                  {a.name}
                  {a.default && (
                    <Badge variant="secondary" size="sm">
                      recommended
                    </Badge>
                  )}
                </span>
                <span className={sx(paint.s30)}>{done ? "Installed on this box" : a.verified}</span>
              </span>
            </label>
          );
        })}
      </div>
      {left.map((a) => (
        <p key={a.id} data-testid={`agent-${a.id}`} className={sx(paint.s31)}>
          <span className={sx(paint.s32)}>{a.name}</span> isn't installed by Burf: {a.why}. <code className={sx(paint.s33)}>{a.install}</code>
        </p>
      ))}
    </>
  );
}

const ORDER = ["claude", "codex", "cursor", "opencode", "gemini"];
const order = (id: string) => (ORDER.indexOf(id) + 1 || 99) as number;

function PlanRow({ step, n, bundledTmux }: { step: InstallPlanStep; n: number; bundledTmux: boolean }) {
  const [open, setOpen] = useState(false);
  const detail = step.id === "tools" && bundledTmux ? `${step.detail} Burf brings its own tmux, so tmux needs no sudo.` : step.detail;
  return (
    <li data-testid={`plan-${step.id}`} className="group">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={sx(paint.s34)}>
        <span aria-hidden className={sx(paint.s35)}>
          {n}
        </span>
        <span className={sx(paint.s36)}>
          <span className={sx(paint.s37)}>
            <span className={sx(paint.s38)}>{step.title}</span>
            {step.sudo && (
              <Badge variant="warning" size="sm" data-testid="sudo-badge">
                <KeyRoundIcon /> sudo
              </Badge>
            )}
            {step.sudo && step.when && <span className={sx(paint.s39)}>{step.when}</span>}
          </span>
          {detail && <span className={sx(paint.s40)}>{detail}</span>}
        </span>
        <span className={sx(paint.s41)}>
          <span className={sx(paint.s42)}>
            {step.where === "laptop" ? <LaptopIcon className={sx(paint.s43)} /> : <ServerIcon className={sx(paint.s44)} />}
            {step.where === "laptop" ? "this computer" : "the box"}
          </span>
          <ChevronRightIcon aria-label={open ? "Hide the commands" : "Show the commands"} className={[sx(paint.s45), open && sx(paint.s46)].filter(Boolean).join(" ")} />
        </span>
      </button>
      {open && (
        <pre data-testid={`plan-commands-${step.id}`} className={sx(paint.s47)}>
          {step.commands.join("\n")}
        </pre>
      )}
    </li>
  );
}

// ---------------------------------------------------------------- the run

export type StepState = "todo" | "running" | "done" | "skip" | "fail";
export interface StepRow {
  id: string;
  title: string;
  sudo?: boolean;
  state: StepState;
  message?: string;
  command?: string;
  // What the step waits on the person for: sudo's password in the
  // terminal, or an answer to question (yes or no).
  needs?: "password" | "ask";
  question?: string;
}

export const TITLES: Record<string, string> = {
  connect: "Connect",
  berthd: "Install berthd",
  linger: "Keep berthd running",
  tools: "tmux and git",
  agents: "Agent CLIs",
  integrations: "Agent integrations",
  pair: "Pair with this computer",
};
export const ORDER_STEPS = ["connect", "berthd", "linger", "tools", "agents", "integrations", "pair"];

export interface InstallRun {
  state: "idle" | "running" | "done" | "failed";
  steps: StepRow[];
  failure?: SshFailure;
  // The box's name, once paired.
  box?: string;
  // What the terminal is waiting for: Enter to start, or sudo's password.
  waiting?: "enter" | "password";
  // Lines for the terminal, when it is not there yet.
  term: React.RefObject<TermHandle | null>;
  conn: React.RefObject<TerminalConnection | null>;
  req?: GuidedInstallRequest;
  start(req: GuidedInstallRequest, from?: string): void;
  stop(): void;
  reset(): void;
  // answer answers a step's question on the terminal's input.
  answer(step: string, yes: boolean): void;
}

const SUDO = /\[sudo\] password for [^:\r\n]*:\s*$|^Password:\s*$/m;
const ENTER = /(Press Enter to start, or Ctrl-C to stop\.|and start\? \[Y\/n\])\s*$/;
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[()][A-Z0-9]/g;

export function useInstallRun(): InstallRun {
  const client = useStore((s) => s.client);
  const [state, setState] = useState<InstallRun["state"]>("idle");
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [failure, setFailure] = useState<SshFailure>();
  const [box, setBox] = useState<string>();
  const [waiting, setWaiting] = useState<InstallRun["waiting"]>();
  const [req, setReq] = useState<GuidedInstallRequest>();
  const term = useRef<TermHandle | null>(null);
  const conn = useRef<TerminalConnection | null>(null);
  const pending = useRef<(string | Uint8Array)[]>([]);
  const tail = useRef("");
  const decoder = useRef(new TextDecoder());
  const autoTrust = useRef<{ known?: string[]; tried?: boolean }>({});

  const write = (d: string | Uint8Array) => {
    if (term.current) term.current.write(d);
    else pending.current.push(d);
  };

  // update changes a step's row; a step the list didn't have yet (the
  // quick install shows lingering only once it matters) goes in its place.
  const update = (id: string, patch: Partial<StepRow>) =>
    setSteps((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) {
        const at = ORDER_STEPS.indexOf(id);
        if (at < 0) return prev;
        const row: StepRow = { id, title: TITLES[id] ?? id, state: "todo", ...patch };
        const before = prev.findIndex((s) => ORDER_STEPS.indexOf(s.id) > at);
        return before < 0 ? [...prev, row] : [...prev.slice(0, before), row, ...prev.slice(before)];
      }
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const start = useCallback(
    (r: GuidedInstallRequest & { knownHostKeys?: string[] }, from?: string) => {
      if (!client) return;
      conn.current?.close();
      const request: GuidedInstallRequest = { host: r.host, name: r.name, network: r.network, identity: r.identity, trust_host_key: r.trust_host_key, agents: r.agents, from, guided: r.guided };
      if (r.knownHostKeys) autoTrust.current = { known: r.knownHostKeys };
      setReq(request);
      setState("running");
      setFailure(undefined);
      setWaiting(undefined);
      tail.current = "";
      // Steps before from keep what they were; the rest start again.
      const fromIdx = from ? ORDER_STEPS.indexOf(from) : 0;
      setSteps((prev) => {
        // Quiet, lingering shows only once it matters, and no step is
        // marked for sudo until it asks.
        const ids = ORDER_STEPS.filter((id) => (id !== "agents" || r.agents.length > 0) && (r.guided || id !== "linger" || prev.some((s) => s.id === id)));
        return ids.map((id) => {
          const was = prev.find((s) => s.id === id);
          if (was && ORDER_STEPS.indexOf(id) < fromIdx && id !== "connect") return was;
          return { id, title: was?.title ?? (id === "agents" ? agentNames(r.agents) : TITLES[id]), sudo: was?.sudo ?? (r.guided ? id === "linger" || id === "tools" : false), state: "todo" as StepState };
        });
      });
      if (from) write(`\r\n\x1b[2m— Retrying from ${TITLES[from] ?? from} —\x1b[0m\r\n`);
      const cols = term.current?.cols ?? 100;
      const rows = term.current?.rows ?? 30;
      const onEvent = (e: InstallEvent) => {
        if (e.type === "step") {
          if (e.state === "start") update(e.step, { state: "running", message: undefined, command: undefined, needs: undefined });
          else if (e.state === "done") {
            update(e.step, { state: "done", message: e.message, needs: undefined });
            if (e.step === "pair" && e.message) setBox(e.message);
          } else if (e.state === "skip") update(e.step, { state: "skip", message: e.message, needs: undefined });
          else if (e.state === "fail") update(e.step, { state: "fail", message: e.message, needs: undefined });
          else if (e.state === "sudo") update(e.step, { state: "running", sudo: true, needs: "password" });
          else if (e.state === "ask") update(e.step, { state: "running", needs: "ask", question: e.message });
          else if (e.state === "cmd") update(e.step, { command: e.message });
          else if (e.state === "open" && e.message) void openUrl(e.message);
        } else if (e.type === "failure") {
          setFailure(e.ssh);
        } else if (e.type === "exit") {
          setWaiting(undefined);
          conn.current = null;
          setState(e.code === 0 ? "done" : "failed");
        }
      };
      conn.current = client.installTerminal(request, cols, rows, {
        onOpen() {},
        onData(d) {
          write(d);
          const text = (typeof d === "string" ? d : decoder.current.decode(d, { stream: true })).replace(ANSI, "");
          tail.current = (tail.current + text).slice(-400);
          setWaiting(SUDO.test(tail.current) ? "password" : ENTER.test(tail.current) ? "enter" : undefined);
        },
        onClose() {
          setState((s) => (s === "running" ? "failed" : s));
        },
        onEvent,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client],
  );

  // A host key the tailnet vouches for is trusted without asking, once.
  useEffect(() => {
    const fp = failure?.kind === "host-key-unknown" ? failure.fingerprint : undefined;
    const at = autoTrust.current;
    if (state !== "failed" || !fp || !req || at.tried || !at.known?.includes(fp)) return;
    at.tried = true;
    write("\r\n\x1b[2mIts host key is the one your tailnet reports for it, so Burf trusts it.\x1b[0m\r\n");
    start({ ...req, trust_host_key: fp });
  }, [state, failure, req, start]);

  useEffect(() => () => conn.current?.close(), []);

  return {
    state,
    steps,
    failure,
    box,
    waiting,
    term,
    conn,
    req,
    start: (r, from) => start(r, from),
    stop: () => {
      conn.current?.close();
      conn.current = null;
      setWaiting(undefined);
      setState("failed");
      setSteps((prev) => prev.map((s) => (s.state === "running" ? { ...s, state: "fail", message: "Stopped" } : s)));
    },
    answer: (step, yes) => {
      conn.current?.send(yes ? "y\r" : "n\r");
      setSteps((prev) => prev.map((s) => (s.id === step ? { ...s, needs: yes ? "password" : undefined, sudo: yes || s.sudo } : s)));
    },
    reset: () => {
      conn.current?.close();
      conn.current = null;
      pending.current = [];
      setState("idle");
      setSteps([]);
      setFailure(undefined);
      setBox(undefined);
      setWaiting(undefined);
      term.current?.reset();
    },
    // flush is internal: the terminal takes what came before it existed.
    ...{ pendingRef: pending },
  } as InstallRun & { pendingRef: typeof pending };
}

function RunStage({
  target,
  run,
  agents,
  onClose,
  onReady,
  onBack,
  readyLabel,
}: {
  target: InstallTarget;
  run: InstallRun;
  agents: string[];
  onClose(): void;
  onReady(box: string): void;
  onBack(): void;
  readyLabel?: string;
}) {
  const narrow = useMediaQuery("(max-width: 1000px)");
  const [identity, setIdentity] = useState(target.identity ?? "");
  const busy = run.state === "running";
  const failed = run.steps.find((s) => s.state === "fail");
  const ready = run.state === "done" && !!run.box;
  const retry = (from?: string, trust?: string) => run.start({ ...target, identity: identity || target.identity, trust_host_key: trust ?? target.trust_host_key, agents, knownHostKeys: target.knownHostKeys, guided: true } as GuidedInstallRequest, from);

  useEffect(() => {
    if (run.state === "idle") run.start({ ...target, agents, knownHostKeys: target.knownHostKeys, guided: true } as GuidedInstallRequest);
    // Once, when the run stage opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = ready ? (
    <Badge variant="success" size="lg" data-testid="install-status">
      <CheckIcon /> Ready
    </Badge>
  ) : busy ? (
    <span data-testid="install-status" className={sx(paint.s48)}>
      <Spinner  size="sm"/> Installing
    </span>
  ) : run.state === "failed" ? (
    <Badge variant="error" size="lg" data-testid="install-status">
      Stopped
    </Badge>
  ) : null;

  return (
    <>
      <Header
        icon={<SquareTerminalIcon className={sx(paint.s49)} />}
        title={ready ? `${run.box} is ready` : `Setting up ${target.host}`}
        sub={ready ? `Paired with this computer. Burf no longer needs SSH for it.` : "You type in the terminal: press Enter to start, and your password when sudo asks."}
        right={
          <div className={sx(paint.s50)}>
            {status}
            {busy && (
              <Button size="sm" variant="outline" onClick={run.stop}>
                Stop
              </Button>
            )}
            <CloseButton onClick={onClose} disabled={busy} />
          </div>
        }
      />
      <div className={[sx(paint.s51), narrow ? sx(paint.s52) : sx(paint.s53)].filter(Boolean).join(" ")}>
        <aside className={[sx(paint.s54), narrow ? sx(paint.s55) : sx(paint.s56)].filter(Boolean).join(" ")}>
          <StepList steps={run.steps} narrow={narrow} onRetry={(from) => retry(from)} busy={busy} waiting={run.waiting} />
          {run.failure && run.state === "failed" && (
            <div className={sx(paint.s57)}>
              <FailurePanel failure={run.failure} identity={identity} setIdentity={setIdentity} onRetry={(trust) => retry(undefined, trust)} />
            </div>
          )}
          {!narrow && (
            <p className={sx(paint.s58)}>
              <ShieldCheckIcon className={sx(paint.s59)} />
              <span>What you type goes to {target.host.split("@").pop()} through this terminal, and nowhere else. Burf doesn't keep it.</span>
            </p>
          )}
          {run.state === "failed" && !failed && !run.failure && (
            <div className={sx(paint.s60)}>
              <Button size="sm" variant="outline" onClick={() => retry()}>
                <RotateCwIcon /> Start again
              </Button>
            </div>
          )}
        </aside>
        <section className={sx(paint.s61)}>
          <Banner run={run} ready={ready} readyLabel={readyLabel} onReady={() => run.box && onReady(run.box)} onBack={onBack} agents={agents} />
          <InstallTerminal run={run} />
        </section>
      </div>
    </>
  );
}

export function StepIcon({ state }: { state: StepState }) {
  return (
    <span
      className={[sx(paint.s62), state === "done" && sx(paint.s63), state === "fail" && sx(paint.s64), state === "running" && sx(paint.s65), state === "skip" && sx(paint.s66), state === "todo" && sx(paint.s67)].filter(Boolean).join(" ")}
    >
      {state === "done" ? (
        <CheckIcon className={sx(paint.s68)} strokeWidth={3} />
      ) : state === "fail" ? (
        <XIcon className={sx(paint.s69)} strokeWidth={3} />
      ) : state === "running" ? (
        <Spinner  size="sm"/>
      ) : state === "skip" ? (
        <MinusIcon className={sx(paint.s70)} />
      ) : (
        <CircleIcon className={sx(paint.s71)} />
      )}
    </span>
  );
}

function StepList({ steps, narrow, onRetry, busy, waiting }: { steps: StepRow[]; narrow: boolean; onRetry(from: string): void; busy: boolean; waiting?: InstallRun["waiting"] }) {
  return (
    <ol data-testid="install-steps" className={[sx(paint.s72), narrow && sx(paint.s73)].filter(Boolean).join(" ")}>
      {steps.map((s) => (
        <li key={s.id} data-testid={`step-${s.id}`} data-state={s.state} className={[sx(paint.s74), s.state === "running" && sx(paint.s75), s.state === "fail" && sx(paint.s76), narrow && sx(paint.s77)].filter(Boolean).join(" ")}>
          <div className={sx(paint.s78)}>
            <StepIcon state={s.state} />
            <span className={[sx(paint.s79), s.state === "todo" && sx(paint.s80), s.state === "skip" && sx(paint.s81), s.state === "running" && sx(paint.s82)].filter(Boolean).join(" ")}>{s.title}</span>
            {s.sudo && s.state !== "skip" && (
              <Tip label="sudo asks for your password on the box, if it needs to">
                <KeyRoundIcon aria-label="needs sudo" className={sx(paint.s83)} />
              </Tip>
            )}
          </div>
          {s.state === "running" && waiting === "password" ? (
            <p data-testid="step-waiting" className={sx(paint.s84)}>
              <KeyRoundIcon className={sx(paint.s85)} /> Waiting for your password
            </p>
          ) : (
            s.message && s.state !== "fail" && !narrow && <p className={sx(paint.s86)}>{s.message}</p>
          )}
          {s.state === "fail" && (
            <div className={[sx(paint.s87), narrow && sx(paint.s88)].filter(Boolean).join(" ")}>
              {s.message && <p className={sx(paint.s89)}>{s.message}</p>}
              {s.command && <CommandLine command={s.command} onRun={() => onRetry(s.id)} />}
              {!busy && (
                <Button size="xs" data-testid={`retry-${s.id}`} onClick={() => onRetry(s.id === "connect" ? "connect" : s.id)}>
                  <RotateCwIcon /> Retry from here
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

// CommandLine is a command to run by hand: as typed, copyable, and run in
// the terminal here (the step again, where sudo can ask).
export function CommandLine({ command, onRun }: { command: string; onRun?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div data-testid="command-line" className={sx(paint.s90)}>
      <code className={sx(paint.s91)}>{command}</code>
      <div className={sx(paint.s92)}>
        <Button
          size="xs"
          variant="ghost"
          
          onClick={() =>
            navigator.clipboard?.writeText(command).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              },
              () => toastManager.add({ type: "error", title: "Could not copy", description: "Select the line and copy it instead." }),
            )
          } muted>
          {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
        </Button>
        {onRun && (
          <Button size="xs" variant="ghost"  onClick={onRun} muted>
            <SquareTerminalIcon /> Run in terminal
          </Button>
        )}
      </div>
    </div>
  );
}

function Banner({ run, ready, readyLabel, onReady, onBack, agents }: { run: InstallRun; ready: boolean; readyLabel?: string; onReady(): void; onBack(): void; agents: string[] }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (ready) ref.current?.focus();
  }, [ready]);
  if (ready)
    return (
      <div data-testid="install-ready" className={sx(paint.s93)}>
        <span className={sx(paint.s94)}>
          <CheckIcon className={sx(paint.s95)} strokeWidth={3} />
        </span>
        <div className={[sx(paint.s96), sx(paint.s133)].filter(Boolean).join(" ")}>
          <p className={sx(paint.s97)}>Ready</p>
          <p className={sx(paint.s98)}>
            {run.box} runs berthd{agents.length ? `, with ${agentNames(agents)}` : ""}.{agents.includes("claude") ? " Claude Code asks you to sign in the first time it starts, right in the chat." : agents.length ? " Each agent asks you to sign in the first time it starts." : ""}
          </p>
        </div>
        <Button ref={ref} data-testid="install-continue" onClick={onReady}>
          {readyLabel ?? `Go to ${run.box}`} <ArrowRightIcon />
        </Button>
      </div>
    );
  let icon: ReactNode = <Spinner  size="md"/>;
  let text: ReactNode = "Connecting…";
  let tone = "";
  if (run.waiting === "password") {
    icon = <KeyRoundIcon className={sx(paint.s99)} />;
    tone = (sx(paint.s136) ?? "");
    text = (
      <>
        <span className={sx(paint.s100)}>sudo is asking for your password on the box.</span> Type it in the terminal and press <Kbd>↵</Kbd>; nothing shows as you type. Burf never sees it.
      </>
    );
  } else if (run.waiting === "enter") {
    icon = <SquareTerminalIcon className={sx(paint.s101)} />;
    tone = (sx(paint.s137) ?? "");
    text = (
      <>
        <span className={sx(paint.s102)}>Check the plan in the terminal, then press</span> <Kbd>↵</Kbd> <span className={sx(paint.s103)}>there to start.</span>
      </>
    );
  } else if (run.state === "failed") {
    icon = <XIcon className={sx(paint.s104)} />;
    tone = (sx(paint.s138) ?? "");
    text = (
      <>
        Stopped. The terminal says why; fix it if it's on the box, then retry from the step that failed. The steps before it are kept.{" "}
        <button type="button" className={[sx(paint.s105), sx(paint.s134)].filter(Boolean).join(" ")} onClick={onBack}>
          Back to the plan
        </button>
      </>
    );
  } else {
    const i = run.steps.findIndex((s) => s.state === "running");
    if (i >= 0)
      text = (
        <>
          <span className={sx(paint.s106)}>
            Step {i + 1} of {run.steps.length}
          </span>{" "}
          · {run.steps[i].title}
        </>
      );
  }
  return (
    <div data-testid="install-banner" data-waiting={run.waiting ?? ""} aria-live="polite" className={[sx(paint.s107), tone].filter(Boolean).join(" ")}>
      <span className={sx(paint.s108)}>{icon}</span>
      <p className={sx(paint.s109)}>{text}</p>
    </div>
  );
}

export function agentNames(ids: string[]) {
  const n = ids.map((id) => ({ claude: "Claude Code", codex: "Codex", cursor: "Cursor Agent", opencode: "OpenCode" })[id] ?? id);
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

// InstallTerminal is Burf's terminal (ghostty-web, or xterm.js) on the
// install's pseudo-terminal: what it shows comes from burf add ssh, and
// what is typed goes back to it. fontSize, when given, overrides the
// terminal's own: the quick install's compact dialog uses a smaller one.
export function InstallTerminal({ run, className, fontSize }: { run: InstallRun; className?: string; fontSize?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useActiveTheme();
  const prefs = useCustomTerminalPrefs();
  const [term, setTerm] = useState<TermHandle>();
  const pendingRef = (run as InstallRun & { pendingRef: React.RefObject<(string | Uint8Array)[]> }).pendingRef;

  useEffect(() => {
    let disposed = false;
    let t: TermHandle | undefined;
    const mount = document.createElement("div");
    mount.className = sx(paint.s139);
    host.current!.appendChild(mount);
    void createTerminal(mount, theme.terminal, fontSize ? { ...prefs, fontSize } : prefs).then((made) => {
      if (disposed) {
        made.dispose();
        return;
      }
      t = made;
      run.term.current = made;
      made.onData((d) => run.conn.current?.send(d));
      made.onResize(({ cols, rows }) => run.conn.current?.resize(cols, rows));
      for (const d of pendingRef.current.splice(0)) made.write(d);
      setTerm(made);
    });
    return () => {
      disposed = true;
      if (run.term.current === t) run.term.current = null;
      t?.dispose();
      mount.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.renderer, prefs.fontFamily, prefs.fontSize, fontSize, theme.id]);

  useEffect(() => {
    if (!term || !host.current) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => term.fit());
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [term]);

  // The keyboard belongs to the terminal while the install waits on it.
  useEffect(() => {
    if (term && run.state === "running") term.focus();
  }, [term, run.state, run.waiting]);

  return (
    <div className={[sx(paint.s110), className].filter(Boolean).join(" ")} style={{ background: theme.terminal.background }} onMouseDown={() => term?.focus()}>
      <div ref={host} data-terminal data-testid="install-terminal" className={[sx(paint.s111), fontSize ? sx(paint.s112) : sx(paint.s113)].filter(Boolean).join(" ")} />
    </div>
  );
}

// useInstallTarget is the guided install's open state for a screen that
// starts it.
export function useInstallTarget() {
  const [target, setTarget] = useState<InstallTarget>();
  return useMemo(() => ({ target, open: setTarget, close: () => setTarget(undefined) }), [target]);
}

// ------------------------------------------------- adding agents later

// AddAgents puts more agent CLIs on a box that is already set up, from its
// settings: the same choice, then the same terminal and checklist. Nothing
// needs sudo, so the terminal only shows what the box prints.
export function AddAgents({ box, open, onClose }: { box: string; open: boolean; onClose(): void }) {
  const client = useStore((s) => s.client);
  const [have, setHave] = useState<(AgentChoice & { installed: boolean })[]>();
  const [picked, setPicked] = useState<string[]>([]);
  const [stage, setStage] = useState<"pick" | "run">("pick");
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [state, setState] = useState<"running" | "done" | "failed">("running");
  const [error, setError] = useState<string>();
  const term = useRef<TermHandle | null>(null);
  const pending = useRef<string[]>([]);
  const abort = useRef<AbortController>(null);

  useEffect(() => {
    if (!open || !client) return;
    setStage("pick");
    setError(undefined);
    boxApi.agentCLIs(client, box).then(
      (list) => {
        setHave(list);
        const remembered = usePrefs.getState().installAgents ?? ["claude"];
        setPicked(remembered.filter((id) => list.some((a) => a.id === id && a.offered && !a.installed)));
      },
      (err) => setError(plainError(err, { box })),
    );
  }, [open, client, box]);

  const write = (l: string) => {
    if (term.current) term.current.write(`${l}\r\n`);
    else pending.current.push(`${l}\r\n`);
  };
  const run = async () => {
    if (!client) return;
    setStage("run");
    setState("running");
    setSteps([...picked.map((id) => ({ id: `agent-${id}`, title: agentNames([id]), state: "todo" as StepState })), { id: "integrations", title: "Agent integrations", state: "todo" as StepState }]);
    const ctl = new AbortController();
    abort.current = ctl;
    const set = (id: string, patch: Partial<StepRow>) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      await boxApi.installAgents(
        client,
        box,
        picked,
        {
          line: write,
          step: (e) => set(e.step, { state: e.state === "start" ? "running" : e.state === "done" ? "done" : e.state === "skip" ? "skip" : e.state === "fail" ? "fail" : "running", message: e.state === "fail" ? e.message : undefined }),
        },
        ctl.signal,
      );
      setState("done");
      setPrefs({ installAgents: [...new Set([...(usePrefs.getState().installAgents ?? []), ...picked])] });
    } catch (err) {
      if (ctl.signal.aborted) return;
      setError(plainError(err, { box }));
      setSteps((prev) => prev.map((s) => (s.state === "running" ? { ...s, state: "fail" } : s)));
      setState("failed");
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && (stage !== "run" || state !== "running") && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={sx(paint.s114)} />
        <DialogPrimitive.Popup data-testid="add-agents" data-stage={stage} className={sx(paint.s115)}>
          {stage === "pick" ? (
            <>
              <Header icon={<ServerIcon className={sx(paint.s116)} />} title={`Add agents to ${box}`} sub="Into ~/.local/bin on the box, without sudo, with Burf's hooks and skills." right={<CloseButton onClick={onClose} />} />
              <div className={sx(paint.s117)}>
                <div className={[sx(paint.s118), sx(paint.s135)].filter(Boolean).join(" ")}>
                  {error && <p className={sx(paint.s119)}>{error}</p>}
                  {!have && !error && (
                    <p className={sx(paint.s120)}>
                      <Spinner  size="md"/> Asking {box}…
                    </p>
                  )}
                  {have && (
                    <AgentPicker
                      choices={have.map((a) => (a.installed ? { ...a, offered: false, why: "" } : a))}
                      installed={have.filter((a) => a.installed).map((a) => a.id)}
                      value={picked}
                      onChange={setPicked}
                    />
                  )}
                </div>
              </div>
              <footer className={sx(paint.s121)}>
                <div className={[sx(paint.s122), sx(paint.s135)].filter(Boolean).join(" ")}>
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button data-testid="add-agents-start" disabled={!picked.length} onClick={() => void run()}>
                    <SquareTerminalIcon /> Install {picked.length ? agentNames(picked) : "agents"}
                  </Button>
                </div>
              </footer>
            </>
          ) : (
            <>
              <Header
                icon={<SquareTerminalIcon className={sx(paint.s123)} />}
                title={state === "done" ? `${agentNames(picked)} on ${box}` : `Adding agents to ${box}`}
                sub={state === "done" ? "Each asks you to sign in the first time it starts." : "No password needed: nothing here uses sudo."}
                right={<CloseButton onClick={onClose} disabled={state === "running"} />}
              />
              <div className={sx(paint.s124)}>
                <aside className={sx(paint.s125)}>
                  <StepList steps={steps} narrow={false} busy={state === "running"} onRetry={() => void run()} />
                  {error && <p className={sx(paint.s126)}>{error}</p>}
                  {state === "done" && (
                    <div className={sx(paint.s127)}>
                      <Button size="sm" data-testid="add-agents-done" onClick={onClose}>
                        <CheckIcon /> Done
                      </Button>
                    </div>
                  )}
                </aside>
                <OutputTerminal term={term} pending={pending} />
              </div>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function OutputTerminal({ term, pending }: { term: React.RefObject<TermHandle | null>; pending: React.RefObject<string[]> }) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useActiveTheme();
  const prefs = useCustomTerminalPrefs();
  useEffect(() => {
    let t: TermHandle | undefined;
    let disposed = false;
    const mount = document.createElement("div");
    mount.className = sx(paint.s139);
    host.current!.appendChild(mount);
    void createTerminal(mount, theme.terminal, prefs).then((made) => {
      if (disposed) return made.dispose();
      t = made;
      term.current = made;
      for (const l of pending.current.splice(0)) made.write(l);
      requestAnimationFrame(() => made.fit());
    });
    const ro = new ResizeObserver(() => t?.fit());
    ro.observe(host.current!);
    return () => {
      disposed = true;
      ro.disconnect();
      if (term.current === t) term.current = null;
      t?.dispose();
      mount.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.id]);
  return (
    <div className={sx(paint.s128)} style={{ background: theme.terminal.background }}>
      <div ref={host} data-testid="add-agents-terminal" className={sx(paint.s129)} />
    </div>
  );
}
