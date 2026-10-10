"use client";

import * as stylex from "@stylexjs/stylex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuiIf,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArchiveIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "lucide-react";
import { fadeIn, riseIn, spin } from "./surfaces";
import {
  forwardRef,
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type FC,
} from "react";

const paint = stylex.create({
  s0: {
    "position": "relative",
    "paddingLeft": "2px",
    "paddingRight": "2px",
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s1: {
    "color": "var(--muted-foreground)",
    "pointerEvents": "none",
    "position": "absolute",
    "insetInlineStart": "12px",
    "top": "50%",
    "transform": "translateY(-50%)",
    "width": "16px",
    "height": "16px",
  },
  s2: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s3: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s4: {
    "color": "var(--muted-foreground)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "16px",
    "paddingBottom": "16px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s5: {
    "color": "var(--muted-foreground)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "12px",
    "paddingBottom": "4px",
    "fontSize": "12px",
    "lineHeight": "16px",
    "fontWeight": 500,
  },
  s6: {
    "width": "16px",
    "height": "16px",
    "flexShrink": 0,
  },
  s7: {
    "whiteSpace": "nowrap",
  },
  s8: {
    "display": "flex",
    "flexDirection": "column",
    "gap": "2px",
  },
  s9: {
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "paddingLeft": "10px",
    "paddingRight": "10px",
  },
  s10: {
    "height": "14px",
    "width": "100%",
  },
  s11: {
    "backgroundColor": {
      ":hover": "var(--muted)",
      ":focus-visible": "var(--muted)",
      ":is([data-state=active], [data-active])": "var(--muted)",
      ":has(:focus-visible)": "var(--muted)",
      ":has([data-state=open])": "var(--muted)",
    },
    "position": "relative",
    "display": "flex",
    "height": "32px",
    "alignItems": "center",
    "borderRadius": "var(--radius-md)",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "outline": {
      ":focus-visible": "none",
    },
  },
  s12: {
    "boxShadow": {
      ":focus-visible": "0 0 0 1px var(--ring)",
    },
    "display": "flex",
    "height": "100%",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "borderRadius": "var(--radius-md)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "textAlign": "start",
    "outline": "none",
    ":is(:hover > &)": {
      "paddingInlineEnd": "36px",
    },
    ":is(:is([data-state=active], [data-active]) > &)": {
      "paddingInlineEnd": "36px",
    },
    ":is(:has(:focus-visible) > &)": {
      "paddingInlineEnd": "36px",
    },
    ":is(:has([data-state=open]) > &)": {
      "paddingInlineEnd": "36px",
    },
  },
  s13: {
    "color": "var(--muted-foreground)",
    "marginInlineEnd": "6px",
    "width": "14px",
    "height": "14px",
    "flexShrink": 0,
  },
  s14: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflow": "hidden",
    "textOverflow": "ellipsis",
    "whiteSpace": "nowrap",
  },
  s15: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },
  s16: {
    "backgroundColor": {
      "[data-state=open]": "var(--accent)",
    },
    "position": "absolute",
    "insetInlineEnd": "6px",
    "top": "50%",
    "transform": "translateY(-50%)",
    "width": "24px",
    "height": "24px",
    "padding": "0px",
    "opacity": {
      "default": 0,
      "[data-state=open]": 1,
    },
    ":is(:hover > &)": {
      "opacity": 1,
    },
    ":is(:is([data-state=active], [data-active]) > &)": {
      "opacity": 1,
    },
    ":is(:has(:focus-visible) > &)": {
      "opacity": 1,
    },
  },
  s17: {
    "width": "14px",
    "height": "14px",
  },
  s18: {
    "position": "absolute",
    "width": "1px",
    "height": "1px",
    "padding": 0,
    "margin": "-1px",
    "overflow": "hidden",
    "clip": "rect(0,0,0,0)",
    "whiteSpace": "nowrap",
    "borderWidth": 0,
  },
  s19: {
    "backgroundColor": "var(--popover)",
    "color": "var(--popover-foreground)",
    "zIndex": 50,
    "minWidth": "128px",
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "padding": "6px",
  },
  s20: {
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":focus": "var(--accent)",
    },
    "color": {
      ":hover": "var(--accent-foreground)",
      ":focus": "var(--accent-foreground)",
    },
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "userSelect": "none",
  },
  s21: {
    "width": "16px",
    "height": "16px",
  },
  s22: {
    "backgroundColor": {
      ":hover": "var(--accent)",
      ":focus": "var(--accent)",
    },
    "color": {
      ":hover": "var(--accent-foreground)",
      ":focus": "var(--accent-foreground)",
    },
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "userSelect": "none",
  },
  s23: {
    "width": "16px",
    "height": "16px",
  },
  s24: {
    "color": {
      "default": "var(--destructive)",
      ":hover": "var(--destructive)",
      ":focus": "var(--destructive)",
    },
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--destructive) 10%, transparent)",
      ":focus": "color-mix(in oklab, var(--destructive) 10%, transparent)",
    },
    "display": "flex",
    "cursor": "pointer",
    "alignItems": "center",
    "gap": "8px",
    "borderRadius": "var(--radius-lg)",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "outline": "none",
    "userSelect": "none",
  },
  s25: {
    "width": "16px",
    "height": "16px",
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export const ThreadList: FC = () => {
  const [search, setSearch] = useState("");
  const hasThreads = useAuiState((s) => s.threads.threadIds.length > 0);

  return (
    <ThreadListRoot>
      <ThreadListNew />
      {hasThreads && (
        <ThreadListSearch value={search} onValueChange={setSearch} />
      )}
      <ThreadListItems searchQuery={hasThreads ? search : ""} />
    </ThreadListRoot>
  );
};

export const ThreadListSearch = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithoutRef<typeof Input>, "value" | "onChange"> & {
    value: string;
    onValueChange: (value: string) => void;
  }
>(({ value, onValueChange, ...props }, ref) => {
  return (
    <div data-slot="aui_thread-list-search" className={sx(paint.s0)}>
      <SearchIcon
        data-slot="aui_thread-list-search-icon"
        className={sx(paint.s1)}
      />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-label="Search threads"
        placeholder="Search threads"
        inset="wide"
        {...props}
      />
    </div>
  );
});

ThreadListSearch.displayName = "ThreadListSearch";

export const ThreadListRoot: FC<
  ComponentPropsWithoutRef<typeof ThreadListPrimitive.Root>
> = ({ className, ...props }) => {
  return (
    <ThreadListPrimitive.Root
      data-slot="aui_thread-list-root"
      className={[sx(paint.s2), className].filter(Boolean).join(" ")}
      {...props}
    />
  );
};

export const ThreadListItems: FC<
  ComponentPropsWithoutRef<"div"> & { searchQuery?: string }
> = ({ className, searchQuery = "", ...props }) => {
  return (
    <div
      data-slot="aui_thread-list-items"
      className={[sx(paint.s3), className].filter(Boolean).join(" ")}
      {...props}
    >
      <AuiIf condition={(s) => s.threads.isLoading}>
        <ThreadListSkeleton />
      </AuiIf>
      <AuiIf condition={(s) => !s.threads.isLoading}>
        <ThreadListItemGroups searchQuery={searchQuery} />
      </AuiIf>
    </div>
  );
};

const dateGroupLabel = (
  date: Date | undefined,
  startOfToday: number,
  startOfYesterday: number,
): string => {
  if (!date || date.getTime() >= startOfToday) return "Today";
  if (date.getTime() >= startOfYesterday) return "Yesterday";
  return "Earlier";
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const subscribeToNextDay = (onDayChange: () => void) => {
  let timeout: number;
  const scheduleNextDay = () => {
    const now = new Date();
    const startOfTomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    ).getTime();
    timeout = window.setTimeout(() => {
      onDayChange();
      scheduleNextDay();
    }, startOfTomorrow - now.getTime());
  };
  scheduleNextDay();
  return () => window.clearTimeout(timeout);
};

const getStartOfToday = () => startOfLocalDay(new Date());

// A server render and hydration see no day start, so a prerender never reads
// the clock; a client-only mount groups on its first render.
const getServerStartOfToday = () => undefined;

const useStartOfToday = () =>
  useSyncExternalStore<number | undefined>(
    subscribeToNextDay,
    getStartOfToday,
    getServerStartOfToday,
  );

export type ThreadListGroup = { label: string; indices: number[] };

/**
 * Filters the thread list by title and buckets the matches by last activity
 * (Today, Yesterday, Earlier). `groups` is null when no thread carries a date
 * or while the local day start is unknown during server render and hydration,
 * in which case `filteredIndices` keeps the runtime order.
 */
export const useThreadListGroups = (searchQuery = "") => {
  const threadIds = useAuiState((s) => s.threads.threadIds);
  const threadItems = useAuiState((s) => s.threads.threadItems);

  const query = searchQuery.trim().toLowerCase();
  const startOfToday = useStartOfToday();

  return useMemo(() => {
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    const dates = threadIds.map((id) => itemsById.get(id)?.lastMessageAt);
    const filteredIndices = threadIds
      .map((id, index) => ({ id, index }))
      .filter(
        ({ id }) =>
          !query ||
          (itemsById.get(id)?.title || "New Chat")
            .toLowerCase()
            .includes(query),
      )
      .map(({ index }) => index);
    if (
      startOfToday === undefined ||
      !filteredIndices.some((index) => dates[index])
    ) {
      return { threadIds, filteredIndices, groups: null };
    }

    const yesterday = new Date(startOfToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = yesterday.getTime();
    const time = (index: number) =>
      dates[index]?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const sorted = [...filteredIndices].sort((a, b) => time(b) - time(a));

    const result: ThreadListGroup[] = [];
    for (const index of sorted) {
      const label = dateGroupLabel(
        dates[index],
        startOfToday,
        startOfYesterday,
      );
      const lastGroup = result[result.length - 1];
      if (lastGroup?.label === label) {
        lastGroup.indices.push(index);
      } else {
        result.push({ label, indices: [index] });
      }
    }
    return { threadIds, filteredIndices, groups: result };
  }, [threadIds, threadItems, query, startOfToday]);
};

const ThreadListItemGroups: FC<{ searchQuery?: string }> = ({
  searchQuery = "",
}) => {
  const { threadIds, filteredIndices, groups } =
    useThreadListGroups(searchQuery);
  const query = searchQuery.trim();

  if (query && filteredIndices.length === 0) {
    return (
      <div
        data-slot="aui_thread-list-empty"
        className={sx(paint.s4)}
      >
        No threads found
      </div>
    );
  }

  if (!groups) {
    return filteredIndices.map((index) => (
      <ThreadListPrimitive.ItemByIndex
        key={threadIds[index]}
        index={index}
        components={{ ThreadListItem }}
      />
    ));
  }

  return groups.map((group) => (
    <Fragment key={group.label}>
      <div
        data-slot="aui_thread-list-group-label"
        className={sx(paint.s5)}
      >
        {group.label}
      </div>
      {group.indices.map((index) => (
        <ThreadListPrimitive.ItemByIndex
          key={threadIds[index]}
          index={index}
          components={{ ThreadListItem }}
        />
      ))}
    </Fragment>
  ));
};

export const ThreadListNew = forwardRef<
  HTMLButtonElement,
  Omit<ComponentPropsWithoutRef<typeof Button>, "className" | "style"> & { labelClassName?: string }
>(({ labelClassName, children, ...props }, ref) => {
  return (
    <ThreadListPrimitive.New asChild>
      <Button
        ref={ref}
        variant="ghost"
        align="start"
        data-slot="aui_thread-list-new"
        {...props}
      >
        {children ?? (
          <>
            <PlusIcon
              data-slot="aui_thread-list-new-icon"
              className={sx(paint.s6)}
            />
            <span
              data-slot="aui_thread-list-new-label"
              className={[sx(paint.s7), labelClassName].filter(Boolean).join(" ")}
            >
              New Thread
            </span>
          </>
        )}
      </Button>
    </ThreadListPrimitive.New>
  );
});

ThreadListNew.displayName = "ThreadListNew";

const ThreadListSkeleton: FC = () => {
  return (
    <div
      role="status"
      aria-label="Loading threads"
      className={sx(paint.s8)}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          data-slot="aui_thread-list-skeleton-wrapper"
          className={sx(paint.s9)}
        >
          <div className={sx(paint.s10)}><Skeleton
            data-slot="aui_thread-list-skeleton"
           
           /></div>
        </div>
      ))}
    </div>
  );
};

