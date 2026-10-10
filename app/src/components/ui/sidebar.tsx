"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetDescription, SheetHeader, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useMediaQuery } from "@/hooks/use-media-query";
import { color, radius } from "@/styles/tokens.stylex";


const md = "@media (min-width: 768px)";
const sm = "@media (min-width: 640px)";
const still = "@media (prefers-reduced-motion: reduce)";
const icon = ":is([data-collapsible=icon] &)";
const off = ":is([data-collapsible=offcanvas] &)";

const SIDEBAR_COOKIE_NAME: string = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE: number = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH: string = "16rem";
const SIDEBAR_WIDTH_ICON: string = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT: string = "b";

const accent = color.sidebarAccent;
const accentText = color.sidebarAccentForeground;

const styles = stylex.create({
  wrapper: {
    display: "flex",
    minHeight: "100svh",
    width: "100%",
    backgroundColor: { ":has([data-variant=inset])": color.sidebar },
  },
  fixed: {
    display: "flex",
    height: "100%",
    width: "var(--sidebar-width)",
    flexDirection: "column",
    backgroundColor: color.sidebar,
    color: color.sidebarForeground,
  },
  sheetBody: { display: "flex", height: "100%", width: "100%", flexDirection: "column" },
  peer: {
    display: { default: "none", [md]: "block" },
    color: color.sidebarForeground,
  },
  gap: {
    position: "relative",
    backgroundColor: "transparent",
    transitionProperty: "width",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "linear",
    width: {
      default: "var(--sidebar-width)",
      [off]: 0,
      [icon]: "var(--sidebar-width-icon)",
    },
    transform: { ":is([data-side=right] &)": "rotate(180deg)" },
  },
  gapFloat: { width: { [icon]: "calc(var(--sidebar-width-icon) + 1rem)" } },
  container: {
    position: "fixed",
    top: 0,
    bottom: 0,
    zIndex: 10,
    display: { default: "none", [md]: "flex" },
    height: "100svh",
    width: "var(--sidebar-width)",
    transitionProperty: "left, right, width",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "linear",
  },
  left: {
    left: { default: 0, [off]: "calc(var(--sidebar-width) * -1)" },
    borderRightWidth: { ":is([data-side=left] &)": 1 },
    borderRightStyle: { ":is([data-side=left] &)": "solid" },
    borderRightColor: { ":is([data-side=left] &)": color.sidebarBorder },
    width: { [icon]: "var(--sidebar-width-icon)" },
  },
  right: {
    right: { default: 0, [off]: "calc(var(--sidebar-width) * -1)" },
    borderLeftWidth: { ":is([data-side=right] &)": 1 },
    borderLeftStyle: { ":is([data-side=right] &)": "solid" },
    borderLeftColor: { ":is([data-side=right] &)": color.sidebarBorder },
    width: { [icon]: "var(--sidebar-width-icon)" },
  },
  float: { padding: 8, width: { [icon]: "calc(var(--sidebar-width-icon) + 1rem + 2px)" } },
  inner: {
    display: "flex",
    height: "100%",
    width: "100%",
    flexDirection: "column",
    backgroundColor: color.sidebar,
    borderRadius: { ":is([data-variant=floating] &)": radius.lg },
    borderWidth: { ":is([data-variant=floating] &)": 1 },
    borderStyle: { ":is([data-variant=floating] &)": "solid" },
    borderColor: { ":is([data-variant=floating] &)": color.sidebarBorder },
    boxShadow: { ":is([data-variant=floating] &)": "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)" },
  },
  sr: {
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
  rail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 20,
    display: { default: "none", [sm]: "flex" },
    width: 16,
    transform: { default: "translateX(-50%)", [off]: "translateX(0)" },
    transitionProperty: "all",
    transitionTimingFunction: "linear",
    backgroundColor: { ":is([data-collapsible=offcanvas] &):hover": color.sidebar },
    cursor: {
      ":is([data-side=left] &)": "w-resize",
      ":is([data-side=right] &)": "e-resize",
      ":is([data-side=left][data-state=collapsed] &)": "e-resize",
      ":is([data-side=right][data-state=collapsed] &)": "w-resize",
    },
    insetInlineEnd: { ":is([data-side=left] &)": -16 },
    left: { ":is([data-side=right] &)": 0 },
    "::after": {
      content: '""',
      position: "absolute",
      top: 0,
      bottom: 0,
      left: { default: "50%", [off]: "100%" },
      width: 2,
      backgroundColor: { ":hover": color.sidebarBorder },
    },
  },
  railOffLeft: { insetInlineEnd: { ":is([data-side=left][data-collapsible=offcanvas] &)": -8 } },
  railOffRight: { left: { ":is([data-side=right][data-collapsible=offcanvas] &)": -8 } },
  inset: {
    position: "relative",
    display: "flex",
    width: "100%",
    flexGrow: 1,
    flexDirection: "column",
    backgroundColor: color.background,
    margin: { [md]: { ":is([data-variant=inset] + &)": 8 } },
    marginInlineStart: {
      [md]: {
        ":is([data-variant=inset] + &)": 0,
        ":is([data-variant=inset][data-state=collapsed] + &)": 8,
      },
    },
    borderRadius: { [md]: { ":is([data-variant=inset] + &)": radius.xl } },
    boxShadow: { [md]: { ":is([data-variant=inset] + &)": "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)" } },
  },
  block: { display: "flex", flexDirection: "column", gap: 8, padding: 8 },
  ruleBottom: { marginBottom: 8, borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: color.sidebarBorder },
  ruleTop: { borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: color.sidebarBorder },
  padX: { paddingLeft: 8, paddingRight: 8 },
  content: {
    display: "flex",
    height: "100%",
    flexDirection: "column",
    gap: 8,
    overflow: { [icon]: "hidden" },
  },
  group: { position: "relative", display: "flex", width: "100%", minWidth: 0, flexDirection: "column", padding: 8 },
  label: {
    display: "flex",
    height: 32,
    flexShrink: 0,
    alignItems: "center",
    borderRadius: radius.lg,
    paddingLeft: 8,
    paddingRight: 8,
    fontWeight: 500,
    color: color.sidebarForeground,
    fontSize: 12,
    outline: "none",
    transitionProperty: "margin, opacity",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "linear",
    boxShadow: { ":focus-visible": "0 0 0 2px var(--sidebar-ring)" },
    marginTop: { [icon]: -32 },
    opacity: { [icon]: 0 },
    ":not(#\\#) > svg": { width: 16, height: 16, flexShrink: 0 },
  },
  groupAction: {
    position: "absolute",
    top: 14,
    insetInlineEnd: 12,
    display: { default: "flex", [icon]: "none" },
    aspectRatio: "1",
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    padding: 0,
    color: color.sidebarForeground,
    outline: "none",
    backgroundColor: { ":hover": accent },
    boxShadow: { ":focus-visible": "0 0 0 2px var(--sidebar-ring)" },
    ":not(#\\#) > svg": { width: 16, height: 16, flexShrink: 0 },
    "::after": {
      content: '""',
      position: "absolute",
      inset: -8,
      display: { [md]: "none" },
    },
  },
  groupContent: { width: "100%", fontSize: 14 },
  menu: { display: "flex", width: "100%", minWidth: 0, flexDirection: "column", gap: 4 },
  menuTight: { gap: 1 },
  item: { position: "relative" },
  button: {
    display: "flex",
    width: { default: "100%", [icon]: 32 },
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    borderRadius: radius.lg,
    padding: 8,
    textAlign: "left",
    fontSize: 14,
    outline: "none",
    color: { ":hover": accentText, ":active": accentText, '[data-active="true"]': accentText, "[data-popup-open]": accentText },
    backgroundColor: {
      ":hover": accent,
      ":active": accent,
      '[data-active="true"]': accent,
      "[data-state=open]:hover": accent,
      "[data-popup-open]": accent,
    },
    fontWeight: { '[data-active="true"]': 500 },
    boxShadow: { ":focus-visible": "0 0 0 2px var(--sidebar-ring)" },
    transitionProperty: "width, height, padding",
    transitionDuration: { default: "150ms", [still]: "0s" },
    opacity: { default: 1, ":disabled": 0.5, '[aria-disabled="true"]': 0.5 },
    pointerEvents: { ":disabled": "none", '[aria-disabled="true"]': "none" },
    paddingInlineEnd: { ":is([data-sidebar=menu-item]:has([data-sidebar=menu-action]) &)": 32 },
    height: { [icon]: 32 },
    ":not(#\\#) > span:last-child": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    ":not(#\\#) > svg": { width: 16, height: 16, flexShrink: 0 },
  },
  sizeDefault: { height: 32, fontSize: 14 },
  sizeSm: { height: 28, fontSize: 12 },
  sizeLg: { height: 48, fontSize: 14, padding: { [icon]: 0 } },
  outline: {
    backgroundColor: { default: color.background, ":hover": accent },
    boxShadow: {
      default: "0 0 0 1px var(--sidebar-border)",
      ":hover": "0 0 0 1px var(--sidebar-accent)",
    },
  },
  row: {
    height: "var(--side-row)",
    fontSize: 13,
    fontWeight: { '[data-active="true"]': 400 },
    ":not(#\\#) > svg": { width: 14, height: 14, color: color.mutedForeground },
  },
  place: {
    height: "calc(var(--side-row) + 2px)",
    gap: 6,
    fontWeight: 500,
    fontSize: 13,
    color: color.foreground,
  },
  offline: { color: color.mutedForeground },
  dim: { opacity: 0.4 },
  hot: { backgroundColor: accent, boxShadow: "0 0 0 1px var(--ring)" },
  action: {
    position: "absolute",
    insetInlineEnd: 4,
    display: { default: "flex", [icon]: "none" },
    aspectRatio: "1",
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    padding: 0,
    color: {
      default: color.sidebarForeground,
      ":hover": accentText,
      ":is([data-sidebar=menu-button]:hover + &)": accentText,
      ':is([data-sidebar=menu-button][data-active="true"] + &)': accentText,
    },
    backgroundColor: { ":hover": accent },
    outline: "none",
    boxShadow: { ":focus-visible": "0 0 0 2px var(--sidebar-ring)" },
    top: {
      default: 6,
      ":is([data-sidebar=menu-button][data-size=sm] + &)": 4,
      ":is([data-sidebar=menu-button][data-size=lg] + &)": 10,
    },
    opacity: { "[data-state=open]": 1, ":is([data-sidebar=menu-item]:hover &)": 1, ":is([data-sidebar=menu-item]:focus-within &)": 1 },
    ":not(#\\#) > svg": { width: 16, height: 16, flexShrink: 0 },
    "::after": { content: '""', position: "absolute", inset: -8, display: { [md]: "none" } },
  },
  hoverOnly: { opacity: { default: 0, [md]: 0 } },
  badge: {
    pointerEvents: "none",
    position: "absolute",
    insetInlineEnd: 4,
    display: { default: "flex", [icon]: "none" },
    height: 20,
    minWidth: 20,
    userSelect: "none",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg,
    paddingLeft: 4,
    paddingRight: 4,
    fontWeight: 500,
    color: {
      default: color.sidebarForeground,
      ":is([data-sidebar=menu-button]:hover + &)": accentText,
      ':is([data-sidebar=menu-button][data-active="true"] + &)': accentText,
    },
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    top: {
      default: 6,
      ":is([data-sidebar=menu-button][data-size=sm] + &)": 4,
      ":is([data-sidebar=menu-button][data-size=lg] + &)": 10,
    },
  },
  pill: {
    top: "50%",
    height: 18,
    minWidth: 18,
    transform: "translateY(-50%)",
    borderRadius: radius.full,
    paddingLeft: 4,
    paddingRight: 4,
    fontSize: 10,
    lineHeight: 1,
  },
  loud: { backgroundColor: "color-mix(in oklab, var(--warning) 15%, transparent)", color: "var(--warning-foreground)" },
  quiet: { backgroundColor: color.sidebarAccent, color: color.sidebarForeground },
  bone: { display: "flex", height: 32, alignItems: "center", gap: 8, borderRadius: radius.lg, paddingLeft: 8, paddingRight: 8 },
  boneIcon: { width: 16, height: 16 },
  boneText: { height: 16, flexGrow: 1, flexShrink: 1, flexBasis: "0%", maxWidth: "var(--skeleton-width)" },
  sub: {
    marginLeft: 14,
    marginRight: 14,
    display: { default: "flex", [icon]: "none" },
    minWidth: 0,
    transform: "translateX(1px)",
    flexDirection: "column",
    gap: 4,
    borderLeftWidth: 1,
    borderLeftStyle: "solid",
    borderLeftColor: color.sidebarBorder,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 2,
    paddingBottom: 2,
  },
  subRepo: { marginLeft: 17, marginRight: 0, gap: 1, paddingTop: 2, paddingBottom: 2, paddingRight: 0, paddingLeft: 6 },
  subTree: { marginLeft: 9, marginRight: 0, gap: 1, paddingTop: 0, paddingBottom: 0, paddingRight: 0, paddingLeft: 6 },
  subFlush: { marginLeft: 0, marginRight: 0, gap: 1, padding: 0, borderLeftWidth: 0 },
  subButton: {
    display: { default: "flex", [icon]: "none" },
    height: { default: 32, [sm]: 28 },
    minWidth: 0,
    transform: "translateX(-1px)",
    alignItems: "center",
    gap: 8,
    overflow: "hidden",
    borderRadius: radius.lg,
    paddingLeft: 8,
    paddingRight: 8,
    color: { default: color.sidebarForeground, ":hover": accentText, ":active": accentText, '[data-active="true"]': accentText },
    backgroundColor: { ":hover": accent, ":active": accent, '[data-active="true"]': accent },
    outline: "none",
    boxShadow: { ":focus-visible": "0 0 0 2px var(--sidebar-ring)" },
    opacity: { ":disabled": 0.5, '[aria-disabled="true"]': 0.5 },
    pointerEvents: { ":disabled": "none", '[aria-disabled="true"]': "none" },
    ":not(#\\#) > span:last-child": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    ":not(#\\#) > svg": { width: 16, height: 16, flexShrink: 0, color: accentText },
  },
  subSm: { fontSize: 12 },
  subMd: { fontSize: 14 },
  subRow: {
    height: "var(--side-row)",
    width: "100%",
    fontSize: 13,
    ":not(#\\#) > svg": { color: color.mutedForeground },
  },
  subQuiet: { height: 24, width: "100%", color: "color-mix(in oklab, var(--muted-foreground) 80%, transparent)" },
});

