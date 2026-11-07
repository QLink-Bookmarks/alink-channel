import type * as React from "react";

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { LinkPreview } from "../types";
import { LinkCreateForm } from "./link-create-form";

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
/* eslint-enable @typescript-eslint/no-require-imports */

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("expo-clipboard", () => ({
  getStringAsync: () => Promise.resolve(""),
}));

jest.mock("@/lib/error-reporting", () => ({ reportError: jest.fn() }));

jest.mock("@/components/ui/popover", () => {
  const passThrough = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return {
    Popover: passThrough,
    PopoverContent: () => null,
    PopoverTrigger: passThrough,
    usePopoverContext: () => ({ open: false, onOpenChange: jest.fn() }),
  };
});

jest.mock("@/features/folders/components/folder-picker-list", () => ({
  FolderPickerList: () => null,
}));

type PreviewState = { preview: LinkPreview | null; isLoading: boolean; previewUrl: string | null };

const mockPreviewByUrl = new Map<string, PreviewState>();
const IDLE_PREVIEW: PreviewState = { preview: null, isLoading: false, previewUrl: null };

jest.mock("../queries", () => ({
  useLinkPreviewQuery: (url: string) => mockPreviewByUrl.get(url) ?? IDLE_PREVIEW,
}));

const mockCreateLink = {
  error: null as Error | null,
  isPending: false,
  mutateAsync: jest.fn(),
  reset: jest.fn(),
};

jest.mock("../mutations", () => ({
  useCreateLinkMutation: () => mockCreateLink,
}));

const mockRequestAiSummary = {
  isPending: false,
  mutateAsync: jest.fn(),
};

jest.mock("@/features/ai/mutations", () => ({
  useRequestAiSummaryMutation: () => mockRequestAiSummary,
}));

const PROVIDER = {
  providerId: 1,
  providerType: "GEMINI",
  models: [{ id: 11, model: "gemini-2.5-flash", priority: 1, userProviderId: 101 }],
};

jest.mock("@/features/ai/queries", () => ({
  useAiProviderCatalogQuery: () => ({ data: [PROVIDER], isLoading: false }),
  useMyAiProvidersQuery: () => ({ data: [PROVIDER], isLoading: false }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

const URL = "https://example.com/post";
const PREVIEW: LinkPreview = {
  title: "미리보기 제목",
  thumbnailUrl: "https://example.com/og.png",
  faviconUrl: null,
  isVideo: false,
};

function renderForm(onSaved = jest.fn()) {
  const view = render(
    <LinkCreateForm
      mode="wide"
      open
      initialUrl={URL}
      onCancel={jest.fn()}
      onSaved={onSaved}
    />,
  );
  return { ...view, onSaved };
}

async function pressSave() {
  await act(async () => {
    fireEvent.press(screen.getByText("저장"));
  });
}

describe("LinkCreateForm while the preview loads", () => {
  beforeEach(() => {
    mockPreviewByUrl.clear();
    mockPreviewByUrl.set(URL, { preview: null, isLoading: true, previewUrl: null });
    mockCreateLink.error = null;
    mockCreateLink.isPending = false;
    mockCreateLink.mutateAsync = jest.fn().mockResolvedValue({ data: { id: 7 } });
    mockCreateLink.reset = jest.fn();
    mockRequestAiSummary.mutateAsync = jest.fn().mockResolvedValue({ data: { id: 8 } });
  });

  it("keeps the title field typeable and saves without the images", async () => {
    const { onSaved } = renderForm();

    expect(screen.getByTestId("link-create-title-loading")).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText("제목"), "직접 쓴 제목");
    await pressSave();

    expect(mockCreateLink.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mockCreateLink.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        url: URL,
        title: "직접 쓴 제목",
        thumbnailUrl: null,
        faviconUrl: null,
        isVideo: false,
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(7);
  });

  it("does not let a preview that arrives after the save fill the emptied form", async () => {
    const { rerender } = renderForm();

    fireEvent.changeText(screen.getByLabelText("제목"), "직접 쓴 제목");
    await pressSave();
    expect(screen.getByLabelText("URL").props.value).toBe("");

    mockPreviewByUrl.set(URL, { preview: PREVIEW, isLoading: false, previewUrl: URL });
    rerender(
      <LinkCreateForm
        mode="wide"
        open
        initialUrl={URL}
        onCancel={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("제목").props.value).toBe("");
    expect(screen.queryByTestId("link-create-preview-image")).toBeNull();
  });

  it("keeps a typed title when the preview arrives before the save", () => {
    const { rerender } = renderForm();

    fireEvent.changeText(screen.getByLabelText("제목"), "직접 쓴 제목");
    mockPreviewByUrl.set(URL, { preview: PREVIEW, isLoading: false, previewUrl: URL });
    rerender(
      <LinkCreateForm
        mode="wide"
        open
        initialUrl={URL}
        onCancel={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("제목").props.value).toBe("직접 쓴 제목");
  });

  it("puts the preview title back when the cleared field is left", () => {
    mockPreviewByUrl.set(URL, { preview: PREVIEW, isLoading: false, previewUrl: URL });
    renderForm();
    expect(screen.getByLabelText("제목").props.value).toBe("미리보기 제목");

    fireEvent.changeText(screen.getByLabelText("제목"), "");
    expect(screen.getByLabelText("제목").props.value).toBe("");
    fireEvent(screen.getByLabelText("제목"), "blur");

    expect(screen.getByLabelText("제목").props.value).toBe("미리보기 제목");
  });
});

describe("LinkCreateForm checks before it sends (N1)", () => {
  beforeEach(() => {
    mockPreviewByUrl.clear();
    mockCreateLink.error = null;
    mockCreateLink.mutateAsync = jest.fn().mockResolvedValue({ data: { id: 7 } });
    mockCreateLink.reset = jest.fn();
    mockRequestAiSummary.mutateAsync = jest.fn().mockResolvedValue({ data: { id: 8 } });
  });

  it("stops 저장 on an empty title with the field message and no request", async () => {
    renderForm();

    await pressSave();

    expect(screen.getByText("저장하려면 제목이 필요해요")).toBeOnTheScreen();
    expect(mockCreateLink.mutateAsync).not.toHaveBeenCalled();
  });

  it("treats a title of spaces as empty", async () => {
    renderForm();

    fireEvent.changeText(screen.getByLabelText("제목"), "   ");
    await pressSave();

    expect(screen.getByText("저장하려면 제목이 필요해요")).toBeOnTheScreen();
    expect(mockCreateLink.mutateAsync).not.toHaveBeenCalled();
  });

  it("lets AI 정리 go without a title", async () => {
    renderForm();

    await act(async () => {
      fireEvent.press(screen.getByText("AI 정리"));
    });

    expect(screen.queryByText("저장하려면 제목이 필요해요")).toBeNull();
    expect(mockRequestAiSummary.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ url: URL, title: null }),
    );
  });

  it("clears the last save failure when a check starts and when the user edits", async () => {
    mockCreateLink.error = new Error("network");
    renderForm();
    expect(
      screen.getByText("링크 저장에 실패했습니다. 잠시 후 다시 시도해주세요."),
    ).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText("제목"), "새 제목");
    expect(mockCreateLink.reset).toHaveBeenCalledTimes(1);

    await pressSave();
    expect(mockCreateLink.reset).toHaveBeenCalledTimes(3);
    expect(mockCreateLink.mutateAsync).toHaveBeenCalledTimes(1);
  });
});
