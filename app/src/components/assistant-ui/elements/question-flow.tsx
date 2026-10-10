"use client";

import * as stylex from "@stylexjs/stylex";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { OptionList, type OptionListOption } from "./option-list";
import { ghostButton, mono, paper } from "./surfaces";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "borderRadius": "var(--radius-2xl)",
    "padding": "8px",
    "maxWidth": "384px",
  },
  s1: {
    "gap": "12px",
  },
  s2: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s3: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s4: {
    "color": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "fontSize": "13.5px",
    "lineHeight": "20px",
    "overflowWrap": "break-word",
  },
  s5: {
    "gap": "20px",
  },
  s6: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "12px",
  },
  s7: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
  },
  s8: {
    "fontSize": "13.5px",
    "lineHeight": "20px",
    "fontWeight": 500,
  },
  s9: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s10: {
    "maxWidth": "none",
    "borderWidth": 0,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "transparent",
    },
    "padding": "0px",
  },
  s11: {
    "gap": "12px",
  },
  s12: {
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
    "gap": "12px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "paddingTop": "4px",
  },
  s13: {
    "color": "color-mix(in oklab, var(--foreground) 35%, transparent)",
    "fontVariantNumeric": "tabular-nums",
  },
  s14: {
    "height": "28px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
  },
  s15: {
    "cursor": "default",
    "opacity": 0.4,
  },
  s16: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 8%, transparent)",
    "marginLeft": "8px",
    "marginRight": "8px",
    "height": "3px",
    "overflow": "hidden",
    "borderRadius": "999px",
  },
  s17: {
    "backgroundColor": "color-mix(in oklab, var(--foreground) 80%, transparent)",
    "height": "100%",
    "transitionProperty": "width",
    "transitionDuration": "200ms",
  },
  s18: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
  },
  s19: {
    "fontSize": "13.5px",
    "lineHeight": "20px",
    "fontWeight": 500,
  },
  s20: {
    "color": "color-mix(in oklab, var(--foreground) 45%, transparent)",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s21: {
    "maxWidth": "none",
    "borderWidth": 0,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "transparent",
    },
    "padding": "0px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export interface QuestionFlowStep {
  id: string;
  question: string;
  description?: string | undefined;
  options: readonly OptionListOption[];
  selectionMode?: "single" | "multiple" | undefined;
  minSelections?: number | undefined;
  maxSelections?: number | undefined;
}

export interface QuestionFlowProps extends Omit<
  ComponentProps<"div">,
  "children" | "defaultValue" | "onSubmit"
> {
  steps: readonly QuestionFlowStep[];
  defaultValue?: Readonly<Record<string, readonly string[]>> | undefined;
  onComplete?:
    | ((answers: Record<string, string[]>) => void | Promise<void>)
    | undefined;
  completeLabel?: string | undefined;
  choice?: Readonly<Record<string, readonly string[]>> | undefined;
}

