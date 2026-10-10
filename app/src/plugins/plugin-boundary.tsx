import * as stylex from "@stylexjs/stylex";
import type { BerthPluginContext } from "@berth/plugin";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { PluginReactContext } from "@/plugins/context";
import { useRegistry } from "@/plugins/registry";
import { Tip } from "@/components/tip";

const paint = stylex.create({
  s0: {
    "color": "var(--destructive)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s1: {
    "margin": "24px",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "color-mix(in oklab, var(--destructive) 30%, transparent)",
    "backgroundColor": "color-mix(in oklab, var(--destructive) 5%, transparent)",
    "padding": "16px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s2: {
    "fontWeight": 500,
  },
  s3: {
    "marginTop": "8px",
    "whiteSpace": "pre-wrap",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "marginTop": "12px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "textDecoration": "underline",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type Props = { plugin: string; children: ReactNode; inline?: boolean };
type State = { error?: Error };

// PluginBoundary renders a plugin's component under its own context and
// catches what it throws, so one broken plugin never blanks the app.
export function PluginBoundary({ plugin, children, inline }: Props) {
  const ctx = pluginContexts.get(plugin) ?? null;
  return (
    <PluginReactContext.Provider value={ctx}>
      <Catch plugin={plugin} inline={inline}>
        {children}
      </Catch>
    </PluginReactContext.Provider>
  );
}

// The context each loaded plugin was activated with, for its components.
export const pluginContexts = new Map<string, BerthPluginContext>();

class Catch extends Component<Omit<Props, "children"> & { children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`plugin ${this.props.plugin} failed to render`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const name = useRegistry.getState().plugins.find((p) => p.id === this.props.plugin)?.name ?? this.props.plugin;
    if (this.props.inline) {
      return (
        <Tip label={error.message}>
          <span className={sx(paint.s0)}>{name} failed</span>
        </Tip>
      );
    }
    return (
      <div className={sx(paint.s1)}>
        <p className={sx(paint.s2)}>{name} hit an error</p>
        <pre className={sx(paint.s3)}>{error.message}</pre>
        <button type="button" className={sx(paint.s4)} onClick={() => this.setState({ error: undefined })}>
          Try again
        </button>
      </div>
    );
  }
}
