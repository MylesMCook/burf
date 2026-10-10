import * as stylex from "@stylexjs/stylex";

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
    maxWidth: 640,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 12,
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
  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.scroll)}>
        <div {...stylex.props(styles.grid)}>
          <HomeGrid />
        </div>
      </div>
      <div {...stylex.props(styles.composer)}>
        <TaskComposer autoFocus />
      </div>
    </div>
  );
}
