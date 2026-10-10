import { TaskComposer } from "@/components/conversation/task-composer";
import { HomeGrid } from "@/views/home/widgets/grid";

// HomeView is the workspace before any worktree is open: one composer to
// start work, then the person's own grid of widgets.
export function HomeView() {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-background">
      <div className="relative min-h-full">
        <div className="relative mx-auto flex w-full max-w-[640px] flex-col items-center px-6 pt-[clamp(48px,16vh,160px)] pb-10">
          <TaskComposer autoFocus />
        </div>
        <div className="relative mx-auto w-full max-w-[1180px] px-6 pb-12">
          <HomeGrid />
        </div>
      </div>
    </div>
  );
}
