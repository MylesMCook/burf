import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface PickerItem {
  value: string;
  label: string;
  // Shown before the label, and dimmer after it / at the far right.
  icon?: ReactNode;
  detail?: string;
  trailing?: ReactNode;
  disabled?: boolean;
  // Extra text the search matches.
  keywords?: string;
}

// Picker is a field-sized button that opens a searchable list: the project,
// agent and host choosers in the new-worktree and add-project dialogs.
export function Picker({
  items,
  value,
  onChange,
  placeholder = "Choose…",
  searchPlaceholder = "Search…",
  footer,
  className,
  variant = "field",
  "aria-label": ariaLabel,
}: {
  items: PickerItem[];
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  searchPlaceholder?: string;
  // Below the list, such as "Add a project…".
  footer?: (close: () => void) => ReactNode;
  className?: string;
  // A form-height field, or a small chip for a dialog's header.
  // inline sits in a line of text, such as a dialog's context line.
  variant?: "field" | "chip" | "inline";
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const current = items.find((i) => i.value === value);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => `${i.label} ${i.detail ?? ""} ${i.keywords ?? ""}`.toLowerCase().includes(q)) : items;
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(Math.max(0, items.findIndex((i) => i.value === value)));
    // Only as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (i?: PickerItem) => {
    if (!i || i.disabled) return;
    onChange(i.value);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(
          variant === "inline" ? "inline-flex" : "flex",
          "min-w-0 items-center border border-input bg-background text-left shadow-xs/5 outline-none transition-[background-color,box-shadow] hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 data-popup-open:bg-accent/50 dark:bg-input/32 dark:hover:bg-input/48",
          variant === "field" && "h-9 w-full gap-2.5 rounded-lg px-3 text-sm sm:h-8",
          variant === "chip" && "h-7 max-w-full gap-1.5 rounded-md px-2 text-[13px]",
          variant === "inline" && "-my-0.5 h-6 max-w-full gap-1 rounded-md border-transparent bg-transparent px-1.5 align-middle font-medium text-[13px] text-foreground shadow-none dark:bg-transparent",
          className,
        )}
      >
        {current ? (
          <>
            {variant !== "inline" && current.icon}
            <span className="min-w-0 truncate">{current.label}</span>
            {current.detail && variant !== "inline" && <span className="min-w-0 truncate text-muted-foreground">{current.detail}</span>}
            {variant === "field" && <span className="ml-auto flex shrink-0 items-center gap-2 text-muted-foreground text-xs">{current.trailing}</span>}
          </>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDownIcon className={cn("size-3.5 shrink-0 text-muted-foreground", variant === "inline" ? "size-3" : (variant === "chip" || !current?.trailing) && "ml-auto")} />
      </PopoverTrigger>
      <PopoverPopup align={variant === "chip" ? "end" : "start"} style={variant === "inline" ? { minWidth: "28rem" } : undefined} className="w-(--anchor-width) min-w-72 p-0 [--viewport-inline-padding:0px] *:data-[slot=popover-viewport]:py-0">
        <div className="flex flex-col">
          <input
            autoFocus
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shown.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(shown[active]);
              }
            }}
            className="h-9 border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div ref={listRef} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {shown.length === 0 && <p className="px-2.5 py-2 text-muted-foreground text-sm">Nothing matches.</p>}
            {shown.map((i, n) => (
              <button
                key={i.value}
                type="button"
                role="option"
                data-index={n}
                aria-selected={i.value === value}
                disabled={i.disabled}
                onMouseMove={() => setActive(n)}
                onClick={() => choose(i)}
                className={cn(
                  "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm outline-none disabled:opacity-50",
                  n === active && "bg-accent text-accent-foreground",
                )}
              >
                {i.icon}
                <span className="min-w-0 truncate">{i.label}</span>
                {i.detail && <span className="min-w-0 truncate text-muted-foreground">{i.detail}</span>}
                <span className="ml-auto flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
                  {i.trailing}
                  <CheckIcon className={cn("size-3.5", i.value !== value && "invisible")} />
                </span>
              </button>
            ))}
          </div>
          {footer && <div className="border-t p-1">{footer(() => setOpen(false))}</div>}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

// PickerAction is a row in a picker's footer.
export function PickerAction({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-muted-foreground text-sm hover:bg-accent hover:text-foreground">
      {icon}
      {children}
    </button>
  );
}
