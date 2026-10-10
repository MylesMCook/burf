import * as stylex from "@stylexjs/stylex";

import { TaskComposer } from "@/components/conversation/task-composer";
import { color } from "@/styles/tokens.stylex";
import { HomeGrid } from "@/views/home/widgets/grid";

// Home is the workspace before a worktree is open: one composer, then the
// person's own grid. The composer stays where it already sits.
const styles = stylex.create({
  page: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflowY: "auto",
    backgroundColor: color.background,
  },
  column: {
    position: "relative",
    minHeight: "100%",
  },
  composer: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    maxWidth: 640,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: "clamp(48px, 16vh, 160px)",
    paddingBottom: 40,
  },
  grid: {
    position: "relative",
    width: "100%",
    maxWidth: 1180,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: 24,
    paddingRight: 24,
    paddingBottom: 48,
  },
});

export function HomeView() {
  return (
    <div {...stylex.props(styles.page)}>
      <div {...stylex.props(styles.column)}>
        <div {...stylex.props(styles.composer)}>
          <TaskComposer autoFocus />
        </div>
        <div {...stylex.props(styles.grid)}>
          <HomeGrid />
        </div>
      </div>
    </div>
  );
}
