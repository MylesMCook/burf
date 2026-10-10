import { TaskComposer } from "@/components/conversation/task-composer";

// Home is the empty thread. One composer starts the work. The sidebar is
// the list of conversations, so this page does not also draw a board of
// the same agents, a painting, or a second way to answer them.
export function HomeView() {
  return (
    <div data-testid="home" className="absolute inset-0 overflow-y-auto bg-background">
      {/* The empty thread is the space above. The composer sits where it
          will sit once a conversation starts, not in the middle of the pane. */}
      <div className="mx-auto flex min-h-full w-full max-w-[40rem] flex-col justify-end px-6 pb-[18vh]">
        <TaskComposer autoFocus />
      </div>
    </div>
  );
}
