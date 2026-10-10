import * as stylex from "@stylexjs/stylex";
import { CheckIcon, ChevronRightIcon, CircleAlertIcon, ClipboardListIcon, CopyIcon } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { create } from "zustand";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toastManager } from "@/components/ui/toast";
import { detailsFor, type Explained, explain, looksRaw, type NextStep, STEP_LABEL } from "@/lib/errors";
import { noteToast } from "@/lib/recent-events";

const paint = stylex.create({
  s0: {
    "display": "inline-flex",
    "width": "fit-content",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "2px",
    "borderRadius": "var(--radius-sm)",
    "color": {
      "default": "var(--muted-foreground)",
      ":hover": "var(--foreground)",
    },
    "fontSize": "12px",
    "lineHeight": "16px",
    "outline": "none",
    "textDecoration": {
      ":hover": "underline",
    },
    "boxShadow": {
      ":focus-visible": "0 0 0 2px var(--ring)",
    },
  },
  s1: {
    "width": "12px",
    "height": "12px",
  },
  s2: {
    "paddingLeft": "24px",
    "paddingRight": "24px",
    "paddingBottom": "8px",
  },
  s3: {
    "maxHeight": "50vh",
    "userSelect": "text",
    "overflow": "auto",
    "whiteSpace": "pre-wrap",
    "overflowWrap": "break-word",
    "borderRadius": "var(--radius-lg)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": "color-mix(in oklab, var(--muted) 60%, transparent)",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "10px",
    "paddingBottom": "10px",
    "fontFamily": "var(--font-mono)",
    "fontSize": "12px",
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    "lineHeight": "1.625",
  },
  s4: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
  },
  s5: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
  },

  s6: {
    textUnderlineOffset: 2,
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

// How errors look: a title, one sentence, the one next step, and what the
// box actually said folded away under "Details" (lib/errors.ts).

// ErrorDetails is "Details": a button that opens what was actually said
// (git's or a script's whole output) in a dialog, with Copy. A button, not
// a <details>: inside a toast the toast takes the pointer for swiping, and
// a toast is too small and too short-lived to hold a long output anyway.
// In a toast (detached) the dialog is the app's one ErrorDetailsHost, so it
// outlives the toast; elsewhere it is its own, nested in any open dialog.
export function ErrorDetails({ text, className, title, message, detached }: { text?: string; className?: string; title?: string; message?: string; detached?: boolean }) {
  if (!text) return null;
  const cls = [[sx(paint.s0), (sx(paint.s6) ?? "")].filter(Boolean).join(" "), className].filter(Boolean).join(" ");
  const label = (
    <>
      Details
      <ChevronRightIcon aria-hidden className={sx(paint.s1)} />
    </>
  );
  if (detached)
    return (
      <button type="button" className={cls} aria-haspopup="dialog" onClick={() => showErrorDetails({ text, title, message })}>
        {label}
      </button>
    );
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={cls} />}>{label}</DialogTrigger>
      <DetailsPopup text={text} title={title} message={message} />
    </Dialog>
  );
}

interface DetailsReq {
  text: string;
  title?: string;
  message?: string;
}

const useDetails = create<{ req?: DetailsReq }>()(() => ({}));

// showErrorDetails opens the details dialog from anywhere (a toast).
export function showErrorDetails(req: DetailsReq) {
  useDetails.setState({ req });
}

// ErrorDetailsHost is where a toast's Details opens; App mounts it once.
export function ErrorDetailsHost() {
  const req = useDetails((s) => s.req);
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && useDetails.setState({ req: undefined })}>
      {req && <DetailsPopup {...req} />}
    </Dialog>
  );
}

function DetailsPopup({ text, title, message }: DetailsReq) {
  const [copied, setCopied] = useState(false);
  return (
    <DialogPopup width="2xl">
      <DialogHeader>
        <DialogTitle>{title ?? "Details"}</DialogTitle>
        <DialogDescription>{message ?? "What was said, word for word."}</DialogDescription>
      </DialogHeader>
      <div className={sx(paint.s2)}>
        <pre
          aria-label="Full output"
          className={sx(paint.s3)}
        >
          {text}
        </pre>
      </div>
      <DialogFooter variant="bare">
        <DialogClose render={<Button variant="ghost" />}>Close</DialogClose>
        {/* What's set up and what went wrong lately, redacted, for a bug report. */}
        <Button variant="outline" data-testid="details-copy-diagnostics" onClick={() => void import("@/lib/diagnostics").then((m) => m.copyDiagnostics())}>
          <ClipboardListIcon />
          Copy diagnostics
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
            } catch {
              return;
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </DialogFooter>
    </DialogPopup>
  );
}

// ErrorText is an inline error kept as text (plainError): the sentence, and
// its details when there were any.
export function ErrorText({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return (
    <div className={[sx(paint.s4), className].filter(Boolean).join(" ")}>
      <span>{text}</span>
      <ErrorDetails text={detailsFor(text)} />
    </div>
  );
}

// ErrorNote is an error in place, as an alert: what happened, what to do,
// and the step as a button when the caller can take it.
export function ErrorNote({ error, box, onStep }: { error: unknown; box?: string; onStep?: (step: NextStep) => void }) {
  const e = explain(error, { box });
  const step = e.step && (onStep || globalStep(e)) ? e.step : undefined;
  return (
    <Alert variant="error">
      <CircleAlertIcon />
      <AlertTitle>{e.title}</AlertTitle>
      <AlertDescription>
        <span>{e.message}</span>
        <ErrorDetails text={e.details} title={e.title} message={detailsLine(e)} />
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

// The dialog's sentence: the toast's own one points at Details, which is
// where the reader already is.
const detailsLine = (e: Explained) => (/^Details has git's/.test(e.message) ? "Git's own words." : /Details has/.test(e.message) ? "What it said, word for word." : e.message);

function description(e: Explained, title?: React.ReactNode): React.ReactNode {
  return (
    <span className={sx(paint.s5)}>
      <span>{e.message}</span>
      <ErrorDetails text={e.details} title={typeof title === "string" ? title : e.title} message={detailsLine(e)} detached />
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
  noted = { code: e.code, message: e.details ? `${e.message} ${e.details}` : e.message };
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
    description: description(e, o.title),
    actionProps: o.actionProps ?? (run && e.step ? { children: STEP_LABEL[e.step], onClick: run } : undefined),
  };
}

const add = toastManager.add.bind(toastManager);
const update = toastManager.update.bind(toastManager);
// Every toast is noted for Copy diagnostics (lib/recent-events), an error
// with its code.
let noted: { code?: string; message?: string } | undefined;
toastManager.add = ((o: AddOptions) => {
  noteToast(o, noted ?? (o.type === "error" && typeof o.description === "string" ? { code: explain(o.description).code } : {}));
  noted = undefined;
  return add(humanize(o));
}) as typeof toastManager.add;
toastManager.update = ((id: string, u: Partial<AddOptions>) => update(id, humanize(u))) as typeof toastManager.update;