export function QuestionFlow({
  steps,
  defaultValue,
  onComplete,
  completeLabel = "Submit",
  choice,
  className,
  ...props
}: QuestionFlowProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    for (const [id, value] of Object.entries(defaultValue ?? {})) {
      initial[id] = [...value];
    }
    return initial;
  });
  const [confirmedAnswers, setConfirmedAnswers] = useState<
    Record<string, string[]> | undefined
  >();
  const [isCompleting, setIsCompleting] = useState(false);
  const questionPrefix = useId();
  const optionListRef = useRef<HTMLDivElement>(null);
  const currentIndex = Math.min(stepIndex, Math.max(0, steps.length - 1));
  const currentStep = steps[currentIndex];
  const previousStepId = useRef(currentStep?.id);

  useLayoutEffect(() => {
    if (previousStepId.current === currentStep?.id) return;
    previousStepId.current = currentStep?.id;
    optionListRef.current
      ?.querySelector<HTMLButtonElement>(
        'button:not([disabled]):not([aria-disabled="true"])',
      )
      ?.focus();
  }, [currentStep?.id]);

  const root = [sx(paper, paint.s0), className].filter(Boolean).join(" ");

  const completedChoice = choice ?? confirmedAnswers;

  if (completedChoice !== undefined) {
    return (
      <div
        {...props}
        data-slot="question-flow"
        data-state="receipt"
        className={[root, sx(paint.s1)].filter(Boolean).join(" ")}
      >
        {steps.flatMap((step) => {
          const selected = completedChoice[step.id];
          if (!selected?.length) return [];
          const labels = step.options
            .filter((option) => selected.includes(option.id))
            .map((option) => option.label)
            .join(", ");
          return (
            <div key={step.id} className={sx(paint.s2)}>
              <span className={sx(paint.s3)}>
                {step.question}
              </span>
              <span className={sx(paint.s4)}>
                {labels}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (!onComplete) {
    return (
      <div
        {...props}
        data-slot="question-flow"
        data-state="open"
        className={[root, sx(paint.s5)].filter(Boolean).join(" ")}
      >
        {steps.map((step) => {
          const questionId = `${questionPrefix}-${step.id}`;
          return (
            <div key={step.id} className={sx(paint.s6)}>
              <div className={sx(paint.s7)}>
                <p
                  id={questionId}
                  className={sx(paint.s8)}
                >
                  {step.question}
                </p>
                {step.description ? (
                  <p className={sx(paint.s9)}>
                    {step.description}
                  </p>
                ) : null}
              </div>
              <OptionList
                aria-labelledby={questionId}
                options={step.options}
                bare
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div
        {...props}
        data-slot="question-flow"
        data-state="open"
        className={root}
      />
    );
  }

  const questionId = `${questionPrefix}-${currentStep.id}`;
  const currentAnswer = answers[currentStep.id];
  const finalStep = currentIndex === steps.length - 1;

  const confirm = (ids: string[]) => {
    const nextAnswers = { ...answers, [currentStep.id]: ids };
    if (!finalStep) {
      setAnswers(nextAnswers);
      setStepIndex(currentIndex + 1);
      return;
    }
    const stepIds = new Set(steps.map((step) => step.id));
    const completedAnswers = Object.fromEntries(
      Object.entries(nextAnswers).filter(([id]) => stepIds.has(id)),
    );
    setIsCompleting(true);
    try {
      return Promise.resolve(onComplete(completedAnswers)).then(
        () => {
          setAnswers(nextAnswers);
          setConfirmedAnswers(completedAnswers);
        },
        (error) => {
          setIsCompleting(false);
          throw error;
        },
      );
    } catch (error) {
      setIsCompleting(false);
      return Promise.reject(error);
    }
  };

  return (
    <div
      {...props}
      data-slot="question-flow"
      data-state="open"
      className={[root, sx(paint.s11)].filter(Boolean).join(" ")}
    >
      <div className={sx(paint.s12)}>
        <span className={sx(mono, paint.s13)}>
          {currentIndex + 1} of {steps.length}
        </span>
        {currentIndex > 0 ? (
          <button
            type="button"
            disabled={isCompleting}
            onClick={() => setStepIndex(currentIndex - 1)}
            className={sx(ghostButton, paint.s14, isCompleting && paint.s15)}
          >
            Back
          </button>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuetext={`Question ${currentIndex + 1} of ${steps.length}`}
        className={sx(paint.s16)}
      >
        <div
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
          className={sx(paint.s17)}
        />
      </div>
      <div className={sx(paint.s18)}>
        <p id={questionId} className={sx(paint.s19)}>
          {currentStep.question}
        </p>
        {currentStep.description ? (
          <p className={sx(paint.s20)}>
            {currentStep.description}
          </p>
        ) : null}
      </div>
      <div ref={optionListRef}>
        <OptionList
          key={currentStep.id}
          aria-labelledby={questionId}
          options={currentStep.options}
          selectionMode={currentStep.selectionMode}
          defaultValue={currentAnswer}
          minSelections={currentStep.minSelections}
          maxSelections={currentStep.maxSelections}
          onConfirm={confirm}
          confirmLabel={finalStep ? completeLabel : "Next"}
          bare
        />
      </div>
    </div>
  );
}
