import { BookMarkedIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AgentIcon } from "@/components/agent-glyph";
import { Tip } from "@/components/tip";
import { AgentPicker } from "@/components/new-worktree/agent-picker";
import { QueueOffer, offlineOffer, queueLabel } from "@/components/queue/queue-offer";
import { Button } from "@/components/ui/button";
import { StepHeader } from "@/components/step-header";
import { Dialog, DialogFooter, DialogPanel, DialogPopup } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toastManager } from "@/components/ui/toast";
import { useSessionName } from "@/hooks/use-session-name";
import { agentPresets } from "@/lib/actions";
import type { Session } from "@/lib/api";
import { agentLabel, agentOf } from "@/lib/derive";
import { errorMessage } from "@/lib/format";
import { plainError } from "@/lib/errors";
import { handoff, handoffPrompt, loop, review, reviewPrompt, send, sessionLocation } from "@/lib/orchestrate";
import { openPromptPicker } from "@/lib/prompts";
import { type SendFailure, enqueue, sendFailure } from "@/lib/queue";
import { load, save } from "@/lib/storage";
import { type OrchestrateDraft, useStore } from "@/lib/store";
import { findSession, setPaneContent, splitPane } from "@/lib/workspaces";
import { ErrorText } from "@/components/error-note";

const titles = {
  send: "Send a prompt",
  handoff: "Hand off",
  review: "Review with another agent",
  loop: "Loop until a check passes",
};

const descriptions = {
  send: "Typed into the session as if you had, then Enter.",
  handoff: "Another agent picks up the work, beside this one or in a new worktree.",
  review: "A second agent reads this worktree's changes and lists problems. It opens beside this one.",
  loop: "Prompt, wait for the turn to end, run the check. While it fails, the failure goes back. Stops if the agent asks you something.",
};

const actions = { send: "Send", handoff: "Hand off", review: "Start review", loop: "Start loop" };

const checkKey = (box: string, location: string) => `berth.loop.check.${box}/${location.split("/")[0]}`;

// OrchestrateDialog drives one session from another: send, hand off,
// review, loop. The work itself is in lib/orchestrate.
export function OrchestrateDialog() {
  const d = useStore((s) => s.orchestrate);
  const close = () => useStore.getState().setOrchestrate(undefined);
  return (
    <Dialog open={!!d} onOpenChange={(open) => !open && close()}>
      {/* Anchored at the top: each kind has its own fields, and Send grows an offer to queue; a centred dialog would move its title. */}
      <DialogPopup anchored className="sm:max-w-[32rem]" showCloseButton={false}>
        {d && <Body key={`${d.kind}:${d.box}:${d.session}`} d={d} onDone={close} />}
      </DialogPopup>
    </Dialog>
  );
}

