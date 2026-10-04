import { TaskComposer } from "@/components/conversation/task-composer";
import { StepHeader } from "@/components/step-header";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useIsLocalBox } from "@/lib/local-box";
import { useStore } from "@/lib/store";

// A first task the sample project can do in a minute or two, with a test.
export const SAMPLE_TASK = 'Add a /health endpoint to server.js that returns {"ok": true}, with a test';

// AgentStep ends onboarding with the composer, the one way to start work,
// on the project just added: for the sample, a first task already written,
// so Enter starts the first agent in a worktree of its own.
export function AgentStep({ box, location, sample, onFinish }: { box: string; location: string; sample?: boolean; onFinish(): void }) {
  const agents = useStore((s) => s.boxes[box]?.info?.agents);
  const local = useIsLocalBox(box);
  const none = agents && !agents.some((a) => a.command);
  return (
    <div>
      <StepHeader
        variant="page"
        title="Start your first agent"
        description={
          <>
            It works in a new worktree of <span className="text-foreground">{location}</span> on <span className="text-foreground">{local ? "this Mac" : box}</span>, keeps going if you close Berth, and tells you
            when it needs you.{sample ? " The task below is a small one to start with; change it, or press Enter." : ""}
          </>
        }
      />
      <div className="mt-6">
        <TaskComposer draft={{ box, location, text: sample ? SAMPLE_TASK : undefined }} autoFocus onDone={onFinish} />
      </div>
      {none && <p className="mt-3 text-muted-foreground text-xs">No agent CLI on {local ? "this Mac" : box} yet. Settings → Agents shows how to install Claude Code or Codex.</p>}
      <div className="mt-8 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Later: <Kbd>⌘N</Kbd> new task · <Kbd>⌘K</Kbd> everything else
        </p>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onFinish}>
          I'll explore first
        </Button>
      </div>
    </div>
  );
}
