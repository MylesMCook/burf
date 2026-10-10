"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import * as stylex from "@stylexjs/stylex";
import { color, radius } from "@/styles/tokens.stylex";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandCollection,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

export type ModelSelectorEffortOption = {
  id: string;
  name: string;
};

export const DEFAULT_EFFORT_OPTIONS: readonly ModelSelectorEffortOption[] = [
  { id: "low", name: "Low" },
  { id: "medium", name: "Med" },
  { id: "high", name: "High" },
];

export type ModelOption = {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Extra terms matched by ModelSelector.Search, in addition to id and name. */
  keywords?: readonly string[];
  /**
   * Reasoning effort levels the model supports. Pass `true` for the default
   * low/medium/high levels, or a custom list. Omit for models without
   * configurable reasoning.
   */
  efforts?: boolean | readonly ModelSelectorEffortOption[];
};

function getModelEfforts(
  model: ModelOption | undefined,
): readonly ModelSelectorEffortOption[] | undefined {
  if (!model?.efforts) return undefined;
  return model.efforts === true ? DEFAULT_EFFORT_OPTIONS : model.efforts;
}

function resolveEffort(
  efforts: readonly ModelSelectorEffortOption[] | undefined,
  effort: string | undefined,
): string | undefined {
  if (effort === undefined) return undefined;
  return efforts?.some((e) => e.id === effort) ? effort : undefined;
}

/**
 * Returns the effort id if the given model supports it, otherwise undefined.
 * Effort selection is kept sticky across model switches; this resolves what
 * actually applies to the current model.
 */
export function resolveModelEffort(
  models: readonly ModelOption[],
  modelId: string | undefined,
  effort: string | undefined,
): string | undefined {
  return resolveEffort(
    getModelEfforts(models.find((m) => m.id === modelId)),
    effort,
  );
}

function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: {
  prop: T | undefined;
  defaultProp: T | undefined;
  onChange: ((next: T) => void) | undefined;
}) {
  const [internal, setInternal] = useState(defaultProp);
  const isControlled = prop !== undefined;
  const value = isControlled ? prop : internal;
  // Read onChange through a ref so inline callbacks don't recreate the setter
  // (and with it the memoized context value) every render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setInternal(next);
      onChangeRef.current?.(next);
    },
    [isControlled],
  );
  return [value, setValue] as const;
}

type ModelSelectorContextValue = {
  models: readonly ModelOption[];
  value: string | undefined;
  setValue: (value: string) => void;
  /** The model matching `value`, derived once for all sub-components. */
  selectedModel: ModelOption | undefined;
  /** The selected model's effort levels, undefined when not configurable. */
  efforts: readonly ModelSelectorEffortOption[] | undefined;
  /** Effort resolved against the selected model's supported levels. */
  effort: string | undefined;
  setEffort: (effort: string) => void;
  setOpen: (open: boolean) => void;
};

const ModelSelectorContext = createContext<ModelSelectorContextValue | null>(
  null,
);

export function useModelSelectorContext() {
  const ctx = useContext(ModelSelectorContext);
  if (!ctx) {
    throw new Error(
      "ModelSelector sub-components must be used within ModelSelector.Root",
    );
  }
  return ctx;
}

/**
 * The selected model's effort levels and the active selection. Use it to build
 * a custom effort UI inside ModelSelector.Content (e.g. a slider or a shadcn
 * DropdownMenu) when the built-in ModelSelector.Effort layout doesn't fit.
 * `efforts` is undefined for models without configurable reasoning.
 */
export function useModelSelectorEfforts(): {
  efforts: readonly ModelSelectorEffortOption[] | undefined;
  effort: string | undefined;
  setEffort: (effort: string) => void;
} {
  const { efforts, effort, setEffort } = useModelSelectorContext();
  return { efforts, effort, setEffort };
}

export type ModelSelectorRootProps = {
  models: readonly ModelOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  effort?: string;
  defaultEffort?: string;
  onEffortChange?: (effort: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

function ModelSelectorRoot({
  models,
  value: valueProp,
  defaultValue,
  onValueChange,
  effort: effortProp,
  defaultEffort,
  onEffortChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  children,
}: ModelSelectorRootProps) {
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue ?? models[0]?.id,
    onChange: onValueChange,
  });
  const [effort, setEffort] = useControllableState({
    prop: effortProp,
    defaultProp: defaultEffort,
    onChange: onEffortChange,
  });
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
  });

  const selectedModel = models.find((m) => m.id === value);
  const efforts = getModelEfforts(selectedModel);
  const activeEffort = resolveEffort(efforts, effort);
  const contextValue = useMemo(
    () => ({
      models,
      value,
      setValue,
      selectedModel,
      efforts,
      effort: activeEffort,
      setEffort,
      setOpen,
    }),
    [
      models,
      value,
      setValue,
      selectedModel,
      efforts,
      activeEffort,
      setEffort,
      setOpen,
    ],
  );

  return (
    <ModelSelectorContext.Provider value={contextValue}>
      <Popover open={open ?? false} onOpenChange={setOpen}>
        {children}
      </Popover>
    </ModelSelectorContext.Provider>
  );
}