function cls(...parts: readonly (false | null | undefined | object)[]): string | undefined {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className;
}

function visual(slot: string, marker: string | undefined, ...parts: readonly (false | null | undefined | object)[]) {
  const painted = (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string; style?: React.CSSProperties })(...parts);
  return {
    className: marker ? [marker, painted.className].filter(Boolean).join(" ") : painted.className,
    style: painted.style,
    "data-slot": slot,
  };
}

export type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

export const SidebarContext: React.Context<SidebarContextProps | null> = React.createContext<SidebarContextProps | null>(null);

export function useSidebar(): SidebarContextProps {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.");
  return context;
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  style,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}): React.ReactElement {
  const isMobile = useMediaQuery("max-md");
  const [openMobile, setOpenMobile] = React.useState(false);
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    async (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) setOpenProp(openState);
      else _setOpen(openState);
      await cookieStore.set({
        expires: Date.now() + SIDEBAR_COOKIE_MAX_AGE * 1000,
        name: SIDEBAR_COOKIE_NAME,
        path: "/",
        value: String(openState),
      });
    },
    [setOpenProp, open],
  );
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen]);
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);
  const state = open ? "expanded" : "collapsed";
  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({ isMobile, open, openMobile, setOpen, setOpenMobile, state, toggleSidebar }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar],
  );
  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        className={cls(styles.wrapper)}
        data-slot="sidebar-wrapper"
        style={{ "--sidebar-width": SIDEBAR_WIDTH, "--sidebar-width-icon": SIDEBAR_WIDTH_ICON, ...style } as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "className"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}): React.ReactElement {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
  if (collapsible === "none") {
    return (
      <div className={cls(styles.fixed)} data-slot="sidebar" {...props}>
        {children}
      </div>
    );
  }
  if (isMobile) {
    return (
      <Sheet onOpenChange={setOpenMobile} open={openMobile} {...props}>
        <SheetPopup data-mobile="true" data-sidebar="sidebar" data-slot="sidebar" showCloseButton={false} side={side} tone="sidebar">
          <SheetHeader hidden>
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className={cls(styles.sheetBody)}>{children}</div>
        </SheetPopup>
      </Sheet>
    );
  }
  const floating = variant === "floating" || variant === "inset";
  return (
    <div className={cls(styles.peer)} data-collapsible={state === "collapsed" ? collapsible : ""} data-side={side} data-slot="sidebar" data-state={state} data-variant={variant}>
      <div className={cls(styles.gap, floating && styles.gapFloat)} data-slot="sidebar-gap" />
      <div className={cls(styles.container, side === "left" ? styles.left : styles.right, floating && styles.float)} data-slot="sidebar-container" {...props}>
        <div className={cls(styles.inner)} data-sidebar="sidebar" data-slot="sidebar-inner">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SidebarTrigger({ onClick, ...props }: React.ComponentProps<typeof Button>): React.ReactElement {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        toggleSidebar();
      }}
      size="icon"
      square={7}
      variant="ghost"
      {...props}
    >
      <PanelLeftIcon />
      <span className={cls(styles.sr)}>Toggle Sidebar</span>
    </Button>
  );
}

