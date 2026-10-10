"use client";

import { Meter as MeterPrimitive } from "@base-ui/react/meter";
import * as stylex from "@stylexjs/stylex";
import type React from "react";

import { color } from "@/styles/tokens.stylex";


const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  root: { display: "flex", width: "100%", flexDirection: "column", gap: 8 },
  label: { fontWeight: 500, color: color.foreground, fontSize: 14 },
  track: { display: "block", height: 8, width: "100%", overflow: "hidden", backgroundColor: color.input },
  indicator: {
    backgroundColor: color.primary,
    transitionProperty: "width, height",
    transitionDuration: { default: "500ms", [still]: "0s" },
  },
  value: { color: color.foreground, fontSize: 14, fontVariantNumeric: "tabular-nums" },
});

export function Meter({ children, ...props }: Omit<MeterPrimitive.Root.Props, "className" | "style">): React.ReactElement {
  return (
    <MeterPrimitive.Root className={stylex.props(styles.root).className} {...props}>
      {children ? (
        children
      ) : (
        <MeterTrack>
          <MeterIndicator />
        </MeterTrack>
      )}
    </MeterPrimitive.Root>
  );
}

export function MeterLabel(props: Omit<MeterPrimitive.Label.Props, "className" | "style">): React.ReactElement {
  return <MeterPrimitive.Label className={stylex.props(styles.label).className} data-slot="meter-label" {...props} />;
}

export function MeterTrack(props: Omit<MeterPrimitive.Track.Props, "className" | "style">): React.ReactElement {
  return <MeterPrimitive.Track className={stylex.props(styles.track).className} data-slot="meter-track" {...props} />;
}

export function MeterIndicator(props: Omit<MeterPrimitive.Indicator.Props, "className" | "style">): React.ReactElement {
  return <MeterPrimitive.Indicator className={stylex.props(styles.indicator).className} data-slot="meter-indicator" {...props} />;
}

export function MeterValue(props: Omit<MeterPrimitive.Value.Props, "className" | "style">): React.ReactElement {
  return <MeterPrimitive.Value className={stylex.props(styles.value).className} data-slot="meter-value" {...props} />;
}

export { MeterPrimitive };
