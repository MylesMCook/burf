import { toastManager } from "@/components/ui/toast";
import { errorMessage } from "@/lib/format";
import { useStore } from "@/lib/store";

// Agents report needs-you, working and done through hooks in their own
// settings on the box. berthd install puts them there for the agent CLIs it
// finds; one installed on the box since has none. The first time the app
// starts such an agent on a box, it offers to install them (GET and POST
// integrations on the box API, as `berthd integrations install` does).

interface IntegrationTool {
  id: string;
  name: string;
  command: string;
  present: boolean;
  hooked: boolean;
}

interface IntegrationsReport {
  tools?: IntegrationTool[];
  output?: string;
}

// The commands berth has hooks for, by the tool they install for.
const TOOLS: Record<string, string> = { claude: "claude", codex: "codex", "cursor-agent": "cursor", cursor: "cursor" };

// hookToolFor is the tool an agent preset ID or command line needs hooks for.
export function hookToolFor(agentOrCommand: string): string | undefined {
  const word = agentOrCommand.trim().split(/\s+/)[0]?.split("/").pop() ?? "";
  return TOOLS[word];
}

// Asked about once per box and tool while the app runs.
const asked = new Set<string>();

// offerAgentHooks checks the box once and, when the agent's hooks are not
// installed there, offers to install them. Boxes whose berthd predates the
// integrations API are left alone.
export async function offerAgentHooks(box: string, agentOrCommand: string) {
  const tool = hookToolFor(agentOrCommand);
  const client = useStore.getState().client;
  if (!tool || !client || asked.has(`${box}:${tool}`)) return;
  asked.add(`${box}:${tool}`);
  let report: IntegrationsReport;
  try {
    report = await client.box<IntegrationsReport>(box, "GET", "integrations");
  } catch {
    return;
  }
  const t = report?.tools?.find((x) => x.id === tool);
  if (!t || t.hooked) return;
  const id = toastManager.add({
    title: `Berth can't see when ${t.name} needs you`,
    description: `Its hooks aren't installed on ${box}, so its agents show no working, done or needs-you state.`,
    type: "warning",
    // Stays until answered: 0 turns off the timer.
    timeout: 0,
    actionProps: {
      children: `Install ${t.name}'s hooks on ${box}`,
      onClick: () => {
        toastManager.close(id);
        void installHooks(box, t);
      },
    },
  });
}

async function installHooks(box: string, t: IntegrationTool) {
  const client = useStore.getState().client;
  if (!client) return;
  try {
    await client.box<IntegrationsReport>(box, "POST", "integrations/install", { tool: t.id });
    toastManager.add({ title: `Installed ${t.name}'s hooks on ${box}`, description: `${t.name} agents you start from now on show when they're working, done or need you.`, type: "success" });
  } catch (err) {
    toastManager.add({ title: `Couldn't install ${t.name}'s hooks on ${box}`, description: `${errorMessage(err)}. On the box: berthd integrations install ${t.id}`, type: "error" });
  }
}
