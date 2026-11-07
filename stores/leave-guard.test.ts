import { renderHook } from "@testing-library/react-native";

import { type LeaveGuard, hasLeaveGuard, requestLeave, useLeaveGuard } from "./leave-guard";

describe("leave guard", () => {
  it("leaves at once when nothing holds unsaved edits", () => {
    const leave = jest.fn();
    requestLeave(leave);
    expect(leave).toHaveBeenCalledTimes(1);
    expect(hasLeaveGuard()).toBe(false);
  });

  it("hands the leave to the guard while it is held, and lets go on unmount", () => {
    const guard = jest.fn<void, Parameters<LeaveGuard>>();
    const { unmount } = renderHook(() => useLeaveGuard(guard));
    const leave = jest.fn();

    requestLeave(leave);
    expect(leave).not.toHaveBeenCalled();
    expect(guard).toHaveBeenCalledWith(leave);

    unmount();
    expect(hasLeaveGuard()).toBe(false);
  });

  it("does not clear a newer guard when an older one lets go", () => {
    const older = jest.fn<void, Parameters<LeaveGuard>>();
    const newer = jest.fn<void, Parameters<LeaveGuard>>();
    const first = renderHook(() => useLeaveGuard(older));
    const second = renderHook(() => useLeaveGuard(newer));

    first.unmount();
    requestLeave(jest.fn());
    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).not.toHaveBeenCalled();

    second.unmount();
    expect(hasLeaveGuard()).toBe(false);
  });

  it("releases the guard when it turns null", () => {
    const guard = jest.fn<void, Parameters<LeaveGuard>>();
    const { rerender, unmount } = renderHook(
      ({ held }: { held: boolean }) => useLeaveGuard(held ? guard : null),
      { initialProps: { held: true } },
    );
    expect(hasLeaveGuard()).toBe(true);
    rerender({ held: false });
    expect(hasLeaveGuard()).toBe(false);
    unmount();
  });
});
