import * as stylex from "@stylexjs/stylex";
import { AlertCircleIcon, AlertTriangleIcon, ArrowUpIcon, BarChart3Icon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, GitBranchIcon, GlobeIcon, LayoutGridIcon, RefreshCwIcon, SendIcon, Table2Icon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import type { ArtId } from "@/lib/whats-new-model";
import { color, radius, font } from "@/styles/tokens.stylex";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "width": "100%",
    "overflow": "hidden",
    "backgroundColor": "var(--background)",
  },
  s1: {
    "position": "absolute",
    "top": "0px",
    "left": "0px",
    "userSelect": "none",
    "color": "var(--foreground)",
    "fontSize": "12px",
    "lineHeight": "1.25",
  },
  s2: {
    "display": "block",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 20%, transparent)",
  },
  s3: {
    "display": "flex",
    "height": "74px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s4: {
    "display": "flex",
    "width": "136px",
    "flexShrink": 0,
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "14px",
    "paddingRight": "14px",
    "paddingTop": "12px",
    "paddingBottom": "12px",
  },
  s5: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "justifyContent": "center",
    "gap": "4px",
    "paddingLeft": "14px",
    "paddingRight": "14px",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontWeight": 500,
  },
  s7: {
    "fontWeight": 500,
    "fontSize": "11.5px",
  },
  s8: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s9: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontSize": "10px",
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s10: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--success)",
  },
  s11: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "gap": "10px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "20px",
  },
  s12: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s13: {
    "display": "flex",
    "width": "100%",
    "alignItems": "flex-end",
    "gap": "8px",
  },
  s14: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "flex-end",
    "gap": "2px",
  },
  s15: {
    "width": "100%",
    "borderTopLeftRadius": "2px",
    "borderTopRightRadius": "2px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
  },
  s16: {
    "width": "100%",
    "borderTopLeftRadius": "2px",
    "borderTopRightRadius": "2px",
    "backgroundColor": "var(--info)",
  },
  s17: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s18: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "justifyContent": "center",
    "gap": "5px",
  },
  s19: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s20: {
    "height": "4px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 25%, transparent)",
  },
  s21: {
    "height": "4px",
    "width": "14px",
    "borderRadius": "999px",
  },
  s22: {
    "backgroundColor": "var(--destructive)",
  },
  s23: {
    "backgroundColor": "var(--success)",
  },
  s24: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s25: {
    "marginTop": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingBottom": "16px",
  },
  s26: {
    "display": "flex",
    "height": "32px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "color": "var(--muted-foreground)",
  },
  s27: {
    "marginLeft": "auto",
    "display": "flex",
    "width": "20px",
    "height": "20px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "var(--muted)",
  },
  s28: {
    "width": "12px",
    "height": "12px",
  },
  s29: {
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-lg)",
    "backgroundColor": "var(--accent)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "color": "var(--foreground)",
  },
  s30: {
    "width": "14px",
    "height": "14px",
  },
  s31: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "gap": "10px",
    "backgroundColor": "var(--card)",
    "padding": "14px",
  },
  s32: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s33: {
    "width": "12px",
    "height": "12px",
    "borderRadius": "3px",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 70%, transparent)",
  },
  s34: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 30%, transparent)",
  },
  s35: {
    "marginLeft": "auto",
    "display": "flex",
    "gap": "8px",
  },
  s36: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
    "paddingTop": "6px",
  },
  s37: {
    "display": "block",
    "height": "12px",
    "width": "64%",
    "borderRadius": "var(--radius-sm)",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 55%, transparent)",
  },
  s38: {
    "position": "relative",
    "display": "block",
    "height": "24px",
    "borderRadius": "var(--radius-sm)",
    "backgroundColor": "color-mix(in oklab, var(--info) 20%, transparent)",
  },
  s39: {
    "position": "absolute",
    "display": "flex",
    "width": "16px",
    "height": "16px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "backgroundColor": "var(--warning)",
    "fontWeight": 600,
    "fontSize": "9px",
    "color": "var(--background)",
  },
  s40: {
    "display": "grid",
    "gridTemplateColumns": "repeat(3, minmax(0, 1fr))",
    "gap": "8px",
  },
  s41: {
    "display": "flex",
    "height": "80px",
    "flexDirection": "column",
    "justifyContent": "flex-end",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "padding": "8px",
  },
  s42: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
  },
  s43: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontSize": "11px",
  },
  s44: {
    "display": "flex",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "padding": "2px",
  },
  s45: {
    "borderRadius": "5px",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontWeight": 500,
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s46: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "color": "var(--muted-foreground)",
  },
  s47: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "color": "var(--muted-foreground)",
  },
  s48: {
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "color": "var(--muted-foreground)",
  },
  s49: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
  },
  s50: {
    "width": "14px",
    "height": "14px",
  },
  s51: {
    "color": "var(--foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s52: {
    "width": "14px",
    "height": "14px",
  },
  s53: {
    "position": "relative",
    "marginLeft": "24px",
    "marginRight": "24px",
    "marginTop": "16px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "borderTopLeftRadius": "var(--radius-lg)",
    "borderTopRightRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "borderBottomWidth": 0,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
  },
  s54: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s55: {
    "position": "absolute",
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0,
  },
  s56: {
    "position": "absolute",
    "top": 0,
    "bottom": 0,
    "left": "46%",
    "width": "1px",
    "backgroundColor": "color-mix(in oklab, var(--foreground) 80%, transparent)",
  },
  s57: {
    "position": "absolute",
    "left": "0px",
    "display": "flex",
    "height": "28px",
    "width": "18px",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "1px",
    "borderRadius": "999px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 8%, transparent)",
  },
  s58: {
    "height": "12px",
    "width": "1px",
    "backgroundColor": "var(--muted-foreground)",
  },
  s59: {
    "height": "12px",
    "width": "1px",
    "backgroundColor": "var(--muted-foreground)",
  },
  s60: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
  },
  s61: {
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
  s62: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s63: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s64: {
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 12%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontWeight": 500,
    "fontSize": "10.5px",
    "color": "var(--destructive-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s65: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "backgroundColor": "var(--card)",
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
  },
  s66: {
    "fontWeight": 600,
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s67: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "backgroundColor": "var(--background)",
  },
  s68: {
    "display": "flex",
    "alignItems": "center",
    "gap": "16px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "fontSize": "11.5px",
  },
  s69: {
    "borderColor": "var(--foreground)",
    "borderBottomWidth": 2,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingBottom": "6px",
    "fontWeight": 500,
  },
  s70: {
    "paddingBottom": "6px",
    "color": "var(--muted-foreground)",
  },
  s71: {
    "marginLeft": "auto",
    "paddingBottom": "6px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s72: {
    "height": "32px",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 8%, transparent)",
  },
  s73: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--destructive-foreground)",
  },
  s74: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--destructive-foreground)",
  },
  s75: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "4px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontFamily": "var(--font-sans)",
    "fontSize": "11px",
    "color": "var(--foreground)",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s76: {
    "width": "12px",
    "height": "12px",
  },
  s77: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--destructive-foreground)",
  },
  s78: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--destructive-foreground)",
  },
  s79: {
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
    "color": "var(--warning-foreground)",
  },
  s80: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "var(--warning-foreground)",
  },
  s81: {
    "color": "var(--muted-foreground)",
  },
  s82: {
    "width": "14px",
    "flexShrink": 0,
  },
  s83: {
    "display": "flex",
    "height": "100%",
  },
  s84: {
    "display": "flex",
    "width": "236px",
    "flexShrink": 0,
    "flexDirection": "column",
    "gap": "2px",
    "borderRightWidth": 1,
    "borderRightStyle": "solid",
    "borderRightColor": "var(--border)",
    "backgroundColor": "var(--sidebar)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
    "color": "var(--sidebar-foreground)",
  },
  s85: {
    "fontWeight": 500,
  },
  s86: {
    "width": "12px",
    "height": "12px",
    "borderRadius": "3px",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--muted-foreground) 60%, transparent)",
  },
  s87: {
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s88: {
    "paddingLeft": "24px",
  },
  s89: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--warning)",
  },
  s90: {
    "marginTop": "2px",
    "marginBottom": "4px",
    "marginLeft": "16px",
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s91: {
    "display": "flex",
    "height": "28px",
    "alignItems": "center",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--ring)",
    "backgroundColor": "var(--background)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "boxShadow": "0 0 0 2px color-mix(in oklab, var(--ring) 25%, transparent)",
  },
  s92: {
    "marginLeft": "1px",
    "height": "14px",
    "width": "1px",
    "backgroundColor": "var(--foreground)",
  },
  s93: {
    "whiteSpace": "nowrap",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "10px",
    "color": "var(--muted-foreground)",
  },
  s94: {
    "fontFamily": "var(--font-mono)",
  },
  s95: {
    "paddingLeft": "24px",
  },
  s96: {
    "width": "12px",
    "height": "12px",
    "color": "var(--success)",
  },
  s97: {
    "paddingLeft": "24px",
  },
  s98: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--success)",
  },
  s99: {
    "paddingLeft": "24px",
    "color": "var(--muted-foreground)",
  },
  s100: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 50%, transparent)",
  },
  s101: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
  },
  s102: {
    "display": "flex",
    "height": "36px",
    "alignItems": "center",
    "gap": "6px",
    "borderBottomWidth": 1,
    "borderBottomStyle": "solid",
    "borderBottomColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s103: {
    "display": "flex",
    "height": "24px",
    "alignItems": "center",
    "gap": "6px",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontWeight": 500,
    "fontSize": "11px",
  },
  s104: {
    "display": "flex",
    "height": "24px",
    "alignItems": "center",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--accent)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "fontSize": "11px",
  },
  s105: {
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "gap": "10px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "14px",
  },
  s106: {
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s107: {
    "color": "var(--foreground)",
  },
  s108: {
    "marginLeft": "auto",
    "maxWidth": "85%",
    "borderRadius": "var(--radius-xl)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "11px",
  },
  s109: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s110: {
    "display": "flex",
    "height": "28px",
    "alignItems": "center",
    "gap": "6px",
    "borderTopWidth": 1,
    "borderTopStyle": "solid",
    "borderTopColor": "var(--border)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "fontSize": "10.5px",
    "color": "var(--muted-foreground)",
  },
  s111: {
    "width": "12px",
    "height": "12px",
  },
  s112: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  s113: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "fontFamily": "var(--font-mono)",
  },
  s114: {
    "display": "flex",
    "width": "20px",
    "height": "20px",
    "alignItems": "center",
    "justifyContent": "center",
    "borderRadius": "999px",
    "fontWeight": 600,
    "fontSize": "10px",
  },
  s115: {
    "fontWeight": 500,
  },
  s116: {
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s117: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "gap": "12px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "24px",
  },
  s118: {
    "marginLeft": "auto",
    "maxWidth": "70%",
    "borderRadius": "var(--radius-xl)",
    "backgroundColor": "var(--muted)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
  },
  s119: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "padding": "12px",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s120: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s121: {
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--info) 12%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontWeight": 500,
    "fontSize": "10px",
    "color": "var(--info-foreground)",
  },
  s122: {
    "marginLeft": "auto",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s123: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
    "lineHeight": "1.375",
  },
  s124: {
    "alignSelf": "flex-start",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "11px",
  },
  s125: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s126: {
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--warning) 12%, transparent)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "1px",
    "paddingBottom": "1px",
    "fontWeight": 500,
    "fontSize": "10px",
    "color": "var(--warning-foreground)",
  },
  s127: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  s128: {
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "11px",
  },
  s129: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "paddingLeft": "4px",
    "paddingRight": "4px",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
  },
  s130: {
    "width": "6px",
    "height": "6px",
    "borderRadius": "999px",
  },
  s131: {
    "color": "color-mix(in oklab, var(--foreground) 85%, transparent)",
  },
  s132: {
    "marginLeft": "auto",
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
  },
  s133: {
    "width": "14px",
    "height": "14px",
    "color": "var(--success)",
  },
  s134: {
    "display": "flex",
    "height": "100%",
    "flexDirection": "column",
    "gap": "14px",
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingTop": "20px",
  },
  s135: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
  },
  s136: {
    "color": "var(--muted-foreground)",
  },
  s137: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
  },
  s138: {
    "height": "6px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "borderRadius": "999px",
    "backgroundColor": "color-mix(in oklab, var(--muted-foreground) 25%, transparent)",
  },
  s139: {
    "width": "48px",
    "textAlign": "right",
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--muted-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s140: {
    "display": "flex",
    "alignItems": "center",
    "gap": "12px",
  },
  s141: {
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
  },
  s142: {
    "display": "block",
    "height": "6px",
    "borderRadius": "999px",
    "backgroundColor": "var(--success)",
  },
  s143: {
    "width": "48px",
    "textAlign": "right",
    "fontWeight": 500,
    "fontFamily": "var(--font-mono)",
    "fontSize": "11px",
    "color": "var(--success-foreground)",
    "fontVariantNumeric": "tabular-nums",
  },
  s144: {
    "marginTop": "auto",
    "marginBottom": "16px",
    "display": "flex",
    "alignItems": "center",
    "gap": "10px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "var(--card)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "boxShadow": "0 1px 2px color-mix(in oklab, var(--foreground) 6%, transparent)",
  },
  s145: {
    "width": "14px",
    "height": "14px",
    "color": "var(--muted-foreground)",
  },
  s146: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s147: {
    "color": "var(--muted-foreground)",
  },
  s148: {
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "11px",
  },

  s149: {
    transformOrigin: "top left",
  },
  s150: {
    outlineWidth: 2,
    outlineStyle: "solid",
    outlineColor: color.warning,
    outlineOffset: 2,
  },
  s151: {
    top: -8,
    right: -8,
  },
  s152: {
    top: "50%",
    translate: "-50% -50%",
  },
  s153: {
    display: "flex",
    height: 28,
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    paddingLeft: 16,
    paddingRight: 16,
    fontFamily: font.mono,
    fontSize: 11,
  },
  s154: {
    display: "flex",
    height: 28,
    alignItems: "center",
    gap: 8,
    borderRadius: radius.md,
    paddingLeft: 8,
    paddingRight: 8,
  },
  s155: {
    color: "var(--success-foreground)",
  },
  s156: {
    color: color.destructiveForeground,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// The What's new card's pictures: small renders of the app's own pieces
// (an artifact's card, a visual diff's slider, the Console drawer, a row
// being renamed, a helper's report, the times), drawn with the theme's
// tokens so they look right in every theme. Each is drawn at about the
// app's own size on a 480×280 canvas and scaled to fit its frame. They say
// nothing a screen reader needs (the item's words do), so they are hidden
// from it, and nothing in them moves.

export const ART_W = 480;
export const ART_H = 280;

// WhatsNewArt fills its container's width, keeping the canvas's shape.
export function WhatsNewArt({ art, className }: { art: ArtId; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(ART_W);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || ART_W));
    ro.observe(el);
    setWidth(el.clientWidth || ART_W);
    return () => ro.disconnect();
  }, []);
  const k = width / ART_W;
  const Draw = DRAW[art];
  return (
    <div ref={box} aria-hidden className={[sx(paint.s0), className].filter(Boolean).join(" ")} style={{ height: ART_H * k }} data-whats-new-art={art}>
      <div className={[sx(paint.s1), sx(paint.s149)].filter(Boolean).join(" ")} style={{ width: ART_W, height: ART_H, transform: `scale(${k})` }}>
        <Draw />
      </div>
    </div>
  );
}