export function SidebarRail(props: Omit<React.ComponentProps<"button">, "className" | "style">): React.ReactElement {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      aria-label="Toggle Sidebar"
      className={cls(styles.rail, styles.railOffLeft, styles.railOffRight)}
      data-sidebar="rail"
      data-slot="sidebar-rail"
      onClick={toggleSidebar}
      tabIndex={-1}
      type="button"
      {...props}
    />
  );
}

export function SidebarInset(props: Omit<React.ComponentProps<"main">, "className" | "style">): React.ReactElement {
  return <main className={cls(styles.inset)} data-slot="sidebar-inset" {...props} />;
}

export function SidebarInput(props: React.ComponentProps<typeof Input>): React.ReactElement {
  return <Input data-sidebar="input" data-slot="sidebar-input" {...props} />;
}

export function SidebarHeader({
  marker,
  rule = false,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & { marker?: string; rule?: boolean }): React.ReactElement {
  return <div {...visual("sidebar-header", marker, styles.block, rule && styles.ruleBottom)} data-sidebar="header" {...props} />;
}

export function SidebarFooter({
  marker,
  rule = false,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & { marker?: string; rule?: boolean }): React.ReactElement {
  return <div {...visual("sidebar-footer", marker, styles.block, rule && styles.ruleTop)} data-sidebar="footer" {...props} />;
}

export function SidebarSeparator(props: React.ComponentProps<typeof Separator>): React.ReactElement {
  return <Separator data-sidebar="separator" data-slot="sidebar-separator" tone="sidebar" {...props} />;
}

export function SidebarContent({
  marker,
  pad = false,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & { marker?: string; pad?: boolean }): React.ReactElement {
  return (
    <ScrollArea fill grow overscrollContain scrollFade>
      <div {...visual("sidebar-content", marker, styles.content, pad && styles.padX)} data-sidebar="content" {...props} />
    </ScrollArea>
  );
}

export function SidebarGroup(props: Omit<React.ComponentProps<"div">, "className" | "style">): React.ReactElement {
  return <div className={cls(styles.group)} data-sidebar="group" data-slot="sidebar-group" {...props} />;
}

export function SidebarGroupLabel({ render, ...props }: Omit<useRender.ComponentProps<"div">, "className" | "style">): React.ReactElement {
  const look = visual("sidebar-group-label", undefined, styles.label);
  const row = { className: look.className, style: look.style, "data-slot": "sidebar-group-label", "data-sidebar": "group-label" };
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(row, props),
    render,
  });
}

export function SidebarGroupAction({ render, ...props }: Omit<useRender.ComponentProps<"button">, "className" | "style">): React.ReactElement {
  const look = visual("sidebar-group-action", undefined, styles.groupAction);
  const row = { className: look.className, style: look.style, "data-slot": "sidebar-group-action", "data-sidebar": "group-action" };
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(row, props),
    render,
  });
}

