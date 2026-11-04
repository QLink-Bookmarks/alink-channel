import { PortalHost } from "@rn-primitives/portal";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { Dialog, DialogContent, DialogTitle } from "./dialog";
import { Text } from "./text";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

function renderDialog(onOpenChange: (open: boolean) => void, hideCloseButton = false) {
  render(
    <>
      <Dialog
        open
        onOpenChange={onOpenChange}
      >
        <DialogContent hideCloseButton={hideCloseButton}>
          <DialogTitle>폴더 추가</DialogTitle>
          <Text>본문</Text>
        </DialogContent>
      </Dialog>
      <PortalHost />
    </>,
  );
}

describe("DialogContent close button", () => {
  it("is one button named 닫기 that closes the dialog", () => {
    const onOpenChange = jest.fn();
    renderDialog(onOpenChange);
    const buttons = screen.getAllByRole("button", { name: "닫기" });
    expect(buttons).toHaveLength(1);
    fireEvent.press(buttons[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is absent when hideCloseButton is set", () => {
    renderDialog(jest.fn(), true);
    expect(screen.getByText("폴더 추가")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "닫기" })).toBeNull();
  });
});