const still = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  trigger: {
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    overflow: "hidden",
    borderRadius: radius.md,
    fontSize: 14,
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: { ":focus-visible": "0 0 0 1px color-mix(in oklab, var(--ring) 50%, transparent)" },
    transitionProperty: "background-color, color",
    transitionDuration: { default: "150ms", [still]: "0s" },
    opacity: { default: 1, ":disabled": 0.5 },
    cursor: { default: "pointer", ":disabled": "not-allowed" },
    ":not(#\\#) svg": { pointerEvents: "none", flexShrink: 0 },
  },
  outline: {
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.input,
    backgroundColor: { default: "transparent", ":hover": color.accent },
    color: { ":hover": color.accentForeground },
  },
  ghost: {
    backgroundColor: { default: "transparent", ":hover": color.accent },
    color: { ":hover": color.accentForeground },
  },
  muted: {
    backgroundColor: { default: color.secondary, ":hover": "color-mix(in oklab, var(--secondary) 80%, transparent)" },
    color: color.secondaryForeground,
  },
  sizeDefault: { height: 36, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 },
  sizeSm: { height: 32, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12 },
  sizeLg: { height: 40, paddingLeft: 16, paddingRight: 16, paddingTop: 10, paddingBottom: 10 },
  sizeXs: { height: 28, paddingLeft: 10, paddingRight: 10, fontSize: 12 },
  pill: { borderRadius: radius.full, flexShrink: 0 },
  chevron: { width: 16, height: 16, opacity: 0.5 },
  icon: {
    display: "flex",
    width: 14,
    height: 14,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    ":not(#\\#) svg": { width: 14, height: 14 },
  },
  iconNudge: { marginTop: 3 },
  placeholder: { color: color.mutedForeground },
  value: { display: "flex", minWidth: 0, alignItems: "center", gap: 8 },
  name: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 },
  effort: { minWidth: 30, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", color: color.mutedForeground },
  sr: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  itemText: { display: "flex", minWidth: 0, flexDirection: "column" },
  desc: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: color.mutedForeground, fontSize: 12 },
  check: { position: "absolute", insetInlineEnd: 12, top: 10, display: "flex", width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  effortRow: {
    display: "flex",
    cursor: "default",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: color.border,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  effortLabel: { color: color.mutedForeground, fontSize: 12 },
  radios: { display: "flex", alignItems: "center", gap: 2 },
  radio: {
    cursor: "pointer",
    borderRadius: radius.md,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 4,
    fontSize: 12,
    outline: "none",
    color: { default: color.mutedForeground, ":hover": color.foreground, "[data-checked]": color.accentForeground },
    backgroundColor: { default: "transparent", ":hover": color.muted, "[data-checked]": color.accent },
    fontWeight: { "[data-checked]": 500 },
    boxShadow: { ":focus-visible": "0 0 0 1px color-mix(in oklab, var(--ring) 50%, transparent)" },
    transitionProperty: "background-color, color",
    transitionDuration: { default: "150ms", [still]: "0s" },
  },
});

function cls(...parts: readonly (false | null | undefined | object)[]): string | undefined {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className;
}

export type ModelSelectorVariant = "outline" | "ghost" | "muted";
export type ModelSelectorSize = "default" | "sm" | "lg" | "xs";

const variantStyle = { outline: styles.outline, ghost: styles.ghost, muted: styles.muted } as const;
const sizeStyle = { default: styles.sizeDefault, sm: styles.sizeSm, lg: styles.sizeLg, xs: styles.sizeXs } as const;

export type ModelSelectorTriggerProps = Omit<ComponentPropsWithoutRef<typeof PopoverTrigger>, "className" | "style"> & {
  variant?: ModelSelectorVariant;
  size?: ModelSelectorSize;
  shape?: "pill";
};

function ModelSelectorTrigger({
  variant = "outline",
  size = "default",
  shape,
  children,
  onKeyDown,
  ...props
}: ModelSelectorTriggerProps) {
  const { setOpen } = useModelSelectorContext();

  return (
    <PopoverTrigger
      data-slot="model-selector-trigger"
      data-variant={variant}
      data-size={size}
      role="combobox"
      aria-haspopup="listbox"
      className={cls(styles.trigger, variantStyle[variant], sizeStyle[size], shape === "pill" && styles.pill)}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        // ARIA combobox: arrows open the listbox from a focused trigger.
        // Popover leaves this to the consumer.
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setOpen(true);
        }
      }}
      {...props}
    >
      {children ?? <ModelSelectorValue />}
      <ChevronDownIcon className={cls(styles.chevron)} />
    </PopoverTrigger>
  );
}

