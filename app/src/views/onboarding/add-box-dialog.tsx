import { useState } from "react";
import { create } from "zustand";

import { Dialog, DialogPopup } from "@/components/ui/dialog";
import { toastManager } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { AddBoxFlow } from "@/views/onboarding/add-box-flow";
import { prefetchTailnets } from "@/views/onboarding/tailnet";
import { InspectSshDialog, useInspectSsh } from "@/views/settings/inspect-ssh";

const useAddBox = create<{ open: boolean }>()(() => ({ open: false }));

// openAddBox shows the add-a-box flow from anywhere: Settings, the sidebar,
// the command palette.
export function openAddBox() {
  prefetchTailnets(useStore.getState().client);
  useAddBox.setState({ open: true });
}

export function AddBoxDialog() {
  const open = useAddBox((s) => s.open);
  const close = () => useAddBox.setState({ open: false });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {/* Anchored at the top: steps differ in height, and a centred dialog
          would move its title with each one. */}
      <DialogPopup anchored width="xl">{open && <AddComputer onClose={close} />}</DialogPopup>
    </Dialog>
  );
}

// AddComputer is the dialog while it is open: pairing a computer that hosts
// projects and agents, and, as a step of its own, inspecting one over SSH.
// That step is a dialog over this one, so leaving it comes back to where the
// person was, and saving in it ends both.
function AddComputer({ onClose }: { onClose(): void }) {
  const inspect = useInspectSsh();
  const [inspecting, setInspecting] = useState(false);
  return (
    <>
      <AddBoxFlow
        variant="dialog"
        intro={{
          title: "Add computer",
          description: "Pair a VPS or dev machine to host projects: agents and dev servers run there. Chats on this computer need no pairing. To only see what runs on a machine, use Inspect over SSH below.",
        }}
        inspect={{
          onOpen: () => setInspecting(true),
          disabled: !inspect.ready,
          reason: inspect.state === "missing" ? "This Burf agent is older than machine inventory. Update Burf on this computer first." : undefined,
        }}
        onDone={(box) => {
          onClose();
          toastManager.add({ title: `${box} is ready`, description: "Paired and online. Add a repo on it to start working there.", type: "success" });
        }}
      />
      <InspectSshDialog open={inspecting} onClose={() => setInspecting(false)} onSaved={onClose} />
    </>
  );
}
