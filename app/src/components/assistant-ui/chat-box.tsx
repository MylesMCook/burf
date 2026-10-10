import type { CSSProperties, ComponentProps } from "react";

import { cn } from "@/lib/utils";

// One chat box. The thread composer, a new task, a worktree, This computer
// and the first prompt all draw this shell. The radius is the chat box in
// DESIGN.md (rounded-2xl), shared with a person's message through
// --composer-radius. A start surface has no thread runtime, so it cannot
// mount ComposerPrimitive; it still uses this shell rather than a second box.
export const chatBoxVars = {
  "--composer-bg": "color-mix(in oklab, var(--color-muted) 30%, transparent)",
  "--composer-radius": "var(--radius-2xl)",
  "--composer-padding": "8px",
} as CSSProperties;

export const chatBoxShellClass =
  "border-foreground/10 focus-within:border-foreground/25 data-[dragging=true]:border-ring flex w-full cursor-text flex-col gap-1 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))]";

export const chatBoxInputClass =
  "caret-primary placeholder:text-muted-foreground/60 field-sizing-content max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none";

export function ChatBox({ className, style, ...props }: ComponentProps<"div">) {
  return <div data-slot="chat-box" style={{ ...chatBoxVars, ...style }} className={cn(chatBoxShellClass, className)} {...props} />;
}
