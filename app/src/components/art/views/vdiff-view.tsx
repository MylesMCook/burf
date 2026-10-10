import * as stylex from "@stylexjs/stylex";
import { AlertTriangleIcon, ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, CheckIcon, Columns2Icon, FlameIcon, InfoIcon, LayersIcon, LayoutGridIcon, MoonIcon, PlusCircleIcon, RepeatIcon, SplitIcon, SquareDashedIcon, StampIcon, SunIcon, XCircleIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ViewProps } from "@/components/art/kinds";
import { Crop, type Overlays, REGION, Stage, type StageMode } from "@/components/art/views/vdiff-stage";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { type Art, type ArtVersion, latest } from "@/lib/art/model";
import { acceptBaseline, useAccepted } from "@/lib/art/vdiff-accept";
import { allClear, baseName, type Change, changes, firstPage, flags, frame, overflow, parseVdiff, pct, type Scheme, schemeOf, schemes, sizeName, sortedPages, thumbShot, type VdPage, type VdShot, type VisualDiff, worstShot } from "@/lib/art/vdiff";
import { color } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "dashed",
    "borderColor": "var(--border)",
    "padding": "12px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s2: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "6px",
  },
  s3: {
    "display": "flex",
    "minWidth": "0px",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "8px",
    "rowGap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "display": "none",
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s5: {
    "display": "none",
  },
  s6: {
    "flexShrink": 0,
    "fontVariantNumeric": "tabular-nums",
  },
  s7: {
    "marginLeft": "auto",
  },
  s8: {
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "6px",
    "color": "var(--warning-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s9: {
    "marginTop": "1px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s10: {
    "minWidth": "0px",
  },
  s11: {
    "display": "flex",
    "minWidth": "0px",
    "flexWrap": "wrap",
    "gap": "4px",
  },
  s12: {
    "borderColor": "color-mix(in oklab, var(--success) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--success) 8%, transparent)",
    "color": "var(--success-foreground)",
  },
  s13: {
    "width": "12px",
    "height": "12px",
  },
  s14: {
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "color": "var(--destructive-foreground)",
  },
  s15: {
    "width": "12px",
    "height": "12px",
  },
  s16: {
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
    "color": "var(--destructive-foreground)",
  },
  s17: {
    "width": "12px",
    "height": "12px",
  },
  s18: {
    "borderColor": "color-mix(in oklab, var(--info) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 8%, transparent)",
    "color": "var(--info-foreground)",
  },
  s19: {
    "width": "12px",
    "height": "12px",
  },
  s20: {
    "borderColor": "color-mix(in oklab, var(--warning) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
    "color": "var(--warning-foreground)",
  },
  s21: {
    "width": "12px",
    "height": "12px",
  },
  s22: {
    "display": "flex",
    "minWidth": "0px",
    "flexWrap": "wrap",
    "gap": "4px",
  },
  s23: {
    "color": "var(--muted-foreground)",
  },
  s24: {
    "color": "var(--muted-foreground)",
  },
  s25: {
    "width": "12px",
    "height": "12px",
    "color": "var(--success-foreground)",
  },
  s26: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontWeight": 500,
    "color": "var(--success-foreground)",
  },
  s27: {
    "width": "14px",
    "height": "14px",
  },
  s28: {
    "position": "relative",
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
  },
  s29: {
    "display": "inline-flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--info) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 6%, transparent)",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "paddingRight": "2px",
    "paddingLeft": "8px",
    "color": "var(--foreground)",
  },
  s30: {
    "maxWidth": "26rem",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s31: {
    "color": "var(--muted-foreground)",
  },
  s32: {
    "color": "var(--destructive-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s33: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s34: {
    "display": "none",
    "color": "var(--muted-foreground)",
  },
  s35: {
    "minWidth": "2.25rem",
    "textAlign": "center",
    "fontVariantNumeric": "tabular-nums",
  },
  s36: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s37: {
    "borderColor": "var(--ring)",
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s38: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s39: {
    "width": "14px",
    "height": "14px",
  },
  s40: {
    "display": "none",
  },
  s41: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s42: {
    "position": "sticky",
    "zIndex": 40,
    "marginLeft": "calc(16px * -1)",
    "marginRight": "calc(16px * -1)",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--background) 95%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "16px",
    "paddingBottom": "10px",
  },
  s43: {
    "display": "none",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s44: {
    "marginLeft": "auto",
  },
  s45: {
    "display": "flex",
    "minWidth": "0px",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s46: {
    "display": "inline-flex",
    "height": "18px",
    "minWidth": "18px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 600,
    "fontSize": "10.5px",
    "color": "#fff",
  },
  s47: {
    "fontWeight": 500,
    "fontFamily": "var(--font-mono)",
  },
  s48: {
    "color": "var(--muted-foreground)",
  },
  s49: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s50: {
    "minWidth": "0px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
  },
  s51: {
    "fontWeight": 500,
    "color": "var(--destructive-foreground)",
  },
  s52: {
    "fontWeight": 500,
    "color": "var(--destructive-foreground)",
  },
  s53: {
    "color": "var(--info-foreground)",
  },
  s54: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
  },
  s55: {
    "position": "sticky",
    "zIndex": 40,
    "marginLeft": "calc(16px * -1)",
    "marginRight": "calc(16px * -1)",
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--background) 95%, transparent)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "16px",
    "paddingBottom": "10px",
  },
  s56: {
    "display": "flex",
    "minWidth": "0px",
    "alignItems": "center",
    "gap": "8px",
  },
  s57: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s58: {
    "display": "none",
    "flexShrink": 0,
  },
  s59: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "columnGap": "6px",
    "rowGap": "6px",
  },
  s60: {
    "marginLeft": "auto",
    "display": "none",
  },
  s61: {
    "height": "12px",
  },
  s62: {
    "display": "flex",
    "gap": "16px",
  },
  s63: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "justifyContent": "center",
  },
  s64: {
    "marginLeft": "calc(4px * -1)",
    "marginRight": "calc(4px * -1)",
    "display": "flex",
    "gap": "4px",
    "overflowX": "auto",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingBottom": "2px",
    "scrollbarWidth": "thin",
  },
  s65: {
    "display": "inline-flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s66: {
    "borderColor": "var(--ring)",
    "backgroundColor": "var(--accent)",
    "color": "var(--foreground)",
  },
  s67: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s68: {
    "fontWeight": 500,
    "fontFamily": "var(--font-mono)",
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
  },
  s69: {
    "fontWeight": 500,
    "color": "var(--destructive-foreground)",
  },
  s70: {
    "fontWeight": 500,
    "color": "var(--info-foreground)",
  },
  s71: {
    "fontWeight": 500,
    "color": "var(--warning-foreground)",
  },
  s72: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
    "color": "var(--success-foreground)",
  },
  s73: {
    "width": "12px",
    "height": "12px",
  },
  s74: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
    "fontVariantNumeric": "tabular-nums",
  },
  s75: {
    "color": "var(--destructive-foreground)",
  },
  s76: {
    "color": "var(--warning-foreground)",
  },
  s77: {
    "width": "12px",
    "height": "12px",
  },
  s78: {
    "display": "inline-flex",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "padding": "2px",
  },
  s79: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s80: {
    "backgroundColor": "var(--background)",
    "color": "var(--foreground)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s81: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s82: {
    "fontWeight": 500,
  },
  s83: {
    "display": "none",
  },
  s84: {
    "fontVariantNumeric": "tabular-nums",
  },
  s85: {
    "display": "inline-flex",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "padding": "2px",
  },
  s86: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s87: {
    "backgroundColor": "var(--background)",
    "color": "var(--foreground)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s88: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
  },
  s89: {
    "width": "14px",
    "height": "14px",
  },
  s90: {
    "display": "none",
  },
  s91: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s92: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "opacity": {
      ":disabled": 0.5,
    },
  },
  s93: {
    "borderColor": "color-mix(in oklab, #f97316 50%, transparent)",
    "backgroundColor": "color-mix(in oklab, #f97316 10%, transparent)",
    "color": "var(--foreground)",
  },
  s94: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s95: {
    "width": "14px",
    "height": "14px",
  },
  s96: {
    "color": "#f97316",
  },
  s97: {
    "display": "none",
  },
  s98: {
    "display": "none",
  },
  s99: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s100: {
    "borderColor": "color-mix(in oklab, #2563eb 40%, transparent)",
    "backgroundColor": "color-mix(in oklab, #2563eb 8%, transparent)",
    "color": "var(--foreground)",
  },
  s101: {
    "color": "var(--muted-foreground)",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s102: {
    "width": "14px",
    "height": "14px",
  },
  s103: {
    "color": "#3b82f6",
  },
  s104: {
    "display": "none",
  },
  s105: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s106: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s107: {
    "display": "none",
  },
  s108: {
    "height": "4px",
    "width": "80px",
    "cursor": "pointer",
  },
  s109: {
    "marginBottom": "12px",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "flex-start",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "0.8125rem",
  },
  s110: {
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 6%, transparent)",
  },
  s111: {
    "minWidth": "0px",
  },
  s112: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--destructive-foreground)",
  },
  s113: {
    "fontWeight": 500,
  },
  s114: {
    "color": "var(--muted-foreground)",
  },
  s115: {
    "marginTop": "2px",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s116: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--info-foreground)",
  },
  s117: {
    "fontWeight": 500,
  },
  s118: {
    "color": "var(--muted-foreground)",
  },
  s119: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--warning-foreground)",
  },
  s120: {
    "fontWeight": 500,
  },
  s121: {
    "color": "var(--muted-foreground)",
  },
  s122: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--success-foreground)",
  },
  s123: {
    "fontWeight": 500,
  },
  s124: {
    "color": "var(--muted-foreground)",
  },
  s125: {
    "marginTop": "2px",
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
    "color": "var(--destructive-foreground)",
  },
  s126: {
    "fontWeight": 500,
  },
  s127: {
    "color": "var(--muted-foreground)",
  },
  s128: {
    "display": "none",
  },
  s129: {
    "display": "none",
    "width": "208px",
    "flexShrink": 0,
    "flexDirection": "column",
    "gap": "4px",
  },
  s130: {
    "position": "sticky",
    "top": "8.5rem",
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s131: {
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "paddingBottom": "4px",
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s132: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "2px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "textAlign": "left",
    "fontSize": "12px",
    "lineHeight": "16px",
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--accent) 60%, transparent)",
    },
  },
  s133: {
    "backgroundColor": "var(--accent)",
  },
  s134: {
    "display": "flex",
    "width": "100%",
    "alignItems": "center",
    "gap": "8px",
  },
  s135: {
    "display": "inline-flex",
    "height": "18px",
    "minWidth": "18px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 600,
    "fontSize": "10.5px",
    "color": "#fff",
  },
  s136: {
    "fontVariantNumeric": "tabular-nums",
  },
  s137: {
    "marginLeft": "auto",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s138: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "paddingInlineStart": "26px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.6875rem",
    "color": "var(--muted-foreground)",
  },
  s139: {
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s140: {
    "marginTop": "12px",
    "display": "flex",
    "flexShrink": 0,
    "flexWrap": "wrap",
    "columnGap": "8px",
    "rowGap": "2px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingTop": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s141: {
    "fontFamily": "var(--font-mono)",
  },
  s142: {
    "fontVariantNumeric": "tabular-nums",
  },
  s143: {
    "marginLeft": "auto",
    "display": "none",
    "fontFamily": "var(--font-mono)",
  },
  s144: {
    "display": "grid",
    "columnGap": "12px",
    "rowGap": "16px",
    "paddingTop": "12px",
  },
  s145: {
    "fontWeight": 500,
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s146: {
    "display": "none",
  },
  s147: {
    "fontVariantNumeric": "tabular-nums",
  },
  s148: {
    "display": "contents",
  },
  s149: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "2px",
    "paddingTop": "4px",
  },
  s150: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontFamily": "var(--font-mono)",
    "fontSize": "0.8125rem",
  },
  s151: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s152: {
    "position": "relative",
    "minWidth": "0px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": {
      "default": "var(--border)",
      ":hover": "color-mix(in oklab, var(--ring) 60%, transparent)",
    },
    "backgroundColor": "var(--card)",
    "textAlign": "left",
    "outline": "none",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s153: {
    "borderColor": "color-mix(in oklab, var(--destructive) 50%, transparent)",
  },
  s154: {
    "opacity": 0.6,
  },
  s155: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "4px",
    "backgroundColor": "color-mix(in oklab, var(--background) 85%, transparent)",
    "padding": "8px",
    "textAlign": "center",
  },
  s156: {
    "width": "20px",
    "height": "20px",
    "color": "var(--destructive-foreground)",
  },
  s157: {
    "fontWeight": 500,
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s158: {
    "position": "absolute",
    "bottom": "6px",
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "4px",
  },
  s159: {
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, var(--background) 92%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "11px",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s160: {
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s161: {
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "#be123c",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontWeight": 500,
    "fontSize": "11px",
    "color": "#fff",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s162: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "20px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
  },
  s163: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "gap": "8px",
    "textAlign": "center",
  },
  s164: {
    "display": "flex",
    "width": "48px",
    "height": "48px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--success) 12%, transparent)",
    "color": "var(--success-foreground)",
  },
  s165: {
    "width": "24px",
    "height": "24px",
  },
  s166: {
    "fontWeight": 600,
    "fontSize": "18px",
    "lineHeight": "28px",
  },
  s167: {
    "textWrap": "balance",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s168: {
    "display": "grid",
    "width": "100%",
    "maxWidth": "60rem",
    "gridTemplateColumns": "repeat(auto-fill,minmax(9.5rem,1fr))",
    "gap": "10px",
  },
  s169: {
    "display": "flex",
    "flexWrap": "wrap",
    "justifyContent": "center",
    "columnGap": "8px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s170: {
    "fontVariantNumeric": "tabular-nums",
  },
  s171: {
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
  },
  s172: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s173: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontWeight": 500,
    "fontFamily": "var(--font-mono)",
  },
  s174: {
    "marginLeft": "auto",
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
    "color": "var(--success-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s175: {
    "width": "12px",
    "height": "12px",
  },
  s176: {
    "position": "relative",
    "display": "flex",
    "gap": "4px",
  },
  s177: {
    "borderRadius": "var(--radius-sm)",
  },
  s178: {
    "position": "absolute",
    "right": "4px",
    "bottom": "4px",
    "display": "inline-flex",
    "alignItems": "center",
    "gap": "2px",
    "borderRadius": "999px",
    "backgroundColor": "#15803d",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontWeight": 500,
    "fontSize": "10px",
    "color": "#fff",
  },
  s179: {
    "width": "12px",
    "height": "12px",
  },
  s180: {
    "position": "relative",
    "overflow": "hidden",
    "borderRadius": "var(--radius-sm)",
  },
  s181: {
    "position": "relative",
    "overflow": "hidden",
    "borderRadius": "var(--radius-sm)",
  },
  s182: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "left": "0px",
    "overflow": "hidden",
  },
  s183: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "width": "2px",
    "backgroundColor": "#fff",
    "boxShadow": "0 0 0 1px rgba(0,0,0,0.2)",
  },
  s184: {
    "position": "absolute",
    "bottom": "4px",
    "left": "4px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, #18181b 75%, transparent)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 500,
    "fontSize": "9.5px",
    "color": "#fff",
  },
  s185: {
    "position": "absolute",
    "right": "4px",
    "bottom": "4px",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "color-mix(in oklab, #1d4ed8 90%, transparent)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 500,
    "fontSize": "9.5px",
    "color": "#fff",
  },
  n0: {
    "display": "inline-flex",
    "height": "18px",
    "minWidth": "18px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontWeight": 600,
    "fontSize": "10.5px",
    "color": "#fff",
  },
  n1: {
    "backgroundColor": "var(--destructive)",
  },
  n2: {
    "backgroundColor": "var(--info)",
  },
  n3: {
    "marginBottom": "12px",
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "flex-start",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "0.8125rem",
  },
  n4: {
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 6%, transparent)",
  },
  n5: {
    "borderColor": "color-mix(in oklab, var(--warning) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--warning) 8%, transparent)",
  },
  n6: {
    "borderColor": "color-mix(in oklab, var(--success) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--success) 6%, transparent)",
  },
  n7: {
    "borderColor": "color-mix(in oklab, var(--info) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--info) 6%, transparent)",
  },

  s186: {
    containerType: "inline-size",
  },
  s187: {
    "@container (max-width: 480px)": {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
    },
  },
  s188: {
    "@container (max-width: 480px)": {
      order: 2,
      marginLeft: "auto",
    },
  },
  s189: {
    "@container (min-width: 560px)": {
      display: "inline",
    },
  },
  s190: {
    "@container (max-width: 480px)": {
      position: "absolute",
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      borderWidth: 0,
    },
  },
  s191: {
    "@container (max-width: 480px)": {
      order: 3,
      width: "100%",
    },
  },
  s192: {
    "@container (max-width: 480px)": {
      order: 1,
    },
  },
  s193: {
    "@container (min-width: 720px)": {
      display: "inline",
    },
  },
  s194: {
    "@container (min-width: 480px)": {
      minWidth: "2.75rem",
    },
    "@container (min-width: 560px)": {
      minWidth: "3.5rem",
    },
  },
  s195: {
    "@container (min-width: 480px)": {
      display: "inline",
    },
  },
  s196: {
    "@container (min-width: 480px)": {
      display: "none",
    },
  },
  s197: {
    top: -16,
    backdropFilter: "blur(8px)",
  },
  s198: {
    "@container (min-width: 760px)": {
      display: "block",
    },
  },
  s199: {
    "@container (min-width: 560px)": {
      columnGap: 10,
      rowGap: 8,
    },
  },
  s200: {
    "@container (min-width: 560px)": {
      display: "block",
    },
  },
  s201: {
    "@container (min-width: 760px)": {
      display: "none",
    },
  },
  s202: {
    "@container (min-width: 620px)": {
      display: "inline",
    },
  },
  s203: {
    "@container (min-width: 480px)": {
      paddingLeft: 8,
      paddingRight: 8,
    },
  },
  s204: {
    "@container (min-width: 900px)": {
      display: "inline",
    },
  },
  s205: {
    "@container (min-width: 620px)": {
      display: "inline-flex",
    },
  },
  s206: {
    "@container (min-width: 560px)": {
      paddingTop: 8,
      paddingBottom: 8,
    },
  },
  s207: {
    "@container (min-width: 1000px)": {
      display: "flex",
    },
  },
  s208: {
    filter: "grayscale(0.6)",
  },
  s209: {
    left: 6,
    right: 6,
  },
  s210: {
    backdropFilter: "blur(8px)",
  },
  s211: {
    maxWidth: "28rem",
  },
  s212: {
    boxShadow: "0 1px 3px 0 color-mix(in oklab, var(--foreground) 10%, transparent), 0 1px 2px -1px color-mix(in oklab, var(--foreground) 10%, transparent)",
  },
  s213: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    gap: 4,
    borderRadius: "0.3125rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    paddingLeft: 6,
    paddingRight: 6,
    fontSize: "0.6875rem",
    lineHeight: "1.125rem",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// A visual diff, drawn by Burf from the box's berth.visualdiff/v1