export const ThreadListItem: FC = () => {
  const isRunning = useAuiState((s) => s.threadListItem.isRunning);
  const [isRenaming, setIsRenaming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (isRenaming || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    triggerRef.current?.focus();
  }, [isRenaming]);

  return (
    <ThreadListItemPrimitive.Root
      data-slot="aui_thread-list-item"
      className={sx(paint.s11)}
    >
      {isRenaming ? (
        <ThreadListItemRename
          onDone={(restoreFocus) => {
            restoreFocusRef.current = restoreFocus;
            setIsRenaming(false);
          }}
        />
      ) : (
        <ThreadListItemPrimitive.Trigger
          ref={triggerRef}
          data-slot="aui_thread-list-item-trigger"
          className={sx(paint.s12)}
        >
          {isRunning && (
            <Loader2Icon
              aria-hidden
              data-slot="aui_thread-list-item-running"
              className={sx(paint.s13, spin)}
            />
          )}
          <span
            data-slot="aui_thread-list-item-title"
            className={sx(paint.s14)}
          >
            <ThreadListItemPrimitive.Title fallback="New Chat" />
          </span>
          {isRunning && <span className={sx(paint.s15)}>Running</span>}
        </ThreadListItemPrimitive.Trigger>
      )}
      <ThreadListItemMore onRename={() => setIsRenaming(true)} />
    </ThreadListItemPrimitive.Root>
  );
};

