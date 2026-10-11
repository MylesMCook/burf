import * as stylex from "@stylexjs/stylex";
import { useLayoutEffect, useRef } from "react";

import { ChatBackground } from "@/components/conversation/chat-background";
import { TaskComposer } from "@/components/conversation/task-composer";
import { color } from "@/styles/tokens.stylex";
import { HomeGrid } from "@/views/home/widgets/grid";
import { HomeMachineScope } from "@/views/home/widgets/machine-filter";
import { ViewHeader } from "@/views/view-header";

// Home is the workspace before a worktree is open. Lists that have rows
// share a feed with task entry. Only the composer surface covers the feed;
// its side margins stay open and the last widget can scroll above it.
const styles = stylex.create({
  page: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: "flex",
    flexDirection: "column",
    backgroundColor: color.background,
    isolation: "isolate",
  },
  scroll: {
    position: "absolute",
    inset: 0,
    minHeight: 0,
    overflowY: "auto",
    scrollPaddingBottom: "calc(var(--berth-home-composer-h, 200px) + 24px)",
    paddingBottom: "calc(var(--berth-home-composer-h, 200px) + 24px)",
  },
  feed: {
    position: "relative",
    minHeight: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
  },
  composer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: "none",
    display: "flex",
    justifyContent: "center",
    paddingLeft: { default: 24, "@media (max-width: 639px)": 12 },
    paddingRight: { default: 24, "@media (max-width: 639px)": 12 },
    paddingTop: 8,
    paddingBottom: 16,
  },
  entry: {
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
    width: "100%",
    maxWidth: 720,
    maxHeight: "50vh",
    overflowY: "auto",
    marginLeft: "auto",
    marginRight: "auto",
  },
  grid: {
    position: "relative",
    width: "100%",
    maxWidth: 1180,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
});

export function HomeView() {
  const composer = useRef<HTMLDivElement>(null);
  // Floating loop details stay above the task entry, including its open
  // configuration and any attachment or failure message.
  useLayoutEffect(() => {
    const el = composer.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--berth-home-composer-h", `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--berth-home-composer-h");
    };
  }, []);

  return (
    <div {...stylex.props(styles.page)}>
      <ChatBackground />
      <ViewHeader title="Home" description="Agent activity and machine readings" />
      <div data-testid="home-feed" {...stylex.props(styles.feed)}>
        <div data-testid="home-scroll" {...stylex.props(styles.scroll)}>
          <div {...stylex.props(styles.grid)}>
            <HomeMachineScope><HomeGrid /></HomeMachineScope>
          </div>
        </div>
        <div ref={composer} data-testid="home-composer-overlay" {...stylex.props(styles.composer)}>
          <div {...stylex.props(styles.entry)}><TaskComposer autoFocus /></div>
        </div>
      </div>
    </div>
  );
}
