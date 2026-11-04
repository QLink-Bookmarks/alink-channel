import { useImportFlowStore } from "@/stores/import-flow";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { isImportAvailable } from "../../lib/import-availability";
import { HomeEmptyState } from "./home-empty-state";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("../../lib/import-availability", () => ({
  isImportAvailable: jest.fn(),
}));

const NOTE = "북마크 가져오기는 웹에서 할 수 있어요";
const mockedIsImportAvailable = jest.mocked(isImportAvailable);

beforeEach(() => {
  useImportFlowStore.setState({ request: null });
});

describe("HomeEmptyState", () => {
  it("on web shows 링크 추가 and the import button, and the button opens the import flow", () => {
    mockedIsImportAvailable.mockReturnValue(true);
    const onAddLink = jest.fn();
    render(<HomeEmptyState onAddLink={onAddLink} />);

    expect(screen.queryByText(NOTE)).toBeNull();
    fireEvent.press(screen.getByText("브라우저 북마크 가져오기"));
    expect(useImportFlowStore.getState().request).toMatchObject({ from: "home" });
    fireEvent.press(screen.getByText("링크 추가"));
    expect(onAddLink).toHaveBeenCalledTimes(1);
  });

  it("on native keeps 링크 추가 and shows the web-only note in place of the import button", () => {
    mockedIsImportAvailable.mockReturnValue(false);
    const onAddLink = jest.fn();
    render(<HomeEmptyState onAddLink={onAddLink} />);

    expect(screen.queryByText("브라우저 북마크 가져오기")).toBeNull();
    expect(screen.getByText(NOTE)).toBeTruthy();
    expect(screen.getByTestId("web-only-import-note").props.accessibilityRole).toBeUndefined();
    fireEvent.press(screen.getByText(NOTE));
    expect(useImportFlowStore.getState().request).toBeNull();
    fireEvent.press(screen.getByText("링크 추가"));
    expect(onAddLink).toHaveBeenCalledTimes(1);
  });
});
