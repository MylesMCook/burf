import { type ReactNode, useState } from "react";
import * as stylex from "@stylexjs/stylex";

import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from "@/components/ui/alert-dialog";

const styles = stylex.create({
  slot: { minWidth: 96, display: "inline-flex" },
});

interface ConfirmProps {
  title: string;
  description: ReactNode;
  confirm: string;
  onConfirm(): void | Promise<void>;
  destructive?: boolean;
}

// ConfirmDialog asks before doing something that cannot be undone. It is
// controlled, so a menu item or a button can open it.
export function ConfirmDialog({ open, onOpenChange, title, description, confirm, onConfirm, destructive }: ConfirmProps & { open: boolean; onOpenChange(open: boolean): void }) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}

// ConfirmButton is a settings-row button that confirms first.
export function ConfirmButton({ label, disabled, ...props }: ConfirmProps & { label: ReactNode; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span {...stylex.props(styles.slot)}><Button size="xs" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </Button></span>
      <ConfirmDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}
