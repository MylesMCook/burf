import { RotateCwIcon, ServerIcon } from "lucide-react";

import { Scene } from "@/components/art/scenes";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { startSession } from "@/lib/actions";
import { agentLabel } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useWorkspaces } from "@/lib/workspaces";

// The states a terminal pane shows when there is nothing to attach to: the
// session ended, or its box is out of reach. Each is a small drawing, one
// line saying what happened, one saying where, and what to do next.

function PaneState({ art, title, detail, children, panel }: { art: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; children?: React.ReactNode; panel?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className={cn("flex max-w-sm flex-col items-center text-center", panel && "rounded-xl border bg-popover/95 px-8 pt-6 pb-5 shadow-lg/5")}>
        <div className="mb-4 text-muted-foreground/80">{art}</div>
        {title}
        {detail && <div className="mt-1 max-w-full text-muted-foreground text-xs">{detail}</div>}
        {children && <div className="mt-4 flex gap-2">{children}</div>}
      </div>
    </div>
  );
}

// SessionEnded says what stopped and where, and offers to start the same
// thing again in the same worktree, in this pane.
export function SessionEnded({ box, session, agent, command, wsKey, tab, pane, onClose }: { box: string; session: string; agent?: string; command?: string; wsKey: string; tab: string; pane: string; onClose(): void }) {
  const ref = useWorkspaces((s) => s.spaces[wsKey]?.ref);
  const label = agent ? agentLabel(agent) : "Shell";
  const where = ref ? (ref.main ? ref.location : ref.worktree) : undefined;
  return (
    <PaneState
      art={<Scene name="ended" width={144} />}
      title={
        // Named as its tab named it; the session's id is for the curious.
        <Tip label={`${session} on ${box}`}>
          <p className="font-medium text-sm">{agent ? `${label} has ended` : "The shell has ended"}</p>
        </Tip>
      }
      detail={
        <p className="flex min-w-0 items-center justify-center gap-1.5">
          <span className="shrink-0">{where ? `${where} on ${box}` : `on ${box}`}</span>
          {command && (
            <>
              <span className="text-muted-foreground/48">·</span>
              <code className="min-w-0 truncate font-mono text-[11px] text-foreground/72">{command}</code>
            </>
          )}
        </p>
      }
    >
      <Button size="sm" onClick={() => void startSession(command ?? "", { kind: "replace", tab, pane }, label)}>
        <RotateCwIcon />
        Start {agent ? label : "a shell"} again
      </Button>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Close pane
      </Button>
    </PaneState>
  );
}

// BoxOffline sits over the dimmed screen: the session is still running on
// the box, and Berth reattaches on its own when the box is back.
export function BoxOffline({ box, onRetry }: { box: string; onRetry(): void }) {
  return (
    <PaneState
      panel
      art={<Scene name="offline" width={128} />}
      title={<p className="font-medium text-sm">{box} is offline</p>}
      detail={<p className="max-w-xs">The session keeps running there; Berth reconnects on its own when the box is back.</p>}
    >
      <Button
        size="sm"
        onClick={() => {
          void useStore.getState().refreshStatus();
          onRetry();
        }}
      >
        <RotateCwIcon />
        Retry now
      </Button>
      <Button size="sm" variant="outline" onClick={() => useStore.getState().setView({ kind: "settings", section: "boxes" })}>
        <ServerIcon />
        Boxes
      </Button>
    </PaneState>
  );
}
