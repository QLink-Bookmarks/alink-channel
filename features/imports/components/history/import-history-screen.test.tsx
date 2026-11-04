import { useImportFlowStore } from "@/stores/import-flow";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { resetShownImportIds } from "../../hooks/use-just-imported-ids";
import { isImportAvailable } from "../../lib/import-availability";
import { useImportsQuery } from "../../queries";
import type { ImportSummary } from "../../types";
import { ImportHistoryScreen } from "./import-history-screen";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockOpenLinks = jest.fn();
let mockIsFocused = true;

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useReducedMotion: () => false,
}));
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useIsFocused: () => mockIsFocused,
}));

jest.mock("../../hooks/use-open-imported-links", () => ({
  useOpenImportedLinks: () => ({ openImportedLinks: mockOpenLinks, pendingId: null }),
}));

jest.mock("@/lib/hooks/use-wide-view", () => ({
  useWideView: () => true,
}));

jest.mock("../../lib/import-availability", () => ({
  isImportAvailable: jest.fn(),
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

const mockedIsImportAvailable = jest.mocked(isImportAvailable);

beforeEach(() => {
  mockedIsImportAvailable.mockReturnValue(true);
  mockPush.mockReset();
  mockReplace.mockReset();
  mockOpenLinks.mockReset();
  resetShownImportIds();
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
    expect(screen.queryByText("북마크 가져오기는 웹에서 할 수 있어요")).toBeNull();
  });

  it("on native shows the web-only note in place of 새로 가져오기, with nothing to press", () => {
    mockedIsImportAvailable.mockReturnValue(false);
    mockList([]);
    render(<ImportHistoryScreen />);

    expect(screen.queryByText("새로 가져오기")).toBeNull();
    const note = screen.getByTestId("web-only-import-note");
    expect(screen.getByText("북마크 가져오기는 웹에서 할 수 있어요")).toBeTruthy();
    expect(note.props.accessibilityRole).toBeUndefined();
    expect(note.props.onPress).toBeUndefined();
    fireEvent.press(screen.getByText("북마크 가져오기는 웹에서 할 수 있어요"));
    expect(useImportFlowStore.getState().request).toBeNull();
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

    expect(screen.getByText("완료 · 썸네일 채우는 중")).toBeTruthy();
    expect(screen.getByText("되돌림")).toBeTruthy();
    expect(screen.queryByText("썸네일 채우는 중")).toBeNull();
    expect(screen.queryByText("완료")).toBeNull();
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

  it("shows the iOS empty copy without asking to upload", () => {
    mockedIsImportAvailable.mockReturnValue(false);
    mockList([]);
    render(<ImportHistoryScreen />);
    expect(screen.getByText("웹에서 가져온 기록이 여기에 쌓여요.")).toBeTruthy();
    expect(screen.queryByText(/올리면/)).toBeNull();
  });

  it("keeps each meta number with its unit", () => {
    mockList([summary({ id: 4, linkCount: 11, folderCount: 3, failedCount: 2 })]);
    render(<ImportHistoryScreen />);
    expect(screen.getByText("링크 11개\u00a0·")).toBeTruthy();
    expect(screen.getByText("새 폴더 3개\u00a0·")).toBeTruthy();
    expect(screen.getByText("실패 2개")).toBeTruthy();
  });

  describe("just imported", () => {
    const now = () => new Date().toISOString();

    it("turns the newest import into a result card that leads to its links", () => {
      mockList([
        summary({
          id: 9,
          fileName: "fresh.html",
          createdAt: now(),
          linkCount: 136,
          folderCount: 39,
          failedCount: 2,
          status: "PARTIALLY_FAILED",
          progress: 0,
        }),
        summary({ id: 8, fileName: "old.html" }),
      ]);
      render(<ImportHistoryScreen />);

      expect(screen.getByText("방금 가져왔어요")).toBeTruthy();
      expect(
        screen.getByText(
          "링크 136개와 새 폴더 39개를 추가했어요. 실패 2개는 상세에서 볼 수 있어요.",
        ),
      ).toBeTruthy();
      expect(screen.getByText("일부 실패 · 썸네일 채우는 중")).toBeTruthy();
      expect(screen.getByTestId("import-row-9")).toBeTruthy();
      expect(screen.getByTestId("import-row-8")).toBeTruthy();

      fireEvent.press(screen.getByText("가져온 링크 보기"));
      expect(mockOpenLinks).toHaveBeenCalledWith(9);
      fireEvent.press(screen.getByText("상세 보기"));
      expect(mockPush).toHaveBeenCalledWith("/settings/imports/9");
      fireEvent.press(screen.getByRole("button", { name: "fresh.html 되돌리기" }));
      expect(screen.getByText("되돌리기 열림: fresh.html")).toBeTruthy();
    });

    it("offers only the detail for a failed import", () => {
      mockList([
        summary({
          id: 5,
          createdAt: now(),
          status: "FAILED",
          linkCount: 0,
          folderCount: 0,
          failedCount: 4,
          isReversible: false,
        }),
      ]);
      render(<ImportHistoryScreen />);
      expect(screen.getByText("가져오지 못했어요")).toBeTruthy();
      expect(screen.getByText("상세 보기")).toBeTruthy();
      expect(screen.queryByText("가져온 링크 보기")).toBeNull();
      expect(screen.queryByText("되돌리기")).toBeNull();
    });

    it("offers only the detail once everything was reversed", () => {
      mockList([summary({ id: 6, createdAt: now(), status: "UNDONE", isReversible: false })]);
      render(<ImportHistoryScreen />);
      expect(screen.getByText("가져온 링크를 모두 되돌렸어요.")).toBeTruthy();
      expect(screen.queryByText("가져온 링크 보기")).toBeNull();
    });

    it("shows a plain row when the list is opened again", () => {
      mockList([summary({ id: 3, createdAt: now() })]);
      const first = render(<ImportHistoryScreen />);
      expect(screen.getByText("방금 가져왔어요")).toBeTruthy();
      first.unmount();

      render(<ImportHistoryScreen />);
      expect(screen.queryByText("방금 가져왔어요")).toBeNull();
      expect(screen.getByRole("button", { name: "bookmarks_3.html 기록 상세" })).toBeTruthy();
    });

    it("does not treat an import older than a minute as just imported", () => {
      mockList([summary({ id: 2, createdAt: new Date(Date.now() - 61_000).toISOString() })]);
      render(<ImportHistoryScreen />);
      expect(screen.queryByText("방금 가져왔어요")).toBeNull();
    });
  });
});
