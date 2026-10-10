import * as stylex from "@stylexjs/stylex";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Scene } from "@/components/art/scenes";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "alignItems": "center",
    "justifyContent": "center",
    "overflowY": "auto",
    "padding": "24px",
  },
  s1: {
    "display": "flex",
    "flexWrap": "wrap",
    "justifyContent": "center",
    "gap": "8px",
  },
  s2: {
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s3: {
    "maxHeight": "256px",
    "width": "100%",
    "overflow": "auto",
    "borderRadius": "var(--radius-md)",
    "backgroundColor": "var(--muted)",
    "padding": "12px",
    "textAlign": "left",
    "fontSize": "12px",
    "lineHeight": "1.625",
    "whiteSpace": "pre-wrap",
    "userSelect": "text",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

type Props = {
  children: ReactNode;
  // What the boundary guards, for the message: "Automations", "a dialog".
  scope?: string;
  // Shown as a way out, such as back to the workspace.
  onLeave?: () => void;
  leaveLabel?: string;
};
type State = { error?: Error; stack?: string; details: boolean };

// ErrorBoundary keeps a render that throws from taking more than its part of
// the window: around a view, the sidebar and every other view keep working.
// Without it React replaces the tree with nothing, the window goes white,
// and what threw is in a console nobody can open: release builds ship
// without devtools. Showing it on screen makes a report from someone else's
// machine actionable.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { details: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ stack: info.componentStack ?? undefined });
    // Kept for anyone who does have a console attached, such as a dev build.
    console.error(`Burf: ${this.props.scope ?? "the app"} hit an error it could not render through:`, error, info.componentStack);
  }

  render() {
    const { error, stack, details } = this.state;
    if (!error) return this.props.children;
    const { scope, onLeave, leaveLabel } = this.props;
    const detail = [error.stack || `${error.name}: ${error.message}`, stack && `Component stack:${stack}`].filter(Boolean).join("\n\n");
    return (
      <div className={sx(paint.s0)}>
        <Empty measure="xl">
          <EmptyHeader>
            <EmptyMedia>
              <Scene name="storm" />
            </EmptyMedia>
            <EmptyTitle>{scope ? `Something in ${scope} broke` : "Burf hit an error"}</EmptyTitle>
            <EmptyDescription>
              {scope ? "The rest of Burf still works. " : ""}
              {error.message || String(error)}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className={sx(paint.s1)}>
              {onLeave && (
                <Button
                  onClick={() => {
                    this.setState({ error: undefined, details: false });
                    onLeave();
                  }}
                >
                  {leaveLabel ?? "Back to workspace"}
                </Button>
              )}
              <Button variant="outline" onClick={() => this.setState({ error: undefined, details: false })}>
                Try again
              </Button>
              <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(detail)}>
                Copy details
              </Button>
            </div>
            <button type="button" className={sx(paint.s2)} onClick={() => this.setState({ details: !details })}>
              {details ? "Hide details" : "Show details"}
            </button>
            {details && <pre className={sx(paint.s3)}>{detail}</pre>}
          </EmptyContent>
        </Empty>
      </div>
    );
  }
}
