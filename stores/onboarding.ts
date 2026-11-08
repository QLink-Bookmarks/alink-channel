import { SessionStorage } from "@/lib/session-storage";

import { create } from "zustand";

const STORAGE_KEY = "qlink-onboarding";
// Bumped when the slides change enough that everyone should see them once more
// (2: the 2.0.0 slides — Ask & Access, the redesigned share sheet). A completion
// stored by an older version no longer counts, so the next launch shows onboarding again.
const ONBOARDING_VERSION = 2;

type OnboardingState = {
  completed: boolean;
  hasHydrated: boolean;
  complete: () => void;
  reset: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

type PersistedOnboarding = {
  completed: boolean;
  version: number;
};

/** True when a stored completion is for the current slides. */
function isCompletionCurrent(raw: string | null): boolean {
  if (!raw) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedOnboarding>;
    return parsed.completed === true && (parsed.version ?? 1) >= ONBOARDING_VERSION;
  } catch {
    return false;
  }
}

const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: false,
  hasHydrated: false,
  complete: () => set({ completed: true }),
  reset: () => set({ completed: false }),
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
}));

async function hydrateOnboardingStore() {
  try {
    const raw = await SessionStorage.getItem(STORAGE_KEY);
    if (isCompletionCurrent(raw)) {
      useOnboardingStore.setState({ completed: true });
    }
  } catch {
    // ignore corrupt storage
  }
  useOnboardingStore.setState({ hasHydrated: true });
}

let unsubPersist: (() => void) | null = null;

function startOnboardingPersistence() {
  if (unsubPersist) return;
  unsubPersist = useOnboardingStore.subscribe((state, previous) => {
    if (state.completed === previous.completed) {
      return;
    }
    if (state.completed) {
      const persisted: PersistedOnboarding = { completed: true, version: ONBOARDING_VERSION };
      void SessionStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } else {
      void SessionStorage.removeItem(STORAGE_KEY);
    }
  });
}

void hydrateOnboardingStore().then(() => {
  startOnboardingPersistence();
});

export { ONBOARDING_VERSION, isCompletionCurrent, useOnboardingStore };
