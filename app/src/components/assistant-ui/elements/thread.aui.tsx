"use client";

import * as stylex from "@stylexjs/stylex";
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";
import { File } from "@/components/assistant-ui/elements/file";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui";
import { Image } from "@/components/assistant-ui/elements/image";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/assistant-ui/elements/reasoning.aui";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback.aui";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/assistant-ui/elements/tool-group.aui";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { chatBoxInputClass, chatBoxShellClass } from "@/components/assistant-ui/chat-box";
import { shimmer } from "@/components/assistant-ui/elements/surfaces";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  useAui,
  ThreadPrimitive,
  type FileMessagePartComponent,
  type ImageMessagePartComponent,
  type TextMessagePartComponent,
  type ToolCallMessagePartComponent,
  useAuiState,
} from "@assistant-ui/react";
import {
  ChartColumnIcon, CodeXmlIcon, PencilLineIcon, LightbulbIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  AudioLinesIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  RefreshCwIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import {
  useState,
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from "react";

const paint = stylex.create({
  s0: {
    "display": "flex",
    "flexDirection": "column",
    "rowGap": "24px",
    "animationDelay": "150ms",
    "animationDuration": "200ms",
  },
  s1: {
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
  s2: {
    "marginLeft": "auto",
    "height": "36px",
  },
  s3: {
    "display": "flex",
    "flexDirection": "column",
    "rowGap": "8px",
  },
  s4: {
    "height": "16px",
  },
  s5: {
    "height": "16px",
  },
  s6: {
    "height": "16px",
  },
  s7: {
    "marginLeft": "auto",
    "height": "36px",
  },
  s8: {
    "display": "flex",
    "flexDirection": "column",
    "rowGap": "8px",
  },
  s9: {
    "height": "16px",
  },
  s10: {
    "height": "16px",
  },
  s11: {
    "backgroundColor": "var(--background)",
    "display": "flex",
    "height": "100%",
    "minHeight": "0px",
    "flexDirection": "column",
  },
  s12: {
    "position": "relative",
    "display": "flex",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "overflowX": "auto",
    "scrollBehavior": "smooth",
  },
  s13: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "width": "100%",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "flexDirection": "column",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "16px",
  },
  s14: {
    "justifyContent": "center",
  },
  s15: {
    "display": {
      "default": "flex",
      ":empty": "none",
    },
    "flexDirection": "column",
    "rowGap": "24px",
  },
  s16: {
    "marginBottom": "24px",
  },
  s17: {
    "marginBottom": "56px",
  },
  s18: {
    "marginBottom": "56px",
    "display": {
      ":empty": "none",
    },
  },
  s19: {
    "backgroundColor": "var(--background)",
    "display": "flex",
    "flexDirection": "column",
    "gap": "16px",
    "overflow": "visible",
    "paddingBottom": {
      "default": "16px",
      "@media (min-width: 768px)": {
        "default": "24px",
      },
    },
  },
  s20: {
    "position": "sticky",
    "bottom": "0px",
    "marginTop": "auto",
  },
  s21: {
    "margin": "0px",
  },
  s22: {
    "backgroundColor": "color-mix(in oklab, var(--muted) 40%, transparent)",
    "marginLeft": "8px",
    "marginRight": "8px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
    "paddingTop": "6px",
    "paddingBottom": "6px",
    "containIntrinsicSize": "auto 48px",
    "contentVisibility": "auto",
  },
  s23: {
    "borderRadius": "var(--radius-xl)",
    "paddingTop": "8px",
    "paddingBottom": "8px",
  },
  s24: {
    "borderTopLeftRadius": "var(--radius-xl)",
    "borderTopRightRadius": "var(--radius-xl)",
    "paddingTop": "8px",
  },
  s25: {
    "marginTop": "calc(24px * -1)",
  },
  s26: {
    "marginTop": "calc(24px * -1)",
    "borderBottomLeftRadius": "var(--radius-xl)",
    "borderBottomRightRadius": "var(--radius-xl)",
    "paddingBottom": "8px",
  },
  s27: {
    "color": "var(--muted-foreground)",
    "marginBottom": "6px",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s28: {
    "width": "12px",
    "height": "12px",
  },
  s29: {
    "color": "var(--foreground)",
    "display": "flex",
    "alignItems": "flex-start",
    "gap": "8px",
    "fontSize": "14px",
    "lineHeight": "1.625",
  },
  s30: {
    "color": "var(--muted-foreground)",
    "marginTop": "4px",
    "flexShrink": 0,
  },
  s31: {
    "width": "14px",
    "height": "14px",
  },
  s32: {
    "width": "14px",
    "height": "14px",
  },
  s33: {
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
  s34: {
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "overflowWrap": "break-word",
  },
  s35: {
    "color": "var(--muted-foreground)",
    "marginInlineStart": "4px",
    "fontFamily": "var(--font-sans)",
  },
  s36: {
    "color": "var(--muted-foreground)",
    "display": "flex",
    "flexShrink": 0,
    "gap": "4px",
  },
  s37: {
    "transitionDuration": "200ms",
    "transitionTimingFunction": "cubic-bezier(0, 0, 0.2, 1)",
  },
  s38: {
    "transitionDuration": "150ms",
  },
  s39: {
    "display": "contents",
  },
  s40: {
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
  s41: {
    "marginBottom": "24px",
    "alignSelf": "center",
    "borderRadius": "999px",
  },
  s42: {
    "marginBottom": "24px",
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "textAlign": "center",
  },
  s43: {
    "fontSize": "24px",
    "lineHeight": "32px",
    "fontWeight": 500,
    "letterSpacing": "-0.025em",
    "transitionDuration": "200ms",
  },
  s44: {
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
    "gap": "8px",
    "paddingLeft": "16px",
    "paddingRight": "16px",
  },
  s45: {
    "width": "100%",
    "overflowX": "auto",
  },
  s46: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "width": "max-content",
    "alignItems": "center",
    "gap": "8px",
  },
  s47: {
    "backgroundColor": "var(--muted)",
  },
  s48: {
    "width": "100%",
    "overflowX": "auto",
    "transitionDuration": "200ms",
  },
  s49: {
    "marginLeft": "auto",
    "marginRight": "auto",
    "display": "flex",
    "width": "max-content",
    "alignItems": "center",
    "gap": "8px",
  },
  s50: {
    "position": "relative",
    "display": "flex",
    "width": "100%",
    "flexDirection": "column",
  },
  s51: {
    "position": "relative",
    "display": "flex",
    "alignItems": "center",
    "justifyContent": "space-between",
  },
  s52: {
    "display": "flex",
    "minWidth": "0px",
    "flexGrow": 1,
    "flexShrink": 1,
    "flexBasis": "0%",
    "alignItems": "center",
    "gap": "4px",
  },
  s53: {
    "display": "flex",
    "flexShrink": 0,
    "alignItems": "center",
    "gap": "6px",
  },
  s54: {
    "width": "16px",
    "height": "16px",
  },
  s55: {
    "width": "14px",
    "height": "14px",
    "fill": "currentColor",
  },
  s56: {
    "width": "16px",
    "height": "16px",
  },
  s57: {
    "width": "28px",
    "height": "28px",
    "borderRadius": "999px",
  },
  s58: {
    "width": "14px",
    "height": "14px",
    "fill": "currentColor",
  },
  s59: {
    "borderColor": "var(--border)",
    "backgroundColor": {
      "default": "light-dark(color-mix(in oklab, var(--destructive) 10%, transparent), color-mix(in oklab, var(--destructive) 5%, transparent))",
    },
    "color": {
      "default": "light-dark(var(--destructive), #fecaca)",
    },
    "marginTop": "8px",
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "padding": "12px",
    "fontSize": "14px",
    "lineHeight": "20px",
  },
  s60: {
    "overflow": "hidden",
    "display": "-webkit-box",
    "WebkitLineClamp": 2,
    "WebkitBoxOrient": "vertical",
  },
  s61: {
    "position": "relative",
    "marginBottom": "calc(30px * -1)",
    "paddingBottom": "30px",
    "transitionDuration": "150ms",
    "containIntrinsicSize": "auto 200px",
    "contentVisibility": "auto",
  },
  s62: {
    "color": "var(--foreground)",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "lineHeight": "1.625",
    "overflowWrap": "break-word",
  },
  s63: {
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s64: {
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s65: {
    "fontFamily": "var(--font-sans)",
  },
  s66: {
    "marginInlineStart": "8px",
    "display": "flex",
    "alignItems": "center",
  },
  s67: {
    "color": "var(--muted-foreground)",
    "gridColumnStart": "3",
    "gridRowStart": "2",
    "marginInlineStart": "calc(4px * -1)",
    "display": "flex",
    "gap": "4px",
    "transitionDuration": "200ms",
  },
  s68: {
    "transitionDuration": "200ms",
    "transitionTimingFunction": "cubic-bezier(0, 0, 0.2, 1)",
  },
  s69: {
    "transitionDuration": "150ms",
  },
  s70: {
    "backgroundColor": "var(--popover)",
    "color": "var(--popover-foreground)",
    "zIndex": 50,
    "minWidth": "8rem",
    "overflow": "hidden",
    "borderRadius": "var(--radius-xl)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "borderColor": "var(--border)",
    "padding": "6px",
  },
  s71: {
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
  s72: {
    "width": "16px",
    "height": "16px",
  },
  s73: {
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s74: {
    "paddingTop": "4px",
    "paddingBottom": "4px",
  },
  s75: {
    "display": "grid",
    "gridTemplateColumns": "minmax(72px,1fr) auto",
    "alignContent": "flex-start",
    "rowGap": "8px",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "transitionDuration": "150ms",
    "containIntrinsicSize": "auto 200px",
    "contentVisibility": "auto",
    ":not(#\\#) :where(>*)": {
      "gridColumnStart": "2",
    },
  },
  s76: {
    "position": "relative",
    "gridColumnStart": "2",
    "minWidth": "0px",
  },
  s77: {
    "backgroundColor": "var(--muted)",
    "color": "var(--foreground)",
    "paddingLeft": "16px",
    "paddingRight": "16px",
    "paddingTop": "8px",
    "paddingBottom": "8px",
    "overflowWrap": "break-word",
    "display": {
      ":empty": "none",
    },
  },
  s78: {
    "position": "absolute",
    "insetInlineStart": "0px",
    "paddingInlineEnd": "8px",
  },
  s79: {
    "gridColumn": "1 / -1",
    "gridColumnStart": "1",
    "marginInlineEnd": "calc(4px * -1)",
    "justifyContent": "flex-end",
  },
  s80: {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "flex-end",
  },
  s81: {
    "display": "flex",
    "flexDirection": "column",
    "paddingLeft": "8px",
    "paddingRight": "8px",
    "containIntrinsicSize": "auto 200px",
    "contentVisibility": "auto",
  },
  s82: {
    "marginLeft": "10px",
    "marginRight": "10px",
    "marginBottom": "10px",
    "display": "flex",
    "alignItems": "center",
    "gap": "6px",
    "alignSelf": "flex-end",
  },
  s83: {
    "height": "32px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s84: {
    "height": "32px",
    "paddingLeft": "12px",
    "paddingRight": "12px",
  },
  s85: {
    "color": "var(--muted-foreground)",
    "marginInlineStart": "calc(8px * -1)",
    "marginInlineEnd": "8px",
    "display": "inline-flex",
    "alignItems": "center",
    "fontSize": "12px",
    "lineHeight": "16px",
  },
  s86: {
    "fontWeight": 500,
  },
  q87: {
    "containerType": "inline-size",
  },
  q88: {
    "width": "40%",
  },
  q89: {
    "width": "91.67%",
  },
  q90: {
    "width": "80%",
  },
  q91: {
    "width": "60%",
  },
  q92: {
    "width": "33.33%",
  },
  q93: {
    "width": "83.33%",
  },
  q94: {
    "width": "66.67%",
  },
  q95: {
    "scrollPaddingBottom": "320px",
    "overflowY": "scroll",
  },
  q96: {
    "maxWidth": "var(--thread-max-width)",
  },
  q97: {
    "borderTopLeftRadius": "var(--composer-radius)",
    "borderTopRightRadius": "var(--composer-radius)",
  },
  q98: {
    "borderColor": {
      "default": "color-mix(in oklab, var(--foreground) 10%, transparent)",
      ":hover": "color-mix(in oklab, var(--foreground) 25%, transparent)",
    },
    "backgroundColor": {
      ":hover": "color-mix(in oklab, var(--foreground) 3%, transparent)",
    },
    "borderRadius": "var(--radius-md)",
    "borderWidth": 1,
    "borderStyle": "solid",
    "paddingTop": "4px",
    "paddingBottom": "4px",
    "paddingLeft": "10px",
    "paddingRight": "10px",
    "fontSize": "14px",
    "lineHeight": "20px",
    "whiteSpace": "nowrap",
    "transitionProperty": "color, background-color, border-color",
    "transitionDuration": "150ms",
    "transitionTimingFunction": "cubic-bezier(0.4, 0, 1, 1)",
    ":not(#\\#) svg": {
      "width": "16px",
      "height": "16px",
    },
  },
  q99: {
    "scrollbarWidth": "none",
    "::-webkit-scrollbar": {
      "display": "none",
    },
  },
  q100: {
    "scrollbarWidth": "none",
    "::-webkit-scrollbar": {
      "display": "none",
    },
  },
  q101: {
    "borderRadius": "var(--composer-radius)",
  },
  q102: {
    "top": "50%",
    "transform": "translateX(-100%) translateY(-50%)",
    ":is(.peer:empty ~ &)": {
      "display": "none",
    },
    ":is([dir=rtl] &)": {
      "transform": "translateX(100%) translateY(-50%)",
    },
  },
});
function sx(...parts: readonly (false | null | undefined | object)[]): string {
  return (stylex.props as (...args: readonly (false | null | undefined | object)[]) => { className?: string })(...parts).className ?? "";
}

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

const reasoningDuration = (timing: ThreadGroupPart["timing"]) =>
  timing?.completedAt === undefined
    ? undefined
    : Math.round((timing.completedAt - timing.startedAt) / 1000);

/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the remaining slots override how the
 * assistant message renders tool calls and part groups. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`. When `TaskGroup` is set, tool calls that carry a nested
 * conversation and have no registered UI render through it instead of the
 * tool group; without it they render like any other tool call.
 */
export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  UserMessage?: ComponentType | undefined;
  Text?: TextMessagePartComponent | undefined;
  UserText?: TextMessagePartComponent | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  ToolGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
  ReasoningGroup?:
    | ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>>
    | undefined;
  TaskGroup?: ComponentType<{ group: ThreadGroupPart }> | undefined;
};

const messageGroupBy = groupPartByType({
  reasoning: ["group-chainOfThought", "group-reasoning"],
  "tool-call": ["group-chainOfThought", "group-tool"],
  "standalone-tool-call": [],
});

type ThreadGroupKey =
  | "group-chainOfThought"
  | "group-reasoning"
  | "group-tool"
  | "group-task";

const TASK_GROUP_PATH: readonly ThreadGroupKey[] = [
  "group-chainOfThought",
  "group-task",
];

const taskAwareGroupBy = (
  part: Parameters<typeof messageGroupBy>[0],
  context?: Parameters<typeof messageGroupBy>[1],
): readonly ThreadGroupKey[] => {
  const path = messageGroupBy(part, context);
  return part.type === "tool-call" &&
    part.messages !== undefined &&
    path.length > 0 &&
    !context?.toolUIs?.[part.toolName]?.length
    ? TASK_GROUP_PATH
    : path;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  autoFocus?: boolean | undefined;
  // Burf's own parts of the page. Elements, not components: a view passes
  // what it already holds the state for, and they keep their place (and a
  // field its keyboard) from one draw to the next.
  // messageList keeps virtualized history; after comes below messages,
  // above the stock composer. Its controls all share one action row.
  messageList?: ReactNode;
  welcome?: ReactNode | undefined;
  after?: ReactNode | undefined;
  // Who is speaking, for someone who cannot see which side a message is on:
  // each message is an article named for its speaker.
  speakers?: { user: string; assistant: string } | undefined;
  // false for a thread whose whole history is already here: no "load
  // earlier" control, and no live region of its own to say it is loading.
  loadEarlier?: boolean | undefined;
  composerInput?: ComposerPrimitive.Input.Props & { "data-autofocus"?: boolean; ref?: React.Ref<HTMLTextAreaElement> };
  composerControls?: ReactNode;
  composerTriggers?: ReactNode;
  beforeComposer?: ReactNode;
  // A thread that is only read (a saved conversation) has no composer.
  readOnly?: boolean | undefined;
};

type ThreadSlots = Pick<
  ThreadProps,
  "messageList" | "welcome" | "after" | "speakers" | "loadEarlier" | "composerInput" | "composerControls" | "composerTriggers" | "beforeComposer" | "readOnly"
>;
const ThreadSlotsContext = createContext<ThreadSlots>({});

const EMPTY_COMPONENTS: ThreadComponents = {};

const ThreadComponentsContext =
  createContext<ThreadComponents>(EMPTY_COMPONENTS);

// Startup exposes a loading placeholder thread; treat it as a new chat so
// the composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  (!s.thread.isLoading || s.threads.isLoading);

// A switched thread that is still fetching its history: skeleton, not welcome.
const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

const ThreadHistorySkeleton: FC = () => (
  <div
    data-slot="aui_thread-history-skeleton"
    role="status"
    className={[sx(paint.s0), "burf-fade"].filter(Boolean).join(" ")}
  >
    <span className={sx(paint.s1)}>Loading conversation</span>
    <div className={[sx(paint.s2), sx(paint.q88)].filter(Boolean).join(" ")}><Skeleton  shape="lg" /></div>
    <div className={sx(paint.s3)}>
      <div className={[sx(paint.s4), sx(paint.q89)].filter(Boolean).join(" ")}><Skeleton  /></div>
      <div className={[sx(paint.s5), sx(paint.q90)].filter(Boolean).join(" ")}><Skeleton  /></div>
      <div className={[sx(paint.s6), sx(paint.q91)].filter(Boolean).join(" ")}><Skeleton  /></div>
    </div>
    <div className={[sx(paint.s7), sx(paint.q92)].filter(Boolean).join(" ")}><Skeleton  shape="lg" /></div>
    <div className={sx(paint.s8)}>
      <div className={[sx(paint.s9), sx(paint.q93)].filter(Boolean).join(" ")}><Skeleton  /></div>
      <div className={[sx(paint.s10), sx(paint.q94)].filter(Boolean).join(" ")}><Skeleton  /></div>
    </div>
  </div>
);

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  autoFocus = true,
  messageList,
  welcome,
  after,
  speakers,
  loadEarlier,
  composerInput, composerControls, composerTriggers, beforeComposer, readOnly,
}) => {
  const isEmpty = useAuiState(isNewChatView);

  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadSlotsContext.Provider
        value={{ messageList, welcome, after, speakers, loadEarlier, composerInput, composerControls, composerTriggers, beforeComposer, readOnly }}
      >
        <ThreadRoot isEmpty={isEmpty} autoFocus={autoFocus} />
      </ThreadSlotsContext.Provider>
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<{ isEmpty: boolean; autoFocus: boolean }> = ({
  isEmpty,
  autoFocus,
}) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);
  const { messageList, welcome, after, loadEarlier, beforeComposer, readOnly } =
    useContext(ThreadSlotsContext);

  return (
    <ThreadPrimitive.Root
      className={[sx(paint.s11), [sx(paint.q87), "aui-root aui-thread-root"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
      style={{
        ["--thread-max-width" as string]: "var(--berth-chat-w, 44rem)",
        ["--composer-bg" as string]:
          "color-mix(in oklab, var(--color-muted) 30%, transparent)",
        ["--composer-radius" as string]: "1rem",
        ["--composer-padding" as string]: "8px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        // scroll-pb: what is scrolled or tabbed into view (an approval's
        // buttons, say) stops above the composer, which stays on top of
        // the foot of the thread.
        className={[sx(paint.s12), sx(paint.q95)].filter(Boolean).join(" ")}
      >
        <div
          className={[[sx(paint.s13), sx(paint.q96)].filter(Boolean).join(" "), isEmpty && sx(paint.s14)].filter(Boolean).join(" ")}
        >
          <AuiIf condition={isNewChatView}>
            {welcome ?? <Welcome />}
          </AuiIf>
          <AuiIf condition={isHistoryLoadingView}>
            <ThreadHistorySkeleton />
          </AuiIf>

          {loadEarlier !== false && <ThreadLoadEarlier />}

          <div
            data-slot="aui_message-group"
            className={[sx(paint.s15), after ? sx(paint.s16) : sx(paint.s17)].filter(Boolean).join(" ")}
          >
            {messageList ?? <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>}
          </div>
          {after && <div className={sx(paint.s18)}>{after}</div>}

          <ThreadPrimitive.ViewportFooter
            className={[[sx(paint.s19), "aui-thread-viewport-footer"].filter(Boolean).join(" "), !isEmpty && [sx(paint.s20), sx(paint.q97)].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
          >
            <ThreadScrollToBottom />
            <ThreadFollowupSuggestions />
            {beforeComposer}
            {!readOnly && <Composer autoFocus={autoFocus} />}
            {!readOnly &&
              <AuiIf condition={(s) => isNewChatView(s) && s.composer.isEmpty}>
                <ThreadSuggestions />
              </AuiIf>
            }
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};



const ThreadMessage: FC = () => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage, UserMessage: UserMessageComponent = UserMessage } =
    useContext(ThreadComponentsContext);
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);
  const isSpoken = useAuiState((s) => s.message.metadata.modality === "voice");

  if (isEditing) return <EditComposer />;
  if (isSpoken) return <SpokenMessage />;
  if (role === "user") return <UserMessageComponent />;
  return <AssistantMessageComponent />;
};

type VoiceRunPosition = "single" | "start" | "middle" | "end";

const useVoiceRunPosition = (): VoiceRunPosition =>
  useAuiState((s) => {
    const before =
      s.thread.messages[s.message.index - 1]?.metadata.modality === "voice";
    const after =
      s.thread.messages[s.message.index + 1]?.metadata.modality === "voice";
    if (before) return after ? "middle" : "end";
    return after ? "start" : "single";
  });

const SpokenText: TextMessagePartComponent = ({ text }) => (
  <p className={[sx(paint.s21), "aui-spoken-message-text"].filter(Boolean).join(" ")}>{text}</p>
);

const SpokenMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const position = useVoiceRunPosition();
  const isSpeaking = useAuiState(
    (s) =>
      s.message.role === "assistant" && s.message.status?.type === "running",
  );
  const opensExchange = position === "start" || position === "single";

  return (
    <MessagePrimitive.Root
      data-slot="aui_spoken-message-root"
      data-role={role}
      data-voice-run={position}
      className={[[sx(paint.s22), "aui-spoken-message"].filter(Boolean).join(" "), position === "single" && sx(paint.s23), position === "start" && sx(paint.s24), position === "middle" && sx(paint.s25), position === "end" && sx(paint.s26)].filter(Boolean).join(" ")}
    >
      {opensExchange && (
        <div
          data-slot="aui_spoken-exchange-header"
          className={sx(paint.s27)}
        >
          <PhoneIcon className={sx(paint.s28)} aria-hidden />
          <span>Voice conversation</span>
        </div>
      )}
      <div
        data-slot="aui_spoken-message-content"
        className={sx(paint.s29)}
      >
        <span className={sx(paint.s30)} aria-hidden>
          {role === "user" ? (
            <MicIcon className={sx(paint.s31)} />
          ) : (
            <AudioLinesIcon className={sx(paint.s32)} />
          )}
        </span>
        <span className={sx(paint.s33)}>
          {role === "user" ? "You said" : "Assistant said"}
        </span>
        <div className={sx(paint.s34)}>
          <MessagePrimitive.Parts components={{ Text: SpokenText }} />
          {isSpeaking && (
            <span
              data-slot="aui_spoken-message-indicator"
              role="status"
              className={[sx(paint.s35), "burf-pulse"].filter(Boolean).join(" ")}
              aria-label="Assistant is speaking"
            >
              ●
            </span>
          )}
        </div>
        <SpokenActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const SpokenActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="always"
      className={[sx(paint.s36), "aui-spoken-action-bar"].filter(Boolean).join(" ")}
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy" box={6}>
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon className={[sx(paint.s37), "burf-fade"].filter(Boolean).join(" ")} />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon className={[sx(paint.s38), "burf-fade"].filter(Boolean).join(" ")} />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
    </ActionBarPrimitive.Root>
  );
};

const FOCUSABLE_SELECTOR =
  "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1']):not([disabled])";

const nextFocusable = (start: Element) => {
  for (
    let element = start.nextElementSibling;
    element;
    element = element.nextElementSibling
  ) {
    const target = element.matches(FOCUSABLE_SELECTOR)
      ? element
      : element.querySelector(FOCUSABLE_SELECTOR);
    if (target instanceof HTMLElement) return target;
  }
  return null;
};

const ThreadLoadEarlier: FC = () => {
  const visible = useAuiState(
    (s) => s.thread.hasEarlier || s.thread.isLoadingEarlier,
  );
  const loading = useAuiState((s) => s.thread.isLoadingEarlier);
  const slotRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef<Element | null>(null);

  // The last page removes the button; a keyboard user on it continues from the
  // next control in tab order rather than from the document body.
  useLayoutEffect(() => {
    const focused = focusedRef.current;
    const slot = slotRef.current;
    if (visible || !focused || focused.isConnected || !slot) return;
    focusedRef.current = null;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    nextFocusable(slot)?.focus();
  }, [visible]);

  return (
    <div
      ref={slotRef}
      className={sx(paint.s39)}
      onFocus={(event) => {
        focusedRef.current = event.target;
      }}
    >
      <span role="status" className={sx(paint.s40)}>
        {loading ? "Loading earlier messages" : ""}
      </span>
      {visible && (
        <ThreadPrimitive.LoadEarlier asChild>
          <span className={[sx(paint.s41), "aui-thread-load-earlier"].filter(Boolean).join(" ")}><Button
            variant="ghost"
            size="sm"
            data-slot="aui_thread-load-earlier" muted>
            <span
              className={loading ? sx(shimmer) : undefined}
            >
              {loading ? "Loading earlier messages" : "Load earlier messages"}
            </span>
          </Button></span>
        </ThreadPrimitive.LoadEarlier>
      )}
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        marker="aui-thread-scroll-to-bottom"
        place="scroll"
        round
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className={[sx(paint.s42), "aui-thread-welcome-root"].filter(Boolean).join(" ")}>
      <p className={[sx(paint.s43), "aui-thread-welcome-message-inner burf-fade burf-rise"].filter(Boolean).join(" ")}>
        How can I help you today?
      </p>
    </div>
  );
};

type SuggestionGroup = {
  label: string;
  icon: ReactNode;
  options: { label: string; prompt: string }[];
};

const SUGGESTION_GROUPS: SuggestionGroup[] = [
  {
    label: "Explain",
    icon: <LightbulbIcon />,
    options: [
      { label: "this project", prompt: "Explain how this project is laid out and where its main pieces are." },
      { label: "the recent changes", prompt: "Summarize what changed in the last few commits and why." },
      { label: "a file", prompt: "Explain what this file does: " },
    ],
  },
  {
    label: "Fix",
    icon: <CodeXmlIcon />,
    options: [
      { label: "the failing tests", prompt: "Run the tests, find what fails and fix it." },
      { label: "a bug", prompt: "There is a bug: " },
      { label: "the build", prompt: "The build is failing. Find out why and fix it." },
    ],
  },
  {
    label: "Review",
    icon: <ChartColumnIcon />,
    options: [
      { label: "my changes", prompt: "Review my uncommitted changes and point out problems." },
      { label: "this branch", prompt: "Review everything on this branch against main." },
    ],
  },
  {
    label: "Write",
    icon: <PencilLineIcon />,
    options: [
      { label: "tests", prompt: "Write tests for the code changed on this branch." },
      { label: "a commit message", prompt: "Write a commit message for my staged changes." },
    ],
  },
];

const suggestionChipClass =
  [sx(paint.q98), "aui-thread-welcome-suggestion"].filter(Boolean).join(" ");

const ThreadSuggestions: FC = () => {
  const aui = useAui();
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);
  const expandedGroup = SUGGESTION_GROUPS.find(
    (group) => group.label === expandedLabel,
  );

  const sendPrompt = (prompt: string) => {
    if (aui.thread.getState().isRunning) return;
    aui.thread.append({
      content: [{ type: "text", text: prompt }],
      runConfig: aui.composer.getState().runConfig,
    });
  };

  return (
    <div className={[sx(paint.s44), "aui-thread-welcome-suggestions"].filter(Boolean).join(" ")}>
      <div className={[sx(paint.s45), sx(paint.q99)].filter(Boolean).join(" ")}>
        <div className={sx(paint.s46)}>
          {SUGGESTION_GROUPS.map((group) => (
            <span className={[suggestionChipClass, group.label === expandedLabel && sx(paint.s47)].filter(Boolean).join(" ")}><Button
              key={group.label}
              variant="ghost"
              
              onClick={() =>
                setExpandedLabel(
                  group.label === expandedLabel ? null : group.label,
                )
              }>
              {group.icon}
              {group.label}
            </Button></span>
          ))}
        </div>
      </div>
      {expandedGroup && (
        <div
          key={expandedGroup.label}
          className={[sx(paint.s48), [sx(paint.q100), "burf-fade burf-rise"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}
        >
          <div className={sx(paint.s49)}>
            {expandedGroup.options.map((option) => (
              <span className={suggestionChipClass}><Button
                key={option.label}
                variant="ghost"
                
                onClick={() => sendPrompt(option.prompt)}>
                {option.label}
              </Button></span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Composer: FC<{ autoFocus: boolean }> = ({ autoFocus }) => {
  const { composerInput, composerTriggers } = useContext(ThreadSlotsContext);
  return (
    <ComposerPrimitive.TriggerPopoverRoot>
    <ComposerPrimitive.Root data-testid="composer" className={[sx(paint.s50), "aui-composer-root"].filter(Boolean).join(" ")}>
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div
          data-slot="aui_composer-shell"
          className={chatBoxShellClass()}
        >
          <ComposerAttachments />
          <ComposerPrimitive.Input
            placeholder="Send a message..."
            className={["aui-composer-input", chatBoxInputClass()].filter(Boolean).join(" ")}
            rows={1}
            autoFocus={autoFocus}
            enterKeyHint="send"
            aria-label="Message input"
            unstable_focusOnRunStart={false}
            unstable_focusOnScrollToBottom={false}
            unstable_focusOnThreadSwitched={false}
            {...composerInput}
          />
          <ComposerAction />
        </div>
      </ComposerPrimitive.AttachmentDropzone>
      {composerTriggers}
    </ComposerPrimitive.Root>
    </ComposerPrimitive.TriggerPopoverRoot>
  );
};

const ComposerAction: FC = () => {
  const { composerControls } = useContext(ThreadSlotsContext);
  // The stop control only cancels the send while no run it could stop is going.
  const isSending = useAuiState(
    (s) =>
      s.composer.submission !== undefined &&
      !(s.thread.isRunning && s.thread.capabilities.cancel),
  );

  return (
    <div className={[sx(paint.s51), "aui-composer-action-wrapper"].filter(Boolean).join(" ")}>
      <div className={sx(paint.s52)}>
        <ComposerAddAttachment />
        {composerControls}
      </div>
      <div className={sx(paint.s53)}>
        <AuiIf condition={(s) => s.thread.capabilities.dictation}>
          <AuiIf condition={(s) => s.composer.dictation == null}>
            <ComposerPrimitive.Dictate asChild>
              <TooltipIconButton
                tooltip="Voice input"
                side="bottom"
                type="button"
                variant="ghost"
                size="icon"
                marker="aui-composer-dictate"
                box={7}
                round
                tone="muted"
                aria-label="Start voice input"
              >
                <MicIcon className={[sx(paint.s54), "aui-composer-dictate-icon"].filter(Boolean).join(" ")} />
              </TooltipIconButton>
            </ComposerPrimitive.Dictate>
          </AuiIf>
          <AuiIf condition={(s) => s.composer.dictation != null}>
            <ComposerPrimitive.StopDictation asChild>
              <TooltipIconButton
                tooltip="Stop dictation"
                side="bottom"
                type="button"
                variant="ghost"
                size="icon"
                marker="aui-composer-stop-dictation"
                box={7}
                round
                tone="destructive"
                aria-label="Stop voice input"
              >
                <SquareIcon className={[sx(paint.s55), "aui-composer-stop-dictation-icon burf-pulse"].filter(Boolean).join(" ")} />
              </TooltipIconButton>
            </ComposerPrimitive.StopDictation>
          </AuiIf>
        </AuiIf>
        <AuiIf
          condition={(s) =>
            !s.composer.canCancel ||
            (s.thread.voice !== undefined &&
              s.composer.submission === undefined)
          }
        >
          <ComposerPrimitive.Send asChild>
            <TooltipIconButton
              tooltip="Send message"
              side="bottom"
              type="button"
              variant="default"
              size="icon"
              marker="aui-composer-send"
              box={7}
              round
              shape="pill"
              aria-label="Send message"
            >
              <ArrowUpIcon className={[sx(paint.s56), "aui-composer-send-icon"].filter(Boolean).join(" ")} />
            </TooltipIconButton>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf
          condition={(s) =>
            s.composer.canCancel &&
            (s.thread.voice === undefined ||
              s.composer.submission !== undefined)
          }
        >
          <ComposerPrimitive.Cancel asChild>
            <span className={[sx(paint.s57), "aui-composer-cancel"].filter(Boolean).join(" ")}><Button
              type="button"
              variant="default"
              size="icon"
              
              aria-label={isSending ? "Cancel sending" : "Stop generating"}>
              <SquareIcon className={[sx(paint.s58), "aui-composer-cancel-icon"].filter(Boolean).join(" ")} />
            </Button></span>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className={[sx(paint.s59), "aui-message-error-root"].filter(Boolean).join(" ")}>
        <ErrorPrimitive.Message className={[sx(paint.s60), "aui-message-error-message"].filter(Boolean).join(" ")} />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

export const AssistantMessage: FC = () => {
  const {
    Text: TextComponent = MarkdownText,
    ToolFallback: ToolFallbackComponent = ToolFallback,
    ToolGroup,
    ReasoningGroup,
    TaskGroup: TaskGroupComponent,
  } = useContext(ThreadComponentsContext);
  const groupBy = TaskGroupComponent ? taskAwareGroupBy : messageGroupBy;

  const { speakers } = useContext(ThreadSlotsContext);
  const ACTION_BAR_PT = "pt-1.5";
  // Keep the action bar inside the contained root's paint box, then cancel its reserved space in flow.
  const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      role={speakers ? "article" : undefined}
      aria-label={speakers?.assistant}
      className={[sx(paint.s61), "burf-fade burf-rise"].filter(Boolean).join(" ")}
    >
      <div
        data-slot="aui_assistant-message-content"
        className={sx(paint.s62)}
      >
        <MessagePrimitive.GroupedParts groupBy={groupBy}>
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                return <div data-slot="aui_chain-of-thought">{children}</div>;
              case "group-task":
                return TaskGroupComponent ? (
                  <TaskGroupComponent group={part} />
                ) : null;
              case "group-tool":
                if (ToolGroup) {
                  return <ToolGroup group={part}>{children}</ToolGroup>;
                }
                return (
                  <ToolGroupRoot variant="ghost">
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "group-reasoning": {
                if (ReasoningGroup) {
                  return (
                    <ReasoningGroup group={part}>{children}</ReasoningGroup>
                  );
                }
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot streaming={running}>
                    <ReasoningTrigger
                      active={running}
                      duration={reasoningDuration(part.timing)}
                    />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "text":
                return <TextComponent {...part} />;
              case "reasoning":
                return <Reasoning {...part} />;
              case "tool-call":
                return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "data":
                return part.dataRendererUI;
              case "file":
                return (
                  <div data-slot="aui_assistant-message-file" className={sx(paint.s63)}>
                    <File {...part} />
                  </div>
                );
              case "image":
                return (
                  <div data-slot="aui_assistant-message-image" className={sx(paint.s64)}>
                    <Image {...part} />
                  </div>
                );
              case "indicator":
                return (
                  <span
                    data-slot="aui_assistant-message-indicator"
                    className={[sx(paint.s65), "burf-pulse"].filter(Boolean).join(" ")}
                    aria-label="Assistant is working"
                  >
                    {"●"}
                  </span>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={[sx(paint.s66), ACTION_BAR_HEIGHT].filter(Boolean).join(" ")}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className={[sx(paint.s67), "aui-assistant-action-bar-root burf-fade"].filter(Boolean).join(" ")}
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon className={[sx(paint.s68), "burf-fade"].filter(Boolean).join(" ")} />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon className={[sx(paint.s69), "burf-fade"].filter(Boolean).join(" ")} />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <AuiIf condition={(s) => s.thread.capabilities.feedback}>
        <ActionBarPrimitive.FeedbackPositive asChild>
          <TooltipIconButton tooltip="Helpful">
            <ThumbsUpIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.FeedbackPositive>
        <ActionBarPrimitive.FeedbackNegative asChild>
          <TooltipIconButton tooltip="Not helpful">
            <ThumbsDownIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.FeedbackNegative>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.capabilities.reload}>
        <ActionBarPrimitive.Reload asChild>
          <TooltipIconButton tooltip="Refresh">
            <RefreshCwIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.Reload>
      </AuiIf>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton tooltip="More">
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          className={[sx(paint.s70), "aui-action-bar-more-content burf-fade burf-rise"].filter(Boolean).join(" ")}
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className={[sx(paint.s71), "aui-action-bar-more-item"].filter(Boolean).join(" ")}>
              <DownloadIcon className={sx(paint.s72)} />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const UserFilePart: FileMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-file" className={sx(paint.s73)}>
    <File {...part} />
  </div>
);

const UserImagePart: ImageMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-image" className={sx(paint.s74)}>
    <Image {...part} />
  </div>
);

export const UserMessage: FC = () => {
  const { speakers } = useContext(ThreadSlotsContext);
  const { UserText } = useContext(ThreadComponentsContext);
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      role={speakers ? "article" : undefined}
      aria-label={speakers?.user}
      className={[sx(paint.s75), "burf-fade burf-rise auto-rows-auto"].filter(Boolean).join(" ")}
      data-role="user"
    >
      <UserMessageAttachments />

      <div className={[sx(paint.s76), "aui-user-message-content-wrapper"].filter(Boolean).join(" ")}>
        <div className={[sx(paint.s77), [sx(paint.q101), "aui-user-message-content peer"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
          <MessagePrimitive.Parts
            components={{ Text: UserText, File: UserFilePart, Image: UserImagePart }}
          />
        </div>
        <div className={[sx(paint.s78), [sx(paint.q102), "aui-user-action-bar-wrapper"].filter(Boolean).join(" ")].filter(Boolean).join(" ")}>
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className={sx(paint.s79)}
      />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className={[sx(paint.s80), "aui-user-action-bar-root"].filter(Boolean).join(" ")}
    >
      <AuiIf condition={(s) => s.thread.capabilities.edit}>
        <ActionBarPrimitive.Edit asChild>
          <TooltipIconButton tooltip="Edit" marker="aui-user-action-edit">
            <PencilIcon />
          </TooltipIconButton>
        </ActionBarPrimitive.Edit>
      </AuiIf>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className={sx(paint.s81)}
    >
      <ComposerPrimitive.Root className={["aui-edit-composer-root", chatBoxShellClass(true)].filter(Boolean).join(" ")}>
        <ComposerPrimitive.Input
          className={["aui-edit-composer-input", chatBoxInputClass(true)].filter(Boolean).join(" ")}
          autoFocus
        />
        <div className={[sx(paint.s82), "aui-edit-composer-footer"].filter(Boolean).join(" ")}>
          <ComposerPrimitive.Cancel asChild>
            <span className={sx(paint.s83)}><Button variant="ghost" size="sm">
              Cancel
            </Button></span>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <span className={sx(paint.s84)}><Button size="sm">
              Update
            </Button></span>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={[[sx(paint.s85), "aui-branch-picker-root"].filter(Boolean).join(" "), className].filter(Boolean).join(" ")}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className={[sx(paint.s86), "aui-branch-picker-state"].filter(Boolean).join(" ")}>
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