export function SidebarGroupContent(props: Omit<React.ComponentProps<"div">, "className" | "style">): React.ReactElement {
  return <div className={cls(styles.groupContent)} data-sidebar="group-content" data-slot="sidebar-group-content" {...props} />;
}

export function SidebarMenu({
  gap = "default",
  ...props
}: Omit<React.ComponentProps<"ul">, "className" | "style"> & { gap?: "default" | "tight" }): React.ReactElement {
  return <ul className={cls(styles.menu, gap === "tight" && styles.menuTight)} data-sidebar="menu" data-slot="sidebar-menu" {...props} />;
}

export function SidebarMenuItem(props: Omit<React.ComponentProps<"li">, "className" | "style">): React.ReactElement {
  return <li className={cls(styles.item)} data-sidebar="menu-item" data-slot="sidebar-menu-item" {...props} />;
}

export function SidebarMenuButton({
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  density,
  dim = false,
  hot = false,
  offline = false,
  render,
  ...props
}: Omit<useRender.ComponentProps<"button">, "className" | "style"> & {
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipPopup>;
  variant?: "default" | "outline";
  size?: "default" | "sm" | "lg";
  density?: "row" | "place";
  dim?: boolean;
  hot?: boolean;
  offline?: boolean;
}): React.ReactElement {
  const { isMobile, state } = useSidebar();
  const look = visual(
    "sidebar-menu-button",
    undefined,
    styles.button,
    size === "sm" && styles.sizeSm,
    size === "lg" && styles.sizeLg,
    size === "default" && styles.sizeDefault,
    variant === "outline" && styles.outline,
    density === "row" && styles.row,
    density === "place" && styles.place,
    offline && styles.offline,
    dim && styles.dim,
    hot && styles.hot,
  );
  const row = {
    className: look.className,
    style: look.style,
    "data-active": isActive,
    "data-sidebar": "menu-button",
    "data-size": size,
    "data-slot": "sidebar-menu-button",
  };
  const buttonProps = mergeProps<"button">(row, props);
  const buttonElement = useRender({ defaultTagName: "button", props: buttonProps, render });
  if (!tooltip) return buttonElement;
  const tip = typeof tooltip === "string" ? { children: tooltip } : tooltip;
  return (
    <Tooltip>
      <TooltipTrigger render={buttonElement as React.ReactElement<Record<string, unknown>>} />
      <TooltipPopup align="center" hidden={state !== "collapsed" || isMobile} side="right" {...tip} />
    </Tooltip>
  );
}

