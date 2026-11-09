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
    expect(
      screen.getByText(
        "링크를 직접 추가하거나, 브라우저에 모아 둔 북마크를 한 번에 가져올 수 있어요.",
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByText("브라우저 북마크 가져오기"));
    expect(useImportFlowStore.getState().request).toMatchObject({ from: "home" });
    fireEvent.press(screen.getByText("링크 추가"));
    expect(onAddLink).toHaveBeenCalledTimes(1);
  });

  it("on native shows only the icon, the title and 링크 추가, with nothing about bookmarks", () => {
    mockedIsImportAvailable.mockReturnValue(false);
    const onAddLink = jest.fn();
    render(<HomeEmptyState onAddLink={onAddLink} />);

    expect(screen.getByText("아직 저장한 링크가 없어요")).toBeTruthy();
    expect(screen.queryAllByText(/북마크/)).toHaveLength(0);
    expect(screen.queryByText(NOTE)).toBeNull();
    expect(screen.queryByTestId("web-only-import-note")).toBeNull();
    expect(screen.queryByText("브라우저 북마크 가져오기")).toBeNull();
    fireEvent.press(screen.getByText("링크 추가"));
    expect(onAddLink).toHaveBeenCalledTimes(1);
    expect(useImportFlowStore.getState().request).toBeNull();
  });
});
