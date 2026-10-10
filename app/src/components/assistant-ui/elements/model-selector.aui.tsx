"use client";

import { Tip } from "@/components/tip";
import { memo, useEffect } from "react";
import * as stylex from "@stylexjs/stylex";
import { useAui } from "@assistant-ui/react";
import {
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
  useModelSelectorContext,
  type ModelSelectorProps,
  type ModelSelectorTriggerProps,
} from "./model-selector";

export {
  DEFAULT_EFFORT_OPTIONS,
  resolveModelEffort,
  useModelSelectorEfforts,
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
} from "./model-selector";

export type {
  ModelOption,
  ModelSelectorEffortOption,
  ModelSelectorProps,
  ModelSelectorRootProps,
  ModelSelectorTriggerProps,
  ModelSelectorValueProps,
  ModelSelectorContentProps,
  ModelSelectorSearchProps,
  ModelSelectorListProps,
  ModelSelectorEmptyProps,
  ModelSelectorGroupProps,
  ModelSelectorSeparatorProps,
  ModelSelectorItemProps,
  ModelSelectorEffortProps,
} from "./model-selector";

/** Registers the selection with assistant-ui's ModelContext system. The
 * context's effort is already resolved against the selected model. */
function ModelSelectorModelContext() {
  const { value, effort } = useModelSelectorContext();
  const api = useAui();

  useEffect(() => {
    if (value === undefined) return;
    const config = {
      config: {
        modelName: value,
        ...(effort !== undefined ? { reasoningEffort: effort } : undefined),
      },
    };
    return api.modelContext.register({
      getModelContext: () => config,
    });
  }, [api, value, effort]);

  return null;
}

const hug = stylex.create({
  hug: { display: "inline-flex", flexShrink: 0 },
});

const ModelSelectorImpl = ({
  searchable,
  variant,
  size,
  shape,
  align,
  triggerProps, tooltip, effortLabel, effortDisabled,
  ...rootProps
}: ModelSelectorProps & { triggerProps?: ModelSelectorTriggerProps; tooltip?: string; effortLabel?: string; effortDisabled?: boolean }) => {
  return (
    <ModelSelectorRoot {...rootProps}>
      <ModelSelectorModelContext />
      {/* The tip's trigger is a span around the picker's own trigger: one
          element cannot be the trigger of both a tooltip and a popup. */}
      <Tip label={tooltip}><span {...stylex.props(hug.hug)}><ModelSelectorTrigger
        {...triggerProps}
        variant={variant}
        size={size}
        shape={shape}
      /></span></Tip>
      <ModelSelectorContent
        {...(align !== undefined ? { align } : {})}
        searchable={searchable ?? false}
      >
        {searchable && <ModelSelectorSearch />}
        <ModelSelectorList />
        <ModelSelectorEffort label={effortLabel} disabled={effortDisabled} />
      </ModelSelectorContent>
    </ModelSelectorRoot>
  );
};

type ModelSelectorComponent = typeof ModelSelectorImpl & {
  displayName?: string;
  Root: typeof ModelSelectorRoot;
  Trigger: typeof ModelSelectorTrigger;
  Value: typeof ModelSelectorValue;
  Content: typeof ModelSelectorContent;
  Search: typeof ModelSelectorSearch;
  FocusAnchor: typeof ModelSelectorFocusAnchor;
  List: typeof ModelSelectorList;
  Empty: typeof ModelSelectorEmpty;
  Group: typeof ModelSelectorGroup;
  Separator: typeof ModelSelectorSeparator;
  Item: typeof ModelSelectorItem;
  Effort: typeof ModelSelectorEffort;
};

const ModelSelector = memo(
  ModelSelectorImpl,
) as unknown as ModelSelectorComponent;

ModelSelector.displayName = "ModelSelector";
ModelSelector.Root = ModelSelectorRoot;
ModelSelector.Trigger = ModelSelectorTrigger;
ModelSelector.Value = ModelSelectorValue;
ModelSelector.Content = ModelSelectorContent;
ModelSelector.Search = ModelSelectorSearch;
ModelSelector.FocusAnchor = ModelSelectorFocusAnchor;
ModelSelector.List = ModelSelectorList;
ModelSelector.Empty = ModelSelectorEmpty;
ModelSelector.Group = ModelSelectorGroup;
ModelSelector.Separator = ModelSelectorSeparator;
ModelSelector.Item = ModelSelectorItem;
ModelSelector.Effort = ModelSelectorEffort;

export { ModelSelector };
