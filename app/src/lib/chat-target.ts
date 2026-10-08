// chatAt is the chat "Send to agent" reaches among a box's chats: the newest in this folder that has not stopped.
export function chatAt<T extends { cwd: string; state: string; started_at: string }>(chats: T[], path: string): T | undefined {
  return chats.filter((c) => c.cwd === path && c.state !== "exited").sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
}