// manifest. Full size it is the slider-first view: one page large, a
// before/after wipe, sizes as tabs with each one's change, the heatmap and
// numbered regions on top; "All shots" puts every page × size in a grid in
// its place, and "Changes ‹ n of N ›" (n / p) walks every change across
// pages and sizes. Nothing changed: a calm all clear. Small (a card, a
// board tile) it is a mini wipe of its biggest change, or the all clear.

export default function VisualDiffKindView({ art, version, body, size, height }: ViewProps) {
  const v = useMemo(() => parseVdiff(body), [body]);
  if (!v)
    return (
      <div className={sx(paint.s0)} style={{ height: height ?? 120 }}>
        This visual diff's manifest doesn't parse.
      </div>
    );
  if (size === "thumb") return <VdiffThumb art={art} v={v} height={height ?? 120} />;
  return <VisualDiffView art={art} version={version} v={v} />;
}

// ---------------------------------------------------------------- the tab

function VisualDiffView({ art, version, v }: { art: Art; version: ArtVersion; v: VisualDiff }) {
  return (
    <div data-vd-view data-vd-clear={allClear(v) || undefined} className={[sx(paint.s1), sx(paint.s186)].filter(Boolean).join(" ")}>
      <Summary art={art} version={version} v={v} />
      {allClear(v) ? <AllClear art={art} v={v} /> : <SliderFirst art={art} v={v} />}
    </div>
  );
}

