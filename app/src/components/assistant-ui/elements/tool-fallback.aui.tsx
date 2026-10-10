"use client";

import * as stylex from "@stylexjs/stylex";
import { memo, useCallback, useRef, useState } from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleMinusIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import {
  toolApprovalAcceptsText,
  useAuiState,
  useScrollLock,
  useToolCallElapsed,
  type ToolApprovalAnswer,
  type ToolApprovalOption,
  type ToolApprovalQuestion,
  type ToolCallMessagePart,
  type ToolCallMessagePartProps,
  type ToolCallMessagePartStatus,
  type ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { fadeIn, riseIn, shimmer, spinFast } from "./surfaces";
import { Textarea } from "@/components/ui/textarea";

const paint = stylex.create({
  s0: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontVariantNumeric": "tabular-nums",
  },
  s1: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s2: {
    "color": "var(--muted-foreground)",
  },
  s3: {
    "animationDuration": "0.6s",
  },
  s4: {
    "display": "inline-block",
    "lineHeight": "1",
    "textAlign": "start",
  },
  s5: {
    "color": "var(--muted-foreground)",
    "textDecoration": "line-through",
  },
  s6: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s7: {
    "transform": "rotate(-90deg)",
    "transitionProperty": "transform",
    "transitionDuration": "150ms",
    "transitionTimingFunction": "linear",
  },
  s8: {
    ":is(.group\\/trigger:is([data-state=open], [data-open]) &)": {
      "transform": "rotate(0deg)",
    },
  },
  s9: {
    ":is(.group\\/trigger:is([data-state=panel-open], [data-panel-open]) &)": {
      "transform": "rotate(0deg)",
    },
  },
  s10: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "paddingInlineStart": "24px",
    "paddingTop": "4px",
    "paddingBottom": "8px",
    "transitionTimingFunction": "linear",
  },
  s11: {
    ":is(.group\\/collapsible-content:is([data-state=open], [data-open]) &)": {},
  },
  s12: {
    ":is(.group\\/collapsible-content:is([data-state=closed], [data-closed]) &)": {},
  },
  s13: {
    ":is(.group\\/collapsible-content:is([data-state=closed], [data-closed]) &)": {},
    ":is(.group\\/collapsible-content:is([data-state=open], [data-open]) &)": {},
  },
  s14: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    "borderRadius": "var(--radius-md)",
    "padding": "10px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "whiteSpace": "pre-wrap",
  },
  s15: {
    "color": "var(--muted-foreground)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
  },
  s16: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 50%, transparent)",
    "color": "color-mix(in oklab, var(--foreground) 90%, transparent)",
    "marginTop": "4px",
    "borderRadius": "var(--radius-md)",
    "padding": "10px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "whiteSpace": "pre-wrap",
  },
  s17: {
    "color": "var(--muted-foreground)",
    "fontWeight": 600,
  },
  s18: {
    "color": "var(--muted-foreground)",
    "whiteSpace": "pre-line",
  },
  s19: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "6px",
    "paddingTop": "4px",
  },
  s20: {
    "color": "var(--muted-foreground)",
    "whiteSpace": "pre-line",
  },
  s21: {
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
  },
  s22: {
    "color": "var(--muted-foreground)",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s23: {
    "fontWeight": 500,
  },
  s24: {
    "color": "var(--muted-foreground)",
  },
  s25: {
    "whiteSpace": "pre-line",
  },
  s26: {
    "color": "var(--muted-foreground)",
  },
  s27: {
    "color": "var(--muted-foreground)",
    "whiteSpace": "pre-line",
  },
  s28: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
  },
  s29: {
    "color": "var(--foreground)",
    "whiteSpace": "pre-line",
  },
  s30: {
    "color": "var(--muted-foreground)",
    "marginInlineEnd": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
    "textTransform": "uppercase",
  },
  s31: {
    "display": "flex",
    "gap": "8px",
  },
  s32: {
    "flexDirection": "column",
    "alignItems": "stretch",
  },
  s33: {
    "flexWrap": "wrap",
    "alignItems": "center",
  },
  s34: {
    "height": "auto",
    "flexDirection": "column",
    "alignItems": "flex-start",
    "gap": "2px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "whiteSpace": "normal",
    "textAlign": "start",
  },
  s35: {
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 400,
    "opacity": 0.8,
  },
  s36: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s37: {
    "color": "var(--foreground)",
    "whiteSpace": "pre-line",
  },
  s38: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "paddingTop": "4px",
  },
  s39: {
    "color": "var(--destructive)",
    "fontSize": "12px",
    "lineHeight": "16px",
    "whiteSpace": "pre-line",
  },
  s40: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "flex-start",
    "gap": "8px",
  },
  s41: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s42: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "12px",
    "paddingTop": "4px",
  },
  s43: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "paddingTop": "4px",
  },
  s44: {
    "fontWeight": 600,
  },
  s45: {
    "color": "var(--muted-foreground)",
    "whiteSpace": "pre-line",
  },
  s46: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "4px",
  },
  s47: {
    "backgroundColor": "var(--muted)",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "6px",
    "paddingRight": "6px",
    "paddingTop": "2px",
    "paddingBottom": "2px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s48: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s49: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "paddingTop": "4px",
  },
  s50: {
    "display": "flex",
    "flexWrap": "wrap",
    "alignItems": "center",
    "gap": "8px",
  },
  s51: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "paddingTop": "4px",
  },
  s52: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s53: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "8px",
    "paddingTop": "4px",
  },
  s54: {
    "display": "flex",
    "alignItems": "center",
    "gap": "8px",
  },
  s55: {
    "opacity": 0.6,
  },
  s56: {
    "transform": {
      "default": "scale(1)",
      ":active": "scale(0.98)",
    },
    "transitionProperty": "transform",
    "transitionDuration": {
      "default": "150ms",
      "@media (prefers-reduced-motion: reduce)": "0s",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

const ANIMATION_DURATION = 200;

export type ToolFallbackRootProps = Omit<
  React.ComponentProps<typeof Collapsible>,
  "open" | "onOpenChange"
> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
};

function ToolFallbackRoot({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  defaultOpen = false,
  children,
  ...props
}: ToolFallbackRootProps) {
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      lockScroll();
      if (!isControlled) {
        setUncontrolledOpen(open);
      }
      controlledOnOpenChange?.(open);
    },
    [lockScroll, isControlled, controlledOnOpenChange],
  );

  return (
    <Collapsible
      ref={collapsibleRef}
      data-slot="tool-fallback-root"
      marker="aui-tool-fallback-root group/tool-fallback-root"
      open={isOpen}
      onOpenChange={handleOpenChange}
      width="full"
      style={
        {
          "--animation-duration": `${ANIMATION_DURATION}ms`,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </Collapsible>
  );
}

type ToolStatus = ToolCallMessagePartStatus["type"];

const statusIconMap: Record<ToolStatus, React.ElementType> = {
  running: LoaderIcon,
  complete: CheckIcon,
  incomplete: XCircleIcon,
  "requires-action": AlertCircleIcon,
};

const formatToolDuration = (ms: number) => {
  if (ms < 1000) return "<1s";
  const seconds = ms / 1000;
  if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};

function ToolFallbackDuration({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const elapsedMs = useToolCallElapsed();
  if (elapsedMs === undefined) return null;

  return (
    <span
      data-slot="tool-fallback-duration"
      className={[[sx(paint.s0), "aui-tool-fallback-duration"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    >
      {formatToolDuration(elapsedMs)}
    </span>
  );
}

function ToolFallbackTrigger({
  toolName,
  status,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger> & {
  toolName: string;
  status?: ToolCallMessagePartStatus;
}) {
  const statusType = status?.type ?? "complete";
  const isRunning = statusType === "running";
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";

  const Icon = statusIconMap[statusType];
  const label =
    statusType === "running"
      ? "Running tool"
      : statusType === "requires-action"
        ? "Waiting on tool"
        : statusType === "incomplete"
          ? `${isCancelled ? "Cancelled" : "Failed"} tool`
          : "Used tool";

  return (
    <CollapsibleTrigger
      data-slot="tool-fallback-trigger"
      look="status"
      marker="aui-tool-fallback-trigger group/trigger"
      {...props}
    >
      <Icon
        data-slot="tool-fallback-trigger-icon"
        className={["aui-tool-fallback-trigger-icon", sx(paint.s1, isCancelled && paint.s2, isRunning && spinFast)].filter(Boolean).join(" ")}
      />
      <span
        data-slot="tool-fallback-trigger-label"
        className={["aui-tool-fallback-trigger-label-wrapper", sx(paint.s4, isCancelled && paint.s5, isRunning && shimmer)].filter(Boolean).join(" ")}
      >
        {label}: <b>{toolName}</b>
      </span>
      <ToolFallbackDuration />
      <ChevronDownIcon
        data-slot="tool-fallback-trigger-chevron"
        className={["aui-tool-fallback-trigger-chevron", sx(paint.s6, paint.s7, paint.s8, paint.s9)].filter(Boolean).join(" ")}
      />
    </CollapsibleTrigger>
  );
}

function ToolFallbackContent({
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="tool-fallback-content"
      marker="aui-tool-fallback-content group/collapsible-content"
      text="sm"
      {...props}
    >
      <div
        className={sx(paint.s10, fadeIn, riseIn, paint.s13)}
      >
        {children}
      </div>
    </CollapsibleContent>
  );
}

function ToolFallbackArgs({
  argsText,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  argsText?: string;
}) {
  if (!argsText) return null;

  return (
    <div
      data-slot="tool-fallback-args"
      className={["aui-tool-fallback-args", className].filter(Boolean).join(" ")}
      {...props}
    >
      <pre className={[sx(paint.s14), "aui-tool-fallback-args-value"].filter(Boolean).join(" ")}>
        {argsText}
      </pre>
    </div>
  );
}

const formatUnknownValue = (value: unknown, space?: number): string => {
  if (typeof value === "string") return value;

  try {
    if (value instanceof Error) return String(value);

    const json = JSON.stringify(value, null, space);
    if (json !== undefined) return json;
  } catch {}

  try {
    return String(value);
  } catch {
    return "[Unserializable value]";
  }
};

function ToolFallbackResult({
  result,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  result?: unknown;
}) {
  if (result === undefined) return null;

  return (
    <div
      data-slot="tool-fallback-result"
      className={["aui-tool-fallback-result", className].filter(Boolean).join(" ")}
      {...props}
    >
      <p className={[sx(paint.s15), "aui-tool-fallback-result-header"].filter(Boolean).join(" ")}>
        Result:
      </p>
      <pre className={[sx(paint.s16), "aui-tool-fallback-result-content"].filter(Boolean).join(" ")}>
        {formatUnknownValue(result, 2)}
      </pre>
    </div>
  );
}

function ToolFallbackError({
  status,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  status?: ToolCallMessagePartStatus;
}) {
  if (status?.type !== "incomplete") return null;

  const error = status.error;
  const errorText =
    error === undefined || error === null ? null : formatUnknownValue(error);

  if (!errorText) return null;

  const isCancelled = status.reason === "cancelled";
  const headerText = isCancelled ? "Cancelled reason:" : "Error:";

  return (
    <div
      data-slot="tool-fallback-error"
      className={["aui-tool-fallback-error", className].filter(Boolean).join(" ")}
      {...props}
    >
      <p className={[sx(paint.s17), "aui-tool-fallback-error-header"].filter(Boolean).join(" ")}>
        {headerText}
      </p>
      <p className={[sx(paint.s18), "aui-tool-fallback-error-reason"].filter(Boolean).join(" ")}>
        {errorText}
      </p>
    </div>
  );
}

const APPROVED_RESULT = "Approved by user";
const DENIED_RESULT = "User denied tool execution";

const APPROVAL_OPTION_DEFAULT_LABELS: Record<string, string> = {
  "allow-once": "Allow",
  "allow-always": "Always allow",
  "reject-once": "Deny",
  "reject-always": "Always deny",
};

const isKnownKind = (kind: string) =>
  Object.hasOwn(APPROVAL_OPTION_DEFAULT_LABELS, kind);

const isAllowKind = (kind: string) =>
  kind === "allow-once" || kind === "allow-always";

const approvalOptionLabel = (option: ToolApprovalOption) =>
  option.label ??
  (isKnownKind(option.kind)
    ? APPROVAL_OPTION_DEFAULT_LABELS[option.kind]
    : undefined) ??
  option.id;

/**
 * A request that declares how it wants to be presented is asking a question,
 * not gating an action, so a refusal is not one of the answers it accepts
 * unless the request declares itself dismissible.
 */
const isQuestion = (approval: ToolCallMessagePart["approval"]) =>
  approval?.display === "select" ||
  approval?.display === "text" ||
  approval?.display === "questions";

const questionAcceptsText = (question: ToolApprovalQuestion) =>
  !question.options?.length || question.allowFreeform === true;

const answerLabels = (
  question: ToolApprovalQuestion,
  answer: ToolApprovalAnswer | undefined,
) => [
  ...(answer?.optionIds ?? []).map(
    (id) => question.options?.find((option) => option.id === id)?.label ?? id,
  ),
  ...(answer?.text?.trim() ? [answer.text] : []),
];

const isSettled = (approval: ToolCallMessagePart["approval"]) =>
  approval != null &&
  (approval.approved !== undefined || approval.resolution !== undefined);

type ApprovalReceipt = {
  outcome: "allowed" | "refused" | "closed";
  label: string;
  option?: string | undefined;
};

/**
 * A settled request reads as a past-tense record of what happened to it, so
 * scrolling back never shows a live control for a decision already made.
 */
const approvalReceipt = (
  approval: NonNullable<ToolCallMessagePart["approval"]>,
): ApprovalReceipt => {
  if (approval.resolution !== undefined)
    return {
      outcome: "closed",
      label:
        approval.resolution === "cancelled"
          ? "Cancelled before a decision"
          : "Expired before a decision",
    };

  const chosen =
    approval.optionId === undefined
      ? undefined
      : approval.options?.find((option) => option.id === approval.optionId);
  const option =
    chosen !== undefined
      ? approvalOptionLabel(chosen)
      : approval.optionId === undefined
        ? undefined
        : approval.optionId;
  const answered =
    isQuestion(approval) || (chosen !== undefined && !isKnownKind(chosen.kind));
  const automatic = approval.isAutomatic ? " automatically" : "";

  if (approval.approved)
    return {
      outcome: "allowed",
      label: `${answered ? "Answered" : "Allowed"}${automatic}`,
      option,
    };
  return {
    outcome: "refused",
    label: `${answered ? "Dismissed" : "Denied"}${automatic}`,
    option,
  };
};

const receiptIcons = {
  allowed: CheckIcon,
  refused: XCircleIcon,
  closed: CircleMinusIcon,
} satisfies Record<ApprovalReceipt["outcome"], React.ElementType>;

function ToolFallbackApprovalReceipt({
  approval,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  approval: NonNullable<ToolCallMessagePart["approval"]>;
}) {
  const receipt = approvalReceipt(approval);
  const Icon = receiptIcons[receipt.outcome];
  const notes = [
    ...new Set(
      [approval.text, approval.reason].filter(
        (value): value is string => typeof value === "string" && value !== "",
      ),
    ),
  ];

  return (
    <div
      data-slot="tool-fallback-approval-receipt"
      data-outcome={receipt.outcome}
      className={[[sx(paint.s19), "aui-tool-fallback-approval-receipt"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    >
      {approval.prompt ? (
        <p className={[sx(paint.s20), "aui-tool-fallback-approval-prompt"].filter(Boolean).join(" ")}>
          {approval.prompt}
        </p>
      ) : null}
      <p className={[sx(paint.s21), "aui-tool-fallback-approval-receipt-label"].filter(Boolean).join(" ")}>
        <Icon aria-hidden className={sx(paint.s22)} />
        <span className={sx(paint.s23)}>{receipt.label}</span>
        {receipt.option !== undefined ? (
          <span className={sx(paint.s24)}>· {receipt.option}</span>
        ) : null}
      </p>
      {approval.answers &&
        approval.questions?.map((question) => {
          const labels = answerLabels(
            question,
            approval.answers && Object.hasOwn(approval.answers, question.id)
              ? approval.answers[question.id]
              : undefined,
          );
          if (labels.length === 0) return null;
          return (
            <p
              key={question.id}
              className={[sx(paint.s25), "aui-tool-fallback-approval-receipt-answer"].filter(Boolean).join(" ")}
            >
              <span className={sx(paint.s26)}>
                {question.header ?? question.prompt}
              </span>{" "}
              · {labels.join(", ")}
            </p>
          );
        })}
      {notes.map((text) => (
        <p
          key={text}
          className={[sx(paint.s27), "aui-tool-fallback-approval-receipt-note"].filter(Boolean).join(" ")}
        >
          {text}
        </p>
      ))}
    </div>
  );
}

function ToolFallbackApprovalQuestions({
  questions,
  dismissible,
  locked,
  onSend,
  onDismiss,
}: {
  questions: readonly ToolApprovalQuestion[];
  dismissible: boolean;
  locked: boolean;
  onSend: (answers: Record<string, ToolApprovalAnswer>) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState<
    ReadonlyMap<string, readonly string[]>
  >(() => new Map());
  const [typed, setTyped] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

  const toggle = (question: ToolApprovalQuestion, optionId: string) =>
    setSelected((current) => {
      const chosen = current.get(question.id) ?? [];
      const next = chosen.includes(optionId)
        ? chosen.filter((id) => id !== optionId)
        : question.multiple
          ? [...chosen, optionId]
          : [optionId];
      return new Map(current).set(question.id, next);
    });

  const answerOf = (question: ToolApprovalQuestion): ToolApprovalAnswer => {
    const optionIds = selected.get(question.id) ?? [];
    const draft = typed.get(question.id);
    const text = draft?.trim() ? draft : undefined;
    return {
      ...(optionIds.length > 0 && { optionIds }),
      ...(text !== undefined && { text }),
    };
  };

  const complete =
    questions.length > 0 &&
    questions.every((question) => {
      const answer = answerOf(question);
      return answer.optionIds !== undefined || answer.text !== undefined;
    });

  const send = () => {
    if (locked || !complete) return;
    onSend(
      Object.fromEntries(
        questions.map((question) => [question.id, answerOf(question)]),
      ),
    );
  };

  return (
    <>
      {questions.map((question) => {
        const chosen = selected.get(question.id) ?? [];
        const described =
          question.options?.some((option) => option.description) ?? false;
        return (
          <div
            key={question.id}
            role="group"
            aria-label={question.prompt}
            data-slot="tool-fallback-approval-question"
            className={[sx(paint.s28), "aui-tool-fallback-approval-question"].filter(Boolean).join(" ")}
          >
            <p className={[sx(paint.s29), "aui-tool-fallback-approval-question-prompt"].filter(Boolean).join(" ")}>
              {question.header ? (
                <span className={sx(paint.s30)}>
                  {question.header}
                </span>
              ) : null}
              {question.prompt}
            </p>
            {question.options && question.options.length > 0 ? (
              <div
                className={[sx(paint.s31), described ? sx(paint.s32) : sx(paint.s33)].filter(Boolean).join(" ")}
              >
                {question.options.map((option) => {
                  const pressed = chosen.includes(option.id);
                  return (
                    <span className={sx(paint.s56, described && paint.s34)}><Button
                      key={option.id}
                      size="sm"
                      variant={pressed ? "default" : "outline"}
                      
                      aria-pressed={pressed}
                      onClick={() => toggle(question, option.id)}
                      disabled={locked}>
                      <span>{option.label}</span>
                      {option.description ? (
                        <span className={sx(paint.s35)}>
                          {option.description}
                        </span>
                      ) : null}
                    </Button></span>
                  );
                })}
              </div>
            ) : null}
            {questionAcceptsText(question) ? (
              <Textarea
                value={typed.get(question.id) ?? ""}
                onChange={(event) =>
                  setTyped((current) =>
                    new Map(current).set(question.id, event.target.value),
                  )
                }
                disabled={locked}
                aria-label={question.prompt}
                placeholder={
                  question.options?.length
                    ? "Or type an answer"
                    : "Type your answer"
                }
              />
            ) : null}
          </div>
        );
      })}
      <div className={sx(paint.s36)}>
        <span className={sx(paint.s56)}><Button
          size="sm"
          
          onClick={send}
          disabled={locked || !complete}>
          Send
        </Button></span>
        {dismissible ? (
          <span className={sx(paint.s56)}><Button
            size="sm"
            variant="outline"
            
            onClick={onDismiss}
            disabled={locked}>
            Dismiss
          </Button></span>
        ) : null}
      </div>
    </>
  );
}

const offersInterruptAction = (
  status: ToolCallMessagePartStatus | undefined,
  approval: ToolCallMessagePart["approval"],
  interrupt: ToolCallMessagePart["interrupt"],
) =>
  status?.type !== "requires-action" ||
  status.reason !== "interrupt" ||
  approval != null ||
  interrupt != null;

function ToolFallbackApproval(
  props: React.ComponentProps<typeof ToolFallbackApprovalImpl>,
) {
  return <ToolFallbackApprovalImpl key={props.approval?.id} {...props} />;
}

function ToolFallbackApprovalImpl({
  className,
  addResult,
  resume,
  interrupt,
  approval,
  respondToApproval,
  status,
  ...props
}: React.ComponentProps<"div"> &
  Partial<
    Pick<
      ToolCallMessagePartProps,
      "addResult" | "resume" | "respondToApproval" | "status"
    >
  > & {
    interrupt?: ToolCallMessagePart["interrupt"];
    approval?: ToolCallMessagePart["approval"];
  }) {
  const [submitted, setSubmitted] = useState(false);
  const voiceActive = useAuiState((s) => s.thread.voice !== undefined);
  const canAnswer = useAuiState((s) => s.thread.capabilities.answerToolCall);
  const locked = submitted || voiceActive;
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (approval != null && isSettled(approval))
    return (
      <ToolFallbackApprovalReceipt
        approval={approval}
        className={className}
        {...props}
      />
    );

  if (!offersInterruptAction(status, approval, interrupt)) return null;

  const promptText = approval?.prompt ? (
    <p className={[sx(paint.s37), "aui-tool-fallback-approval-prompt"].filter(Boolean).join(" ")}>
      {approval.prompt}
    </p>
  ) : null;

  if (!canAnswer)
    return (
      promptText && (
        <div
          data-slot="tool-fallback-approval"
          className={[[sx(paint.s38), "aui-tool-fallback-approval"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
          {...props}
        >
          {promptText}
        </div>
      )
    );

  // A declared option list is a host constraint: the kit never adds an
  // approval path beyond it, and preserves a refusal path only where the
  // request is an action the user may refuse.
  const declaredOptions = respondToApproval ? approval?.options : undefined;
  const acceptsText =
    approval != null &&
    respondToApproval != null &&
    toolApprovalAcceptsText(approval);

  // A refused response leaves the request open, so the controls come back
  // rather than staying spent on a decision the runtime never recorded.
  const submit = (send: () => Promise<void> | void) => {
    setSubmitted(true);
    setError(null);
    void (async () => {
      try {
        await send();
      } catch (sendError) {
        setSubmitted(false);
        setError(
          sendError instanceof Error ? sendError.message : String(sendError),
        );
      }
    })();
  };

  const respond = (approved: boolean) => {
    if (locked) return;
    if (
      approval != null &&
      approval.approved === undefined &&
      respondToApproval
    ) {
      submit(() => respondToApproval({ approved, ...typedNote() }));
    } else if (interrupt) {
      submit(() => resume?.({ approved }));
    } else if (
      status?.type === "requires-action" &&
      status.reason === "interrupt"
    ) {
      return;
    } else {
      submit(() => addResult?.(approved ? APPROVED_RESULT : DENIED_RESULT));
    }
  };

  const respondWithOption = (option: ToolApprovalOption) => {
    if (locked) return;
    setConfirmingId(null);
    // A custom kind has no decision class for the runtime to derive, and
    // responding without one throws; picking a declared option is an answer,
    // so it resolves as approved.
    submit(() =>
      respondToApproval?.(
        isKnownKind(option.kind)
          ? { optionId: option.id, ...typedNote() }
          : { optionId: option.id, approved: true, ...typedNote() },
      ),
    );
  };

  const typedNote = () => (answer.trim() ? { text: answer } : {});

  // The kit does not validate an answer the request never constrained: a host
  // that cannot record an empty one rejects it, which reopens the controls.
  const submitAnswer = () => {
    if (locked) return;
    submit(() => respondToApproval?.({ text: answer }));
  };

  // A dismissal is no answer at all, so a typed draft does not travel with it.
  const dismiss = () => {
    if (locked) return;
    submit(() => respondToApproval?.({ approved: false }));
  };

  const handleOption = (option: ToolApprovalOption) => {
    if (option.confirm) {
      setConfirmingId(option.id);
    } else {
      respondWithOption(option);
    }
  };

  const confirming =
    confirmingId != null
      ? declaredOptions?.find((o) => o.id === confirmingId)
      : undefined;

  const question = isQuestion(approval);
  const dismissible =
    question && respondToApproval != null && approval?.dismissible === true;

  const dismissButton = dismissible ? (
    <span className={sx(paint.s56)}><Button
      size="sm"
      variant="outline"
      
      onClick={dismiss}
      disabled={locked}>
      Dismiss
    </Button></span>
  ) : null;

  const errorText = error ? (
    <p
      role="alert"
      className={[sx(paint.s39), "aui-tool-fallback-approval-error"].filter(Boolean).join(" ")}
    >
      {error}
    </p>
  ) : null;

  const answerField = acceptsText ? (
    <div className={[sx(paint.s40), "aui-tool-fallback-approval-answer"].filter(Boolean).join(" ")}>
      <Textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={locked}
        aria-label={question ? (approval?.prompt ?? "Answer") : "Note"}
        placeholder={
          question ? "Type your answer" : "Add a note to your decision"
        }
      />
      {question && (
        <div className={sx(paint.s41)}>
          <span className={sx(paint.s56)}><Button
            size="sm"
            
            onClick={submitAnswer}
            disabled={locked}>
            Send
          </Button></span>
          {dismissButton}
        </div>
      )}
    </div>
  ) : null;

  if (approval?.display === "questions" && respondToApproval) {
    return (
      <div
        data-slot="tool-fallback-approval"
        className={[[sx(paint.s42), "aui-tool-fallback-approval"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
        {...props}
      >
        {promptText}
        <ToolFallbackApprovalQuestions
          questions={approval.questions ?? []}
          dismissible={approval.dismissible === true}
          locked={locked}
          onSend={(answers) => submit(() => respondToApproval({ answers }))}
          onDismiss={dismiss}
        />
        {errorText}
      </div>
    );
  }

  if (confirming) {
    const confirmMeta =
      typeof confirming.confirm === "object" ? confirming.confirm : undefined;
    const confirmDescription =
      confirmMeta?.description ?? confirming.description;
    return (
      <div
        data-slot="tool-fallback-approval-confirm"
        className={[[sx(paint.s43), "aui-tool-fallback-approval-confirm"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
        {...props}
      >
        <p className={[sx(paint.s44), "aui-tool-fallback-approval-confirm-title"].filter(Boolean).join(" ")}>
          {confirmMeta?.title ?? `${approvalOptionLabel(confirming)}?`}
        </p>
        {confirmDescription && (
          <p className={[sx(paint.s45), "aui-tool-fallback-approval-confirm-description"].filter(Boolean).join(" ")}>
            {confirmDescription}
          </p>
        )}
        {confirming.grants && confirming.grants.length > 0 && (
          <ul className={[sx(paint.s46), "aui-tool-fallback-approval-confirm-grants"].filter(Boolean).join(" ")}>
            {confirming.grants.map((grant) => (
              <li key={grant}>
                <code className={[sx(paint.s47), "aui-tool-fallback-approval-confirm-grant"].filter(Boolean).join(" ")}>
                  {grant}
                </code>
              </li>
            ))}
          </ul>
        )}
        <div className={sx(paint.s48)}>
          <span className={sx(paint.s56)}><Button
            size="sm"
            
            onClick={() => respondWithOption(confirming)}
            disabled={locked}>
            Confirm
          </Button></span>
          <span className={sx(paint.s56)}><Button
            size="sm"
            variant="outline"
            
            onClick={() => setConfirmingId(null)}
            disabled={locked}>
            Back
          </Button></span>
        </div>
      </div>
    );
  }

  if (declaredOptions && declaredOptions.length > 0) {
    const allowOptions = declaredOptions.filter((o) => isAllowKind(o.kind));
    const customOptions = declaredOptions.filter((o) => !isKnownKind(o.kind));
    const rejectOptions = declaredOptions.filter(
      (o) => isKnownKind(o.kind) && !isAllowKind(o.kind),
    );
    return (
      <div
        data-slot="tool-fallback-approval"
        className={[[sx(paint.s49), "aui-tool-fallback-approval"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
        {...props}
      >
        {promptText}
        <div className={sx(paint.s50)}>
          {[...allowOptions, ...customOptions, ...rejectOptions].map(
            (option) => (
              <span className={sx(paint.s56)}><Button
                key={option.id}
                size="sm"
                variant={option === allowOptions[0] ? "default" : "outline"}
                
                onClick={() => handleOption(option)}
                disabled={locked}>
                {approvalOptionLabel(option)}
              </Button></span>
            ),
          )}
          {rejectOptions.length === 0 && !question && (
            <span className={sx(paint.s56)}><Button
              size="sm"
              variant="outline"
              
              onClick={() => respond(false)}
              disabled={locked}>
              Deny
            </Button></span>
          )}
          {!acceptsText && dismissButton}
        </div>
        {answerField}
        {errorText}
      </div>
    );
  }

  // A question carries no decision to fabricate, so it renders only what the
  // request declared, even when that leaves nothing to act on here.
  if (question) {
    return (
      <div
        data-slot="tool-fallback-approval"
        className={[[sx(paint.s51), "aui-tool-fallback-approval"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
        {...props}
      >
        {promptText}
        {answerField}
        {!acceptsText && dismissButton && (
          <div className={sx(paint.s52)}>{dismissButton}</div>
        )}
        {errorText}
      </div>
    );
  }

  return (
    <div
      data-slot="tool-fallback-approval"
      className={[[sx(paint.s53), "aui-tool-fallback-approval"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...props}
    >
      {promptText}
      <div className={sx(paint.s54)}>
        <span className={sx(paint.s56)}><Button
          size="sm"
          
          onClick={() => respond(true)}
          disabled={locked}>
          Allow
        </Button></span>
        <span className={sx(paint.s56)}><Button
          size="sm"
          variant="outline"
          
          onClick={() => respond(false)}
          disabled={locked}>
          Deny
        </Button></span>
      </div>
      {answerField}
      {errorText}
    </div>
  );
}

const ToolFallbackImpl: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
  addResult,
  resume,
  interrupt,
  approval,
  respondToApproval,
}) => {
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const isRequiresAction = status?.type === "requires-action";
  const shouldRenderApproval =
    isRequiresAction && offersInterruptAction(status, approval, interrupt);

  const [open, setOpen] = useState(isRequiresAction);
  const [prevRequiresAction, setPrevRequiresAction] =
    useState(isRequiresAction);
  if (isRequiresAction !== prevRequiresAction) {
    setPrevRequiresAction(isRequiresAction);
    if (isRequiresAction) setOpen(true);
  }

  return (
    <ToolFallbackRoot open={open} onOpenChange={setOpen}>
      <ToolFallbackTrigger toolName={toolName} status={status} />
      <ToolFallbackContent>
        <ToolFallbackError status={status} />
        <ToolFallbackArgs
          argsText={argsText}
          className={isCancelled ? sx(paint.s55) : undefined}
        />
        {(shouldRenderApproval || isSettled(approval)) && (
          <ToolFallbackApproval
            addResult={addResult}
            resume={resume}
            interrupt={interrupt}
            approval={approval}
            respondToApproval={respondToApproval}
            status={status}
          />
        )}
        <ToolFallbackResult result={result} />
      </ToolFallbackContent>
    </ToolFallbackRoot>
  );
};

const ToolFallback = memo(
  ToolFallbackImpl,
) as unknown as ToolCallMessagePartComponent & {
  Root: typeof ToolFallbackRoot;
  Trigger: typeof ToolFallbackTrigger;
  Content: typeof ToolFallbackContent;
  Args: typeof ToolFallbackArgs;
  Result: typeof ToolFallbackResult;
  Error: typeof ToolFallbackError;
  Approval: typeof ToolFallbackApproval;
};

ToolFallback.displayName = "ToolFallback";
ToolFallback.Root = ToolFallbackRoot;
ToolFallback.Trigger = ToolFallbackTrigger;
ToolFallback.Content = ToolFallbackContent;
ToolFallback.Args = ToolFallbackArgs;
ToolFallback.Result = ToolFallbackResult;
ToolFallback.Error = ToolFallbackError;
ToolFallback.Approval = ToolFallbackApproval;

export {
  formatUnknownValue,
  offersInterruptAction,
  ToolFallback,
  ToolFallbackRoot,
  ToolFallbackTrigger,
  ToolFallbackContent,
  ToolFallbackArgs,
  ToolFallbackResult,
  ToolFallbackError,
  ToolFallbackApproval,
};
