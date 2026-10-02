import { CheckIcon, XIcon } from "lucide-react";

import type { FlowRun } from "@/lib/flows";
import { cn } from "@/lib/utils";

// RunStatus is a run's outcome at a glance.
export function RunStatus({ status, className }: { status: FlowRun["status"]; className?: string }) {
  const box = cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full", className);
  if (status === "running")
    return (
      <span className={box} title="Running">
        <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent" />
      </span>
    );
  if (status === "succeeded")
    return (
      <span className={cn(box, "bg-success/15 text-success")} title="Succeeded">
        <CheckIcon className="size-2.5" strokeWidth={3} />
      </span>
    );
  return (
    <span className={cn(box, "bg-destructive/15 text-destructive-foreground")} title="Failed">
      <XIcon className="size-2.5" strokeWidth={3} />
    </span>
  );
}

// runTook is how long a run took, or has been going.
export function runTook(r: FlowRun): string {
  const ms = (r.finished ? new Date(r.finished).getTime() : Date.now()) - new Date(r.started).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