// Summary: what was compared with what, how long it took, what needs a
// look, and Accept as baseline.
function Summary({ art, version, v }: { art: Art; version: ArtVersion; v: VisualDiff }) {
  const n = v.settings.sizes.length;
  const sch = schemes(v);
  // Under 480px (beside the chat) it is one line, what needs a look and
  // Accept, so the stage starts near the top; the counts and timing stay
  // for screen readers.
  return (
    <div className={[sx(paint.s2), sx(paint.s187)].filter(Boolean).join(" ")} data-vd-summary>
      <div className={[sx(paint.s3), sx(paint.s188)].filter(Boolean).join(" ")}>
        <span className={[sx(paint.s4), sx(paint.s189)].filter(Boolean).join(" ")} data-vd-compare>
          {v.base.kind === "baseline" ? `${v.base.label} baseline` : v.base.label}
          {v.base.commit ? `@${v.base.commit}` : ""} → {v.head.label}
          {v.head.commit ? `@${v.head.commit}` : ""}
          {v.head.dirty ? ` +${v.head.dirty} uncommitted` : ""}
        </span>
        <span aria-hidden className={[sx(paint.s5), sx(paint.s189)].filter(Boolean).join(" ")}>
          ·
        </span>
        <span className={[sx(paint.s6), sx(paint.s190)].filter(Boolean).join(" ")}>
          {v.pages.length} {v.pages.length === 1 ? "page" : "pages"} × {n} {n === 1 ? "size" : "sizes"}
          {sch.length > 1 ? " × light and dark" : sch[0] === "dark" ? " (dark)" : ""} in {(v.timing.total_ms / 1000).toFixed(1)}s
        </span>
        <span className={sx(paint.s7)} />
        <AcceptButton art={art} version={version} v={v} />
      </div>
      {v.notice && (
        <div className={[sx(paint.s8), sx(paint.s191)].filter(Boolean).join(" ")} data-vd-notice>
          <InfoIcon className={sx(paint.s9)} aria-hidden />
          <span className={sx(paint.s10)}>{v.notice}</span>
        </div>
      )}
      <VdiffChips v={v} className={sx(paint.s192)} />
    </div>
  );
}

