import { ArrowUpIcon, ChevronsUpDownIcon, FolderIcon, GitBranchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { AgentIcon, StatusDot } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { Frame, FrameFooter, FramePanel } from "@/components/ui/frame";
import { Kbd } from "@/components/ui/kbd";
import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import { agentPresets } from "@/lib/actions";
import type { AgentPreset } from "@/lib/api";
import { NONE, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// TaskComposer is one place to start work: what to do, on which box and
// project, in a new worktree or the main checkout, and with which agents.
// One agent is a task; several (or one model against another, or ×2 of the
// same) are attempts. It only gathers the task; onSend starts it.

export interface AgentPick {
  agent: string;
  // The CLI's own names; "" is its default.
  model: string;
  effort: string;
}

export interface TaskDraft {
  text: string;
  box: string;
  location: string;
  where: "new" | "main";
  // One pick is a task; more are attempts.
  picks: AgentPick[];
}

export interface TaskComposerProps {
  onSend(d: TaskDraft): void | Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  // Start on this box and project.
  box?: string;
  location?: string;
  // Work in a worktree already chosen: no box, project or where pickers.
  fixed?: boolean;
}

// What the picker holds: per agent, its models (each one attempt; "" the
// default) and one effort.
type Chosen = Record<string, { models: string[]; effort: string }>;

export function TaskComposer({ onSend, placeholder = "Describe a task, a bug to fix, an idea to try…", autoFocus, box: box0, location: loc0, fixed }: TaskComposerProps) {
  const status = useStore((s) => s.status);
  const boxes = useStore((s) => s.boxes);
  const online = useMemo(() => (status?.boxes ?? []).filter((b) => b.state === "online").map((b) => b.name), [status]);
  const [box, setBox] = useState(box0 ?? "");
  const pickBox = fixed ? box : online.includes(box) ? box : (online[0] ?? "");
  const projects = (boxes[pickBox]?.locations ?? NONE).filter((l) => l.repo);
  const [location, setLocation] = useState(loc0 ?? "");
  const pickLoc = fixed || projects.some((p) => p.name === location) ? location : (projects[0]?.name ?? "");
  const presets = pickBox ? agentPresets(pickBox, pickLoc) : [];
  const [chosen, setChosen] = useState<Chosen>({});
  const [copies, setCopies] = useState(1);
  const [where, setWhere] = useState<"new" | "main">("new");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  // Until something is picked, the first agent at its defaults.
  const live: Chosen = Object.fromEntries(Object.entries(chosen).filter(([id, c]) => c.models.length && presets.some((p) => p.id === id)));
  const sel: Chosen = Object.keys(live).length ? live : presets[0] ? { [presets[0].id]: { models: [""], effort: "" } } : {};
  const picks: AgentPick[] = Object.entries(sel).flatMap(([agent, c]) => c.models.flatMap((model) => Array.from({ length: copies }, () => ({ agent, model, effort: c.effort }))));

  const ready = !!text.trim() && !!pickBox && !!pickLoc && picks.length > 0 && !busy;
  const send = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await onSend({ text: text.trim(), box: pickBox, location: pickLoc, where, picks });
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame className="w-full shadow-lg/5">
      <FramePanel className="p-0 ring-ring/24 transition-shadow has-focus-visible:border-ring has-focus-visible:ring-[3px]">
        <textarea
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
          className="field-sizing-content block max-h-60 min-h-[76px] w-full resize-none rounded-[inherit] bg-transparent px-3.5 py-3 text-[14px] outline-none placeholder:text-muted-foreground/72"
        />
      </FramePanel>
      <FrameFooter className="flex items-center gap-0.5 px-1 pt-1 pb-0">
        {fixed && <span className="px-2.5 text-muted-foreground text-xs">Starts here, in this worktree</span>}
        {!fixed && (
          <>
            <Pick label="Box" icon={<StatusDot state="online" />} value={pickBox} options={online.map((b) => ({ value: b, label: b }))} onPick={setBox} empty="No box online" />
            <Pick label="Project" icon={<FolderIcon />} value={pickLoc} options={projects.map((p) => ({ value: p.name, label: p.name }))} onPick={setLocation} empty="No project" />
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
          </>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <AgentsPicker presets={presets} sel={sel} copies={copies} onChange={setChosen} onCopies={setCopies} />
          <Tip
            label={
              <span className="flex items-center gap-1.5">
                {picks.length > 1 ? `Start ${picks.length} attempts` : "Start"} <Kbd>⏎</Kbd>
              </span>
            }
          >
            <Button size="icon-sm" aria-label={picks.length > 1 ? `Start ${picks.length} attempts` : "Start"} disabled={!ready} loading={busy} onClick={() => void send()}>
              <ArrowUpIcon />
            </Button>
          </Tip>
        </div>
      </FrameFooter>
    </Frame>
  );
}

// nice shows a CLI's name for a model or an effort as people say it:
// "opus" → "Opus", "xhigh" → "Extra high"; ids like gpt-5-codex stay.
const nice = (m: string) => (m === "xhigh" ? "Extra high" : /^[a-z]+$/.test(m) ? m[0].toUpperCase() + m.slice(1) : m);

// pickLabel is the trigger's text: "Claude Code · Opus · High",
// "Claude Code (Opus vs Sonnet)", "Claude Code + Codex", "Codex ×3".
export function pickLabel(sel: Chosen, copies: number, presets: AgentPreset[]): string {
  const name = (id: string) => presets.find((p) => p.id === id)?.name ?? id;
  const entries = Object.entries(sel);
  let s: string;
  if (entries.length === 1 && entries[0][1].models.length === 1) {
    const [id, c] = entries[0];
    s = [name(id), c.models[0] && nice(c.models[0]), c.effort && nice(c.effort)].filter(Boolean).join(" · ");
  } else {
    const parts = entries.map(([id, c]) => {
      const named = c.models.filter(Boolean).map(nice);
      if (!named.length) return name(id);
      return `${name(id)} (${c.models.map((m) => (m ? nice(m) : "Default")).join(" vs ")})`;
    });
    s = parts.length > 2 ? `${parts[0]} + ${parts.length - 1} more` : parts.join(" + ");
  }
  return copies > 1 ? `${s} ×${copies}` : s;
}

function AgentsPicker({ presets, sel, copies, onChange, onCopies }: { presets: AgentPreset[]; sel: Chosen; copies: number; onChange(c: Chosen): void; onCopies(n: number): void }) {
  const label = pickLabel(sel, copies, presets);
  const ids = Object.keys(sel);
  // Unticking the last pick leaves it: there is always one agent.
  const set = (id: string, next: { models: string[]; effort: string } | undefined) => {
    const out: Chosen = { ...sel };
    if (next?.models.length) out[id] = next;
    else delete out[id];
    if (Object.keys(out).length) onChange(out);
  };
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="ghost" aria-label={`Agents: ${label}`} className="min-w-0 max-w-72 shrink" />}>
        <span className="flex shrink-0 gap-0.5">
          {ids.map((id) => (
            <AgentIcon key={id} agent={id} />
          ))}
        </span>
        <span className="truncate">{label}</span>
        <ChevronsUpDownIcon className="opacity-60" />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-64">
        <MenuGroup>
          <MenuGroupLabel>Agents</MenuGroupLabel>
          {presets.map((p) => {
            const c = sel[p.id];
            const models = p.model_flag ? (p.models ?? []) : [];
            const efforts = p.effort_flag ? (p.efforts ?? []) : [];
            if (!models.length && !efforts.length) {
              return (
                <MenuCheckboxItem key={p.id} checked={!!c} onCheckedChange={(on) => set(p.id, on ? { models: [""], effort: "" } : undefined)}>
                  <span className="flex items-center gap-2">
                    <AgentIcon agent={p.id} />
                    {p.name}
                  </span>
                </MenuCheckboxItem>
              );
            }
            const cur = c ?? { models: [], effort: "" };
            const toggle = (m: string, on: boolean) => set(p.id, { ...cur, models: on ? [...cur.models.filter((x) => x !== m), m] : cur.models.filter((x) => x !== m) });
            return (
              <MenuSub key={p.id}>
                <MenuSubTrigger className="gap-2 ps-2">
                  <span className={cn("flex w-3 shrink-0 items-center justify-center", !c && "invisible")} aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3">
                      <path d="M5.25 12.7 10.2 18.63 18.75 5.37" />
                    </svg>
                  </span>
                  <AgentIcon agent={p.id} />
                  <span className="flex-1">{p.name}</span>
                  {c && <span className="text-muted-foreground text-xs">{[...c.models.map((m) => (m ? nice(m) : "Default")), c.effort && nice(c.effort)].filter(Boolean).join(", ")}</span>}
                </MenuSubTrigger>
                <MenuSubPopup className="min-w-44">
                  <MenuGroup>
                    <MenuGroupLabel>Model</MenuGroupLabel>
                    {["", ...models].map((m) => (
                      <MenuCheckboxItem key={m || "default"} checked={cur.models.includes(m)} onCheckedChange={(on) => toggle(m, on)}>
                        {m ? nice(m) : "Default"}
                      </MenuCheckboxItem>
                    ))}
                  </MenuGroup>
                  {efforts.length > 0 && (
                    <>
                      <MenuSeparator />
                      <MenuGroup>
                        <MenuGroupLabel>Effort</MenuGroupLabel>
                        <MenuRadioGroup value={cur.effort} onValueChange={(v) => set(p.id, { models: cur.models.length ? cur.models : [""], effort: String(v) })}>
                          {["", ...efforts].map((e) => (
                            <MenuRadioItem key={e || "default"} value={e}>
                              {e ? nice(e) : "Default"}
                            </MenuRadioItem>
                          ))}
                        </MenuRadioGroup>
                      </MenuGroup>
                    </>
                  )}
                </MenuSubPopup>
              </MenuSub>
            );
          })}
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>Attempts of each</MenuGroupLabel>
          <MenuRadioGroup value={copies} onValueChange={(v) => onCopies(Number(v))}>
            {[1, 2, 3].map((n) => (
              <MenuRadioItem key={n} value={n}>
                {n === 1 ? "One" : `×${n}`}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

function Pick({ label, icon, value, options, onPick, empty }: { label: string; icon: React.ReactNode; value: string; options: { value: string; label: string }[]; onPick(v: string): void; empty?: string }) {
  const shown = options.find((o) => o.value === value)?.label ?? empty ?? "";
  return (
    <Menu>
      <MenuTrigger render={<Button size="sm" variant="ghost" aria-label={`${label}: ${shown}`} disabled={!options.length} className="text-muted-foreground hover:text-foreground" />}>
        {icon}
        {shown}
        <ChevronsUpDownIcon className="opacity-60" />
      </MenuTrigger>
      <MenuPopup align="start">
        <MenuGroup>
          <MenuGroupLabel>{label}</MenuGroupLabel>
          <MenuRadioGroup value={value} onValueChange={(v) => onPick(String(v))}>
            {options.map((o) => (
              <MenuRadioItem key={o.value} value={o.value} closeOnClick>
                {o.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
