import { folderChat } from "@/lib/chat-target";
import { openRemoteChat, remoteChatApi } from "@/lib/remote-chat";
import { useStore } from "@/lib/store";
import { selectWorktree, useWorkspaces, wsKey, type WorktreeRef } from "@/lib/workspaces";

let generation = 0;

// selectFolder shows a worktree, then opens its newest live daemon chat.
// No chat, or a list that fails, leaves the launcher. Transcript files are not read.
export function selectFolder(ref: WorktreeRef) {
  const ticket = ++generation;
  selectWorktree(ref);
  const client = useStore.getState().client;
  if (!client) return;
  const caps = useStore.getState().boxes[ref.box]?.info?.capabilities;
  if (!caps?.some((c) => c === "chat.codex" || c === "chat.claude")) return;
  void remoteChatApi.list(client, ref.box).then(
    (result) => {
      if (ticket !== generation) return;
      if (useWorkspaces.getState().current !== wsKey(ref.box, ref.path)) return;
      const chat = folderChat(result.chats ?? [], ref.path);
      if (!chat) return;
      openRemoteChat(ref.box, chat, ref);
    },
    () => {
      // The launcher stays.
    },
  );
}
