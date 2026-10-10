import * as stylex from "@stylexjs/stylex";
import { useLayoutEffect, useRef } from "react";

import { TaskComposer } from "@/components/conversation/task-composer";
import { color } from "@/styles/tokens.stylex";
import { HomeGrid } from "@/views/home/widgets/grid";

// Home is the workspace before a worktree is open. Lists that have rows
// sit above the composer. The composer stays at the foot, where a chat's
// composer sits.
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
  },
  scroll: {
    minHeight: 0,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
    overflowY: "auto",
  },
  composer: {
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
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 8,
    paddingBottom: 16,
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
      <div {...stylex.props(styles.scroll)}>
        <div {...stylex.props(styles.grid)}>
          <HomeGrid />
        </div>
      </div>
      <div ref={composer} {...stylex.props(styles.composer)}>
        <TaskComposer autoFocus />
      </div>
    </div>
  );
}
