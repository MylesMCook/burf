import * as stylex from "@stylexjs/stylex";
import { color, radius } from "@/styles/tokens.stylex";
import { LibraryIcon, PencilIcon, UsersIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { QueueOffer, offlineOffer, queueLabel } from "@/components/queue/queue-offer";
import { LIBRARY_SCREEN, PromptPreview, PromptRow, VariableFields, openLibrary, useTargetLabel, withDefaults } from "@/components/prompts/shared";
import { SimpleSelect } from "@/components/simple-select";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { StepHeader } from "@/components/step-header";
import { Dialog, DialogFooter, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { useAllSessions } from "@/hooks/use-agent-counts";
import { agentOf, sessionName } from "@/lib/derive";
import { plainError } from "@/lib/errors";
import { send } from "@/lib/orchestrate";
import { type SendFailure, enqueue, sendFailure, targetName } from "@/lib/queue";
import {
  askedVariables,
  closePromptPicker,
  fill,
  focusedSession,
  matches,
  openBroadcast,
  type PickerDraft,
  promptsFor,
  type SavedPrompt,
  sessionProject,
  sessionValues,
  type Target,
  usePromptUi,
  usePrompts,
} from "@/lib/prompts";
import { useStore } from "@/lib/store";
import { useRegistry } from "@/plugins/registry";
import { describeAgent, startedAt } from "@/views/dashboard/names";
import { ErrorText } from "@/components/error-note";

const paint = stylex.create({
  s0: {
    "marginLeft": "2px",
  },
  s1: {
    "paddingLeft": "20px",
    "paddingRight": "20px",
    "paddingBottom": "8px",
  },
  s2: {
    "maxHeight": "min(24rem,55vh)",
    "overflowY": "auto",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingBottom": "8px",
  },
  s3: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "1px",
  },
  s4: {
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "24px",
    "paddingBottom": "24px",
    "textAlign": "center",
    "color": "var(--muted-foreground)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s6: {
    "display": "flex",
    "alignItems": "center",
    "gap": "4px",
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s7: {
    "display": "contents",
  },
  s8: {
    "marginLeft": "2px",
  },
  s9: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "6px",
  },
  s10: {
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s11: {
    "display": "flex",
    "minWidth": "0px",
    "flexDirection": "column",
    "gap": "6px",
  },
  s12: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
    "fontWeight": 500,
    "fontSize": "13px",
  },
  s13: {
    "marginLeft": "auto",
    "height": "24px",
  },
  s14: {
    "marginLeft": "auto",
    "height": "24px",
  },
  s15: {
    "maxHeight": "256px",
    "overflowY": "auto",
  },
  s16: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s17: {
    "color": "var(--destructive)",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s18: {
    "marginInlineEnd": "calc(4px * -1)",
    "backgroundColor": "color-mix(in oklab, var(--primary-foreground) 16%, transparent)",
    "color": "color-mix(in oklab, var(--primary-foreground) 80%, transparent)",
  },
  s19: {
    "width": "12px",
    "height": "12px",
  },
  s20: {
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s21: {
    "flexShrink": 0,
    "color": "var(--muted-foreground)",
  },
  s22: {
    display: "inline-flex",
    height: 24,
    minWidth: 0,
    alignItems: "center",
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: "color-mix(in oklab, var(--muted) 72%, transparent)",
    paddingLeft: 8,
    paddingRight: 8,
    fontSize: 13,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const sep = "\u0000";

// PromptPicker sends one saved prompt to one session: pick it, fill its
// variables, see exactly what will be typed, send. In insert mode it hands
// the filled text back instead (the Send prompt dialog uses that).
export function PromptPicker() {
  const d = usePromptUi((s) => s.picker);
  return (
    <Dialog open={!!d} onOpenChange={(open) => !open && closePromptPicker()}>
      {/* Anchored at the top: the list filters and the fill step is taller, and a centred dialog would move its title. */}
      <DialogPopup anchored showCloseButton={false} width="xl">
        {d && <Body key={`${d.box}:${d.session}:${d.promptId}:${!!d.onInsert}`} d={d} />}
      </DialogPopup>
    </Dialog>
  );
}

function Body({ d }: { d: PickerDraft }) {
  const prompts = usePrompts((s) => s.prompts);
  const [target, setTarget] = useState<Target | undefined>(() => (d.box && d.session ? { box: d.box, session: d.session } : d.onInsert ? undefined : focusedSession()));
  const [picked, setPicked] = useState<SavedPrompt | undefined>(() => prompts.find((p) => p.id === d.promptId));
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const insert = !!d.onInsert;

  useEffect(() => {
    void usePrompts.getState().load();
  }, []);

  const project = target ? sessionProject(target.box, target.session) : undefined;
  const list = useMemo(() => promptsFor(prompts, project).filter((p) => matches(p, query)), [prompts, project, query]);
  const current = list[Math.min(active, list.length - 1)];

  if (picked) return <Fill d={d} prompt={picked} target={target} setTarget={setTarget} onBack={() => setPicked(undefined)} />;

  return (
    <>
      <StepHeader title={insert ? "Insert a saved prompt" : "Send a saved prompt"} aside={target && !insert && <TargetChip target={target} className={sx(paint.s0)} />} description="Pick a prompt from your library." hideDescription />
      <div className={sx(paint.s1)}>
        <Input
          autoFocus
          value={query}
          placeholder="Search prompts and tags…"
          aria-label="Search prompts"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, list.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && current) {
              e.preventDefault();
              setPicked(current);
            }
          }}
        />
      </div>
      <div className={sx(paint.s2)}>
        <div role="listbox" aria-label="Saved prompts" className={sx(paint.s3)}>
          {list.map((p, i) => (
            <PromptRow key={p.id} p={p} active={p === current} onHover={() => setActive(i)} onPick={() => setPicked(p)} />
          ))}
          {list.length === 0 && <p className={sx(paint.s4)}>{query ? "No prompt matches." : "No saved prompts yet."}</p>}
        </div>
      </div>
      <DialogFooter pad="split">
        <LibraryButton />
        <div className={sx(paint.s5)}>
          {!insert && (
            <Button type="button" variant="ghost" size="sm" onClick={() => openBroadcast({ promptId: current?.id, targets: target ? [target] : undefined })}>
              <UsersIcon />
              Send to several…
            </Button>
          )}
          <span className={sx(paint.s6)}>
            <Kbd>↵</Kbd> to choose
          </span>
        </div>
      </DialogFooter>
    </>
  );
}

function LibraryButton() {
  const has = useRegistry((s) => s.screens.some((c) => c.item.id === LIBRARY_SCREEN));
  if (!has) return <span />;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        closePromptPicker();
        openLibrary();
      }}
    >
      <LibraryIcon />
      Library
    </Button>
  );
}