export type ModelSelectorValueProps = {
  placeholder?: ReactNode;
  /** Show the active effort level next to the model name. */
  showEffort?: boolean;
};

function ModelIcon({ children, nudge = false }: { children: ReactNode; nudge?: boolean }) {
  return <span className={cls(styles.icon, nudge && styles.iconNudge)}>{children}</span>;
}

function ModelSelectorValue({ placeholder = "Select model", showEffort = true }: ModelSelectorValueProps) {
  const { selectedModel, efforts, effort } = useModelSelectorContext();

  if (!selectedModel) {
    return (
      <span data-slot="model-selector-value" className={cls(styles.placeholder)}>
        {placeholder}
      </span>
    );
  }

  const effortName =
    showEffort && effort !== undefined
      ? efforts?.find((e) => e.id === effort)?.name
      : undefined;

  return (
    <span data-slot="model-selector-value" className={cls(styles.value)}>
      {selectedModel.icon && <ModelIcon>{selectedModel.icon}</ModelIcon>}
      <span className={cls(styles.name)}>{selectedModel.name}</span>
      {effortName && <span className={cls(styles.effort)}>{effortName}</span>}
    </span>
  );
}

export type ModelSelectorContentProps = Omit<
  ComponentPropsWithoutRef<typeof PopoverContent>,
  "side"
> & {
  /**
   * Preferred side for the initial placement. Once the popover is open, the
   * rendered side takes over until it closes, so the popup does not jump
   * between sides while filtering resizes the list.
   */
  side?: ComponentPropsWithoutRef<typeof PopoverContent>["side"];
  searchable?: boolean;
};

// The popover re-evaluates collision flipping whenever the popup resizes, so
// filtering the list down flips the popup back to the preferred side
// mid-interaction. Feed the rendered side back as the preferred side, making
// the popup keep its side until it no longer fits.
function useLazyFlipSide(): {
  side: ModelSelectorContentProps["side"];
  popupRef: (node: HTMLDivElement | null) => void;
} {
  const [side, setSide] = useState<ModelSelectorContentProps["side"]>();
  const observerRef = useRef<MutationObserver | null>(null);
  const popupRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) {
      setSide(undefined);
      return;
    }
    const sync = () => {
      const rendered = node.getAttribute("data-side");
      if (rendered) setSide(rendered as ModelSelectorContentProps["side"]);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(node, {
      attributes: true,
      attributeFilter: ["data-side"],
    });
    observerRef.current = observer;
  }, []);
  return { side, popupRef };
}

// Base UI's input anchors keyboard navigation when search is hidden.
function ModelSelectorFocusAnchor() {
  return (
    <div className={cls(styles.sr)}>
      <CommandInput readOnly aria-label="Model" />
    </div>
  );
}

function ModelSelectorContent({
  align = "start",
  side,
  sideOffset = 6,
  searchable,
  children,
  ...props
}: ModelSelectorContentProps) {
  const { models } = useModelSelectorContext();
  const { side: renderedSide, popupRef } = useLazyFlipSide();
  const unfiltered =
    searchable === false || (!searchable && children === undefined);

  return (
    <PopoverContent
      ref={popupRef}
      data-slot="model-selector-content"
      align={align}
      side={renderedSide ?? side ?? "bottom"}
      sideOffset={sideOffset}
      flush
      width="72"
      {...props}
    >
      <Command
        items={models}
        itemToStringValue={(item) => (item as ModelOption).name}
        filter={unfiltered ? null : (item, query) => {
          const model = item as ModelOption;
          return [model.id, model.name, ...(model.keywords ?? [])].some((term) => term.toLowerCase().includes(query.toLowerCase()));
        }}
      >
        {unfiltered && <ModelSelectorFocusAnchor />}
        {children ?? (
          <>
            {searchable && <ModelSelectorSearch />}
            <ModelSelectorList />
            <ModelSelectorEffort />
          </>
        )}
      </Command>
    </PopoverContent>
  );
}

export type ModelSelectorSearchProps = ComponentPropsWithoutRef<
  typeof CommandInput
>;

function ModelSelectorSearch({
  placeholder = "Search models...",
  ...props
}: ModelSelectorSearchProps) {
  return (
    <CommandInput
      data-slot="model-selector-search"
      placeholder={placeholder}
      {...props}
    />
  );
}

export type ModelSelectorListProps = ComponentPropsWithoutRef<
  typeof CommandList
>;

