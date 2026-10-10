import { TaskComposer } from "@/components/conversation/task-composer";

// Home is the empty thread. One composer starts the work. The sidebar is
// the list of conversations, so this page does not also draw a board of
// the same agents, a painting, or a second way to answer them.
export function HomeView() {
  return (
    <div data-testid="home" className="absolute inset-0 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col justify-center px-6 py-10">
        <TaskComposer autoFocus />
      </div>
    </div>
  );
}
