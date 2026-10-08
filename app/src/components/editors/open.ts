import { toastManager } from "@/components/ui/toast";
import { type EditorId, openInEditor, SSHSetupNeeded } from "@/lib/editors";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";
import { openSettings } from "@/views/settings/settings-view";

// openEditor opens a worktree, or a file in it, and says what went wrong in
// a toast: most often that editors cannot reach the box over SSH yet.
export async function openEditor(req: { box: string; path?: string; location?: string; file?: string; line?: number; col?: number; editor?: EditorId }) {
  const client = useStore.getState().client;
  if (!client) return;
  try {
    const res = await openInEditor(client, req);
    if (res.note) toastManager.add({ title: "Opened in your editor", description: res.note, type: "info" });
  } catch (err) {
    if (err instanceof SSHSetupNeeded) {
      toastManager.add({
        title: "External editor needs SSH setup",
        description: `Review the SSH entry for ${req.box} before writing it. This is only for your external editor; chats in Burf do not need it.`,
        type: "warning",
        actionProps: { children: "Review setup", onClick: () => openSettings("boxes") },
      });
      return;
    }
    toastManager.add({ title: "Could not open the editor", description: errorMessage(err), type: "error" });
  }
}
