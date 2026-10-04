import { ArrowUpIcon, CheckIcon, ChevronDownIcon, FolderIcon, GaugeIcon, GitBranchIcon, Layers2Icon, MonitorIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { agentLabel } from "@/lib/derive";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Composer is Shore's one place to start work: what to do, on which box and
// project, in a new worktree or the main checkout, with which agent, and
// whether to try several ways at once. Once work starts it docks at the foot
// of the window as a one-line reply box; the same element travels there, so
// what you were typing and the focus go with it.

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

export function Composer({ docked, onSend, title }: { docked?: boolean; onSend(s: Send): void; title?: string }) {
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

  const ready = !!text.trim() && (docked || (!!pickBox && !!pickLoc));
  const send = () => {
    const t = text.trim();
    if (!ready) return;
    onSend({ text: t, box: pickBox, location: pickLoc, where, agent, effort, attempts: ways ? 3 : 1 });
    setText("");
  };

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <Fold open={!docked}>
        <h1 className="pb-5 text-center font-semibold text-(--sh-title) text-[30px] leading-tight tracking-[-0.022em] [text-shadow:0_1px_18px_rgb(255_255_255/0.45)] max-[1100px]:text-[26px]">
          {title ?? "What should your agents work on?"}
        </h1>
      </Fold>
      <div
        className={cn(
          "relative rounded-[22px] bg-(--sh-glass) shadow-(--sh-shadow) ring-(--sh-edge) ring-1 backdrop-blur-xl transition-[padding] duration-500",
          "focus-within:ring-(--sh-line-2)",
          docked ? "py-3.5 pr-14 pl-4.5" : "px-4.5 pt-4 pb-3",
        )}
      >
        <textarea
          ref={ref}
          value={text}
          rows={docked ? 1 : 2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          aria-label={docked ? "Reply" : "What should your agents work on?"}
          placeholder={docked ? "Reply, or ask for something else" : "Describe a task, a bug to fix, an idea to try…"}
          className="field-sizing-content block max-h-48 min-h-6 w-full resize-none bg-transparent text-(--sh-ink) text-[15px] leading-6 outline-none placeholder:text-(--sh-ink-3)"
        />
        <Fold open={!docked}>
          <div className="flex items-center gap-1 pt-3 pr-11">
            <button
              type="button"
              onClick={() => setWays((w) => !w)}
              aria-pressed={ways}
              title="Start three agents on the same task, each in its own worktree, and keep the best"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium text-[12.5px] transition-colors",
                ways ? "bg-(--sh-on) text-(--sh-on-ink)" : "text-(--sh-ink-2) hover:bg-(--sh-chip)",
              )}
            >
              <Layers2Icon className="size-3.5" />
              Try 3 ways
            </button>
            <div className="ml-auto flex items-center gap-0.5">
              <Pick icon={<AgentIcon agent={agent} className="size-3.5" />} label={agentLabel(agent)} value={agent} options={AGENTS} show={agentLabel} onPick={setAgent} />
              <Pick icon={<GaugeIcon />} label={effort} value={effort} options={EFFORTS} onPick={setEffort} hint="Effort" />
            </div>
          </div>
        </Fold>
        <button
          type="button"
          onClick={send}
          disabled={!ready}
          aria-label="Send"
          className={cn(
            "absolute right-3 inline-flex size-8 items-center justify-center rounded-full bg-(--sh-btn) text-(--sh-btn-ink) shadow-sm transition-[background-color,color,transform,bottom] duration-300 enabled:hover:scale-105 disabled:bg-(--sh-chip-2) disabled:text-(--sh-ink-3) disabled:shadow-none",
            docked ? "bottom-[11px]" : "bottom-3",
          )}
        >
          <ArrowUpIcon className="size-4" strokeWidth={2.4} />
        </button>
      </div>
      <Fold open={!docked}>
        <div className="flex justify-center pt-3">
          <div className="flex items-center gap-0.5 rounded-full bg-(--sh-glass-2) p-0.5 shadow-(--sh-shadow-sm) ring-(--sh-edge) ring-1 backdrop-blur-xl">
            <Pick icon={<MonitorIcon />} label={pickBox || "No box"} value={pickBox} options={online} onPick={setBox} hint="Box" />
            <span className="text-(--sh-ink-3) text-[12px]" aria-hidden>
              /
            </span>
            <Pick icon={<FolderIcon />} label={pickLoc || "No project"} value={pickLoc} options={projects.map((p) => p.name)} onPick={setLocation} hint="Project" />
            <span className="mx-1 h-4 w-px bg-(--sh-line-2)" aria-hidden />
            <Pick
              icon={<GitBranchIcon />}
              label={where === "new" ? "New worktree from main" : "Main checkout"}
              value={where === "new" ? "New worktree from main" : "Main checkout"}
              options={["New worktree from main", "Main checkout"]}
              onPick={(v) => setWhere(v === "Main checkout" ? "main" : "new")}
              hint="Where"
            />
          </div>
        </div>
      </Fold>
    </div>
  );
}

function Fold({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="shore-fold" data-closed={open ? undefined : ""} inert={!open || undefined}>
      <div>{children}</div>
    </div>
  );
}

function Pick({ icon, label, value, options, onPick, show, hint }: { icon?: React.ReactNode; label: string; value: string; options: string[]; onPick(v: string): void; show?(v: string): string; hint?: string }) {
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={hint ? `${hint}: ${label}` : undefined}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 font-medium text-(--sh-ink-2) text-[12.5px] outline-none transition-colors hover:bg-(--sh-chip) hover:text-(--sh-ink) data-popup-open:bg-(--sh-chip-2) [&_svg]:size-3.5"
          />
        }
      >
        {icon}
        {label}
        <ChevronDownIcon className="-ml-0.5 opacity-60" />
      </MenuTrigger>
      <MenuPopup align="start">
        {options.map((o) => (
          <MenuItem key={o} onClick={() => onPick(o)}>
            <span className="flex-1">{show ? show(o) : o}</span>
            {o === value && <CheckIcon className="size-3.5 opacity-70" />}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
