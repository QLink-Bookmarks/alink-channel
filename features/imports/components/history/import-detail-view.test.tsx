import { useToastStore } from "@/stores/toast-store";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { useImportQuery } from "../../queries";
import type { ImportDetail } from "../../types";
import { ImportDetailView } from "./import-detail-view";

import * as Clipboard from "expo-clipboard";

const mockPush = jest.fn();

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useReducedMotion: () => false,
}));
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../queries", () => ({
  useImportQuery: jest.fn(),
}));

const mockedUseImportQuery = jest.mocked(useImportQuery);
const mockedSetString = jest.mocked(Clipboard.setStringAsync);

function detail(overrides: Partial<ImportDetail> = {}): ImportDetail {
  return {
    id: 9,
    fileName: "bookmarks.html",
    status: "PARTIALLY_FAILED",
    linkCount: 2,
    folderCount: 1,
    skippedCount: 0,
    failedCount: 2,
    progress: 1,
    isReversible: true,
    createdAt: "2026-11-05T06:00:00.000Z",
    folders: [
      {
        kind: "UNFILED",
        folderId: null,
        name: null,
        links: [{ linkId: 1, title: "A", url: "https://a.test" }],
      },
      {
        kind: "NEW",
        folderId: 42,
        name: "자바",
        links: [{ linkId: 2, title: "B", url: "https://b.test" }],
      },
    ],
    failures: [
      { title: "사내 위키", url: "intranet://wiki", reason: "URL_INVALID" },
      { title: "", url: "https://x.test/only-url", reason: "UNKNOWN" },
    ],
    ...overrides,
  };
}

function mockDetail(value: ImportDetail) {
  mockedUseImportQuery.mockReturnValue({
    data: value,
    isError: false,
    error: null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useImportQuery>);
}

beforeEach(() => {
  mockPush.mockReset();
  mockedSetString.mockReset();
  useToastStore.setState({ items: [] });
});

function lastToastTitle() {
  return useToastStore.getState().items.at(-1)?.title;
}

describe("ImportDetailView failures", () => {
  it("copies a failed address and says so", async () => {
    mockDetail(detail());
    mockedSetString.mockResolvedValue(true);
    render(
      <ImportDetailView
        importId={9}
        mode="panel"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "사내 위키 주소 복사" }));
    expect(mockedSetString).toHaveBeenCalledWith("intranet://wiki");
    await waitFor(() => expect(lastToastTitle()).toBe("주소를 복사했어요."));
  });

  it("names a failure without a title by its address", () => {
    mockDetail(detail());
    render(
      <ImportDetailView
        importId={9}
        mode="panel"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "https://x.test/only-url 주소 복사" })).toBeTruthy();
  });

  it("tells when the address could not be copied", async () => {
    mockDetail(detail());
    mockedSetString.mockRejectedValue(new Error("denied"));
    render(
      <ImportDetailView
        importId={9}
        mode="panel"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "사내 위키 주소 복사" }));
    await waitFor(() => expect(lastToastTitle()).toBe("주소를 복사하지 못했어요."));
  });
});

describe("ImportDetailView footer", () => {
  it("opens the first new folder with 가져온 링크 보기", () => {
    mockDetail(detail());
    render(
      <ImportDetailView
        importId={9}
        mode="panel"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText("가져온 링크 보기"));
    expect(mockPush).toHaveBeenCalledWith("/folders/42");
  });

  it("hides 가져온 링크 보기 for a reversed or failed import", () => {
    mockDetail(detail({ status: "UNDONE", isReversible: false }));
    const view = render(
      <ImportDetailView
        importId={9}
        mode="page"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );
    expect(screen.queryByText("가져온 링크 보기")).toBeNull();

    mockDetail(detail({ status: "FAILED", linkCount: 0, folders: [], isReversible: false }));
    view.rerender(
      <ImportDetailView
        importId={9}
        mode="page"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );
    expect(screen.queryByText("가져온 링크 보기")).toBeNull();
  });

  it("shows the combined badge while thumbnails fill", () => {
    mockDetail(detail({ progress: 0.3 }));
    render(
      <ImportDetailView
        importId={9}
        mode="panel"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );
    expect(screen.getByText("일부 실패 · 썸네일 채우는 중")).toBeTruthy();
  });
});

describe("ImportDetailView copy feedback on the page", () => {
  it("shows the result above the footer buttons instead of a toast", async () => {
    mockDetail(detail());
    mockedSetString.mockResolvedValue(true);
    render(
      <ImportDetailView
        importId={9}
        mode="page"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "사내 위키 주소 복사" }));
    await waitFor(() => expect(screen.getByTestId("import-copy-notice")).toBeTruthy());
    expect(screen.getByText("주소를 복사했어요.")).toBeTruthy();
    expect(lastToastTitle()).toBeUndefined();
  });

  it("says when copying failed", async () => {
    mockDetail(detail());
    mockedSetString.mockRejectedValue(new Error("denied"));
    render(
      <ImportDetailView
        importId={9}
        mode="page"
        onBack={jest.fn()}
        onReverse={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "사내 위키 주소 복사" }));
    await waitFor(() => expect(screen.getByText("주소를 복사하지 못했어요.")).toBeTruthy());
  });
});
