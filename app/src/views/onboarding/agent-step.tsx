import { SparklesIcon } from "lucide-react";

import { AgentIcon } from "@/components/agent-glyph";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useStore } from "@/lib/store";

// AgentStep ends onboarding by starting the first piece of work: a new
// worktree with an agent in it, through the usual dialog with that agent
// already chosen.
export function AgentStep({ box, location, onFinish }: { box: string; location: string; onFinish(): void }) {
  const agents = useStore((s) => s.boxes[box]?.info?.agents);
  const first = agents?.find((a) => a.id === "claude") ?? agents?.find((a) => a.command);

  const open = (agent?: string) => {
    onFinish();
    useStore.getState().openNewWorktree({ box, location, agent });
  };

  return (
    <div>
      <span className="flex size-10 items-center justify-center rounded-xl border bg-card text-muted-foreground">
        <SparklesIcon className="size-5" />
      </span>
      <h1 className="mt-6 font-semibold text-xl tracking-tight">Start your first agent</h1>
      <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
        A new worktree of <span className="text-foreground">{location}</span> on <span className="text-foreground">{box}</span>, with {first?.name ?? "an agent"} in it. It keeps going if you close Berth, and tells you when it needs you.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {first ? (
          <Button onClick={() => open(first.id)}>
            <AgentIcon agent={first.id} className="size-4" />
            Start {first.name}
          </Button>
        ) : null}
        <Button variant={first ? "outline" : "default"} onClick={() => open()}>
          New worktree…
        </Button>
        <Button variant="ghost" className="text-muted-foreground" onClick={onFinish}>
          I'll explore first
        </Button>
      </div>
      {!first && agents && <p className="mt-3 text-muted-foreground text-xs">No agent CLI on {box} yet. Settings → Agents shows how to install one.</p>}
      <p className="mt-10 text-muted-foreground text-xs">
        Later: <Kbd>⌘N</Kbd> new worktree · <Kbd>⌘K</Kbd> everything else
      </p>
    </div>
  );
}
