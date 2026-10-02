import { TriangleAlertIcon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

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
    console.error(`Berth: ${this.props.scope ?? "the app"} hit an error it could not render through:`, error, info.componentStack);
  }

  render() {
    const { error, stack, details } = this.state;
    if (!error) return this.props.children;
    const { scope, onLeave, leaveLabel } = this.props;
    const detail = [error.stack || `${error.name}: ${error.message}`, stack && `Component stack:${stack}`].filter(Boolean).join("\n\n");
    return (
      <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto p-6">
        <Empty className="max-w-xl">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyTitle>{scope ? `Something in ${scope} broke` : "Berth hit an error"}</EmptyTitle>
            <EmptyDescription>
              {scope ? "The rest of Berth still works. " : ""}
              {error.message || String(error)}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-2">
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
            <button type="button" className="text-muted-foreground text-xs hover:text-foreground" onClick={() => this.setState({ details: !details })}>
              {details ? "Hide details" : "Show details"}
            </button>
            {details && <pre className="max-h-64 w-full overflow-auto rounded-md bg-muted p-3 text-left text-xs leading-relaxed whitespace-pre-wrap select-text">{detail}</pre>}
          </EmptyContent>
        </Empty>
      </div>
    );
  }
}
