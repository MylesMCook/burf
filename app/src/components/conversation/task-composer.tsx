import { ArrowUpIcon, ChevronsUpDownIcon, FolderIcon, GitBranchIcon, Layers2Icon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { AgentIcon, StatusDot } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuGroup, MenuGroupLabel, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/menu";
import { Toggle } from "@/components/ui/toggle";
import { agentPresets } from "@/lib/actions";
import { NONE, useStore } from "@/lib/store";

// TaskComposer is one place to start work: what to do, on which box and
// project, in a new worktree or the main checkout, with which agent, and
// whether to try several ways at once. It only gathers the task; onSend
// starts it.

export interface TaskDraft {
  text: string;
  box: string;
  location: string;
  where: "new" | "main";
  agent: string;
  // How many ways to try it: 1, or 3 with "Try 3 ways".
  attempts: number;
}

export interface TaskComposerProps {
  onSend(d: TaskDraft): void | Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  // Start on this box and project.
  box?: string;
  location?: string;
}

export function TaskComposer({ onSend, placeholder = "Describe a task, a bug to fix, an idea to try…", autoFocus, box: box0, location: loc0 }: TaskComposerProps) {
  const status = useStore((s) => s.status);
  const boxes = useStore((s) => s.boxes);
  const online = useMemo(() => (status?.boxes ?? []).filter((b) => b.state === "online").map((b) => b.name), [status]);
  const [box, setBox] = useState(box0 ?? "");
  const pickBox = online.includes(box) ? box : (online[0] ?? "");
  const projects = (boxes[pickBox]?.locations ?? NONE).filter((l) => l.repo);
  const [location, setLocation] = useState(loc0 ?? "");
  const pickLoc = projects.some((p) => p.name === location) ? location : (projects[0]?.name ?? "");
  const presets = pickBox ? agentPresets(pickBox, pickLoc) : [];
  const [agent, setAgent] = useState("");
  const pickAgent = presets.some((p) => p.id === agent) ? agent : (presets[0]?.id ?? "claude");
  const [where, setWhere] = useState<"new" | "main">("new");
  const [ways, setWays] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const ready = !!text.trim() && !!pickBox && !!pickLoc && !busy;
  const send = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await onSend({ text: text.trim(), box: pickBox, location: pickLoc, where, agent: pickAgent, attempts: ways ? 3 : 1 });
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col items-center gap-2.5">
      <InputGroup className="**:[textarea]:min-h-14! bg-background shadow-lg/5 dark:bg-background">
        <InputGroupTextarea
          ref={ref}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          aria-label="What should your agents work on?"
          placeholder={placeholder}
          className="max-h-60 text-[14px]"
        />
        <InputGroupAddon align="block-end" className="gap-1">
          <Tip label="Start three agents on it, each in its own worktree, and pick the best">
            <Toggle size="sm" variant="outline" pressed={ways} onPressedChange={setWays} aria-label="Try 3 ways">
              <Layers2Icon />
              Try 3 ways
            </Toggle>
          </Tip>
          <div className="ml-auto flex items-center gap-1">
            <Menu>
              <MenuTrigger render={<Button size="sm" variant="ghost" aria-label={`Agent: ${presets.find((p) => p.id === pickAgent)?.name ?? pickAgent}`} />}>
                <AgentIcon agent={pickAgent} />
                {presets.find((p) => p.id === pickAgent)?.name ?? pickAgent}
                <ChevronsUpDownIcon className="opacity-60" />
              </MenuTrigger>
              <MenuPopup align="end">
                <MenuGroup>
                  <MenuGroupLabel>Agent</MenuGroupLabel>
                  <MenuRadioGroup value={pickAgent} onValueChange={(v) => setAgent(String(v))}>
                    {presets.map((p) => (
                      <MenuRadioItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <AgentIcon agent={p.id} />
                          {p.name}
                        </span>
                      </MenuRadioItem>
                    ))}
                  </MenuRadioGroup>
                </MenuGroup>
              </MenuPopup>
            </Menu>
            <Tip label={<span className="flex items-center gap-1.5">Send <Kbd>⏎</Kbd></span>}>
              <Button size="icon-sm" aria-label="Send" disabled={!ready} loading={busy} onClick={() => void send()}>
                <ArrowUpIcon />
              </Button>
            </Tip>
          </div>
        </InputGroupAddon>
      </InputGroup>

      <Group aria-label="Where it runs">
        <Pick label="Box" icon={<StatusDot state="online" />} value={pickBox} options={online.map((b) => ({ value: b, label: b }))} onPick={setBox} empty="No box online" />
        <GroupSeparator />
        <Pick label="Project" icon={<FolderIcon />} value={pickLoc} options={projects.map((p) => ({ value: p.name, label: p.name }))} onPick={setLocation} empty="No project" />
        <GroupSeparator />
        <Pick
          label="Where"
          icon={<GitBranchIcon />}
          value={where}
          options={[
            { value: "new", label: "New worktree" },
            { value: "main", label: "Main checkout" },
          ]}
          onPick={(v) => setWhere(v as "new" | "main")}
        />
      </Group>
    </div>
  );
}

function Pick({ label, icon, value, options, onPick, empty }: { label: string; icon: React.ReactNode; value: string; options: { value: string; label: string }[]; onPick(v: string): void; empty?: string }) {
  const shown = options.find((o) => o.value === value)?.label ?? empty ?? "";
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="outline" aria-label={`${label}: ${shown}`} disabled={!options.length} />}>
        {icon}
        {shown}
        <ChevronsUpDownIcon className="opacity-60" />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuGroup>
          <MenuGroupLabel>{label}</MenuGroupLabel>
          <MenuRadioGroup value={value} onValueChange={(v) => onPick(String(v))}>
            {options.map((o) => (
              <MenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

