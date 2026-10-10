import { GitCommitHorizontalIcon, LaptopMinimalIcon, ServerIcon, Undo2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/tip";

// Section is one titled part of Project settings, framed like the rest of
// the app's settings.
export function Section({ id, title, description, actions, children }: { id: string; title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="mb-2.5 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-sm">{title}</h2>
          {description && <p className="mt-0.5 text-muted-foreground text-xs leading-relaxed">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
    </section>
  );
}

export type Source = "repo" | "box" | "override";

// SourceBadge says where a value comes from: committed in the repository,
// set on this box, or this box overriding the committed value.
export function SourceBadge({ source, box }: { source: Source; box: string }) {
  const map = {
    repo: { Icon: GitCommitHorizontalIcon, label: "Repo", cls: "text-muted-foreground", title: "Committed in the repository's .berth/config.json" },
    box: { Icon: ServerIcon, label: box, cls: "text-sky-400 border-sky-400/25", title: `Set on ${box} only` },
    override: { Icon: ServerIcon, label: `${box} override`, cls: "text-warning-foreground border-warning/30", title: `${box} replaces the committed value` },
  }[source];
  return (
    <Tip label={map.title}>
      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-px text-[11px]", map.cls)}>
        <map.Icon className="size-3" />
        {map.label}
      </span>
    </Tip>
  );
}

// LayeredScript is a script the repository may commit and this box may
// override: the committed one shows read-only until overridden.
export function LayeredScript({
  label,
  hint,
  repo,
  local,
  box,
  placeholder,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  repo?: string;
  local?: string;
  box: string;
  placeholder: string;
  onChange(v: string | undefined): void;
}) {
  const overriding = local !== undefined && local !== "";
  const source: Source | undefined = overriding ? (repo ? "override" : "box") : repo ? "repo" : undefined;
  return (
    <div className="px-4 py-3.5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="font-medium text-sm">{label}</span>
        {source && <SourceBadge source={source} box={box} />}
        <span className="ml-auto flex gap-1">
          {repo && !overriding && (
            <Button size="xs" variant="ghost" onClick={() => onChange(repo)}>
              <LaptopMinimalIcon />
              Override on {box}
            </Button>
          )}
          {overriding && repo && (
            <Button size="xs" variant="ghost" onClick={() => onChange(undefined)}>
              <Undo2Icon />
              Use the repo's
            </Button>
          )}
        </span>
      </div>
      <p className="mb-2 text-muted-foreground text-xs">{hint}</p>
      {repo && !overriding ? (
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed">{repo}</pre>
      ) : (
        <Textarea value={local ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} mono text="xs" span="note" spellCheck={false} />
      )}
    </div>
  );
}
