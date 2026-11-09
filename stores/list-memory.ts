import { isSignOutTransition } from "@/lib/session-tokens";
import { useAuthStore } from "@/stores/auth";

import { create } from "zustand";

type ListMemoryState = {
  positions: Record<string, number>;
  filters: Record<string, unknown>;
  savePosition: (memoryKey: string, offsetY: number) => void;
  saveFilter: (filterKey: string, value: unknown) => void;
  clear: () => void;
};

const useListMemoryStore = create<ListMemoryState>((set) => ({
  positions: {},
  filters: {},
  savePosition: (memoryKey, offsetY) =>
    set((state) =>
      state.positions[memoryKey] === offsetY
        ? state
        : { positions: { ...state.positions, [memoryKey]: offsetY } },
    ),
  saveFilter: (filterKey, value) =>
    set((state) => ({ filters: { ...state.filters, [filterKey]: value } })),
  clear: () => set({ positions: {}, filters: {} }),
}));

useAuthStore.subscribe((state, previous) => {
  if (isSignOutTransition(state, previous)) {
    useListMemoryStore.getState().clear();
  }
});

export { useListMemoryStore };
export type { ListMemoryState };