function ModelSelectorList({
  children,
  ...props
}: ModelSelectorListProps) {
  return (
    <CommandList
      data-slot="model-selector-list"
      hideBar
      {...props}
    >
      {children ?? (
        <>
          <ModelSelectorEmpty />
          <CommandGroup>
            <CommandCollection>{(model: ModelOption) => <ModelSelectorItem key={model.id} model={model} />}</CommandCollection>
          </CommandGroup>
        </>
      )}
    </CommandList>
  );
}

export type ModelSelectorEmptyProps = ComponentPropsWithoutRef<
  typeof CommandEmpty
>;

function ModelSelectorEmpty({ children, ...props }: ModelSelectorEmptyProps) {
  return (
    <CommandEmpty data-slot="model-selector-empty" {...props}>
      {children ?? "No models found."}
    </CommandEmpty>
  );
}

export type ModelSelectorGroupProps = ComponentPropsWithoutRef<
  typeof CommandGroup
>;

function ModelSelectorGroup(props: ModelSelectorGroupProps) {
  return <CommandGroup data-slot="model-selector-group" {...props} />;
}

export type ModelSelectorSeparatorProps = ComponentPropsWithoutRef<
  typeof CommandSeparator
>;

function ModelSelectorSeparator(props: ModelSelectorSeparatorProps) {
  return <CommandSeparator data-slot="model-selector-separator" {...props} />;
}

export type ModelSelectorItemProps = Omit<
  ComponentPropsWithoutRef<typeof CommandItem>,
  "value"
> & {
  model: ModelOption;
};

function ModelSelectorItem({
  model,
  children,
  onClick,
  ...props
}: ModelSelectorItemProps) {
  const { value, setValue, setOpen } = useModelSelectorContext();
  const isSelected = value === model.id;

  return (
    <CommandItem
      data-slot="model-selector-item"
      value={model}
      {...(model.disabled ? { disabled: true } : undefined)}
      onClick={(event) => {
        setValue(model.id);
        setOpen(false);
        onClick?.(event);
      }}
      look="model"
      {...props}
    >
      {children ?? (
        <>
          {model.icon && <ModelIcon nudge>{model.icon}</ModelIcon>}
          <span className={cls(styles.itemText)}>
            <span className={cls(styles.name)}>{model.name}</span>
            {model.description && <span className={cls(styles.desc)}>{model.description}</span>}
          </span>
        </>
      )}
      {isSelected && (
        <span className={cls(styles.check)}>
          <CheckIcon className={cls(styles.chevron)} />
        </span>
      )}
    </CommandItem>
  );
}

export type ModelSelectorEffortProps = Omit<ComponentPropsWithoutRef<"div">, "className" | "style"> & {
  label?: ReactNode;
  disabled?: boolean;
};

function ModelSelectorEffort({
  label = "Thinking",
  disabled,
  onKeyDown,
  ...props
}: ModelSelectorEffortProps) {
  const { efforts, effort, setEffort } = useModelSelectorEfforts();

  if (!efforts?.length) return null;

  return (
    <div
      data-slot="model-selector-effort"
      className={cls(styles.effortRow)}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        // Keep the model list from handling the reasoning group's keys.
        if (e.key === "Home" || e.key === "End") e.stopPropagation();
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.currentTarget
            .closest('[data-slot="model-selector-content"]')
            ?.querySelector<HTMLInputElement>('[data-slot="autocomplete-input"]')
            ?.focus();
        }
      }}
      {...props}
    >
      <span className={cls(styles.effortLabel)}>{label}</span>
      <RadioGroupPrimitive
        disabled={disabled}
        value={effort ?? ""}
        onValueChange={setEffort}
        aria-label={typeof label === "string" ? label : "Reasoning effort"}
        className={cls(styles.radios)}
      >
        {efforts.map((option) => (
          <RadioPrimitive.Root
            key={option.id}
            value={option.id}
            className={cls(styles.radio)}
          >
            {option.name}
          </RadioPrimitive.Root>
        ))}
      </RadioGroupPrimitive>
    </div>
  );
}

export type ModelSelectorProps = Omit<ModelSelectorRootProps, "children"> & {
  variant?: ModelSelectorVariant;
  size?: ModelSelectorSize;
  shape?: "pill";
  /** Render a search input above the model list. */
  searchable?: boolean;
  /** Alignment of the dropdown relative to the trigger. Use `"end"` when the
   * trigger sits at the right edge of its container. */
  align?: ModelSelectorContentProps["align"];
};

export {
  ModelSelectorRoot,
  ModelSelectorTrigger,
  ModelSelectorValue,
  ModelSelectorContent,
  ModelSelectorSearch,
  ModelSelectorFocusAnchor,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorSeparator,
  ModelSelectorItem,
  ModelSelectorEffort,
};