const ThreadListItemRename: FC<{
  onDone: (restoreFocus: boolean) => void;
}> = ({ onDone }) => {
  const aui = useAui();
  const title = useAuiState((s) => s.threadListItem.title) ?? "";
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const commit = (restoreFocus: boolean) => {
    if (settledRef.current) return;
    settledRef.current = true;

    const next = value.trim();
    if (!next || next === title) {
      onDone(restoreFocus);
      return;
    }

    // Deferred so a synchronous throw lands on the rejection path too.
    Promise.resolve()
      .then(() => aui.threadListItem.rename(next))
      .then(
        () => onDone(restoreFocus),
        () => {
          settledRef.current = false;
          if (restoreFocus) inputRef.current?.focus();
        },
      );
  };

  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    onDone(true);
  };

  return (
    <Input
      ref={inputRef}
      autoFocus
      data-slot="aui_thread-list-item-rename"
      aria-label="Rename thread"
      value={value}
      layout="rename"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
          return;
        if (event.key === "Enter") {
          event.preventDefault();
          commit(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
};

const ThreadListItemMore: FC<{ onRename: () => void }> = ({ onRename }) => {
  return (
    <ThreadListItemMorePrimitive.Root sharedFocusGroup>
      <ThreadListItemMorePrimitive.Trigger asChild>
        <span className={sx(paint.s16)}><Button
          variant="ghost"
          size="icon"
          data-slot="aui_thread-list-item-more">
          <MoreHorizontalIcon className={sx(paint.s17)} />
          <span className={sx(paint.s18)}>More options</span>
        </Button></span>
      </ThreadListItemMorePrimitive.Trigger>
      <ThreadListItemMorePrimitive.Content
        side="right"
        align="start"
        sideOffset={6}
        data-slot="aui_thread-list-item-more-content"
        className={sx(paint.s19, fadeIn, riseIn)}
      >
        <ThreadListItemMorePrimitive.Item
          data-slot="aui_thread-list-item-more-item"
          className={sx(paint.s20)}
          onSelect={onRename}
        >
          <PencilIcon className={sx(paint.s21)} />
          Rename
        </ThreadListItemMorePrimitive.Item>
        <ThreadListItemPrimitive.Archive asChild>
          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className={sx(paint.s22)}
          >
            <ArchiveIcon className={sx(paint.s23)} />
            Archive
          </ThreadListItemMorePrimitive.Item>
        </ThreadListItemPrimitive.Archive>
        <ThreadListItemPrimitive.Delete asChild>
          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className={sx(paint.s24)}
          >
            <TrashIcon className={sx(paint.s25)} />
            Delete
          </ThreadListItemMorePrimitive.Item>
        </ThreadListItemPrimitive.Delete>
      </ThreadListItemMorePrimitive.Content>
    </ThreadListItemMorePrimitive.Root>
  );
};
