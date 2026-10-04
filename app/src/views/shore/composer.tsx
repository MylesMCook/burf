import { ArrowUpIcon, ChevronDownIcon, FolderIcon, GitBranchIcon, MonitorIcon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { agentLabel } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Composer is Shore's one place to start work: what to do, on which box and
// project, in a new worktree or the main checkout, with which agent, and
// whether to try several ways at once.

export interface Send {
  text: string;
  box: string;
  location: string;
  where: "new" | "main";
  agent: string;
  effort: string;
  attempts: number;
}

const AGENTS = ["claude", "codex", "gemini"];
const EFFORTS = ["Low", "Medium", "High"];

export function Composer({ docked, onSend, placeholder }: { docked?: boolean; onSend(s: Send): void; placeholder?: string }) {
  const status = useStore((s) => s.status);
  const boxes = useStore((s) => s.boxes);
  const online = useMemo(() => (status?.boxes ?? []).filter((b) => b.state === "online").map((b) => b.name), [status]);
  const [box, setBox] = useState("");
  const pickBox = box || online[0] || "";
  const projects = (boxes[pickBox]?.locations ?? []).filter((l) => l.repo);
  const [location, setLocation] = useState("");
  const pickLoc = projects.some((p) => p.name === location) ? location : (projects[0]?.name ?? "");
  const [where, setWhere] = useState<"new" | "main">("new");
  const [agent, setAgent] = useState("claude");
  const [effort, setEffort] = useState("High");
  const [ways, setWays] = useState(false);
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [docked]);

  const send = () => {
    const t = text.trim();
    if (!t || !pickBox || !pickLoc) return;
    onSend({ text: t, box: pickBox, location: pickLoc, where, agent, effort, attempts: ways ? 3 : 1 });
    setText("");
  };

  return (
    <div className={cn("w-full max-w-[640px]", docked ? "" : "")}>
      {!docked && (
        <div className="mb-2 flex justify-end gap-1">
          <Pick onWater icon={<MonitorIcon />} label={pickBox || "No box"} options={online} onPick={setBox} />
          <Pick onWater icon={<FolderIcon />} label={pickLoc || "No project"} options={projects.map((p) => p.name)} onPick={setLocation} />
        </div>
      )}
      <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-[0_8px_40px_-12px_rgba(20,40,90,0.35)] backdrop-blur-md">
        <textarea
          ref={ref}
          value={text}
          rows={docked ? 1 : 2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder ?? "What should your agents work on?"}
          className="field-sizing-content max-h-48 min-h-6 w-full resize-none bg-transparent px-1 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
        />
        <div className="mt-2 flex items-center gap-1">
          {!docked && (
            <button
              type="button"
              onClick={() => setWays((w) => !w)}
              aria-pressed={ways}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors",
                ways ? "bg-sky-100 text-sky-800" : "text-slate-500 hover:bg-slate-100",
              )}
            >
              <SparklesIcon className="size-3.5" />
              Try 3 ways
            </button>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Pick icon={<AgentIcon agent={agent} className="size-3.5" />} label={agentLabel(agent)} options={AGENTS} show={agentLabel} onPick={setAgent} />
            <Pick label={effort} options={EFFORTS} onPick={setEffort} quiet />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim()}
              aria-label="Send"
              className="ml-1 inline-flex size-8 items-center justify-center rounded-full bg-slate-900 text-white transition-opacity disabled:opacity-30"
            >
              <ArrowUpIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
      {!docked && (
        <div className="mt-2 flex gap-1">
          <Pick
            onWater
            icon={<FolderIcon />}
            label={where === "new" ? "New worktree" : "Main checkout"}
            options={["New worktree", "Main checkout"]}
            onPick={(v) => setWhere(v === "New worktree" ? "new" : "main")}
          />
          <Pick onWater icon={<GitBranchIcon />} label="from main" options={["from main"]} onPick={() => {}} />
        </div>
      )}
    </div>
  );
}

function Pick({ icon, label, options, onPick, show, quiet, onWater }: { icon?: React.ReactNode; label: string; options: string[]; onPick(v: string): void; show?(v: string): string; quiet?: boolean; onWater?: boolean }) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs outline-none transition-colors hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-sky-300 data-popup-open:bg-white/80 [&_svg]:size-3.5",
              quiet ? "text-slate-400" : "text-slate-600",
              onWater && "bg-white/75 shadow-sm backdrop-blur-sm",
            )}
          />
        }
      >
        {icon}
        {label}
        <ChevronDownIcon className="text-slate-400" />
      </MenuTrigger>
      <MenuPopup align="start">
        {options.map((o) => (
          <MenuItem key={o} onClick={() => onPick(o)}>
            {show ? show(o) : o}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
