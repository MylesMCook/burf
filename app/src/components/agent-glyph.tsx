import { AsteriskIcon, CheckIcon, HexagonIcon, SparkleIcon, SquareTerminalIcon, TerminalIcon } from "lucide-react";

import type { SessionState } from "@/lib/derive";
import { cn } from "@/lib/utils";

// AgentIcon marks which agent a session runs, in the agent's own colour.
export function AgentIcon({ agent, className }: { agent?: string; className?: string }) {
  const cls = cn("size-3.5 shrink-0", className);
  switch (agent) {
    case "claude":
      return <AsteriskIcon className={cn(cls, "text-[#d97757]")} strokeWidth={2.75} />;
    case "codex":
      return <HexagonIcon className={cn(cls, "text-foreground/80")} strokeWidth={2.25} />;
    case "gemini":
      return <SparkleIcon className={cn(cls, "text-[#6f9bff]")} strokeWidth={2.25} />;
    case "pi":
      return <span className={cn("shrink-0 font-semibold text-[#a78bfa] text-xs leading-none", className)}>π</span>;
    case "opencode":
      return <SquareTerminalIcon className={cn(cls, "text-foreground/80")} />;
    default:
      return <TerminalIcon className={cn(cls, "text-muted-foreground")} />;
  }
}

const stateLabel: Record<SessionState, string> = {
  ready: "Ready",
  running: "Working",
  waiting: "Waiting for you",
  finished: "Finished",
  exited: "Exited",
  idle: "Shell",
};

export function stateText(state: SessionState) {
  return stateLabel[state];
}

// StateGlyph is a session's state at a glance: a blue spinner while working,
// an amber dot when it needs you (amber means that and nothing else), a check
// when done, grey once it has exited. Under reduced motion the spinner stands
// still as a broken ring and the dot does not ping. The sidebar, the rail,
// panes and the palette all draw states with it, so they agree. It is
// named for screen readers; the row or card around it says it in words.
export function StateGlyph({ state, className }: { state: SessionState; className?: string }) {
  const box = cn("inline-flex size-3.5 shrink-0 items-center justify-center", className);
  switch (state) {
    case "running":
      return (
        <span className={box} role="img" aria-label={stateLabel[state]}>
          <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-info border-t-transparent motion-reduce:animate-none" />
        </span>
      );
    case "waiting":
      return (
        <span className={box} role="img" aria-label={stateLabel[state]}>
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-warning opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-warning" />
          </span>
        </span>
      );
    case "finished":
      return (
        <span className={box} role="img" aria-label={stateLabel[state]}>
          <CheckIcon className="size-3 text-success" strokeWidth={3} />
        </span>
      );
    case "ready":
      return (
        <span className={box} role="img" aria-label={stateLabel[state]}>
          <span className="size-2 rounded-full border-[1.5px] border-muted-foreground/70" />
        </span>
      );
    case "exited":
      return (
        <span className={box} role="img" aria-label={stateLabel[state]}>
          <span className="size-2 rounded-full bg-muted-foreground/40" />
        </span>
      );
    default:
      return null;
  }
}

// StatusDot is a box's connection state.
export function StatusDot({ state, className }: { state?: string; className?: string }) {
  const color = state === "online" ? "bg-success" : state === "connecting" ? "bg-warning" : state === "untrusted" ? "bg-destructive" : "bg-muted-foreground/40";
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", color, className)} />;
}
