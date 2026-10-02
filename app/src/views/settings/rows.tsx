import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ViewHeader } from "@/views/view-header";

// The pieces every settings section is made of: a titled page, groups of
// rows, and rows of label, description and control.

export function SettingsPage({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-8 pt-6 pb-16 max-[1200px]:px-6">
      {/* The section names itself in the view's strip, after "Settings". */}
      <ViewHeader
        title={
          <span className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">Settings</span>
            <span className="text-muted-foreground/60">/</span>
            {title}
          </span>
        }
        actions={actions}
      />
      {/* Section descriptions run long, so they stay with the page. */}
      {description && <p className="mb-6 text-muted-foreground text-sm">{description}</p>}
      <div className="space-y-8">{children}</div>
    </div>
  );
}

export function SettingsGroup({ title, description, actions, children }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {(title || actions) && (
        <div className="mb-2 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            {title && <h2 className="font-medium text-[13px] text-muted-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-muted-foreground/80 text-xs">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card/40">{children}</div>
    </section>
  );
}

export function SettingsRow({ label, description, children, className }: { label: ReactNode; description?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-12 items-center gap-6 px-4 py-2.5", className)}>
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        {description && <div className="mt-0.5 text-muted-foreground text-xs leading-relaxed">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

// Code is a path or a command inside a description.
export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground/90">{children}</code>;
}

// Value shows a setting that is read, not edited here, as a quiet chip.
export function Value({ children }: { children: ReactNode }) {
  return <span className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-muted-foreground text-xs tabular-nums">{children}</span>;
}