// VdiffChips says what needs a look: a page that now scrolls sideways, one
// that fails, a new or gone page; then how many pages are unchanged.
export function VdiffChips({ v, className, max }: { v: VisualDiff; className?: string; max?: number }) {
  const f = flags(v);
  const chip = (sx(paint.s213) ?? "");
  if (allClear(v))
    return (
      <div className={[sx(paint.s11), className].filter(Boolean).join(" ")} data-vd-chips>
        <span className={[chip, sx(paint.s12)].filter(Boolean).join(" ")}>
          <CheckCircle2Icon className={sx(paint.s13)} aria-hidden />
          {v.pages.length} pages × {v.settings.sizes.length} sizes match {baseName(v)}
        </span>
      </div>
    );
  const items: React.ReactNode[] = [
    ...f.sideways.map((o) => (
      <span key={`o${o.path}${o.size}`} data-vd-chip="sideways" className={[chip, sx(paint.s14)].filter(Boolean).join(" ")}>
        <AlertTriangleIcon className={sx(paint.s15)} aria-hidden />
        {o.path} at {o.size} scrolls sideways
      </span>
    )),
    ...f.fails.map((p) => (
      <span key={`e${p}`} data-vd-chip="fails" className={[chip, sx(paint.s16)].filter(Boolean).join(" ")}>
        <XCircleIcon className={sx(paint.s17)} aria-hidden />
        {p} fails
      </span>
    )),
    ...f.fresh.map((p) => (
      <span key={`n${p}`} data-vd-chip="new" className={[chip, sx(paint.s18)].filter(Boolean).join(" ")}>
        <PlusCircleIcon className={sx(paint.s19)} aria-hidden />
        {p} new
      </span>
    )),
    ...f.gone.map((p) => (
      <span key={`g${p}`} data-vd-chip="gone" className={[chip, sx(paint.s20)].filter(Boolean).join(" ")}>
        <AlertTriangleIcon className={sx(paint.s21)} aria-hidden />
        {p} gone
      </span>
    )),
  ];
  const shown = max ? items.slice(0, max) : items;
  return (
    <div className={[sx(paint.s22), className].filter(Boolean).join(" ")} data-vd-chips>
      {shown}
      {items.length > shown.length && <span className={[chip, sx(paint.s23)].filter(Boolean).join(" ")}>+{items.length - shown.length} more</span>}
      {f.same > 0 && (
        <span data-vd-chip="unchanged" className={[chip, sx(paint.s24)].filter(Boolean).join(" ")}>
          <CheckCircle2Icon className={sx(paint.s25)} aria-hidden />
          {f.same} unchanged
        </span>
      )}
    </div>
  );
}