const DRAW: Record<ArtId, () => React.ReactElement> = {
  artifacts: Artifacts,
  "visual-diff": VisualDiff,
  devtools: Devtools,
  rename: Rename,
  "agent-messages": AgentMessages,
  speed: Speed,
};

// A line of text that isn't there: a muted bar.
const Bar = ({ w, className }: { w: number | string; className?: string }) => <span className={[sx(paint.s2), className].filter(Boolean).join(" ")} style={{ width: w }} />;

// An artifact's card in a chat, as components/art/art-card.tsx draws it:
// a thumbnail, its title, the headline its data gives, what and which
// version. Under the reply box, "N artifacts" opens the board.
function ArtCard({ thumb, icon, title, gist, gistClass, meta, live }: { thumb: React.ReactNode; icon: React.ReactNode; title: string; gist: string; gistClass: string; meta: string; live?: boolean }) {
  return (
    <div className={sx(paint.s3)}>
      <div className={sx(paint.s4)}>{thumb}</div>
      <div className={sx(paint.s5)}>
        <span className={sx(paint.s6)}>
          {icon}
          {title}
        </span>
        <span className={[sx(paint.s7), gistClass].filter(Boolean).join(" ")}>{gist}</span>
        <span className={sx(paint.s8)}>
          {meta}
          {live && (
            <span className={sx(paint.s9)}>
              <span className={sx(paint.s10)} />
              Live
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function Artifacts() {
  const bars = [
    [46, 16],
    [34, 13],
    [40, 20],
    [26, 10],
    [30, 14],
  ];
  return (
    <div className={sx(paint.s11)}>
      <span className={sx(paint.s12)}>The trigram index is in. Here is what it did:</span>
      <ArtCard
        thumb={
          <span className={sx(paint.s13)}>
            {bars.map(([a, b], i) => (
              <span key={i} className={sx(paint.s14)}>
                <span className={sx(paint.s15)} style={{ height: a }} />
                <span className={sx(paint.s16)} style={{ height: b }} />
              </span>
            ))}
          </span>
        }
        icon={<BarChart3Icon className={sx(paint.s17)} />}
        title="p95 before and after"
        gist="/search 1,240 → 410 ms (−67%)"
        gistClass={sx(paint.s155)}
        meta="Bar chart · v2"
        live
      />
      <ArtCard
        thumb={
          <span className={sx(paint.s18)}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={sx(paint.s19)}>
                <span className={sx(paint.s20)} />
                <span className={[sx(paint.s21), i === 1 || i === 3 ? sx(paint.s22) : sx(paint.s23)].filter(Boolean).join(" ")} />
              </span>
            ))}
          </span>
        }
        icon={<Table2Icon className={sx(paint.s24)} />}
        title="Search test results"
        gist="3 failed of 16"
        gistClass={sx(paint.s156)}
        meta="Table · v1"
      />
      <div className={sx(paint.s25)}>
        <span className={sx(paint.s26)}>
          Reply, or ask for something else
          <span className={sx(paint.s27)}>
            <ArrowUpIcon className={sx(paint.s28)} />
          </span>
        </span>
        <span className={sx(paint.s29)}>
          <LayoutGridIcon className={sx(paint.s30)} />6 artifacts
        </span>
      </div>
    </div>
  );
}

// A page, drawn in blocks; `after` has a banner the change added, which
// pushed the cards down.
function Page({ after }: { after?: boolean }) {
  return (
    <div className={sx(paint.s31)}>
      <div className={sx(paint.s32)}>
        <span className={sx(paint.s33)} />
        <Bar w={48} className={sx(paint.s34)} />
        <span className={sx(paint.s35)}>
          <Bar w={22} />
          <Bar w={22} />
          <Bar w={22} />
        </span>
      </div>
      <div className={sx(paint.s36)}>
        <span className={sx(paint.s37)} />
        <Bar w="48%" />
      </div>
      {after && (
        <span className={[sx(paint.s38), sx(paint.s150)].filter(Boolean).join(" ")}>
          <span className={[sx(paint.s39), sx(paint.s151)].filter(Boolean).join(" ")}>1</span>
        </span>
      )}
      <div className={sx(paint.s40)}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={sx(paint.s41)}>
            <Bar w="80%" />
            <Bar w="50%" />
          </span>
        ))}
      </div>
    </div>
  );
}

