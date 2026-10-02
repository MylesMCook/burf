import { ChevronRightIcon, FileCode2Icon } from "lucide-react";

import { Picker } from "@/components/new-worktree/picker";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Location, TaskTemplate, TemplateVariable } from "@/lib/api";
import { labelFor } from "@/lib/templates";
import { cn } from "@/lib/utils";

export interface AdvancedValues {
  name: string;
  branch: string;
  base: string;
  prompt: string;
  template: string;
  vars: Record<string, string>;
}

// Advanced holds what Start from works out for you, to change by hand: the
// worktree's name and branch, what it starts from, and a template.
export function Advanced({
  open,
  onOpen,
  summary,
  v,
  set,
  placeholders,
  location,
  templates,
  variables,
}: {
  open: boolean;
  onOpen(open: boolean): void;
  summary: string;
  v: AdvancedValues;
  set(patch: Partial<AdvancedValues>, edited?: (keyof AdvancedValues)[]): void;
  placeholders: { name: string; branch: string; base: string };
  location?: Location;
  templates: TaskTemplate[];
  variables: TemplateVariable[];
}) {
  const scripts = location?.scripts;
  return (
    <Frame className="rounded-xl p-0.5">
      <button type="button" aria-expanded={open} onClick={() => onOpen(!open)} className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg px-2.5 text-left text-[13px] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
        <ChevronRightIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="font-medium">Advanced</span>
        <span className="ml-auto min-w-0 truncate font-mono text-[12px] text-muted-foreground">{summary}</span>
      </button>
      {open && (
        <FramePanel className="flex flex-col gap-3 rounded-[10px] p-3 shadow-none before:hidden">
          <Labelled label="Branch">
            <Input size="sm" className="font-mono" value={v.branch} placeholder={placeholders.branch} spellCheck={false} onChange={(e) => set({ branch: e.target.value }, ["branch"])} />
          </Labelled>
          <div className="grid grid-cols-[1fr_10rem] gap-2">
            <Labelled label="Worktree folder">
              <Input size="sm" className="font-mono" value={v.name} placeholder={placeholders.name} spellCheck={false} onChange={(e) => set({ name: e.target.value }, ["name"])} />
            </Labelled>
            <Labelled label="From">
              <Input size="sm" className="font-mono" value={v.base} placeholder={placeholders.base} spellCheck={false} onChange={(e) => set({ base: e.target.value }, ["base"])} />
            </Labelled>
          </div>
          {templates.length > 0 && (
            <Labelled label="Template">
              <Picker
                aria-label="Template"
                value={v.template}
                onChange={(id) => set({ template: id })}
                items={[{ value: "", label: "None" }, ...templates.map((t) => ({ value: t.id, label: t.name, detail: t.description }))]}
              />
            </Labelled>
          )}
          {variables.map((variable) => (
            <Labelled key={variable.id} label={labelFor(variable)}>
              {variable.multiline ? (
                <Textarea size="sm" rows={2} value={v.vars[variable.id] ?? ""} onChange={(e) => set({ vars: { ...v.vars, [variable.id]: e.target.value } })} />
              ) : (
                <Input size="sm" value={v.vars[variable.id] ?? ""} onChange={(e) => set({ vars: { ...v.vars, [variable.id]: e.target.value } })} />
              )}
            </Labelled>
          ))}
          <p className="flex items-start gap-1.5 text-muted-foreground text-xs leading-relaxed">
            <FileCode2Icon className="mt-0.5 size-3.5 shrink-0" />
            {scripts?.setup ? (
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>Setup script {scripts.from === "repo" ? "from .berth/config.json" : "set on this project"}, runs after creating</span>
                <code className="truncate font-mono text-foreground/80" title={scripts.setup}>
                  {scripts.setup}
                </code>
              </span>
            ) : (
              <span>No setup script. One in the repository's .berth/config.json runs in every new worktree.</span>
            )}
          </p>
        </FramePanel>
      )}
    </Frame>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}
