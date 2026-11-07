import * as React from "react";

import { create } from "zustand";

// A screen holding unsaved edits (the link detail's action editor) registers a guard so
// that leaving it from elsewhere — the panel scrim, the panel close, another link, back —
// asks first. The guard gets the leave and runs it once the user agrees.
type LeaveGuard = (leave: () => void) => void;

type LeaveGuardState = {
  guard: LeaveGuard | null;
  setGuard: (guard: LeaveGuard | null) => void;
};

const useLeaveGuardStore = create<LeaveGuardState>((set) => ({
  guard: null,
  setGuard: (guard) => set({ guard }),
}));

function hasLeaveGuard() {
  return useLeaveGuardStore.getState().guard != null;
}

// Leaves now, or hands the leave to the screen with unsaved edits.
function requestLeave(leave: () => void) {
  const { guard } = useLeaveGuardStore.getState();
  if (guard) {
    guard(leave);
    return;
  }
  leave();
}

// Holds `guard` while it is given; null releases it.
function useLeaveGuard(guard: LeaveGuard | null) {
  React.useEffect(() => {
    if (!guard) {
      return;
    }
    const { setGuard } = useLeaveGuardStore.getState();
    setGuard(guard);
    return () => {
      if (useLeaveGuardStore.getState().guard === guard) {
        setGuard(null);
      }
    };
  }, [guard]);
}

export { hasLeaveGuard, requestLeave, useLeaveGuard };
export type { LeaveGuard };