export function SidebarMenuAction({
  showOnHover = false,
  render,
  ...props
}: Omit<useRender.ComponentProps<"button">, "className" | "style"> & { showOnHover?: boolean }): React.ReactElement {
  const look = visual("sidebar-menu-action", undefined, styles.action, showOnHover && styles.hoverOnly);
  const row = { className: look.className, style: look.style, "data-sidebar": "menu-action", "data-slot": "sidebar-menu-action" };
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(row, props),
    render,
  });
}

export function SidebarMenuBadge({
  pill,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & { pill?: "loud" | "quiet" }): React.ReactElement {
  return <div className={cls(styles.badge, pill && styles.pill, pill === "loud" && styles.loud, pill === "quiet" && styles.quiet)} data-sidebar="menu-badge" data-slot="sidebar-menu-badge" {...props} />;
}

export function SidebarMenuSkeleton({
  showIcon = false,
  ...props
}: Omit<React.ComponentProps<"div">, "className" | "style"> & { showIcon?: boolean }): React.ReactElement {
  const width = React.useMemo(() => `${Math.floor(Math.random() * 40) + 50}%`, []);
  return (
    <div className={cls(styles.bone)} data-sidebar="menu-skeleton" data-slot="sidebar-menu-skeleton" {...props}>
      {showIcon && (
        <div className={cls(styles.boneIcon)}>
          <Skeleton data-sidebar="menu-skeleton-icon" shape="lg" />
        </div>
      )}
      <div className={cls(styles.boneText)} style={{ "--skeleton-width": width } as React.CSSProperties}>
        <Skeleton data-sidebar="menu-skeleton-text" />
      </div>
    </div>
  );
}

export function SidebarMenuSub({
  indent,
  ...props
}: Omit<React.ComponentProps<"ul">, "className" | "style"> & { indent?: "repo" | "tree" | "flush" }): React.ReactElement {
  return (
    <ul
      className={cls(styles.sub, indent === "repo" && styles.subRepo, indent === "tree" && styles.subTree, indent === "flush" && styles.subFlush)}
      data-sidebar="menu-sub"
      data-slot="sidebar-menu-sub"
      {...props}
    />
  );
}

export function SidebarMenuSubItem(props: Omit<React.ComponentProps<"li">, "className" | "style">): React.ReactElement {
  return <li className={cls(styles.item)} data-sidebar="menu-sub-item" data-slot="sidebar-menu-sub-item" {...props} />;
}

export function SidebarMenuSubButton({
  size = "md",
  isActive = false,
  density,
  away = false,
  render,
  ...props
}: Omit<useRender.ComponentProps<"a">, "className" | "style"> & {
  size?: "sm" | "md";
  isActive?: boolean;
  density?: "row" | "quiet";
  away?: boolean;
}): React.ReactElement {
  const look = visual(
    "sidebar-menu-sub-button",
    undefined,
    styles.subButton,
    size === "sm" && styles.subSm,
    size === "md" && styles.subMd,
    density === "row" && styles.subRow,
    density === "quiet" && styles.subQuiet,
    away && styles.offline,
  );
  const row = {
    className: look.className,
    style: look.style,
    "data-active": isActive,
    "data-sidebar": "menu-sub-button",
    "data-size": size,
    "data-slot": "sidebar-menu-sub-button",
  };
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(row, props),
    render,
  });
}