// A visual diff's tab: the before/after slider on a page, the change boxed
// and numbered.
function VisualDiff() {
  return (
    <div className={sx(paint.s42)}>
      <div className={sx(paint.s43)}>
        <span className={sx(paint.s44)}>
          <span className={sx(paint.s45)}>Slider</span>
          <span className={sx(paint.s46)}>Side by side</span>
          <span className={sx(paint.s47)}>Flicker</span>
          <span className={sx(paint.s48)}>Heatmap</span>
        </span>
        <span className={sx(paint.s49)}>
          Changes
          <ChevronLeftIcon className={sx(paint.s50)} />
          <span className={sx(paint.s51)}>1 of 3</span>
          <ChevronRightIcon className={sx(paint.s52)} />
        </span>
      </div>
      <div className={sx(paint.s53)}>
        <div className={sx(paint.s54)}>
          <Page />
        </div>
        <div className={sx(paint.s55)} style={{ clipPath: "inset(0 0 0 46%)" }}>
          <Page after />
        </div>
        <div className={sx(paint.s56)}>
          <span className={[sx(paint.s57), sx(paint.s152)].filter(Boolean).join(" ")}>
            <span className={sx(paint.s58)} />
            <span className={sx(paint.s59)} />
          </span>
        </div>
      </div>
    </div>
  );
}

