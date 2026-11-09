import * as React from "react";
import { Text } from "react-native";

import { act, fireEvent, render, screen, within } from "@testing-library/react-native";

import { Sheet, SheetFooter, SheetHeader } from "./sheet";

type MockModalStatus = "unmounted" | "presented" | "closing" | "minimized" | "stuck";

const mockModal = {
  status: "unmounted" as MockModalStatus,
  deferPresent: false,
  pendingPresent: null as (() => void) | null,
  finishClose: () => {},
  dragDown: () => {},
  minimize: () => {},
  snapCount: 0,
  startDragClose: () => {},
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
    onAnimate?: (fromIndex: number, toIndex: number) => void;
    handleComponent?: () => React.ReactNode;
    backdropComponent?: (props: object) => React.ReactNode;
    footerComponent?: (props: object) => React.ReactNode;
  };
  type MockModalHandle = { present: () => void; dismiss: () => void; snapToIndex: () => void };

  const BottomSheetModal = ReactModule.forwardRef<MockModalHandle, MockModalProps>(
    function MockBottomSheetModal(
      {
        children,
        onChange,
        onDismiss,
        onAnimate,
        handleComponent,
        backdropComponent,
        footerComponent,
      },
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
      mockModal.startDragClose = () => onAnimate?.(0, -1);
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
        snapToIndex: () => {
          mockModal.snapCount += 1;
          setStatus("presented");
          firstCallbacks.current.onChange?.(0);
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
          <View testID="mock-sheet-content">{children}</View>
          {footerComponent ? (
            <View testID="mock-sheet-footer">
              {ReactModule.createElement(footerComponent as React.ComponentType, {})}
            </View>
          ) : null}
        </View>
      );
    },
  );

  return {
    // Like gorhom: with pressBehavior "none" the backdrop takes no tap of its own.
    BottomSheetBackdrop: ({
      children,
      onPress,
      pressBehavior,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      pressBehavior?: string;
    }) =>
      pressBehavior === "none" ? (
        <View accessibilityLabel="바깥">{children}</View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="바깥"
          onPress={onPress}
        />
      ),
    BottomSheetFooter: ({ children }: { children?: React.ReactNode }) => children,
    BottomSheetModal,
    BottomSheetScrollView: ({ children }: { children?: React.ReactNode }) => children,
    useBottomSheetTimingConfigs: (configs: object) => configs,
    useBottomSheetInternal: () => ({
      animatedPosition: { value: 0 },
      animatedAnimationState: { value: { status: 0 } },
    }),
    ANIMATION_STATUS: { UNDETERMINED: 0, RUNNING: 1, STOPPED: 2, INTERRUPTED: 3 },
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
  mockModal.snapCount = 0;
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

  describe("SheetHeader", () => {
    function renderWithHeader(onBack?: () => void) {
      return (
        <Sheet
          open
          onOpenChange={jest.fn()}
        >
          <SheetHeader
            title="새 링크 추가"
            onBack={onBack}
          />
        </Sheet>
      );
    }

    it("puts the title in the fixed head with 닫기, and 뒤로 only when it is given", () => {
      const onBack = jest.fn();
      const { rerender } = render(renderWithHeader());
      expect(screen.getByRole("header", { name: "새 링크 추가" })).toBeOnTheScreen();
      expect(
        within(screen.getByTestId("mock-sheet-content")).queryByText("새 링크 추가"),
      ).toBeNull();
      expect(screen.getByRole("button", { name: "닫기" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "뒤로" })).toBeNull();

      rerender(renderWithHeader(onBack));
      fireEvent.press(screen.getByRole("button", { name: "뒤로" }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  it("draws the fixed head from the first frame with fixedHeader, before a SheetHeader fills it", () => {
    render(
      <Sheet
        open
        fixedHeader
        onOpenChange={jest.fn()}
      >
        <React.Fragment />
      </Sheet>,
    );
    expect(screen.getByRole("header")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "닫기" })).toBeOnTheScreen();
  });

  describe("onCloseRequest", () => {
    function renderGuarded(onCloseRequest: () => boolean, onOpenChange: (open: boolean) => void) {
      return (
        <Sheet
          open
          onCloseRequest={onCloseRequest}
          onOpenChange={onOpenChange}
        >
          <React.Fragment />
        </Sheet>
      );
    }

    it.each(["닫기", "바깥"])("keeps the sheet open on %s when the request says no", (name) => {
      const onOpenChange = jest.fn();
      const onCloseRequest = jest.fn(() => false);
      render(renderGuarded(onCloseRequest, onOpenChange));

      fireEvent.press(
        name === "바깥"
          ? screen.getByTestId("sheet-backdrop-press")
          : screen.getByRole("button", { name }),
      );

      expect(onCloseRequest).toHaveBeenCalledTimes(1);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(mockModal.status).toBe("presented");
    });

    it("closes on the backdrop when the request says yes", () => {
      const onOpenChange = jest.fn();
      render(renderGuarded(() => true, onOpenChange));

      fireEvent.press(screen.getByTestId("sheet-backdrop-press"));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockModal.status).toBe("closing");
    });

    it("closes on 닫기 when the request says yes", () => {
      const onOpenChange = jest.fn();
      render(renderGuarded(() => true, onOpenChange));

      fireEvent.press(screen.getByRole("button", { name: "닫기" }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(mockModal.status).toBe("closing");
    });

    it("sends a dragged-down sheet back up when the request says no, and lets it close when yes", () => {
      const onOpenChange = jest.fn();
      let allow = false;
      render(renderGuarded(() => allow, onOpenChange));

      act(() => {
        mockModal.startDragClose();
      });
      expect(mockModal.snapCount).toBe(1);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(isSheetShown()).toBe(true);

      allow = true;
      act(() => {
        mockModal.startDragClose();
      });
      expect(mockModal.snapCount).toBe(1);
      dragDown();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(isSheetShown()).toBe(false);
    });
  });

  describe("SheetFooter", () => {
    function renderWithFooter(label: string | null) {
      return (
        <Sheet open>
          <Text>본문</Text>
          {label ? (
            <SheetFooter>
              <Text>{label}</Text>
            </SheetFooter>
          ) : null}
        </Sheet>
      );
    }

    it("renders its children in the fixed footer, not in the scrolling content", () => {
      render(renderWithFooter("저장"));

      expect(within(screen.getByTestId("mock-sheet-footer")).getByText("저장")).toBeOnTheScreen();
      expect(within(screen.getByTestId("mock-sheet-content")).queryByText("저장")).toBeNull();
      expect(within(screen.getByTestId("mock-sheet-content")).getByText("본문")).toBeOnTheScreen();
    });

    it("follows the content's updates and removes the footer when it unmounts", () => {
      const { rerender } = render(renderWithFooter("저장"));

      rerender(renderWithFooter("저장 중"));
      expect(
        within(screen.getByTestId("mock-sheet-footer")).getByText("저장 중"),
      ).toBeOnTheScreen();

      rerender(renderWithFooter(null));
      expect(screen.queryByTestId("mock-sheet-footer")).toBeNull();
    });

    it("keeps the footer's children mounted while the content updates them", () => {
      const mounts = jest.fn();
      function Counter({ label }: { label: string }) {
        React.useEffect(() => {
          mounts();
        }, []);
        return <Text>{label}</Text>;
      }
      function Content({ label }: { label: string }) {
        return (
          <SheetFooter>
            <Counter label={label} />
          </SheetFooter>
        );
      }
      const { rerender } = render(
        <Sheet open>
          <Content label="저장" />
        </Sheet>,
      );
      rerender(
        <Sheet open>
          <Content label="저장 중" />
        </Sheet>,
      );
      rerender(
        <Sheet open>
          <Content label="다시 저장" />
        </Sheet>,
      );

      expect(
        within(screen.getByTestId("mock-sheet-footer")).getByText("다시 저장"),
      ).toBeOnTheScreen();
      expect(mounts).toHaveBeenCalledTimes(1);
    });

    it("renders in place when it is not inside a sheet", () => {
      render(
        <SheetFooter>
          <Text>저장</Text>
        </SheetFooter>,
      );

      expect(screen.getByText("저장")).toBeOnTheScreen();
    });
  });
});
