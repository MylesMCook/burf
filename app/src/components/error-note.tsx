import { CircleAlertIcon } from "lucide-react";
import type React from "react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
import { detailsFor, type Explained, explain, looksRaw, type NextStep, STEP_LABEL } from "@/lib/errors";
import { cn } from "@/lib/utils";

// How errors look: a title, one sentence, the one next step, and what the
// box actually said folded away under "Details" (lib/errors.ts).

// ErrorDetails folds the original words away.
export function ErrorDetails({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return (
    <details className={cn("group/details text-muted-foreground text-xs", className)}>
      <summary className="w-fit cursor-pointer select-none rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">Details</summary>
      <code className="mt-1 block max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-foreground/80 select-text">{text}</code>
    </details>
  );
}

// ErrorText is an inline error kept as text (plainError): the sentence, and
// its details when there were any.
export function ErrorText({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span>{text}</span>
      <ErrorDetails text={detailsFor(text)} />
    </div>
  );
}

// ErrorNote is an error in place, as an alert: what happened, what to do,
// and the step as a button when the caller can take it.
export function ErrorNote({ error, box, onStep, className }: { error: unknown; box?: string; onStep?: (step: NextStep) => void; className?: string }) {
  const e = explain(error, { box });
  const step = e.step && (onStep || globalStep(e)) ? e.step : undefined;
  return (
    <Alert variant="error" className={className}>
      <CircleAlertIcon />
      <AlertTitle>{e.title}</AlertTitle>
      <AlertDescription>
        <span>{e.message}</span>
        <ErrorDetails text={e.details} />
      </AlertDescription>
      {step && (
        <AlertAction>
          <Button size="xs" variant="outline" onClick={() => (onStep ? onStep(step) : globalStep(e)?.())}>
            {STEP_LABEL[step]}
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

// Steps any error can take without knowing where it came from.
function globalStep(e: Explained): (() => void) | undefined {
  if (e.step === "update-box" && e.box) {
    const box = e.box;
    return () => void import("@/lib/outdated").then((m) => m.updateBoxes([box]));
  }
  if (e.step === "reconnect") return () => void import("@/lib/store").then((m) => m.useStore.getState().refreshAll());
  return undefined;
}

function description(e: Explained): React.ReactNode {
  return (
    <span className="flex flex-col gap-1">
      <span>{e.message}</span>
      <ErrorDetails text={e.details} />
    </span>
  );
}

// toastError says what went wrong in a toast. title is what was being done
// ("Couldn't send it"); the explanation's own title replaces it when that
// says more. onStep takes the next step (Start again, Show terminal…);
// without it only steps that need no context are offered.
export function toastError(err: unknown, opts: { title?: string; box?: string; onStep?: (step: NextStep) => void } = {}) {
  const e = explain(err, { box: opts.box });
  const run = e.step && opts.onStep ? () => opts.onStep!(e.step!) : globalStep(e);
  return toastManager.add({
    type: "error",
    title: e.title !== "Something went wrong" ? e.title : (opts.title ?? e.title),
    description: description(e),
    actionProps: run && e.step ? { children: STEP_LABEL[e.step], onClick: run } : undefined,
  });
}

// Every other error toast in the app passes its description as text, often
// errorMessage(err) — what the box said. They are put in plain English on
// the way in: the caller's title stays (it says what failed), the sentence
// replaces the raw words, which move behind Details.
type AddOptions = Parameters<typeof toastManager.add>[0];
function humanize<T extends Partial<AddOptions>>(o: T): T {
  if (o.type !== "error" || typeof o.description !== "string" || !o.description) return o;
  const e = explain(o.description);
  if (!e.details && !looksRaw(o.description)) return o;
  const run = globalStep(e);
  return {
    ...o,
    description: description(e),
    actionProps: o.actionProps ?? (run && e.step ? { children: STEP_LABEL[e.step], onClick: run } : undefined),
  };
}

const add = toastManager.add.bind(toastManager);
const update = toastManager.update.bind(toastManager);
toastManager.add = ((o: AddOptions) => add(humanize(o))) as typeof toastManager.add;
toastManager.update = ((id: string, u: Partial<AddOptions>) => update(id, humanize(u))) as typeof toastManager.update;
