import * as React from "react";

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { Sheet } from "./sheet";

type MockModalStatus = "unmounted" | "presented" | "closing" | "minimized" | "stuck";

const mockModal = {
  status: "unmounted" as MockModalStatus,
  deferPresent: false,
  pendingPresent: null as (() => void) | null,
  finishClose: () => {},
  dragDown: () => {},
  minimize: () => {},
};

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

jest.mock("@gorhom/bottom-sheet", () => {
  const ReactModule = require("react") as typeof React;
  const { Pressable, View } = require("react-native");

  type MockModalProps = {
    children?: React.ReactNode;
    onChange?: (index: number) => void;
    onDismiss?: () => void;
    handleComponent?: () => React.ReactNode;
    backdropComponent?: (props: object) => React.ReactNode;
  };
  type MockModalHandle = { present: () => void; dismiss: () => void };

  const BottomSheetModal = ReactModule.forwardRef<MockModalHandle, MockModalProps>(
    function MockBottomSheetModal(
      { children, onChange, onDismiss, handleComponent, backdropComponent },
      ref,
    ) {
      const [mounted, setMounted] = ReactModule.useState(false);
      const firstCallbacks = ReactModule.useRef({ onChange, onDismiss });
      const setStatus = (status: MockModalStatus) => {
        mockModal.status = status;
      };
      const unmount = () => {
        setStatus("unmounted");
        setMounted(false);
        firstCallbacks.current.onDismiss?.();
      };
      const finishClose = () => {
        if (mockModal.status !== "closing") {
          return;
        }
        firstCallbacks.current.onChange?.(-1);
        unmount();
      };
      mockModal.finishClose = finishClose;
      mockModal.dragDown = () => {
        setStatus("closing");
        finishClose();
      };
      mockModal.minimize = () => {
        setStatus("minimized");
        firstCallbacks.current.onChange?.(-1);
      };
      ReactModule.useImperativeHandle(ref, () => ({
        present: () => {
          const mount = () => {
            if (mockModal.status === "stuck" || mockModal.status === "closing") {
              return;
            }
            setStatus("presented");
            setMounted(true);
            firstCallbacks.current.onChange?.(0);
          };
          if (mockModal.deferPresent) {
            mockModal.pendingPresent = mount;
          } else {
            mount();
          }
        },
        dismiss: () => {
          if (mockModal.status === "unmounted") {
            setStatus("stuck");
          } else if (mockModal.status === "stuck" || mockModal.status === "minimized") {
            unmount();
          } else {
            setStatus("closing");
          }
        },
      }));
      if (!mounted) {
        return null;
      }
      return (
        <View>
          {backdropComponent?.({})}
          {handleComponent?.()}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="시트 내용"
          />
          {children}
        </View>
      );
    },
  );

  return {
    BottomSheetBackdrop: ({ onPress }: { onPress?: () => void }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="바깥"
        onPress={onPress}
      />
    ),
    BottomSheetFooter: ({ children }: { children?: React.ReactNode }) => children,
    BottomSheetModal,
    BottomSheetScrollView: ({ children }: { children?: React.ReactNode }) => children,
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

function renderSheet(open: boolean, onOpenChange: (open: boolean) => void) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
    >
      <React.Fragment />
    </Sheet>
  );
}

function isSheetShown() {
  return screen.queryByRole("button", { name: "시트 내용" }) !== null;
}

function finishCloseAnimation() {
  act(() => {
    mockModal.finishClose();
  });
}

function dragDown() {
  act(() => {
    mockModal.dragDown();
  });
}

async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

function mountPendingPresent() {
  act(() => {
    const mount = mockModal.pendingPresent;
    mockModal.pendingPresent = null;
    mount?.();
  });
}

beforeEach(() => {
  mockModal.status = "unmounted";
  mockModal.deferPresent = false;
  mockModal.pendingPresent = null;
});

describe("Sheet", () => {
  it("does not report a close back to the caller that closed it", () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(renderSheet(true, onOpenChange));
    expect(isSheetShown()).toBe(true);

    rerender(renderSheet(false, onOpenChange));
    finishCloseAnimation();

    expect(isSheetShown()).toBe(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("reports a drag-down close once, to the latest onOpenChange", () => {
    const firstOnOpenChange = jest.fn();
    const latestOnOpenChange = jest.fn();
    const { rerender } = render(renderSheet(true, firstOnOpenChange));
    rerender(renderSheet(true, latestOnOpenChange));

    dragDown();
    rerender(renderSheet(false, latestOnOpenChange));

    expect(firstOnOpenChange).not.toHaveBeenCalled();
    expect(latestOnOpenChange).toHaveBeenCalledTimes(1);
    expect(latestOnOpenChange).toHaveBeenCalledWith(false);
  });

  it.each(["닫기", "바깥"])("reports a %s press once and closes the sheet", (name) => {
    const onOpenChange = jest.fn();
    const { rerender } = render(renderSheet(true, onOpenChange));

    fireEvent.press(screen.getByRole("button", { name }));
    rerender(renderSheet(false, onOpenChange));
    finishCloseAnimation();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(isSheetShown()).toBe(false);
  });

  it("reports a close once when another sheet minimises it, then still unmounts on close", () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(renderSheet(true, onOpenChange));

    act(() => {
      mockModal.minimize();
    });
    rerender(renderSheet(false, onOpenChange));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(mockModal.status).toBe("unmounted");
  });

  it("opens again after a drag-down close the caller answered after the sheet unmounted", () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(renderSheet(true, onOpenChange));

    dragDown();
    rerender(renderSheet(false, onOpenChange));
    rerender(renderSheet(true, onOpenChange));

    expect(isSheetShown()).toBe(true);
  });

  it("opens again when the caller closes it only after the X close finished, as the unsaved-changes prompt does", () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(renderSheet(true, onOpenChange));

    fireEvent.press(screen.getByRole("button", { name: "닫기" }));
    finishCloseAnimation();
    rerender(renderSheet(false, onOpenChange));
    rerender(renderSheet(true, onOpenChange));

    expect(isSheetShown()).toBe(true);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
  });

  it("stays open when reopened while the previous close is still animating", async () => {
    const onOpenChange = jest.fn();
    const { rerender } = render(renderSheet(true, onOpenChange));

    fireEvent.press(screen.getByRole("button", { name: "닫기" }));
    rerender(renderSheet(false, onOpenChange));
    rerender(renderSheet(true, onOpenChange));
    finishCloseAnimation();
    await nextFrame();

    expect(isSheetShown()).toBe(true);
    expect(onOpenChange).toHaveBeenCalledTimes(1);

    dragDown();
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("closes cleanly when the caller closes it before the sheet finished mounting, then opens again", () => {
    mockModal.deferPresent = true;
    const onOpenChange = jest.fn();
    const { rerender } = render(renderSheet(true, onOpenChange));

    rerender(renderSheet(false, onOpenChange));
    mountPendingPresent();
    finishCloseAnimation();
    expect(isSheetShown()).toBe(false);

    rerender(renderSheet(true, onOpenChange));
    mountPendingPresent();

    expect(isSheetShown()).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