// A Browser tab with its Console drawer open, an error ready to send.
function Devtools() {
  const row = (sx(paint.s153) ?? "");
  return (
    <div className={sx(paint.s60)}>
      <div className={sx(paint.s61)}>
        <GlobeIcon className={sx(paint.s62)} />
        <span className={sx(paint.s63)}>http://checkout-fix.shop.devl.localhost:1377/cart</span>
        <span className={sx(paint.s64)}>4</span>
      </div>
      <div className={sx(paint.s65)}>
        <span className={sx(paint.s66)}>Cart</span>
        <Bar w="34%" />
      </div>
      <div className={sx(paint.s67)}>
        <div className={sx(paint.s68)}>
          <span className={sx(paint.s69)}>Console</span>
          <span className={sx(paint.s70)}>Network</span>
          <span className={sx(paint.s71)}>⌘⌥I</span>
        </div>
        <div className={[row, sx(paint.s72)].filter(Boolean).join(" ")}>
          <AlertCircleIcon className={sx(paint.s73)} />
          <span className={sx(paint.s74)}>TypeError: cart.summary is undefined</span>
          <span className={sx(paint.s75)}>
            <SendIcon className={sx(paint.s76)} />
            Send to agent
          </span>
        </div>
        <div className={row}>
          <AlertCircleIcon className={sx(paint.s77)} />
          <span className={sx(paint.s78)}>Unhandled rejection: payment provider timed out</span>
        </div>
        <div className={row}>
          <AlertTriangleIcon className={sx(paint.s79)} />
          <span className={sx(paint.s80)}>Image has no width or height</span>
        </div>
        <div className={[row, sx(paint.s81)].filter(Boolean).join(" ")}>
          <span className={sx(paint.s82)} />
          cart ready {"{ items: 2, currency: \"EUR\" }"}
        </div>
      </div>
    </div>
  );
}

