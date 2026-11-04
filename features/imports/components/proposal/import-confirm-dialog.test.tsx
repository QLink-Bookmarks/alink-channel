import { PortalHost } from "@rn-primitives/portal";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { ImportConfirmDialog, getStartErrorKind } from "./import-confirm-dialog";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

const NOTHING = "이미 모두 저장된 링크라 새로 가져올 링크가 없어요";

function serverError(code: string, status: number) {
  return {
    isAxiosError: true,
    response: { status, data: { success: false, data: null, error: { code, message: "x" } } },
  };
}

function renderDialog(onStart: () => Promise<void>) {
  const onCancel = jest.fn();
  render(
    <>
      <ImportConfirmDialog
        folderCount={0}
        linkCount={2}
        open
        onCancel={onCancel}
        onPendingChange={jest.fn()}
        onStart={onStart}
      />
      <PortalHost />
    </>,
  );
  return { onCancel };
}

describe("getStartErrorKind", () => {
  it("maps IMPORT_422_0003 to nothing-to-import and anything else to retry", () => {
    expect(getStartErrorKind(serverError("IMPORT_422_0003", 422))).toBe("nothing-to-import");
    expect(getStartErrorKind(serverError("IMPORT_422_0002", 422))).toBe("retry");
    expect(getStartErrorKind(serverError("COM_500_0001", 500))).toBe("retry");
    expect(getStartErrorKind(new Error("Network Error"))).toBe("retry");
  });
});

describe("ImportConfirmDialog", () => {
  it("on nothing to import shows the message, blocks 시작 without 다시 시도, and 취소 still closes", async () => {
    const onStart = jest.fn(() => Promise.reject(serverError("IMPORT_422_0003", 422)));
    const { onCancel } = renderDialog(onStart);

    await act(async () => {
      fireEvent.press(screen.getByText("시작"));
    });

    expect(screen.getByText(NOTHING)).toBeTruthy();
    expect(screen.queryByText("다시 시도")).toBeNull();
    expect(screen.queryByText("잠시 후 다시 시도해 주세요.")).toBeNull();
    expect(screen.getByRole("button", { name: "시작" }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(onStart).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText("취소"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("on other errors keeps 다시 시도, which starts again", async () => {
    const onStart = jest.fn(() => Promise.reject(serverError("COM_500_0001", 500)));
    renderDialog(onStart);

    await act(async () => {
      fireEvent.press(screen.getByText("시작"));
    });
    expect(screen.getByText("잠시 후 다시 시도해 주세요.")).toBeTruthy();
    expect(screen.queryByText(NOTHING)).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText("다시 시도"));
    });
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});