function Fill({ d, prompt, target, setTarget, onBack }: { d: PickerDraft; prompt: SavedPrompt; target?: Target; setTarget(t?: Target): void; onBack(): void }) {
  const insert = !!d.onInsert;
  const vars = useMemo(() => askedVariables(prompt), [prompt]);
  const [values, setValues] = useState<Record<string, string>>({});
  // Once edited by hand, the text is what goes, whatever the fields say.
  const [edited, setEdited] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // A send to a box that is away offers to queue the prompt instead; the
  // offer follows the chosen session's box.
  const [failure, setFailure] = useState<{ box: string; f: SendFailure }>();
  const offer = target && !insert ? (failure?.box === target.box ? failure.f : offlineOffer(target.box)) : undefined;
  // Subscribing keeps built-ins current while sessions and worktrees load.
  useStore((s) => (target ? s.boxes[target.box] : undefined));
  const builtins = target ? sessionValues(target.box, target.session) : {};
  const all = { ...builtins, ...withDefaults(vars, values) };
  const text = edited ?? fill(prompt.body, all);
  const ready = !!text.trim() && (insert || !!target);
  // With nothing to fill in, the button has focus, so Enter sends.
  const nothingToFill = !vars.length && (insert || !!d.session);

  const submit = async (force?: "send") => {
    if (!ready || busy) return;
    if (insert) {
      d.onInsert?.(text);
      usePrompts.getState().used([prompt.id]);
      closePromptPicker();
      return;
    }
    if (!target) return;
    setBusy(true);
    setError(undefined);
    try {
      if (offer && force !== "send") {
        await enqueue({ box: target.box, session: target.session, text });
      } else {
        await send(target.box, target.session, text);
        toastManager.add({ title: `Sent “${prompt.title}”`, description: targetName(target.box, target.session), type: "success" });
      }
      usePrompts.getState().used([prompt.id]);
      closePromptPicker();
    } catch (err) {
      const f = sendFailure(err, target.box);
      setFailure(f && { box: target.box, f });
      if (!f) setError(plainError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className={sx(paint.s7)}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <StepHeader
        title={prompt.title}
        onBack={onBack}
        backLabel="Back to prompts"
        aside={target && !insert && d.session && <TargetChip target={target} className={sx(paint.s8)} />}
        description="Fill in the prompt's variables, then send it."
        hideDescription
      />

      <DialogPanel inset="body" stack={4}>
        {!insert && !d.session && (
          <label className={sx(paint.s9)}>
            <span className={sx(paint.s10)}>Send to</span>
            <SessionSelect value={target} onChange={setTarget} />
          </label>
        )}
        <VariableFields vars={vars} values={values} autoFocus onChange={(name, v) => setValues((s) => ({ ...s, [name]: v }))} />
        <div className={sx(paint.s11)}>
          <span className={sx(paint.s12)}>
            {edited == null ? "Preview" : "Text"}
            {edited == null ? (
              <span className={sx(paint.s13)}><Button type="button" size="xs" variant="ghost"  onClick={() => setEdited(text)} muted>
                <PencilIcon />
                Edit text
              </Button></span>
            ) : (
              <span className={sx(paint.s14)}><Button type="button" size="xs" variant="ghost"  onClick={() => setEdited(undefined)} muted>
                Reset to the prompt
              </Button></span>
            )}
          </span>
          {edited == null ? (
            <PromptPreview body={prompt.body} values={all} className={sx(paint.s15)} />
          ) : (
            <Textarea autoFocus rows={7} value={edited} onChange={(e) => setEdited(e.target.value)} />
          )}
          {!target && !insert && <span className={sx(paint.s16)}>Built-in variables like {"{{branch}}"} fill in once you choose a session.</span>}
        </div>
        {offer && target && <QueueOffer failure={offer} box={target.box} />}
        {error && <ErrorText className={sx(paint.s17)} text={error} />}
      </DialogPanel>

      <DialogFooter pad="actions">
        <Button type="button" variant="ghost" onClick={closePromptPicker}>
          Cancel
        </Button>
        {offer && (
          <Button type="button" variant="outline" disabled={!ready || busy} onClick={() => void submit("send")}>
            Try sending again
          </Button>
        )}
        <Button type="submit" loading={busy} disabled={!ready} autoFocus={nothingToFill}>
          {insert ? "Insert" : offer && target ? queueLabel(offer, target.box) : "Send"}
          <span className={sx(paint.s18)}><Kbd>⌘↵</Kbd></span>
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TargetChip({ target, className }: { target: Target; className?: string }) {
  const { session, short, detail } = useTargetLabel(target.box, target.session);
  return (
    <Tip label={`${detail} · session ${target.session}`}>
      <span className={[sx(paint.s22), className].filter(Boolean).join(" ")}>
        <AgentIcon agent={session && agentOf(session)} className={sx(paint.s19)} />
        <span className={sx(paint.s20)}>{short}</span>
        <span className={sx(paint.s21)}>{target.box}</span>
      </span>
    </Tip>
  );
}

// SessionSelect chooses one agent session on any box.
function SessionSelect({ value, onChange }: { value?: Target; onChange(t?: Target): void }) {
  const all = useAllSessions();
  const boxes = useStore((s) => s.boxes);
  const options = all
    .filter((e) => e.state !== "exited" && agentOf(e.session))
    .map(({ box, session }) => {
      const data = boxes[box];
      const name = sessionName(session, { sessions: data?.sessions, locations: data?.locations, place: true });
      // Several of one agent in a worktree: when each started tells them apart.
      const crowded = describeAgent(session, data?.sessions, data?.locations).crowded;
      return { value: `${box}${sep}${session.name}`, label: `${name}${crowded ? `, started ${startedAt(session.created)}` : ""} — ${box}` };
    });
  return (
    <SimpleSelect
      options={options}
      value={value ? `${value.box}${sep}${value.session}` : ""}
      placeholder={options.length ? "Choose an agent…" : "No agents running"}
      disabled={!options.length}
      onChange={(v) => {
        const [box, session] = v.split(sep);
        onChange(box && session ? { box, session } : undefined);
      }}
    />
  );
}
