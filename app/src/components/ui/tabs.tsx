"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import * as stylex from "@stylexjs/stylex";
import * as React from "react";

import { color, radius } from "@/styles/tokens.stylex";

const sm = "@media (min-width: 640px)";
const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  vertical: { flexDirection: "row" },
  fill: { minHeight: 0, flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  below: { marginBottom: 8 },
  list: {
    position: "relative",
    zIndex: 0,
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 2,
    color: color.mutedForeground,
  },
  listColumn: { flexDirection: "column" },
  listTrack: {
    borderRadius: radius.lg,
    backgroundColor: color.muted,
    padding: 2,
    color: "color-mix(in oklab, var(--muted-foreground) 72%, transparent)",
  },
  listLine: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  listLineColumn: { paddingLeft: 4, paddingRight: 4 },
  bleed: { marginBottom: -1 },
  tab: {
    position: "relative",
    display: "flex",
    flexGrow: 1,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap",
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    backgroundColor: "transparent",
    color: {
      default: color.mutedForeground,
      ":hover": color.mutedForeground,
      "[data-active]": color.foreground,
    },
    fontWeight: 500,
    fontSize: { default: 16, [sm]: 14 },
    cursor: "pointer",
    outline: "none",
    boxShadow: { ":focus-visible": "0 0 0 2px var(--ring)" },
    opacity: { default: 1, ":disabled": 0.64 },
    pointerEvents: { default: "auto", ":disabled": "none" },
    transitionProperty: "color, background-color, box-shadow",
    transitionDuration: { default: "150ms", [still]: "0s" },
    ":not(#\\#) svg": {
      pointerEvents: "none",
      flexShrink: 0,
      marginLeft: -2,
      marginRight: -2,
      width: { default: 18, [sm]: 16 },
      height: { default: 18, [sm]: 16 },
      opacity: 0.8,
    },
  },
  tabOn: { color: color.foreground },
  tabColumn: {
    width: "100%",
    justifyContent: "flex-start",
  },
  tabLine: {
    backgroundColor: { ":hover": color.accent },
  },
  sizeDefault: {
    height: { default: 34, [sm]: 30 },
    paddingLeft: 9,
    paddingRight: 9,
  },
  sizeLg: {
    height: { default: 38, [sm]: 34 },
    paddingLeft: 11,
    paddingRight: 11,
  },
  sizeSm: {
    height: { default: 30, [sm]: 26 },
    paddingLeft: 7,
    paddingRight: 7,
  },
  indicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: "var(--active-tab-height)",
    width: "var(--active-tab-width)",
    transform: "translateX(var(--active-tab-left)) translateY(calc(var(--active-tab-bottom) * -1))",
    transitionProperty: "width, translate",
    transitionDuration: { default: "200ms", [still]: "0s" },
    transitionTimingFunction: "ease-in-out",
  },
  indicatorPill: {
    zIndex: -1,
    borderRadius: radius.md,
    backgroundColor: "var(--tab-indicator)",
    boxShadow: "0 1px 2px color-mix(in oklab, var(--foreground) 5%, transparent)",
  },
  indicatorLine: {
    zIndex: 10,
    backgroundColor: color.primary,
  },
  indicatorLineRow: { height: 2, transform: "translateX(var(--active-tab-left)) translateY(1px)" },
  indicatorLineColumn: { width: 2, transform: "translateX(-1px) translateY(calc(var(--active-tab-bottom) * -1))" },
  panel: { flexGrow: 1, flexShrink: 1, flexBasis: 0, outline: "none" },
});

export type TabsVariant = "default" | "underline";
export type TabsSize = "default" | "lg" | "sm";

const sizeStyle = { default: styles.sizeDefault, lg: styles.sizeLg, sm: styles.sizeSm } as const;

const TabsListContext: React.Context<{ size: TabsSize; variant: TabsVariant }> = React.createContext<{
  size: TabsSize;
  variant: TabsVariant;
}>({ size: "default", variant: "default" });

export function Tabs({
  fill = false,
  space,
  ...props
}: Omit<TabsPrimitive.Root.Props, "className" | "style"> & {
  fill?: boolean;
  space?: "below";
}): React.ReactElement {
  return (
    <TabsPrimitive.Root
      className={(state) =>
        stylex.props(styles.root, state.orientation === "vertical" && styles.vertical, fill && styles.fill, space === "below" && styles.below).className
      }
      data-slot="tabs"
      {...props}
    />
  );
}

export function TabsList({
  variant = "default",
  size = "default",
  bleed = false,
  children,
  ...props
}: Omit<TabsPrimitive.List.Props, "className" | "style"> & {
  size?: TabsSize;
  variant?: TabsVariant;
  bleed?: boolean;
}): React.ReactElement {
  return (
    <TabsPrimitive.List
      className={(state) =>
        stylex.props(
          styles.list,
          state.orientation === "vertical" && styles.listColumn,
          variant === "default" && styles.listTrack,
          variant === "underline" && state.orientation === "horizontal" && styles.listLine,
          variant === "underline" && state.orientation === "vertical" && styles.listLineColumn,
          bleed && styles.bleed,
        ).className
      }
      data-size={size}
      data-slot="tabs-list"
      {...props}
    >
      <TabsListContext.Provider value={{ size, variant }}>
        {children}
      </TabsListContext.Provider>
      <TabsPrimitive.Indicator
        className={(state) =>
          stylex.props(
            styles.indicator,
            variant === "underline" ? styles.indicatorLine : styles.indicatorPill,
            variant === "underline" && state.orientation === "horizontal" && styles.indicatorLineRow,
            variant === "underline" && state.orientation === "vertical" && styles.indicatorLineColumn,
          ).className
        }
        data-slot="tab-indicator"
      />
    </TabsPrimitive.List>
  );
}

export function TabsTab({
  size,
  ...props
}: Omit<TabsPrimitive.Tab.Props, "className" | "style"> & {
  size?: TabsSize;
}): React.ReactElement {
  const list = React.useContext(TabsListContext);
  const resolvedSize: TabsSize = size ?? list.size;
  return (
    <TabsPrimitive.Tab
      className={(state) =>
        stylex.props(
          styles.tab,
          state.orientation === "vertical" && styles.tabColumn,
          sizeStyle[resolvedSize],
          list.variant === "underline" && styles.tabLine,
          state.active && styles.tabOn,
        ).className
      }
      data-size={resolvedSize}
      data-slot="tabs-tab"
      {...props}
    />
  );
}

export function TabsPanel(props: Omit<TabsPrimitive.Panel.Props, "className" | "style">): React.ReactElement {
  return <TabsPrimitive.Panel className={stylex.props(styles.panel).className} data-slot="tabs-content" {...props} />;
}

export { TabsPrimitive, TabsTab as TabsTrigger, TabsPanel as TabsContent };
