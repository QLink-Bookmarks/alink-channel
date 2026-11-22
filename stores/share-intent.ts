import { SessionStorage } from "@/lib/session-storage";

import { create } from "zustand";

const STORAGE_KEY = "qlink-pending-share";

type PendingShare = {
  url: string;
  live?: true;
};

type ShareIntentState = {
  pending: PendingShare | null;
  hasHydrated: boolean;
  setPending: (pending: PendingShare) => void;
  clearPending: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

const useShareIntentStore = create<ShareIntentState>((set) => ({
  pending: null,
  hasHydrated: false,
  setPending: (pending) => set({ pending }),
  clearPending: () => set({ pending: null }),
  setHasHydrated: (hasHydrated) => set({ hasHydrated }),
}));

async function hydrateShareIntentStore() {
  try {
    const raw = await SessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PendingShare>;
      if (typeof parsed.url === "string") {
        useShareIntentStore.setState({ pending: { url: parsed.url } });
      }
    }
  } catch {
    // ignore corrupt storage
  }
  useShareIntentStore.setState({ hasHydrated: true });
}

let unsubPersist: (() => void) | null = null;

function startShareIntentPersistence() {
  if (unsubPersist) return;
  unsubPersist = useShareIntentStore.subscribe((state, previous) => {
    if (state.pending === previous.pending) {
      return;
    }
    if (state.pending) {
      void SessionStorage.setItem(STORAGE_KEY, JSON.stringify({ url: state.pending.url }));
    } else {
      void SessionStorage.removeItem(STORAGE_KEY);
    }
  });
}

void hydrateShareIntentStore().then(() => {
  startShareIntentPersistence();
});

export { useShareIntentStore };
export type { PendingShare, ShareIntentState };
