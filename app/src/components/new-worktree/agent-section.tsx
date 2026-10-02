import type { Ref } from "react";

import { AgentPicker } from "@/components/new-worktree/agent-picker";
import { Frame, FramePanel } from "@/components/ui/frame";
import type { AgentPreset } from "@/lib/api";

// AgentSection picks who works in the new worktree, and once someone does,
// what they are asked first.
export function AgentSection({
  presets,
  agent,
  onAgent,
  prompt,
  onPrompt,
  promptRef,
}: {
  presets: AgentPreset[];
  agent: string;
  onAgent(id: string): void;
  prompt: string;
  onPrompt(v: string): void;
  promptRef?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <AgentPicker presets={presets} value={agent} onChange={onAgent} allowNone />
      {agent && (
        <Frame className="rounded-xl p-0.5">
          <FramePanel className="rounded-[10px] p-0 shadow-none before:hidden dark:bg-input/32">
            <textarea
              ref={promptRef}
              rows={3}
              value={prompt}
              aria-label="First prompt"
              placeholder="What should it do first? Leave empty to start it at its prompt."
              onChange={(e) => onPrompt(e.target.value)}
              className="block min-h-20 w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/72"
            />
          </FramePanel>
        </Frame>
      )}
    </div>
  );
}
