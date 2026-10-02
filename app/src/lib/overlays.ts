// OVERLAYS matches what keeps the keyboard over any pane: open dialogs,
// menus, listboxes and popovers. A pane takes focus only when none is open.
export const OVERLAYS = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-slot=popover-popup], [data-berth-overlay]";

export function overlayOpen(): boolean {
  return !!document.querySelector(OVERLAYS);
}
