import { toastManager } from "@/components/ui/toast";
import { boxApi } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";

export { TITLE_MAX, titleOf } from "@/lib/derive";

// A session is named after its work: the box keeps a short title, the first
// line of the prompt it started with (or the first one it was sent), and
// the app shows it wherever the session is named (lib/derive sessionName).

// renameSession names a session's work on its box; "" clears the title, so
// the app falls back to the agent's name. The box says session.renamed and
// the lists refresh; this refreshes at once as well.
export async function renameSession(box: string, session: string, title: string): Promise<boolean> {
  const client = useStore.getState().client;
  if (!client) return false;
  try {
    await boxApi.renameSession(client, box, session, title.trim());
    await useStore.getState().refreshBox(box, ["sessions"]);
    return true;
  } catch (err) {
    toastManager.add({ type: "error", title: "Couldn't rename it", description: errorMessage(err) });
    return false;
  }
}
