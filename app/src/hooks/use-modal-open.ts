import { useSyncExternalStore } from "react";

// useModalOpen says whether a dialog or sheet is open. Their popups are
// portalled straight into <body>, so watching its children is enough.
const MODALS = '[data-slot="dialog-popup"], [data-slot="alert-dialog-popup"], [data-slot="sheet-popup"]';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true });
  return () => observer.disconnect();
}

const snapshot = () => document.querySelector(MODALS) !== null;

export function useModalOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
