import { useImportFlowStore } from "@/stores/import-flow";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { useImportsQuery } from "../../queries";
import type { ImportSummary } from "../../types";
import { ImportHistoryScreen } from "./import-history-screen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockIsFocused = true;

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useIsFocused: () => mockIsFocused,
}));

jest.mock("@/lib/hooks/use-wide-view", () => ({
  useWideView: () => true,
}));

jest.mock("../../queries", () => ({
  useImportsQuery: jest.fn(),
}));

jest.mock("../../hooks/use-import-progress-refresh", () => ({
  useImportProgressRefresh: jest.fn(),
}));

jest.mock("../reversal/reversal-modal", () => ({
  ReversalModal: ({ target }: { target: { fileName: string } | null }) => {
    const { Text } = jest.requireActual("react-native");
    return target ? <Text>되돌리기 열림: {target.fileName}</Text> : null;
  },
}));

jest.mock("./import-detail-view", () => ({
  ImportDetailView: () => null,
}));

const mockedUseImportsQuery = useImportsQuery as jest.MockedFunction<typeof useImportsQuery>;

function summary(overrides: Partial<ImportSummary> & Pick<ImportSummary, "id">): ImportSummary {
  return {
    fileName: `bookmarks_${overrides.id}.html`,
    status: "COMPLETED",
    linkCount: 3,
    folderCount: 1,
    skippedCount: 0,
    failedCount: 0,
    progress: 1,
    isReversible: true,
    createdAt: "2026-10-28T00:12:00.000Z",
    ...overrides,
  };
}

function mockList(contents: ImportSummary[]) {
  mockedUseImportsQuery.mockReturnValue({
    data: {
      pages: [{ isEmpty: contents.length === 0, contents, nextCursor: null, hasNext: false }],
    },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
  } as unknown as ReturnType<typeof useImportsQuery>);
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  mockIsFocused = true;
  mockedUseImportsQuery.mockReset();
  useImportFlowStore.setState({ request: null });
});

describe("ImportHistoryScreen", () => {
  it("polls only while the screen is focused", () => {
    mockList([]);
    const view = render(<ImportHistoryScreen />);
    expect(mockedUseImportsQuery).toHaveBeenLastCalledWith({ isScreenFocused: true });

    mockIsFocused = false;
    view.rerender(<ImportHistoryScreen />);
    expect(mockedUseImportsQuery).toHaveBeenLastCalledWith({ isScreenFocused: false });
  });

  it("opens the import flow from settings with 새로 가져오기", () => {
    mockList([]);
    render(<ImportHistoryScreen />);

    fireEvent.press(screen.getByText("새로 가져오기"));

    expect(useImportFlowStore.getState().request).toMatchObject({ from: "settings" });
  });

  it("shows the empty state", () => {
    mockList([]);
    render(<ImportHistoryScreen />);
    expect(screen.getByText("아직 가져온 기록이 없어요")).toBeTruthy();
  });

  it("shows status, progress and 되돌리기 only where it applies", () => {
    mockList([
      summary({ id: 2, fileName: "filling.html", progress: 0.4 }),
      summary({ id: 1, fileName: "undone.html", status: "UNDONE", isReversible: false }),
    ]);
    render(<ImportHistoryScreen />);

    expect(screen.getByText("완료")).toBeTruthy();
    expect(screen.getByText("되돌림")).toBeTruthy();
    expect(screen.getAllByText("썸네일 채우는 중")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "filling.html 되돌리기" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "undone.html 되돌리기" })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "filling.html 되돌리기" }));
    expect(screen.getByText("되돌리기 열림: filling.html")).toBeTruthy();
  });

  it("opens the detail path for a row", () => {
    mockList([summary({ id: 7, fileName: "seven.html" })]);
    render(<ImportHistoryScreen />);

    fireEvent.press(screen.getByRole("button", { name: "seven.html 기록 상세" }));
    expect(mockPush).toHaveBeenCalledWith("/settings/imports/7");
  });
});