// The sidebar with a worktree's row turned into its name field, and the
// name where the worktree shows: its tab group, with the branch kept.
function Rename() {
  const row = (sx(paint.s154) ?? "");
  return (
    <div className={sx(paint.s83)}>
      <div className={sx(paint.s84)}>
        <div className={[row, sx(paint.s85)].filter(Boolean).join(" ")}>
          <span className={sx(paint.s86)} />
          shop
          <span className={sx(paint.s87)}>devl</span>
        </div>
        <div className={[row, sx(paint.s88)].filter(Boolean).join(" ")}>
          <span className={sx(paint.s89)} />
          checkout-fix
        </div>
        <div className={sx(paint.s90)}>
          <span className={sx(paint.s91)}>
            Refund flow
            <span className={sx(paint.s92)} />
          </span>
          <span className={sx(paint.s93)}>
            Branch stays <span className={sx(paint.s94)}>https-linear-app-acme</span>
          </span>
        </div>
        <div className={[row, sx(paint.s95)].filter(Boolean).join(" ")}>
          <CheckIcon className={sx(paint.s96)} />
          order-export
        </div>
        <div className={[row, sx(paint.s97)].filter(Boolean).join(" ")}>
          <span className={sx(paint.s98)} />
          search-perf
        </div>
        <div className={[row, sx(paint.s99)].filter(Boolean).join(" ")}>
          <span className={sx(paint.s100)} />
          qa-deck
        </div>
      </div>
      <div className={sx(paint.s101)}>
        <div className={sx(paint.s102)}>
          <span className={sx(paint.s103)} style={{ background: "color-mix(in oklab, var(--wt-violet, var(--info)) 15%, transparent)", color: "var(--wt-violet, var(--foreground))" }}>
            Refund flow
          </span>
          <span className={sx(paint.s104)}>Claude Code</span>
        </div>
        <div className={sx(paint.s105)}>
          <span className={sx(paint.s106)}>
            shop / <span className={sx(paint.s107)}>Refund flow</span>
          </span>
          <div className={sx(paint.s108)}>Fix the refund webhook</div>
          <div className={sx(paint.s109)}>
            <Bar w="88%" />
            <Bar w="70%" />
            <Bar w="78%" />
          </div>
        </div>
        <div className={sx(paint.s110)}>
          <GitBranchIcon className={sx(paint.s111)} />
          <span className={sx(paint.s112)}>Refund flow</span>
          <span className={sx(paint.s113)}>https-linear-app-acme</span>
        </div>
      </div>
    </div>
  );
}

