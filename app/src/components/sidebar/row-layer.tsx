import type { ComponentProps, CSSProperties } from "react";
import * as stylex from "@stylexjs/stylex";

import { RowMenus } from "@/components/sidebar/actions";
import { useTipLayer } from "@/components/tip";

const styles = stylex.create({
  projects: {
    minHeight: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
    overflowY: "auto",
    paddingLeft: 8,
    paddingRight: 8,
    paddingBottom: 12,
  },
  rail: {
    height: "100%",
    scrollPaddingTop: 28,
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingLeft: 4,
    paddingRight: 4,
    scrollbarWidth: "none",
    "::-webkit-scrollbar": { display: "none" },
  },
});

type RowLayerProps = Omit<ComponentProps<"div">, "className" | "style"> & {
  /** Projects list, or the folded rail's agent list. */
  layout?: "projects" | "rail";
  style?: CSSProperties;
};

// RowLayer holds a long list of rows, the sidebar's projects and worktrees
// or the rail's agents: one context menu (RowMenus) and one tooltip (a tip
// layer) for all of them, so a row costs its own few elements and nothing
// more until it is pointed at, focused or right-clicked. It renders a div,
// with the props given.
export function RowLayer({ children, layout, style, onPointerOver, onPointerOut, onFocus, onBlur, onPointerDown, onKeyDown, ...props }: RowLayerProps) {
  const tips = useTipLayer();
  const painted = stylex.props(layout === "projects" && styles.projects, layout === "rail" && styles.rail);
  return tips.provider(
    <RowMenus
      {...props}
      className={painted.className}
      style={{ ...painted.style, ...style }}
      onPointerOver={(e) => {
        onPointerOver?.(e);
        tips.props.onPointerOver(e);
      }}
      onPointerOut={(e) => {
        onPointerOut?.(e);
        tips.props.onPointerOut(e);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        tips.props.onFocus(e);
      }}
      onBlur={(e) => {
        onBlur?.(e);
        tips.props.onBlur(e);
      }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        tips.props.onPointerDown(e);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        tips.props.onKeyDown(e);
      }}
    >
      {children}
      {tips.tooltip}
    </RowMenus>,
  );
}