function Body({ d, onDone }: { d: OrchestrateDraft; onDone(): void }) {
  const session = useStore((s) => s.boxes[d.box]?.sessions?.find((x) => x.name === d.session));
  const presets = agentPresets(d.box);
  const current = session ? agentOf(session) : undefined;
  const other = presets.find((p) => p.id !== current)?.id ?? presets[0]?.id ?? "claude";
  let location = d.location ?? "";
  try {
    location = sessionLocation(d.box, d.session);
  } catch {
    // An unknown session: the dialog still opens, and submitting explains.
  }
  const worktree = location.split("/")[1] ?? location;
  const who = useSessionName(d.box, d.session);
  const from = { worktree: worktree || d.session, path: session?.dir ?? "" };

  const [text, setText] = useState(() => d.prompt ?? (d.kind === "handoff" ? handoffPrompt(from, true) : d.kind === "review" ? reviewPrompt(who) : ""));
  const [edited, setEdited] = useState(!!d.prompt);
  const [agent, setAgent] = useState(d.kind === "review" ? other : (current ?? presets[0]?.id ?? "claude"));
  const [newWorktree, setNewWorktree] = useState(false);
  const [name, setName] = useState("");
  const [check, setCheck] = useState(() => load(checkKey(d.box, location), "pnpm test"));
  const [rounds, setRounds] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // A send to a box that is away offers to queue the prompt instead.
  const [offer, setOffer] = useState<SendFailure | undefined>(() => (d.kind === "send" ? offlineOffer(d.box) : undefined));

  // Until edited, a hand-off's prompt follows where the next agent works.
  useEffect(() => {
    if (d.kind === "handoff" && !edited) setText(handoffPrompt(from, !newWorktree));
    // from changes identity every render; where it points does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newWorktree]);

  const ready = d.kind === "loop" ? !!check.trim() : !!text.trim() && (!newWorktree || !!name.trim());

  const submit = async (force?: "send") => {
    if (!ready || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (d.kind === "send" && offer && force !== "send") {
        await enqueue({ box: d.box, session: d.session, text });
      } else if (d.kind === "send") {
        try {
          await send(d.box, d.session, text);
          setOffer(undefined);
        } catch (err) {
          const f = sendFailure(err, d.box);
          setOffer(f);
          if (!f) throw err;
          return;
        }
      } else if (d.kind === "loop") {
        save(checkKey(d.box, location), check.trim());
        loop({ box: d.box, session: d.session, prompt: text.trim(), check: check.trim(), max: rounds });
      } else {
        const wt = d.kind === "handoff" && newWorktree ? { name: name.trim() } : undefined;
        // The new agent opens beside this one while it starts.
        const at = !wt ? findSession(d.box, d.session) : undefined;
        const pane = at ? splitPane(at.key, at.tab, at.pane.id, "row", { kind: "starting", label: agentLabel(agent) }) : undefined;
        const started = (s: Session) => at && pane && setPaneContent(at.key, at.tab, pane, { kind: "terminal", box: d.box, session: s.name });
        const start = d.kind === "review" ? review({ box: d.box, from: d.session, agent, prompt: text, onStarted: started }) : handoff({ box: d.box, from: d.session, location: location || undefined, agent, prompt: text, worktree: wt, onStarted: started });
        void start.catch((err) => {
          if (at && pane) setPaneContent(at.key, at.tab, pane, { kind: "error", message: plainError(err) });
          else toastManager.add({ title: d.kind === "review" ? "Review failed" : "Hand off failed", description: errorMessage(err), type: "error" });
        });
        if (wt) toastManager.add({ title: `Starting ${agentLabel(agent)} in ${wt.name}`, type: "info" });
      }
      onDone();
    } catch (err) {
      setError(plainError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="contents"
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
        title={titles[d.kind]}
        description={descriptions[d.kind]}
        aside={
          <Tip label={`Session ${d.session} on ${d.box}`}>
            <span className="ml-0.5 inline-flex h-6 min-w-0 items-center gap-1.5 rounded-md border bg-muted/72 px-2 text-[13px]">
              <AgentIcon agent={current} className="size-3" />
              <span className="truncate">{worktree ? `${worktree} · ${who}` : who}</span>
              <span className="shrink-0 text-muted-foreground">{d.box}</span>
            </span>
          </Tip>
        }
      />

      <DialogPanel className="flex flex-col gap-4 px-5 pb-5">
        {(d.kind === "handoff" || d.kind === "review") && (
          <Field label="Agent">
            <AgentPicker presets={presets} value={agent} onChange={setAgent} />
          </Field>
        )}
        {d.kind === "handoff" && (
          <div className="flex min-h-8 items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={newWorktree} onCheckedChange={setNewWorktree} />
              In a new worktree
            </label>
            {newWorktree && <Input size="sm" className="ml-auto max-w-52 font-mono" value={name} placeholder="worktree name" aria-label="New worktree name" onChange={(e) => setName(e.target.value)} />}
          </div>
        )}
        <Field
          label={d.kind === "loop" ? "First prompt" : "Prompt"}
          action={
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-6 text-muted-foreground"
              onClick={() =>
                openPromptPicker({
                  box: d.box,
                  session: d.session,
                  onInsert: (t) => {
                    setText(text.trim() && edited ? `${text.trimEnd()}\n\n${t}` : t);
                    setEdited(true);
                  },
                })
              }
            >
              <BookMarkedIcon />
              Saved prompts…
            </Button>
          }
        >
          <Textarea
            autoFocus
            rows={d.kind === "send" ? 4 : 3}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setEdited(true);
            }}
            placeholder={d.kind === "loop" ? "Empty runs the check first" : d.kind === "send" ? "e.g. Run the tests again and fix what fails" : undefined}
          />
        </Field>
        {d.kind === "loop" && (
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Check" hint="Runs in the session's worktree; exit 0 means done.">
              <Input className="font-mono" value={check} onChange={(e) => setCheck(e.target.value)} />
            </Field>
            <Field label="Rounds">
              <NumberField className="w-28" value={rounds} min={1} max={20} onValueChange={(v) => v != null && setRounds(v)}>
                <NumberFieldGroup>
                  <NumberFieldDecrement />
                  <NumberFieldInput className="text-center tabular-nums" />
                  <NumberFieldIncrement />
                </NumberFieldGroup>
              </NumberField>
            </Field>
          </div>
        )}
        {offer && <QueueOffer failure={offer} box={d.box} />}
        {error && <ErrorText className="text-destructive text-sm" text={error} />}
      </DialogPanel>

      <DialogFooter className="items-center px-5 py-3">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        {offer && (
          <Button type="button" variant="outline" disabled={!ready || busy} onClick={() => void submit("send")}>
            Try sending again
          </Button>
        )}
        <Button type="submit" loading={busy} disabled={!ready}>
          {offer ? queueLabel(offer, d.box) : actions[d.kind]}
          <Kbd className="-me-1 bg-primary-foreground/16 text-primary-foreground/80">⌘↵</Kbd>
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, hint, action, children }: { label: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {action ? (
        <span className="-my-0.5 flex items-center justify-between gap-2 font-medium text-[13px]">
          {label}
          {action}
        </span>
      ) : (
        <span className="font-medium text-[13px]">{label}</span>
      )}
      {children}
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}
