import { BroadcastDialog } from "@/components/prompts/broadcast-dialog";
import { PromptPicker } from "@/components/prompts/prompt-picker";

// PromptDialogs are the saved-prompt picker and the broadcast dialog, opened
// from anywhere with openPromptPicker and openBroadcast (lib/prompts).
export function PromptDialogs() {
  return (
    <>
      <PromptPicker />
      <BroadcastDialog />
    </>
  );
}
