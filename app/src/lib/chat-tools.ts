// A structured chat's own Burf tools ask the chat's person before one acts
// outside the provider's sandbox (internal/box/chattools.go). The approval's
// detail is the tool's name, then what it would do: here it becomes a
// question in the person's words, with the rest shown as it is.

const ASKS: Record<string, string> = {
  berth_exec: "Run this command outside the sandbox?",
  berth_task_new: "Start an agent in a new worktree?",
  berth_send: "Send this to another agent?",
  berth_run_start: "Start this run?",
  berth_run_cancel: "Cancel this run?",
  berth_attempts: "Try this task several ways, an agent each?",
};

export function toolAsk(detail: string): { tool: string; question: string; what: string } {
  const [tool, ...rest] = detail.split("\n");
  return { tool, question: ASKS[tool] ?? `Allow Burf to use ${tool}?`, what: rest.join("\n") };
}