// A helper's report and a teammate's question in a chat, each as its
// sender's own card.
function Sender({ initial, tone, name, kind }: { initial: string; tone: string; name: string; kind: string }) {
  return (
    <>
      <span className={sx(paint.s114)} style={{ background: `color-mix(in oklab, var(--wt-${tone}, var(--info)) 22%, transparent)`, color: `var(--wt-${tone}, var(--foreground))` }}>
        {initial}
      </span>
      <span className={sx(paint.s115)}>{name}</span>
      <span className={sx(paint.s116)}>{kind}</span>
    </>
  );
}

function AgentMessages() {
  return (
    <div className={sx(paint.s117)}>
      <div className={sx(paint.s118)}>Find every caller of chargeCard</div>
      <div className={sx(paint.s119)}>
        <div className={sx(paint.s120)}>
          <Sender initial="S" tone="violet" name="scout" kind="Helper" />
          <span className={sx(paint.s121)}>Report</span>
          <span className={sx(paint.s122)}>1m 48s · to Claude</span>
        </div>
        <span className={sx(paint.s123)}>Found 4 callers of chargeCard. Two retry without an idempotency key.</span>
        <span className={sx(paint.s124)}>Read report</span>
      </div>
      <div className={sx(paint.s125)}>
        <Sender initial="R" tone="cyan" name="reviewer" kind="Teammate" />
        <span className={sx(paint.s126)}>Question</span>
        <span className={sx(paint.s127)}>Keep the old retry path?</span>
        <span className={sx(paint.s128)}>Reply</span>
      </div>
      <div className={sx(paint.s129)}>
        <span className={sx(paint.s130)} style={{ background: "var(--wt-magenta, var(--info))" }} />
        <span className={sx(paint.s131)}>build-watch</span>
        Update · tests green on main
        <span className={sx(paint.s132)}>
          <CheckIcon className={sx(paint.s133)} />3 finished
        </span>
      </div>
    </div>
  );
}

