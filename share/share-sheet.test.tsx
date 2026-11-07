import * as React from "react";

import type { AiProviderWithModels } from "@/features/ai/types";
import type { Folder } from "@/features/folders/types";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";

import {
  createSharedLink,
  fetchFolders,
  fetchProviderModels,
  hasAuth,
  requestSharedAiSummary,
} from "./share-api";
import { ShareSheet } from "./share-sheet";

import { close, openHostApp } from "expo-share-extension";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
let mockReducedMotion = false;
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useReducedMotion: () => mockReducedMotion,
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const chain = () => {
    const gesture: Record<string, unknown> = {};
    for (const key of [
      "enabled",
      "activeOffsetY",
      "failOffsetX",
      "onUpdate",
      "onEnd",
      "onFinalize",
    ]) {
      gesture[key] = () => gesture;
    }
    return gesture;
  };
  return {
    Gesture: { Pan: chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: View,
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("expo-share-extension", () => ({ close: jest.fn(), openHostApp: jest.fn() }));
jest.mock("./share-api", () => ({
  createSharedLink: jest.fn(),
  fetchFolders: jest.fn(),
  fetchProviderModels: jest.fn(),
  hasAuth: jest.fn(),
  requestSharedAiSummary: jest.fn(),
  uploadSharedPreviewImage: jest.fn(),
}));

const mockCreateSharedLink = jest.mocked(createSharedLink);
const mockRequestSharedAiSummary = jest.mocked(requestSharedAiSummary);
const mockFetchFolders = jest.mocked(fetchFolders);
const mockFetchProviderModels = jest.mocked(fetchProviderModels);
const mockHasAuth = jest.mocked(hasAuth);
const mockClose = jest.mocked(close);
const mockOpenHostApp = jest.mocked(openHostApp);

const SHARED_URL = "https://www.jejutrail.kr/hallasan";
const PREPROCESSING = {
  title: "document title",
  url: SHARED_URL,
  meta: { "og:title": "한라산 성판악 코스 완벽 가이드" },
};

function folder(id: number, name: string, emoji: string | null, isShared = false): Folder {
  return { id, name, emoji, isShared, shareCounts: 0, linkCounts: 0, myLinkCounts: 0 };
}

const FOLDERS: Folder[] = [
  folder(1, "읽을거리", "📚"),
  folder(2, "제주 여행", "✈️"),
  folder(100, "가족 여행", "🧳", true),
];

const PROVIDERS: AiProviderWithModels[] = [
  {
    providerId: 1,
    providerType: "GEMINI",
    models: [{ id: 12, model: "gemini", priority: 1, userProviderId: 101 }],
  },
  {
    providerId: 2,
    providerType: "OPENAI",
    models: [{ id: 21, model: "gpt", priority: 1, userProviderId: 201 }],
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderReady(props: Partial<React.ComponentProps<typeof ShareSheet>> = {}) {
  render(
    <ShareSheet
      preprocessingResults={PREPROCESSING}
      url={SHARED_URL}
      {...props}
    />,
  );
  await flush();
  await flush();
}

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockHasAuth.mockResolvedValue(true);
  mockFetchFolders.mockResolvedValue(FOLDERS);
  mockFetchProviderModels.mockResolvedValue(PROVIDERS);
  mockCreateSharedLink.mockResolvedValue({} as Awaited<ReturnType<typeof createSharedLink>>);
  mockRequestSharedAiSummary.mockResolvedValue(
    {} as Awaited<ReturnType<typeof requestSharedAiSummary>>,
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe("ShareSheet", () => {
  it("shows the link, 미분류 folder, AI option summary, hint and both buttons once loaded", async () => {
    await renderReady();

    expect(screen.getByText("한라산 성판악 코스 완벽 가이드")).toBeTruthy();
    expect(screen.getByText("jejutrail.kr")).toBeTruthy();
    expect(screen.getByLabelText("폴더, 미분류")).toBeTruthy();
    expect(screen.getByLabelText("AI 옵션, Gemini, 액션 끔")).toBeTruthy();
    expect(screen.queryByText("GEMINI")).toBeNull();
    expect(screen.getByText("미분류면 AI가 알맞은 폴더에 넣어요")).toBeTruthy();
    expect(screen.getByText("저장")).toBeTruthy();
    expect(screen.getByText("AI 정리")).toBeTruthy();
    expect(screen.getByText("그대로 보관", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("요약·태그까지 정리", { includeHiddenElements: true })).toBeTruthy();
  });

  it("ignores presses while folders and providers are still loading", async () => {
    const folders = deferred<Folder[]>();
    mockFetchFolders.mockReturnValue(folders.promise);
    render(
      <ShareSheet
        preprocessingResults={PREPROCESSING}
        url={SHARED_URL}
      />,
    );
    await flush();

    fireEvent.press(screen.getByText("저장"));
    fireEvent.press(screen.getByText("AI 정리"));
    await flush();

    expect(mockCreateSharedLink).not.toHaveBeenCalled();
    expect(mockRequestSharedAiSummary).not.toHaveBeenCalled();
  });

  it("saves to 미분류, shows the completion and closes once it finishes", async () => {
    const request = deferred<Awaited<ReturnType<typeof createSharedLink>>>();
    mockCreateSharedLink.mockReturnValue(request.promise);
    await renderReady();

    fireEvent.press(screen.getByText("저장"));
    await flush();

    expect(screen.getByText("보내는 중", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "저장", busy: true })).toBeTruthy();
    expect(mockCreateSharedLink).toHaveBeenCalledWith({
      url: SHARED_URL,
      title: "한라산 성판악 코스 완벽 가이드",
      folderId: null,
      thumbnailUrl: null,
    });

    await act(async () => {
      request.resolve({} as Awaited<ReturnType<typeof createSharedLink>>);
    });
    await flush();

    expect(within(screen.getByTestId("share-sheet")).getByLabelText("저장됨")).toBeTruthy();
    expect(screen.queryByLabelText("폴더, 미분류")).toBeNull();
    expect(screen.getByLabelText("폴더, 미분류", { includeHiddenElements: true })).toBeTruthy();
    expect(mockClose).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2249);
    });
    expect(mockClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("plays the reduced-motion completion on the sheet and closes sooner", async () => {
    mockReducedMotion = true;
    await renderReady();

    fireEvent.press(screen.getByText("저장"));
    await flush();
    await flush();

    expect(within(screen.getByTestId("share-sheet")).getByLabelText("저장됨")).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(1200);
    });
    expect(mockClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("returns from the folder picker with the chosen folder and saves AI results into it", async () => {
    await renderReady();

    fireEvent.press(screen.getByLabelText("폴더, 미분류"));
    expect(screen.getByLabelText("내 폴더 목록")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("✈️ 제주 여행"));

    expect(screen.getByLabelText("폴더, 제주 여행")).toBeTruthy();
    expect(screen.queryByText("미분류면 AI가 알맞은 폴더에 넣어요")).toBeNull();

    fireEvent.press(screen.getByText("AI 정리"));
    await flush();

    expect(mockRequestSharedAiSummary).toHaveBeenCalledWith({
      url: SHARED_URL,
      title: "한라산 성판악 코스 완벽 가이드",
      folderId: 2,
      userProviderId: 101,
      modelId: 12,
      generateTodo: false,
      thumbnailUrl: null,
    });
  });

  it("keeps the selection when going back and shows the hint again for 미분류", async () => {
    await renderReady();

    fireEvent.press(screen.getByLabelText("폴더, 미분류"));
    fireEvent.press(screen.getByLabelText("뒤로"));
    expect(screen.getByLabelText("폴더, 미분류")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("폴더, 미분류"));
    fireEvent.press(screen.getByLabelText("✈️ 제주 여행"));
    expect(screen.queryByText("미분류면 AI가 알맞은 폴더에 넣어요")).toBeNull();

    fireEvent.press(screen.getByLabelText("폴더, 제주 여행"));
    fireEvent.press(screen.getByLabelText("미분류"));
    expect(screen.getByText("미분류면 AI가 알맞은 폴더에 넣어요")).toBeTruthy();
  });

  it("shows only 미분류 in the picker when the account has no folders", async () => {
    mockFetchFolders.mockResolvedValue([]);
    await renderReady();

    fireEvent.press(screen.getByLabelText("폴더, 미분류"));

    expect(screen.getByLabelText("미분류")).toBeTruthy();
    expect(screen.queryByText("내 폴더")).toBeNull();
    expect(screen.queryByText("공유 폴더")).toBeNull();
  });

  it("applies the provider and action options from the AI options step", async () => {
    await renderReady();

    fireEvent.press(screen.getByLabelText("AI 옵션, Gemini, 액션 끔"));
    fireEvent.press(screen.getByLabelText("OpenAI"));
    fireEvent.press(screen.getByRole("switch", { name: "액션 생성" }));
    fireEvent.press(screen.getByLabelText("뒤로"));

    expect(screen.getByLabelText("AI 옵션, OpenAI, 액션 켬")).toBeTruthy();

    fireEvent.press(screen.getByText("AI 정리"));
    await flush();

    expect(mockRequestSharedAiSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: null,
        userProviderId: 201,
        modelId: 21,
        generateTodo: true,
      }),
    );
  });

  it("hides AI options and keeps one full-width 저장 when no provider is registered", async () => {
    mockFetchProviderModels.mockResolvedValue([]);
    await renderReady();

    expect(screen.queryByText("AI 옵션")).toBeNull();
    expect(screen.queryByText("AI 정리")).toBeNull();
    expect(screen.queryByText("미분류면 AI가 알맞은 폴더에 넣어요")).toBeNull();
    expect(screen.getByText("저장")).toBeTruthy();
    expect(screen.getByText("그대로 보관", { includeHiddenElements: true })).toBeTruthy();
  });

  it("shows 보내는 중 under the single 저장 while saving without providers", async () => {
    mockFetchProviderModels.mockResolvedValue([]);
    const request = deferred<Awaited<ReturnType<typeof createSharedLink>>>();
    mockCreateSharedLink.mockReturnValue(request.promise);
    await renderReady();

    fireEvent.press(screen.getByText("저장"));
    await flush();

    expect(screen.getByText("보내는 중", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("그대로 보관", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByRole("button", { name: "저장", busy: true })).toBeTruthy();
  });

  it("shows the fixed failure toast without the server message, hides it after 4s and allows a retry", async () => {
    mockCreateSharedLink.mockRejectedValueOnce(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 500, data: { error: { message: "서버 내부 오류 원문" } } },
      }),
    );
    await renderReady();

    fireEvent.press(screen.getByText("저장"));
    await flush();
    await flush();

    expect(screen.getByText("저장에 실패했어요. 잠시 후 다시 시도해주세요")).toBeTruthy();
    expect(screen.queryByText("서버 내부 오류 원문")).toBeNull();
    expect(screen.queryByLabelText("저장됨")).toBeNull();
    expect(screen.getByLabelText("폴더, 미분류")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("저장에 실패했어요. 잠시 후 다시 시도해주세요")).toBeNull();

    fireEvent.press(screen.getByText("저장"));
    await flush();
    await flush();

    expect(mockCreateSharedLink).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("저장됨")).toBeTruthy();
  });

  it("saves once when the buttons are pressed repeatedly", async () => {
    const request = deferred<Awaited<ReturnType<typeof createSharedLink>>>();
    mockCreateSharedLink.mockReturnValue(request.promise);
    await renderReady();

    fireEvent.press(screen.getByText("저장"));
    fireEvent.press(screen.getByText("저장"));
    fireEvent.press(screen.getByText("AI 정리"));
    fireEvent.press(screen.getByLabelText("폴더, 미분류"));
    await flush();

    expect(mockCreateSharedLink).toHaveBeenCalledTimes(1);
    expect(mockRequestSharedAiSummary).not.toHaveBeenCalled();

    await act(async () => {
      request.resolve({} as Awaited<ReturnType<typeof createSharedLink>>);
    });
    await flush();
    fireEvent.press(screen.getByText("저장", { includeHiddenElements: true }));
    await flush();

    expect(mockCreateSharedLink).toHaveBeenCalledTimes(1);
    expect(screen.getAllByLabelText("저장됨")).toHaveLength(1);
  });

  it("asks to log in and opens the app login when there is no session", async () => {
    mockHasAuth.mockResolvedValue(false);
    await renderReady();

    expect(screen.getByText("로그인을 먼저 해주세요")).toBeTruthy();
    fireEvent.press(screen.getByText("로그인 하러가기"));

    expect(mockOpenHostApp).toHaveBeenCalledWith("login");
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("explains a non-web share and closes from 닫기", async () => {
    await renderReady({ url: undefined, text: "장보기 메모", preprocessingResults: undefined });

    expect(screen.getByText("북마크 가능한 웹페이지 url이 아니에요")).toBeTruthy();
    fireEvent.press(screen.getByText("닫기"));

    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(mockFetchFolders).not.toHaveBeenCalled();
  });
});