// AcceptButton keeps this version's after-shots as the worktree's accepted
// baseline, after asking once. The box remembers which version it was.
function AcceptButton({ art, version, v }: { art: Art; version: ArtVersion; v: VisualDiff }) {
  const accepted = useAccepted(art);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const isLatest = version.n === latest(art).n;
  const done = accepted?.from === art.id && accepted.from_version === version.n;
  const shots = v.pages.reduce((n, p) => n + p.shots.filter((s) => s.after?.img).length, 0);
  if (v.base.label === "accepted" && allClear(v)) return null;
  if (done)
    return (
      <span className={sx(paint.s26)} data-vd-accepted>
        <CheckIcon className={sx(paint.s27)} aria-hidden />
        Accepted as baseline
      </span>
    );
  return (
    <span className={sx(paint.s28)}>
      {ask ? (
        <span className={sx(paint.s29)} data-vd-accept-ask>
          <span className={sx(paint.s30)}>
            Keep these {shots} after-shots as {art.worktree}'s accepted look? <span className={sx(paint.s31)}>Main isn't changed.</span>
          </span>
          <Button
            size="xs"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(undefined);
              try {
                await acceptBaseline(art);
                setAsk(false);
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Accept v{version.n}
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setAsk(false)}>
            Cancel
          </Button>
        </span>
      ) : (
        <Tip label={isLatest ? "Later compares with --base accepted measure against these shots" : "Only the latest version can be accepted"}>
          <Button size="xs" variant="outline" disabled={!isLatest} onClick={() => setAsk(true)} data-vd-accept>
            <StampIcon />
            Accept<span className={sx(paint.s190)}> as baseline</span>
          </Button>
        </Tip>
      )}
      {err && <span className={sx(paint.s32)}>{err}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- slider first

function useOverlays() {
  const [heat, setHeat] = useState(true);
  const [glow, setGlow] = useState(0.6);
  const [regions, setRegions] = useState(true);
  return { heat, setHeat, glow, setGlow, regions, setRegions };
}

function SliderFirst({ art, v }: { art: Art; v: VisualDiff }) {
  const pages = useMemo(() => sortedPages(v), [v]);
  const items = useMemo(() => changes(v), [v]);
  const sch = schemes(v);
  const start = firstPage(pages);
  const [scheme, setScheme] = useState<Scheme>(() => schemeOf(worstShot(start)));
  const [path, setPath] = useState(start.path);
  const page = pages.find((p) => p.path === path) ?? pages[0];
  const [size, setSize] = useState(() => worstShot(start, scheme).size);
  const shot = page.shots.find((s) => s.size === size && schemeOf(s) === scheme) ?? worstShot(page, scheme);
  const [all, setAll] = useState(false);
  const [step, setStep] = useState<number | undefined>();
  const root = useRef<HTMLDivElement>(null);
  // A new version: start again on its biggest change.
  useEffect(() => {
    const p = firstPage(pages);
    setPath(p.path);
    setScheme(schemeOf(worstShot(p)));
    setSize(worstShot(p).size);
    setStep(undefined);
  }, [pages]);
  const go = useCallback(
    (k: number) => {
      const it = items[Math.max(0, Math.min(items.length - 1, k))];
      if (!it) return;
      setStep(items.indexOf(it));
      setAll(false);
      setPath(it.page.path);
      setSize(it.shot.size);
      setScheme(schemeOf(it.shot));
    },
    [items],
  );
  // n / p (and ] / [) step through the changes, when nothing else is
  // typing and this view is the one on screen.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input,textarea,select,[contenteditable],[role=slider],.xterm")) return;
      const el = root.current;
      if (!el || !el.offsetParent) return;
      // The keyboard is in this artifact, or nowhere in particular: on
      // <body>, or home on a region round it (lib/focus-home.ts puts it on
      // <main> when what had it went away, as the chat's Open does).
      const active = document.activeElement;
      const art = el.closest("[data-testid=artifact-pane]");
      if (active && active !== document.body && !art?.contains(active) && !(art && active.contains(art))) return;
      if (e.key === "n" || e.key === "]") {
        e.preventDefault();
        go((step ?? -1) + 1);
      } else if (e.key === "p" || e.key === "[") {
        e.preventDefault();
        go((step ?? 1) - 1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, step]);
  const cur = step !== undefined ? items[step] : undefined;
  const focus = cur && cur.page.path === page.path && cur.shot === shot && cur.kind === "region" ? cur.n - 1 : undefined;

  const stepper = (
    <div className={sx(paint.s33)} data-vd-stepper role="group" aria-label="Changes">
      <span className={[sx(paint.s34), sx(paint.s193)].filter(Boolean).join(" ")}>Changes</span>
      <Tip label="Previous change · p">
        <Button size="icon-xs" variant="outline" aria-label="Previous change" onClick={() => go((step ?? 1) - 1)} disabled={!items.length || step === 0}>
          <ArrowLeftIcon />
        </Button>
      </Tip>
      <span className={[sx(paint.s35), sx(paint.s194)].filter(Boolean).join(" ")} data-vd-step>
        {step !== undefined ? `${step + 1} of ${items.length}` : `${items.length}`}
      </span>
      <Tip label="Next change · n">
        <Button size="icon-xs" variant="outline" aria-label="Next change" onClick={() => go((step ?? -1) + 1)} disabled={!items.length || step === items.length - 1}>
          <ArrowRightIcon />
        </Button>
      </Tip>
    </div>
  );
  const allBtn = (
    <Tip label={all ? "Back to one page" : "Every page and size at once"}>
      <button type="button" aria-pressed={all} onClick={() => setAll((x) => !x)} data-vd-all className={[sx(paint.s36), all ? sx(paint.s37) : sx(paint.s38)].filter(Boolean).join(" ")}>
        <LayoutGridIcon className={sx(paint.s39)} aria-hidden />
        <span className={[sx(paint.s40), sx(paint.s195)].filter(Boolean).join(" ")}>All {v.summary.shots} shots</span>
        <span className={sx(paint.s196)}>All</span>
      </button>
    </Tip>
  );
  const schemeSeg =
    sch.length > 1 ? (
      <Seg<Scheme>
        label="Colour scheme"
        value={scheme}
        onChange={(s) => {
          setScheme(s);
          setStep(undefined);
        }}
        items={[
          { v: "light", label: "Light", icon: SunIcon },
          { v: "dark", label: "Dark", icon: MoonIcon },
        ]}
      />
    ) : null;

  return (
    <div ref={root} className={sx(paint.s41)} data-vd-slider-first>
      {all ? (
        <>
          <div className={[sx(paint.s42), sx(paint.s197)].filter(Boolean).join(" ")}>
            {allBtn}
            <span className={[sx(paint.s43), sx(paint.s189)].filter(Boolean).join(" ")}>most changed first · click a shot to compare it</span>
            <span className={sx(paint.s44)} />
            {schemeSeg}
            {stepper}
          </div>
          <ShotGrid
            art={art}
            v={v}
            pages={pages}
            scheme={scheme}
            onPick={(p, sz) => {
              setAll(false);
              setPath(p);
              setSize(sz);
              setStep(undefined);
            }}
          />
        </>
      ) : (
        <Detail
          art={art}
          v={v}
          pages={pages}
          page={page}
          shot={shot}
          scheme={scheme}
          setPage={(p) => {
            setPath(p);
            setStep(undefined);
          }}
          setSize={(sz) => {
            setSize(sz);
            setStep(undefined);
          }}
          lead={allBtn}
          extra={stepper}
          schemeSeg={schemeSeg}
          focus={focus}
          caption={cur ? <ChangeCaption it={cur} total={items.length} /> : undefined}
        />
      )}
    </div>
  );
}

function ChangeCaption({ it }: { it: Change; total: number }) {
  const over = overflow(it.shot);
  return (
    <div className={sx(paint.s45)} data-vd-caption>
      <span className={[sx(paint.n0), it.kind === "region" ? "" : it.kind === "error" ? sx(paint.n1) : sx(paint.n2)].filter(Boolean).join(" ")} style={it.kind === "region" ? { background: REGION } : undefined}>
        {it.kind === "region" ? it.n : "!"}
      </span>
      <span className={sx(paint.s47)}>{it.page.path}</span>
      <span className={sx(paint.s48)}>
        {sizeName(it.shot.size)} {it.shot.size}
        {schemeOf(it.shot) === "dark" ? " · dark" : ""}
      </span>
      {it.kind === "region" ? (
        <>
          <span className={sx(paint.s49)}>
            · region {it.n} of {it.shot.regions_total ?? it.shot.regions?.length}, {it.region!.w}×{it.region!.h}
          </span>
          {it.region!.el && <span className={sx(paint.s50)}>· {it.region!.el}</span>}
          {over ? <span className={sx(paint.s51)}>· scrolls sideways (+{over}px)</span> : null}
        </>
      ) : (
        <span className={it.kind === "error" ? sx(paint.s52) : sx(paint.s53)}>· {it.shot.why}</span>
      )}
    </div>
  );
}

// Detail is one page large: pages, sizes, how to compare, and the stage.
function Detail({ art, v, pages, page, shot, scheme, setPage, setSize, lead, extra, schemeSeg, focus: focusIn, caption }: { art: Art; v: VisualDiff; pages: VdPage[]; page: VdPage; shot: VdShot; scheme: Scheme; setPage(p: string): void; setSize(s: number): void; lead?: React.ReactNode; extra?: React.ReactNode; schemeSeg?: React.ReactNode; focus?: number; caption?: React.ReactNode }) {
  const [mode, setMode] = useState<StageMode>("slider");
  const [wipe, setWipe] = useState(50);
  const [onion, setOnion] = useState(0.5);
  const ov = useOverlays();
  const [focusOwn, setFocus] = useState<number | undefined>();
  const focus = focusIn ?? focusOwn;
  const o: Overlays = { heat: ov.heat && shot.verdict === "changed", glow: ov.glow, regions: ov.regions, focus };
  const stageRef = useRef<HTMLDivElement>(null);
  const show = (i: number) => {
    setFocus(i);
    stageRef.current?.querySelector(`[data-vd-region="${i + 1}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  useEffect(() => setFocus(undefined), [page.path, shot]);
  // A change chosen with n / p scrolls into view.
  useEffect(() => {
    if (focusIn === undefined) return;
    const t = window.setTimeout(() => stageRef.current?.querySelector(`[data-vd-region="${focusIn + 1}"]`)?.scrollIntoView({ block: "center" }), 120);
    return () => window.clearTimeout(t);
  }, [focusIn, page.path, shot]);
  const shots = page.shots.filter((s) => schemeOf(s) === scheme);
  return (
    <div data-vd-detail data-vd-page={page.path} data-vd-size={shot.size} className={sx(paint.s54)}>
      <div className={[sx(paint.s55), sx(paint.s197)].filter(Boolean).join(" ")} data-vd-toolbar>
        <div className={sx(paint.s56)}>
          {lead}
          <div className={sx(paint.s57)}>
            <PageChips pages={pages} cur={page.path} scheme={scheme} onPick={setPage} />
          </div>
          {extra && <div className={[sx(paint.s58), sx(paint.s198)].filter(Boolean).join(" ")}>{extra}</div>}
        </div>
        <div className={[sx(paint.s59), sx(paint.s199)].filter(Boolean).join(" ")}>
          <SizeTabs shots={shots} cur={shot.size} onPick={setSize} />
          {schemeSeg}
          <span className={[sx(paint.s60), sx(paint.s200)].filter(Boolean).join(" ")} />
          <Seg<StageMode>
            label="How to compare"
            value={mode}
            onChange={setMode}
            items={[
              { v: "slider", label: "Slider", icon: SplitIcon },
              { v: "side", label: "Side by side", icon: Columns2Icon },
              { v: "flicker", label: "Flicker", icon: RepeatIcon },
              { v: "onion", label: "Onion skin", icon: LayersIcon },
            ]}
          />
          <OverlayControls ov={ov} shot={shot} />
          {mode === "onion" && <Range label="After" value={onion} onChange={setOnion} />}
          {extra && <div className={sx(paint.s201)}>{extra}</div>}
        </div>
        {caption}
      </div>
      <div className={sx(paint.s61)} />
      <Banner v={v} page={page} shot={shot} />
      <div className={sx(paint.s62)}>
        <div ref={stageRef} className={sx(paint.s63)}>
          <Stage art={art} v={v} shot={shot} mode={mode} o={o} wipe={wipe} setWipe={setWipe} onion={onion} />
        </div>
        {ov.regions && (shot.regions?.length ?? 0) > 0 && <RegionList shot={shot} focus={focus} onPick={show} />}
      </div>
      <Settings v={v} shot={shot} />
    </div>
  );
}

function PageChips({ pages, cur, scheme, onPick }: { pages: VdPage[]; cur: string; scheme: Scheme; onPick(p: string): void }) {
  return (
    <div className={sx(paint.s64)} role="tablist" aria-label="Pages, most changed first">
      {pages.map((p) => {
        const top = worstShot(p, scheme);
        return (
          <button key={p.path} type="button" role="tab" aria-selected={p.path === cur} data-vd-page-chip={p.path} onClick={() => onPick(p.path)} className={[sx(paint.s65), p.path === cur ? sx(paint.s66) : sx(paint.s67)].filter(Boolean).join(" ")}>
            <span className={sx(paint.s68)}>{p.path}</span>
            <VerdictTag shot={top} all={p.shots.filter((s) => schemeOf(s) === scheme)} />
          </button>
        );
      })}
    </div>
  );
}

// VerdictTag sums a page (or one shot) up in a few characters.
function VerdictTag({ shot, all }: { shot: VdShot; all?: VdShot[] }) {
  const shots = all ?? [shot];
  if (shot.verdict === "error") return <span className={sx(paint.s69)}>{shot.after?.status && shot.after.status >= 400 ? shot.after.status : "Error"}</span>;
  if (shot.verdict === "new") return <span className={sx(paint.s70)}>New</span>;
  if (shot.verdict === "removed") return <span className={sx(paint.s71)}>Gone</span>;
  if (shots.every((s) => s.verdict === "unchanged"))
    return (
      <span className={sx(paint.s72)}>
        <CheckCircle2Icon className={sx(paint.s73)} aria-hidden />
        Same
      </span>
    );
  const side = shots.some((s) => overflow(s));
  return (
    <span className={[sx(paint.s74), side ? sx(paint.s75) : sx(paint.s76)].filter(Boolean).join(" ")}>
      {side && <AlertTriangleIcon className={sx(paint.s77)} aria-label="scrolls sideways" />}
      {pct(shot.changed_pct)}
    </span>
  );
}

function SizeTabs({ shots, cur, onPick }: { shots: VdShot[]; cur: number; onPick(n: number): void }) {
  return (
    <div className={sx(paint.s78)} role="tablist" aria-label="Sizes">
      {shots.map((s) => (
        <button key={s.size} type="button" role="tab" aria-selected={s.size === cur} data-vd-size-tab={s.size} onClick={() => onPick(s.size)} className={[sx(paint.s79), s.size === cur ? sx(paint.s80) : sx(paint.s81)].filter(Boolean).join(" ")}>
          <span className={sx(paint.s82)}>
            <span className={[sx(paint.s83), sx(paint.s202)].filter(Boolean).join(" ")}>{sizeName(s.size)} </span>
            <span className={sx(paint.s84)}>{s.size}</span>
          </span>
          <VerdictTag shot={s} />
        </button>
      ))}
    </div>
  );
}

function Seg<T extends string>({ value, onChange, items, label }: { value: T; onChange(v: T): void; items: { v: T; label: string; icon: React.ComponentType<{ className?: string }> }[]; label: string }) {
  return (
    <div className={sx(paint.s85)} role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <Tip key={it.v} label={it.label}>
          <button type="button" role="radio" aria-checked={value === it.v} aria-label={it.label} data-vd-mode={it.v} onClick={() => onChange(it.v)} className={[[sx(paint.s86), sx(paint.s203)].filter(Boolean).join(" "), value === it.v ? sx(paint.s87) : sx(paint.s88)].filter(Boolean).join(" ")}>
            <it.icon className={sx(paint.s89)} />
            <span className={[sx(paint.s90), sx(paint.s204)].filter(Boolean).join(" ")}>{it.label}</span>
          </button>
        </Tip>
      ))}
    </div>
  );
}

function OverlayControls({ ov, shot }: { ov: ReturnType<typeof useOverlays>; shot: VdShot }) {
  const n = shot.regions_total ?? shot.regions?.length ?? 0;
  return (
    <div className={sx(paint.s91)}>
      <Tip label="Changed pixels, glowing by how much they changed">
        <button type="button" aria-pressed={ov.heat} aria-label="Heatmap" data-vd-heat-toggle onClick={() => ov.setHeat((h) => !h)} disabled={!shot.heat} className={[[sx(paint.s92), sx(paint.s203)].filter(Boolean).join(" "), ov.heat && shot.heat ? sx(paint.s93) : sx(paint.s94)].filter(Boolean).join(" ")}>
          <FlameIcon className={[sx(paint.s95), ov.heat && shot.heat && sx(paint.s96)].filter(Boolean).join(" ")} aria-hidden />
          <span className={[sx(paint.s97), sx(paint.s189)].filter(Boolean).join(" ")}>Heatmap</span>
        </button>
      </Tip>
      {ov.heat && shot.heat && (
        <span className={[sx(paint.s98), sx(paint.s205)].filter(Boolean).join(" ")}>
          <Range label="Glow" value={ov.glow} onChange={ov.setGlow} />
        </span>
      )}
      <Tip label="Numbered boxes around each change">
        <button type="button" aria-pressed={ov.regions} aria-label={n ? `Regions, ${n}` : "Regions"} data-vd-regions-toggle onClick={() => ov.setRegions((r) => !r)} className={[[sx(paint.s99), sx(paint.s203)].filter(Boolean).join(" "), ov.regions ? sx(paint.s100) : sx(paint.s101)].filter(Boolean).join(" ")}>
          <SquareDashedIcon className={[sx(paint.s102), ov.regions && sx(paint.s103)].filter(Boolean).join(" ")} aria-hidden />
          <span className={[sx(paint.s104), sx(paint.s189)].filter(Boolean).join(" ")}>Regions</span>
          {n ? <span className={sx(paint.s105)}>{n}</span> : null}
        </button>
      </Tip>
    </div>
  );
}

function Range({ label, value, onChange }: { label: string; value: number; onChange(n: number): void }) {
  return (
    <label className={sx(paint.s106)}>
      <span className={[sx(paint.s107), sx(paint.s193)].filter(Boolean).join(" ")}>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className={[sx(paint.s108), "vd-range"].filter(Boolean).join(" ")} aria-label={label} />
    </label>
  );
}

function Banner({ v, page, shot }: { v: VisualDiff; page: VdPage; shot: VdShot }) {
  const over = overflow(shot);
  const base = baseName(v);
  const line = (tone: "bad" | "warn" | "info" | "good", icon: React.ReactNode, text: React.ReactNode) => (
    <div data-vd-banner={tone} className={[[sx(paint.n3), sx(paint.s206)].filter(Boolean).join(" "), tone === "bad" ? sx(paint.n4) : tone === "warn" ? sx(paint.n5) : tone === "good" ? sx(paint.n6) : sx(paint.n7)].filter(Boolean).join(" ")}>
      {icon}
      <div className={sx(paint.s111)}>{text}</div>
    </div>
  );
  if (shot.verdict === "error")
    return line(
      "bad",
      <XCircleIcon className={sx(paint.s112)} aria-hidden />,
      <>
        <span className={sx(paint.s113)}>
          {page.path} fails on {shot.why?.startsWith("before") ? base : v.head.label}
        </span>{" "}
        <span className={sx(paint.s114)}>· {shot.why}</span>
        {shot.after?.errors?.[0] && <div className={sx(paint.s115)}>{shot.after.errors[0]}</div>}
      </>,
    );
  if (shot.verdict === "new")
    return line(
      "info",
      <PlusCircleIcon className={sx(paint.s116)} aria-hidden />,
      <>
        <span className={sx(paint.s117)}>A new page.</span>{" "}
        <span className={sx(paint.s118)}>
          {page.path} {shot.why === "not in the baseline" ? `isn't in ${base}` : `is a 404 on ${base}`}; this is how it looks on {v.head.label}.
        </span>
      </>,
    );
  if (shot.verdict === "removed")
    return line(
      "warn",
      <AlertTriangleIcon className={sx(paint.s119)} aria-hidden />,
      <>
        <span className={sx(paint.s120)}>This page is gone.</span> <span className={sx(paint.s121)}>{page.path} is a 404 on {v.head.label}.</span>
      </>,
    );
  if (shot.verdict === "unchanged")
    return line(
      "good",
      <CheckCircle2Icon className={sx(paint.s122)} aria-hidden />,
      <>
        <span className={sx(paint.s123)}>No visual change</span>{" "}
        <span className={sx(paint.s124)}>
          at {sizeName(shot.size)} {shot.size}
          {shot.masks?.length ? ` · ${shot.masks.length} dynamic ${shot.masks.length === 1 ? "area" : "areas"} masked` : ""}.
        </span>
      </>,
    );
  if (over)
    return line(
      "bad",
      <AlertTriangleIcon className={sx(paint.s125)} aria-hidden />,
      <>
        <span className={sx(paint.s126)}>Now scrolls sideways at {shot.size}</span>
        <span className={sx(paint.s127)}>
          : {over}px wider than the screen<span className={[sx(paint.s128), sx(paint.s189)].filter(Boolean).join(" ")}>, and it wasn't on {base}. Usually a row that doesn't wrap or a fixed width</span>.
        </span>
      </>,
    );
  return null;
}

function RegionList({ shot, focus, onPick }: { shot: VdShot; focus?: number; onPick(i: number): void }) {
  const total = shot.regions_total ?? shot.regions!.length;
  return (
    <aside className={[sx(paint.s129), sx(paint.s207)].filter(Boolean).join(" ")} aria-label="Regions" data-vd-region-list>
      <div className={sx(paint.s130)}>
        <div className={sx(paint.s131)}>
          {total} {total === 1 ? "region" : "regions"} · {shot.changed_px.toLocaleString("en-US")} px
        </div>
        {shot.regions!.map((r, i) => (
          <button key={`${r.x}-${r.y}-${i}`} type="button" onClick={() => onPick(i)} className={[sx(paint.s132), focus === i && sx(paint.s133)].filter(Boolean).join(" ")}>
            <span className={sx(paint.s134)}>
              <span className={sx(paint.s135)} style={{ background: REGION }}>
                {i + 1}
              </span>
              <span className={sx(paint.s136)}>
                {r.w}×{r.h}
              </span>
              <span className={sx(paint.s137)}>{r.px >= 1000 ? `${(r.px / 1000).toFixed(1)}k px` : `${r.px} px`}</span>
            </span>
            {r.el && <span className={sx(paint.s138)}>{r.el}</span>}
          </button>
        ))}
        {total > shot.regions!.length && <div className={sx(paint.s139)}>+{total - shot.regions!.length} smaller</div>}
      </div>
    </aside>
  );
}

function Settings({ v, shot }: { v: VisualDiff; shot: VdShot }) {
  const ms = Math.max(shot.before?.ms ?? 0, shot.after?.ms ?? 0);
  return (
    <div className={sx(paint.s140)}>
      <span>
        {shot.viewport[0]}×{shot.viewport[1]} at {v.settings.scale}x{schemeOf(shot) === "dark" ? ", dark" : ""}
      </span>
      <span aria-hidden>·</span>
      <span>reduced motion, animations settled, caret hidden, UTC</span>
      {v.settings.mask?.length ? (
        <>
          <span aria-hidden>·</span>
          <span>
            masked <span className={sx(paint.s141)}>{v.settings.mask.join(", ")}</span>
          </span>
        </>
      ) : null}
      <span aria-hidden>·</span>
      <span>threshold {v.settings.threshold}</span>
      {ms ? (
        <>
          <span aria-hidden>·</span>
          <span className={sx(paint.s142)}>
            shot in {(ms / 1000).toFixed(1)}s, diffed in {shot.diff_ms} ms
          </span>
        </>
      ) : null}
      {v.settings.chromium && <span className={[sx(paint.s143), sx(paint.s193)].filter(Boolean).join(" ")}>{v.settings.chromium}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- all shots

function ShotGrid({ art, v, pages, scheme, onPick }: { art: Art; v: VisualDiff; pages: VdPage[]; scheme: Scheme; onPick(path: string, size: number): void }) {
  const sizes = v.settings.sizes;
  return (
    <div data-vd-grid className={sx(paint.s144)} style={{ gridTemplateColumns: `minmax(5.5rem,8rem) repeat(${sizes.length}, minmax(0,1fr))` }}>
      <span />
      {sizes.map((s) => (
        <span key={s} className={sx(paint.s145)}>
          <span className={[sx(paint.s146), sx(paint.s202)].filter(Boolean).join(" ")}>{sizeName(s)} </span>
          <span className={sx(paint.s147)}>{s}</span>
        </span>
      ))}
      {pages.map((p) => {
        const same = p.shots.every((s) => s.verdict === "unchanged");
        return (
          <div key={p.path} className={sx(paint.s148)}>
            <div className={sx(paint.s149)}>
              <span className={sx(paint.s150)}>{p.path}</span>
              <span className={sx(paint.s151)}>{p.title}</span>
            </div>
            {sizes.map((size) => {
              const s = p.shots.find((x) => x.size === size && schemeOf(x) === scheme);
              return s ? <Cell key={size} art={art} path={p.path} s={s} dim={same} onPick={() => onPick(p.path, size)} /> : <span key={size} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

function useWidth(min = 80, initial = 220) {
  const ref = useRef<HTMLButtonElement & HTMLDivElement>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(min, el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setW(Math.max(min, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w] as const;
}

function Cell({ art, path, s, dim, onPick }: { art: Art; path: string; s: VdShot; dim: boolean; onPick(): void }) {
  const [ref, w] = useWidth();
  const h = Math.round(w * 0.62);
  const r = s.regions?.[0];
  // Every cell at the same scale: the page's full width, from the top, or
  // from just above its biggest change when that is further down.
  const fh = s.size / (w / h);
  const pageH = Math.max(s.after?.h ?? 0, s.before?.h ?? 0, s.viewport[1]);
  const view = { x: 0, y: r && r.y > fh * 0.8 ? Math.min(Math.max(0, pageH - fh), r.y - fh * 0.2) : 0, w: s.size, h: fh };
  const over = overflow(s);
  return (
    <button ref={ref} type="button" onClick={onPick} data-vd-cell={`${path}@${s.size}`} aria-label={`${path} at ${s.size}: ${s.verdict === "changed" ? pct(s.changed_pct) : s.verdict}`} className={[[sx(paint.s152), "group"].filter(Boolean).join(" "), (over || s.verdict === "error") && sx(paint.s153)].filter(Boolean).join(" ")}>
      <div className={dim ? [sx(paint.s154), sx(paint.s208)].filter(Boolean).join(" ") : undefined}>
        <Crop art={art} shot={s} r={view} side={s.verdict === "removed" ? "before" : "after"} w={w} h={h} heat={s.verdict === "changed" ? 0.6 : 0} outline={r} />
      </div>
      {s.verdict === "error" && (
        <div className={sx(paint.s155)}>
          <XCircleIcon className={sx(paint.s156)} aria-hidden />
          <span className={sx(paint.s157)}>{s.why}</span>
        </div>
      )}
      <div className={[sx(paint.s158), sx(paint.s209)].filter(Boolean).join(" ")}>
        <span className={[sx(paint.s159), sx(paint.s210)].filter(Boolean).join(" ")}>
          <VerdictTag shot={s} />
          {s.verdict === "changed" && (
            <span className={sx(paint.s160)}>
              · {s.regions_total ?? s.regions?.length} {(s.regions_total ?? 0) === 1 ? "region" : "regions"}
            </span>
          )}
        </span>
        {over ? <span className={sx(paint.s161)}>↔ +{over}px</span> : null}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------- all clear

function AllClear({ art, v }: { art: Art; v: VisualDiff }) {
  const sch = schemes(v);
  return (
    <div className={sx(paint.s162)} data-vd-all-clear>
      <div className={sx(paint.s163)}>
        <span className={[sx(paint.s164), "vd-clear"].filter(Boolean).join(" ")}>
          <CheckCircle2Icon className={sx(paint.s165)} aria-hidden />
        </span>
        <h3 className={sx(paint.s166)}>No visual changes</h3>
        <p className={[sx(paint.s167), sx(paint.s211)].filter(Boolean).join(" ")}>
          All {v.summary.shots} shots of {v.pages.length} {v.pages.length === 1 ? "page" : "pages"} match {baseName(v)} pixel for pixel{v.settings.mask?.length ? ", with dynamic content masked" : ""}.
        </p>
      </div>
      <div className={sx(paint.s168)}>
        {v.pages.map((p) => (
          <ClearTile key={p.path} art={art} p={p} />
        ))}
      </div>
      <div className={sx(paint.s169)}>
        <span>sizes {v.settings.sizes.join(", ")}</span>
        {sch.length > 1 && (
          <>
            <span aria-hidden>·</span>
            <span>light and dark</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>threshold {v.settings.threshold}</span>
        <span aria-hidden>·</span>
        <span className={sx(paint.s170)}>
          {(v.timing.total_ms / 1000).toFixed(1)}s for {v.summary.shots} shots
        </span>
        {v.base.taken && (
          <>
            <span aria-hidden>·</span>
            <span>baseline from {new Date(v.base.taken).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ClearTile({ art, p }: { art: Art; p: VdPage }) {
  const [ref, w] = useWidth(60, 160);
  const s = [...p.shots].sort((x, y) => y.size - x.size)[0];
  const h = 104;
  return (
    <div ref={ref} className={sx(paint.s171)}>
      <Crop art={art} shot={s} r={{ x: 0, y: 0, w: s.size, h: s.size * (h / w) }} side="after" w={w} h={h} />
      <div className={sx(paint.s172)}>
        <span className={sx(paint.s173)}>{p.path}</span>
        <span className={sx(paint.s174)}>
          <CheckCircle2Icon className={sx(paint.s175)} aria-hidden />
          {p.shots.length}/{p.shots.length}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- thumbnails

// VdiffThumb is a visual diff small: its biggest change, before against
// after split down the middle, the heat glowing on the after half; or, all
// clear, a row of unchanged pages.
function VdiffThumb({ art, v, height }: { art: Art; v: VisualDiff; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(240);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(60, el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setW(Math.max(60, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (allClear(v)) {
    const ps = v.pages.slice(0, Math.max(1, Math.min(4, Math.floor(w / 70))));
    const cw = (w - (ps.length - 1) * 4) / ps.length;
    return (
      <div ref={ref} className={sx(paint.s176)} style={{ height }} data-vd-thumb="clear">
        {ps.map((p) => {
          const s = [...p.shots].sort((x, y) => y.size - x.size)[0];
          return <Crop key={p.path} art={art} shot={s} r={{ x: 0, y: 0, w: s.size, h: s.size * (height / cw) }} side="after" w={cw} h={height} className={sx(paint.s177)} />;
        })}
        <span className={[sx(paint.s178), sx(paint.s212)].filter(Boolean).join(" ")}>
          <CheckCircle2Icon className={sx(paint.s179)} aria-hidden /> All clear
        </span>
      </div>
    );
  }
  const it = thumbShot(v);
  if (!it) {
    // Only errors and new pages: the first page that has an image.
    const p = v.pages.find((x) => x.shots.some((s) => s.after?.img));
    const s = p?.shots.find((x) => x.after?.img);
    return (
      <div ref={ref} className={sx(paint.s180)} style={{ height }} data-vd-thumb="other">
        {s && <Crop art={art} shot={s} r={{ x: 0, y: 0, w: s.size, h: s.size / (w / height) }} side="after" w={w} h={height} />}
      </div>
    );
  }
  const aspect = w / height;
  const shot = it.shot;
  const fh = shot.size / aspect;
  // The first screen, or the first change when it sits further down.
  const reg = [...(shot.regions ?? [])].sort((a, b) => a.y - b.y)[0];
  const r = reg && reg.y > fh * 0.7 ? frame({ x: 0, y: reg.y, w: shot.size, h: reg.h }, shot.size, Math.max(shot.after?.h ?? 0, shot.before?.h ?? 0), aspect) : { x: 0, y: 0, w: shot.size, h: fh };
  return (
    <div ref={ref} className={sx(paint.s181)} style={{ height }} data-vd-thumb="wipe">
      <Crop art={art} shot={shot} r={r} side="after" w={w} h={height} heat={0.8} />
      <div className={sx(paint.s182)} style={{ width: w / 2 }}>
        <Crop art={art} shot={shot} r={r} side="before" w={w} h={height} />
      </div>
      <div className={sx(paint.s183)} style={{ left: w / 2 - 1 }} />
      <span className={sx(paint.s184)}>before</span>
      <span className={sx(paint.s185)}>
        after · {it.page.path} {shot.size}
      </span>
    </div>
  );
}