// The times before and after, and a box's link coming back by itself.
function Speed() {
  const rows: [string, string, string, number][] = [
    ["Sidebar ready, 300 worktrees", "2.48 s", "0.07 s", 0.07 / 2.48],
    ["Sidebar memory, 300 worktrees", "120 MB", "20 MB", 20 / 120],
    ["A reply's update, 2,000-turn chat", "57 ms", "15 ms", 15 / 57],
  ];
  return (
    <div className={sx(paint.s134)}>
      {rows.map(([what, before, after, ratio]) => (
        <div key={what} className={sx(paint.s135)}>
          <span className={sx(paint.s136)}>{what}</span>
          <span className={sx(paint.s137)}>
            <span className={sx(paint.s138)} />
            <span className={sx(paint.s139)}>{before}</span>
          </span>
          <span className={sx(paint.s140)}>
            <span className={sx(paint.s141)}>
              <span className={sx(paint.s142)} style={{ width: `${Math.max(ratio * 100, 1.5)}%` }} />
            </span>
            <span className={sx(paint.s143)}>{after}</span>
          </span>
        </div>
      ))}
      <div className={sx(paint.s144)}>
        <RefreshCwIcon className={sx(paint.s145)} />
        <span className={sx(paint.s146)}>
          Reconnecting to devl… <span className={sx(paint.s147)}>Next try in 6s</span>
        </span>
        <span className={sx(paint.s148)}>Try now</span>
      </div>
    </div>
  );
}
