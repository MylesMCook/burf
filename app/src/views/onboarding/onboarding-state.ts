import { create } from "zustand";

import { useStore } from "@/lib/store";

// Onboarding fills the main area while there are no boxes, and stays until
// it is finished, even once the first box is paired: adding a repo and
// starting an agent come after. Settings → Developer can bring it back.

const FORCE_KEY = "berth.onboarding.show";

function forcedAtStart(): boolean {
  try {
    return localStorage.getItem(FORCE_KEY) === "1";
  } catch {
    return false;
  }
}

const useOnboarding = create<{ forced: boolean; inProgress: boolean }>()(() => ({ forced: forcedAtStart(), inProgress: false }));

// useOnboardingActive reports whether the onboarding should be on screen.
export function useOnboardingActive(): boolean {
  const { forced, inProgress } = useOnboarding();
  const noBoxes = useStore((s) => !!s.status && s.status.boxes.length === 0);
  return forced || inProgress || noBoxes;
}

export function markOnboardingStarted() {
  if (!useOnboarding.getState().inProgress) useOnboarding.setState({ inProgress: true });
}

export function finishOnboarding() {
  try {
    localStorage.removeItem(FORCE_KEY);
  } catch {
    // Nothing remembered it.
  }
  useOnboarding.setState({ forced: false, inProgress: false });
}

// showOnboardingAgain brings the onboarding back, now and after a reload,
// until it is finished.
export function showOnboardingAgain() {
  try {
    localStorage.setItem(FORCE_KEY, "1");
  } catch {
    // It still shows for this run.
  }
  useOnboarding.setState({ forced: true });
}
