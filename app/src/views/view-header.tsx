import type { ReactNode } from "react";

// ViewHeader is a full-page view's top strip: its title, a short line of
// context, and its actions, in the window's drag region, so the view's name
// appears once.
export function ViewHeader({ title, description, actions, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header data-tauri-drag-region className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b bg-sidebar/40 px-6 py-2">
      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-baseline gap-3">
        <h1 className="shrink-0 font-medium text-sm">{title}</h1>
        {description && <p className="hidden min-w-0 truncate text-muted-foreground text-xs md:block">{description}</p>}
      </div>
      {children}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
