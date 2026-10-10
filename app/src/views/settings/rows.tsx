import { Children, cloneElement, createContext, Fragment, isValidElement, type ReactElement, type ReactNode, useContext, useId } from "react";
import * as stylex from "@stylexjs/stylex";

import { platformKeys } from "@/lib/platform";
import { color, font, radius } from "@/styles/tokens.stylex";
import { ViewHeader } from "@/views/view-header";

const narrow = "@media (max-width: 1200px)";

const styles = stylex.create({
  page: {
    marginLeft: "auto",
    marginRight: "auto",
    width: "100%",
    maxWidth: "42rem",
    paddingTop: 24,
    paddingBottom: 64,
    paddingLeft: { default: 32, [narrow]: 24 },
    paddingRight: { default: 32, [narrow]: 24 },
  },
  crumb: { display: "flex", alignItems: "baseline", gap: 6 },
  crumbMuted: { color: color.mutedForeground },
  slash: { color: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)" },
  badge: { alignSelf: "center" },
  lead: { marginBottom: 24, color: color.mutedForeground, fontSize: 14 },
  stack: { ":not(#\\#) > * + *": { marginTop: 32 } },
  head: { display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 8 },
  headText: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  heading: { fontWeight: 500, fontSize: 13, color: color.mutedForeground },
  hint: { marginTop: 2, color: color.mutedForeground, fontSize: 12 },
  group: {
    overflow: "hidden",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: "color-mix(in oklab, var(--card) 40%, transparent)",
    ":not(#\\#) > * + *": {
      borderTopWidth: 1,
      borderTopStyle: "solid",
      borderTopColor: "color-mix(in oklab, var(--border) 70%, transparent)",
    },
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    minHeight: 48,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
  },
  snug: { paddingTop: 8, paddingBottom: 8 },
  short: { minHeight: 40 },
  dim: { opacity: 0.6 },
  labelCol: { minWidth: 0, flexGrow: 1, flexShrink: 1, flexBasis: "0%" },
  label: { fontSize: 14 },
  description: { marginTop: 2, color: color.mutedForeground, fontSize: 12, lineHeight: 1.625 },
  controls: { display: "flex", flexShrink: 0, alignItems: "center", gap: 8 },
  code: {
    borderRadius: radius.sm,
    backgroundColor: color.muted,
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 4,
    paddingRight: 4,
    fontFamily: font.mono,
    fontSize: 11,
    color: color.foreground,
  },
  value: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    backgroundColor: "color-mix(in oklab, var(--muted) 40%, transparent)",
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 8,
    paddingRight: 8,
    fontFamily: font.mono,
    fontSize: 12,
    color: color.mutedForeground,
    fontVariantNumeric: "tabular-nums",
  },
});

// The pieces every settings section is made of: a titled page, groups of
// rows, and rows of label, description and control.

// badge sits beside the title (the Linux app's Alpha, in About).
export function SettingsPage({ title, badge, description, actions, children }: { title: string; badge?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div {...stylex.props(styles.page)}>
      {/* The section names itself in the view's strip, after "Settings". */}
      <ViewHeader
        title={
          <span {...stylex.props(styles.crumb)}>
            <span {...stylex.props(styles.crumbMuted)}>Settings</span>
            <span {...stylex.props(styles.slash)}>/</span>
            {title}
            {badge && <span {...stylex.props(styles.badge)}>{badge}</span>}
          </span>
        }
        actions={actions}
      />
      {/* Section descriptions run long, so they stay with the page. */}
      {description && <p {...stylex.props(styles.lead)}>{description}</p>}
      <div {...stylex.props(styles.stack)}>{children}</div>
    </div>
  );
}

export function SettingsGroup({ title, description, actions, children }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {(title || actions) && (
        <div {...stylex.props(styles.head)}>
          <div {...stylex.props(styles.headText)}>
            {title && <h2 {...stylex.props(styles.heading)}>{title}</h2>}
            {description && <p {...stylex.props(styles.hint)}>{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div {...stylex.props(styles.group)}>{children}</div>
    </section>
  );
}

// A row's label and description name its control: a switch reads "Play a
// sound, on", not just "switch". SettingsRow passes the ids to each control
// it holds; a control that can't take them as props (a stepper's input, say)
// reads them with useSettingsRow.
const RowContext = createContext<{ labelledBy: string; describedBy?: string } | null>(null);
export const useSettingsRow = () => useContext(RowContext);

type AriaProps = { "aria-label"?: string; "aria-labelledby"?: string; "aria-describedby"?: string; children?: ReactNode };

// hasText is whether a control names itself, as a button with words does.
function hasText(children: ReactNode): boolean {
  return Children.toArray(children).some((c) => typeof c === "string" || typeof c === "number");
}

function nameControl(child: ReactNode, labelledBy: string, describedBy?: string): ReactNode {
  // Plain elements and fragments are layout, not controls: the controls
  // inside them read the ids from context.
  if (!isValidElement<AriaProps>(child) || typeof child.type === "string" || child.type === Fragment) return child;
  const props = child.props;
  const next: AriaProps = {};
  if (!props["aria-label"] && !props["aria-labelledby"] && !hasText(props.children)) next["aria-labelledby"] = labelledBy;
  if (describedBy && !props["aria-describedby"]) next["aria-describedby"] = describedBy;
  return Object.keys(next).length ? cloneElement(child as ReactElement<AriaProps>, next) : child;
}

export function SettingsRow({
  label,
  description,
  children,
  dim = false,
  pad,
  min,
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Quiet the row while its control does not apply. */
  dim?: boolean;
  /** 8px vertical padding. Notifications. */
  pad?: "snug";
  /** 40px row. Shortcut list. */
  min?: "short";
}) {
  const id = useId();
  const labelledBy = `${id}-label`;
  const describedBy = description ? `${id}-description` : undefined;
  return (
    <div {...stylex.props(styles.row, pad === "snug" && styles.snug, min === "short" && styles.short, dim && styles.dim)}>
      <div {...stylex.props(styles.labelCol)}>
        <div id={labelledBy} {...stylex.props(styles.label)}>
          {label}
        </div>
        {description && (
          <div id={describedBy} {...stylex.props(styles.description)}>
            {typeof description === "string" ? platformKeys(description) : description}
          </div>
        )}
      </div>
      {children && (
        <div {...stylex.props(styles.controls)}>
          <RowContext.Provider value={{ labelledBy, describedBy }}>{Children.map(children, (c) => nameControl(c, labelledBy, describedBy))}</RowContext.Provider>
        </div>
      )}
    </div>
  );
}

// Code is a path or a command inside a description.
export function Code({ children }: { children: ReactNode }) {
  return <code {...stylex.props(styles.code)}>{children}</code>;
}

// Value shows a setting that is read, not edited here, as a quiet chip.
export function Value({ children }: { children: ReactNode }) {
  return <span {...stylex.props(styles.value)}>{children}</span>;
}
