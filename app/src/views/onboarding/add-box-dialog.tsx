import { create } from "zustand";

import { Dialog, DialogDescription, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { toastManager } from "@/components/ui/toast";
import { AddBoxFlow } from "@/views/onboarding/add-box-flow";

const useAddBox = create<{ open: boolean }>()(() => ({ open: false }));

// openAddBox shows the add-a-box flow from anywhere: Settings, the sidebar,
// the command palette.
export function openAddBox() {
  useAddBox.setState({ open: true });
}

export function AddBoxDialog() {
  const open = useAddBox((s) => s.open);
  const close = () => useAddBox.setState({ open: false });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogPopup className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a box</DialogTitle>
          <DialogDescription>Any VPS or dev machine. Agents and dev servers run there; this computer only watches.</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {open && (
            <AddBoxFlow
              onDone={(box) => {
                close();
                toastManager.add({ title: `${box} is ready`, description: "Paired and online. Add a repo on it to start working there.", type: "success" });
              }}
            />
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
