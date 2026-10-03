import { create } from "zustand";

import { Dialog, DialogPopup } from "@/components/ui/dialog";
import { toastManager } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { AddBoxFlow } from "@/views/onboarding/add-box-flow";
import { prefetchTailnets } from "@/views/onboarding/tailnet";

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
      <DialogPopup className="sm:max-w-xl" anchored>
        {open && (
          <AddBoxFlow
            variant="dialog"
            intro={{ title: "Add a box", description: "Any VPS or dev machine. Agents and dev servers run there; this computer only watches." }}
            onDone={(box) => {
              close();
              toastManager.add({ title: `${box} is ready`, description: "Paired and online. Add a repo on it to start working there.", type: "success" });
            }}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}
