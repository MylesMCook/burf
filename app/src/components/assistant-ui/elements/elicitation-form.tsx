"use client";

// Adapted from https://r.assistant-ui.com/elements-elicitation-form.json.
// Stock props are retained; Burf adds pending feedback and cancellation receipts.

import { useId, type ComponentProps } from "react";
import { CheckIcon, PlugIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import * as stylex from "@stylexjs/stylex";
import { color, font, radius } from "@/styles/tokens.stylex";
import { field, paper, mark, withClass } from "./surfaces";
import { useReceiptFocus } from "./receipt-focus";

const styles = stylex.create({
  root: {
    display: "flex",
    width: "100%",
    maxWidth: 384,
    minWidth: 0,
    flexDirection: "column",
    gap: 14,
    borderRadius: radius.sm,
    padding: 16,
    fontFamily: font.sans
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10
  },
  iconWrap: {
    color: color.mutedForeground,
    display: "flex",
    width: 28,
    height: 28,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center"
  },
  icon: {
    width: 14,
    height: 14
  },
  server: {
    minWidth: 0,
    flex: 1,
    fontSize: 14,
    fontWeight: 500,
    overflowWrap: "anywhere"
  },
  muted: {
    color: color.mutedForeground,
    fontSize: 12
  },
  status: {
    color: color.mutedForeground,
    flexShrink: 0,
    fontSize: 12
  },
  message: {
    color: color.mutedForeground,
    fontSize: 12,
    lineHeight: 1.6,
    overflowWrap: "anywhere"
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4
  },
  choices: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6
  },
  choice: {
    borderRadius: radius.md,
    padding: "4px 10px",
    fontSize: 12
  },
  selected: {
    backgroundColor: color.foreground,
    color: color.background
  },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: 8
  },
  value: {
    color: color.foreground,
    borderRadius: radius.md,
    padding: "6px 10px",
    fontSize: 12,
    overflowWrap: "anywhere"
  },
  actions: {
    display: "flex",
    minHeight: 32,
    alignItems: "center",
    justifyContent: "end",
    gap: 8
  },
  receipt: {
    color: color.mutedForeground,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12
  },
  success: {
    width: 14,
    height: 14,
    color: color.mutedForeground
  }
});
const sx = (...parts: readonly (false | null | undefined | object)[]) => mark(undefined, ...parts).className;

export type ElicitationState = "request" | "accepted" | "declined" | "cancelled";

export interface ElicitationField {
  name: string;
  label: string;
  value: string;
  kind: "text" | "choice" | "toggle";
  options?: readonly string[];
  required?: boolean;
}

function Toggle({ value }: { value: string }) {
  return <span className={sx(styles.muted)}>{value === "true" ? "On" : "Off"}</span>;
}

export function ElicitationForm({
  server,
  message,
  fields,
  state,
  pendingAction,
  onFieldChange,
  onAccept,
  onDecline,
  className,
  ...props
}: Omit<
  ComponentProps<"div">,
  | "children"
  | "server"
  | "message"
  | "fields"
  | "state"
  | "onFieldChange"
  | "onAccept"
  | "onDecline"
> & {
  server: string;
  message: string;
  fields: readonly ElicitationField[];
  state: ElicitationState;
  pendingAction?: "accept" | "decline";
  onFieldChange?: ((name: string, value: string) => void) | undefined;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const fieldPrefix = useId();
  const { receiptRef, focusHandlers } = useReceiptFocus(props);
  const interactive = state === "request" && onFieldChange !== undefined;
  const status = state === "request"
    ? pendingAction === "accept" ? "Sending answer" : pendingAction === "decline" ? "Declining" : "Needs input"
    : state === "accepted" ? "Answered" : state === "declined" ? "Declined" : "Cancelled";
  const missingRequired =
    interactive &&
    fields.some(
      (item) =>
        item.kind !== "toggle" &&
        item.required === true &&
        item.value.trim() === "",
    );

  return (
    <div
      data-slot="elicitation-form"
      className={withClass(undefined, className, paper, styles.root).className}

      {...props}
      {...focusHandlers}
    >
      <div className={sx(styles.header)}>
        <span className={sx(styles.iconWrap)}>
          <PlugIcon className={sx(styles.icon)} />
        </span>
        <span className={sx(styles.server)}>
          {server}
        </span>
        <span role="status" className={sx(styles.status)}>
          {status}
        </span>
      </div>

      <p className={sx(styles.message)}>{message}</p>

      <div className={sx(styles.fields)} aria-busy={!!pendingAction}>
        {fields.map((item, index) => {
          const labelId = `${fieldPrefix}-${index}`;
          const inputId = `${labelId}-input`;
          return (
            <div key={item.name} className={sx(styles.field)}>
              {item.kind === "text" && interactive ? (
                <label
                  id={labelId}
                  htmlFor={inputId}
                  className={sx(styles.muted)}
                >
                  {item.label}
                  {item.required && (
                    <span aria-hidden className={sx(styles.muted)}> *</span>
                  )}
                </label>
              ) : (
                <span
                  id={labelId}
                  className={sx(styles.muted)}
                >
                  {item.label}
                  {item.required && (
                    <span aria-hidden className={sx(styles.muted)}> *</span>
                  )}
                </span>
              )}
              {item.kind === "choice" ? (
                <div
                  role={interactive ? "group" : undefined}
                  aria-labelledby={interactive ? labelId : undefined}
                  className={sx(styles.choices)}
                >
                  {item.options?.map((option) =>
                    interactive ? (
                      <Button
                        size="xs"
                        variant={option === item.value ? "default" : "secondary"}
                        key={option}
                        type="button"
                        aria-pressed={option === item.value}
                        disabled={!!pendingAction}
                        onClick={() => onFieldChange(item.name, option)}
                      >
                        {option}
                      </Button>
                    ) : (
                      <span
                        key={option}
                        className={sx(
                          styles.choice,
                          option === item.value
                            ? styles.selected
                            : styles.muted,
                          option !== item.value && field,
                        )}
                      >
                        {option}
                      </span>
                    ),
                  )}
                </div>
              ) : item.kind === "toggle" ? (
                interactive ? (
                  <div className={sx(styles.toggle)}>
                    <Switch
                      aria-labelledby={labelId}
                      checked={item.value === "true"}
                      disabled={!!pendingAction}
                      onCheckedChange={(checked) => onFieldChange(item.name, String(checked))}
                    />
                    <Toggle value={item.value} />
                  </div>
                ) : (
                  <span className={sx(styles.toggle)}>
                    <Toggle value={item.value} />
                  </span>
                )
              ) : interactive ? (
                <Input
                  size="sm"
                  text="xs"
                  id={inputId}
                  value={item.value}
                  aria-required={item.required || undefined}
                  disabled={!!pendingAction}
                  onChange={(event) =>
                    onFieldChange(item.name, event.currentTarget.value)
                  }
                />
              ) : (
                <span
                  className={sx(
                    field,
                    styles.value,
                  )}
                >
                  {item.value}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className={sx(styles.actions)}>
        {state === "request" ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={onDecline}
              disabled={!!pendingAction}
            >
              Decline
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={onAccept}
              disabled={missingRequired || !!pendingAction}
            >
              Send
            </Button>
          </>
        ) : (
          <span
            key={state}
            ref={receiptRef}
            tabIndex={-1}
            className={sx(styles.receipt)}
          >
            {state === "accepted" ? (
              <>
                <CheckIcon className={sx(styles.success)} />
                Sent to {server}
              </>
            ) : (
              <>
                <XIcon className={sx(styles.icon)} />
                {state === "cancelled" ? "Cancelled" : "Declined"}
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
