import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { KEYBOARD_HINT, type NameHint, ProposalNameInput } from "./proposal-name-input";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("@/lib/hooks/use-wide-view", () => ({
  useWideView: () => true,
}));

function setup(
  onSubmit: (value: string) => boolean | void = jest.fn(),
  getHint: (value: string) => NameHint = () => KEYBOARD_HINT,
) {
  const onCancel = jest.fn();
  const submit = jest.fn(onSubmit);
  render(
    <ProposalNameInput
      accessibilityLabel="새 폴더 이름"
      getHint={getHint}
      initialValue="자바"
      onCancel={onCancel}
      onSubmit={submit}
    />,
  );
  return { onCancel, onSubmit: submit, input: screen.getByLabelText("새 폴더 이름") };
}

describe("ProposalNameInput", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it("shows the confirm and cancel buttons next to the field", () => {
    setup();
    expect(screen.getByLabelText("이름 확정")).toBeTruthy();
    expect(screen.getByLabelText("취소")).toBeTruthy();
  });

  it("confirm submits the typed name once, and a later blur does not submit again", () => {
    const { input, onSubmit, onCancel } = setup();
    fireEvent.changeText(input, "여행");
    fireEvent.press(screen.getByLabelText("이름 확정"));
    fireEvent(input, "blur");
    fireEvent(input, "submitEditing");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("여행");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancel discards the typed name, and a later blur does not submit it", () => {
    const { input, onSubmit, onCancel } = setup();
    fireEvent.changeText(input, "여행");
    fireEvent.press(screen.getByLabelText("취소"));
    fireEvent(input, "blur");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("a blocked name keeps the field open, so confirm can be pressed again after a fix", () => {
    const { input, onSubmit } = setup((value) => value !== "취업" && undefined);
    fireEvent.changeText(input, "취업");
    fireEvent.press(screen.getByLabelText("이름 확정"));
    expect(screen.getByLabelText("새 폴더 이름")).toBeTruthy();
    fireEvent.changeText(input, "취업 준비");
    fireEvent.press(screen.getByLabelText("이름 확정"));
    expect(onSubmit.mock.calls.map(([value]) => value)).toEqual(["취업", "취업 준비"]);
  });

  it("confirm cuts the name at 100 UTF-16 units like Enter", () => {
    const { input, onSubmit } = setup();
    fireEvent.changeText(input, "가".repeat(120));
    fireEvent.press(screen.getByLabelText("이름 확정"));
    expect(onSubmit).toHaveBeenCalledWith("가".repeat(100));
  });

  it("native hides the Enter and Esc hint even on a wide window, but keeps the other hints and the count", () => {
    const { input } = setup(undefined, (value) =>
      value === "취업"
        ? { text: "공유 폴더와 같은 이름은 쓸 수 없어요", tone: "danger" }
        : KEYBOARD_HINT,
    );
    expect(screen.queryByText("Enter로 저장, Esc로 취소")).toBeNull();
    expect(screen.getByText("2/100")).toBeTruthy();
    fireEvent.changeText(input, "취업");
    expect(screen.getByText("공유 폴더와 같은 이름은 쓸 수 없어요")).toBeTruthy();
  });
});
