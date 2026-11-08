import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  SheetFooter,
  SheetHeader,
  type SheetScroll,
  useSheetScroll,
} from "@/components/layout/sheet";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { type DateValue } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopoverContext,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/text";
import { type TimeValue } from "@/components/ui/time-picker";
import {
  AiProviderPickerList,
  type AiProviderSelection,
  getProviderSelection,
} from "@/features/ai/components/ai-provider-picker-list";
import { resolveProviderRequest } from "@/features/ai/lib/resolve-provider-request";
import { useRequestAiSummaryMutation } from "@/features/ai/mutations";
import { useAiProviderCatalogQuery, useMyAiProvidersQuery } from "@/features/ai/queries";
import {
  FolderPickerList,
  type FolderPickerSelection,
} from "@/features/folders/components/folder-picker-list";
import { type TodoDraftEditorItem } from "@/features/todos/components/todo-draft-list-editor";
import {
  type TodoEditorId,
  type TodoEditorMode,
  type WeekdayValue,
} from "@/features/todos/components/todo-editor/todo-editor";
import { countTodoDraftErrors, validateTodoDrafts } from "@/features/todos/lib/todo-schedule";
import { todoQueryKeys } from "@/features/todos/queries";
import { useClipboardFailureFeedback } from "@/lib/clipboard-feedback";
import { reportError } from "@/lib/error-reporting";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";
import { useQrScanStore } from "@/stores/qr-scan";
import { useToastStore } from "@/stores/toast-store";
import { useQueryClient } from "@tanstack/react-query";

import { buildAiMemoAndTodoFields, buildLinkTodoRequests } from "../lib/link-create-todos";
import { getLinkPreviewRequestFields } from "../lib/link-preview/link-preview-result";
import { useCreateLinkMutation } from "../mutations";
import { useLinkPreviewQuery } from "../queries";
import type { LinkPreview } from "../types";
import { LinkCreateBottomBar, type LinkCreateProviderState } from "./link-create-bottom-bar";
import { LinkCreateMemoActions } from "./link-create-memo-actions";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { ChevronDown, ChevronRight, FolderOpen, QrCode } from "lucide-react-native/icons";

type LinkCreateFormMode = "wide" | "mobile";
type MobileSheetStep = "form" | "folder-picker" | "ai-model-picker";
// How the URL field got its current value: typed key by key, or filled at once
// (paste, QR, share, clipboard). Typed URLs wait for a pause before the preview.
type UrlFillMode = "typed" | "instant";
type SubmitKind = "save" | "ai";

type FolderDraft = {
  id: string | null;
  label: string;
};

type FieldErrors = { url?: string; title?: string };

type LinkCreateFormHandle = {
  /**
   * Asked before the user closes the form. True when it may close now; false when it
   * holds input and opens the unsaved changes dialog instead.
   */
  requestClose: () => boolean;
};

type LinkCreateFormProps = {
  ref?: React.Ref<LinkCreateFormHandle>;
  mode: LinkCreateFormMode;
  open: boolean;
  initialUrl?: string;
  onCancel: () => void;
  onSaved?: (id: number) => void;
  onMobileSubStepChange?: (isSubStep: boolean) => void;
};

const defaultFolder: FolderDraft = {
  id: null,
  label: "없음",
};

const defaultWeekdays: WeekdayValue[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const TITLE_MAX_LENGTH = 300;
const URL_PLACEHOLDER = "https://www.example.com";
const URL_REQUIRED_ERROR = "URL을 입력해주세요.";
const TITLE_REQUIRED_ERROR = "저장하려면 제목이 필요해요";
const TITLE_TOO_LONG_ERROR = `제목은 ${TITLE_MAX_LENGTH}자 이내로 입력해주세요.`;
const URL_HELP = "복사해 둔 링크가 있으면 자동으로 채워요";
const TITLE_LABEL_TAIL = "· AI 정리는 비워도 돼요";
const TITLE_PLACEHOLDER = "링크 제목";
const FOLDER_HELP = "비워 두면 AI 정리가 폴더를 골라요";
const PREVIEW_LOADING_LABEL = "미리보기를 불러오는 중";
const POPOVER_FOLDER_LIST_MAX_HEIGHT = 200;

function createInitialTodos(): TodoDraftEditorItem[] {
  return [];
}

function getFolderDraft(selection: FolderPickerSelection): FolderDraft {
  if (selection.id == null) {
    return defaultFolder;
  }
  return {
    id: String(selection.id),
    label: selection.emoji ? `${selection.emoji} ${selection.label}` : selection.label,
  };
}

// A change that adds more than one character at once is a paste or an autofill,
// not typing.
function getUrlFillMode(previousUrl: string, nextUrl: string): UrlFillMode {
  return nextUrl.length - previousUrl.length > 1 ? "instant" : "typed";
}

function getFieldErrors(kind: SubmitKind, url: string, title: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!url.trim()) {
    errors.url = URL_REQUIRED_ERROR;
  }
  const trimmedTitle = title.trim();
  if (kind === "save" && !trimmedTitle) {
    errors.title = TITLE_REQUIRED_ERROR;
  } else if (trimmedTitle.length > TITLE_MAX_LENGTH) {
    // A preview title is not cut to the field's limit.
    errors.title = TITLE_TOO_LONG_ERROR;
  }
  return errors;
}

type HostNode = { children?: ArrayLike<HostNode> };

// The action row at `index`: the list wraps the editor list, whose children are the rows.
// Native refs walk the host tree like the DOM does (React Native 0.82+).
function findActionRow(actionList: View, index: number): View | null {
  const list = (actionList as unknown as HostNode).children?.[0];
  return (list?.children?.[index] as View | undefined) ?? null;
}

// Brings the action row at `index` into view once the folded group has opened: the
// dialog scrolls its own body, the sheet scrolls through its handle, and web lets the
// browser bring the row to the middle.
function scrollToActionRow(
  index: number,
  actionList: View | null,
  scrollTarget: { scrollContent: View | null; scrollView: ScrollView | null } | SheetScroll | null,
) {
  if (!actionList) return;
  const row = findActionRow(actionList, index) ?? actionList;
  if (process.env.EXPO_OS === "web") {
    (row as unknown as HTMLElement).scrollIntoView?.({ block: "center" });
    return;
  }
  if (!scrollTarget) return;
  if ("scrollToView" in scrollTarget) {
    scrollTarget.scrollToView(row);
    return;
  }
  const { scrollContent, scrollView } = scrollTarget;
  if (!scrollContent || !scrollView) return;
  row.measureLayout(
    scrollContent,
    (_x, y) => scrollView.scrollTo({ y: Math.max(0, y - 16), animated: true }),
    () => undefined,
  );
}

function LinkCreateForm({
  ref,
  mode,
  open,
  initialUrl,
  onCancel,
  onSaved,
  onMobileSubStepChange,
}: LinkCreateFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pendingQrResult = useQrScanStore((state) => state.pendingResult);
  const clearQrResult = useQrScanStore((state) => state.clear);
  const createLinkMutation = useCreateLinkMutation();
  const resetMutation = createLinkMutation.reset;
  const hasSaveError = Boolean(createLinkMutation.error);
  const invalidateLinkQueries = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["links", "list"] });
    void queryClient.invalidateQueries({ queryKey: ["folders"] });
  }, [queryClient]);
  const clipboardFeedback = useClipboardFailureFeedback();
  const showToast = useToastStore((state) => state.showToast);
  const aiProvidersQuery = useAiProviderCatalogQuery();
  const aiProviders = aiProvidersQuery.data;
  const myProvidersQuery = useMyAiProvidersQuery();
  const myProviders = myProvidersQuery.data;
  const defaultProvider = useDisplaySettings((state) => state.ai.defaultProvider);
  const requestAiSummaryMutation = useRequestAiSummaryMutation();
  // Blocks a second 저장 or AI 정리 press before the pending state re-renders the buttons.
  const isSubmittingRef = React.useRef(false);
  const [url, setUrl] = React.useState("");
  // The URL the form filled in by itself on opening (a shared link or the clipboard). It
  // is not the user's input, so closing with only it asks nothing.
  const [autoFilledUrl, setAutoFilledUrl] = React.useState("");
  const [urlFillMode, setUrlFillMode] = React.useState<UrlFillMode>("instant");
  // Latest URL for async callbacks (the clipboard read) that must not clobber it.
  const urlRef = React.useRef(url);
  React.useEffect(() => {
    urlRef.current = url;
  }, [url]);
  const [title, setTitle] = React.useState("");
  // Set once the user edits the title; a fetched preview never overwrites it.
  const isTitleEditedRef = React.useRef(false);
  const appliedPreviewUrlRef = React.useRef<string | null>(null);
  const [memo, setMemo] = React.useState("");
  const [folder, setFolder] = React.useState<FolderDraft>(defaultFolder);
  const [aiProvider, setAiProvider] = React.useState<AiProviderSelection | null>(null);
  const [todos, setTodos] = React.useState<TodoDraftEditorItem[]>(createInitialTodos);
  const [generateTodo, setGenerateTodo] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isMemoActionsOpen, setIsMemoActionsOpen] = React.useState(false);
  // The action row to bring into view after a save stopped on its error.
  const [errorScrollRequest, setErrorScrollRequest] = React.useState<{
    index: number;
  } | null>(null);
  const [mobileSheetStep, setMobileSheetStep] = React.useState<MobileSheetStep>("form");
  const isMobileSubStep = mobileSheetStep !== "form";
  const scrollViewRef = React.useRef<ScrollView>(null);
  const scrollContentRef = React.useRef<View>(null);
  const actionListRef = React.useRef<View>(null);
  const sheetScroll = useSheetScroll();

  // The save failure notice goes away with the next edit.
  const hasSaveErrorRef = React.useRef(hasSaveError);
  React.useLayoutEffect(() => {
    hasSaveErrorRef.current = hasSaveError;
  }, [hasSaveError]);
  const clearSaveError = React.useCallback(() => {
    if (hasSaveErrorRef.current) {
      resetMutation();
    }
  }, [resetMutation]);

  React.useEffect(() => {
    onMobileSubStepChange?.(isMobileSubStep);
  }, [isMobileSubStep, onMobileSubStepChange]);

  React.useEffect(() => {
    return () => onMobileSubStepChange?.(false);
  }, [onMobileSubStepChange]);

  // The provider used when none is picked: the one chosen in settings, else the first.
  const defaultCatalogProvider = React.useMemo(
    () =>
      aiProviders?.find((provider) => provider.providerId === defaultProvider.id) ??
      aiProviders?.[0] ??
      null,
    [aiProviders, defaultProvider.id],
  );
  const defaultProviderId = defaultCatalogProvider?.providerId ?? null;

  React.useEffect(() => {
    if (aiProvider || !defaultCatalogProvider) {
      return;
    }
    setAiProvider(getProviderSelection(defaultCatalogProvider));
  }, [aiProvider, defaultCatalogProvider]);

  const providerState = React.useMemo<LinkCreateProviderState>(() => {
    if (aiProvidersQuery.isLoading) {
      return { status: "loading" };
    }
    const selection =
      aiProvider ?? (defaultCatalogProvider ? getProviderSelection(defaultCatalogProvider) : null);
    if (!selection) {
      return { status: "empty" };
    }
    return {
      status: "ready",
      selection,
      isDefault: selection.providerId === defaultProviderId,
    };
  }, [aiProvider, aiProvidersQuery.isLoading, defaultCatalogProvider, defaultProviderId]);

  const handleClipboardReadFailure = React.useCallback(
    (error: unknown) => {
      reportError(error, {
        area: "link-create-form:clipboard-read",
        extra: {
          mode,
        },
        level: "warning",
      });
      showToast({
        description: clipboardFeedback.description,
        dismissible: true,
        durationMs: 3000,
        showProgress: true,
        sourceKey: "link-create-clipboard",
        title: clipboardFeedback.title,
        variant: "warning",
      });
    },
    [clipboardFeedback.description, clipboardFeedback.title, mode, showToast],
  );

  const linkPreviewQuery = useLinkPreviewQuery(url, { immediate: urlFillMode === "instant" });
  const linkPreview = linkPreviewQuery.preview;
  const isPreviewLoading = linkPreviewQuery.isLoading;

  React.useEffect(() => {
    const previewUrl = linkPreviewQuery.previewUrl;
    if (!linkPreview || !previewUrl || appliedPreviewUrlRef.current === previewUrl) {
      return;
    }
    appliedPreviewUrlRef.current = previewUrl;
    if (!isTitleEditedRef.current) {
      setTitle(linkPreview.title ?? "");
    }
  }, [linkPreview, linkPreviewQuery.previewUrl]);

  const handleUrlChange = React.useCallback(
    (nextUrl: string) => {
      setUrlFillMode(getUrlFillMode(url, nextUrl));
      setUrl(nextUrl);
      setErrors((current) => (current.url ? { ...current, url: undefined } : current));
      clearSaveError();
    },
    [clearSaveError, url],
  );

  const fillUrlInstantly = React.useCallback((nextUrl: string) => {
    setUrlFillMode("instant");
    setUrl(nextUrl);
  }, []);

  const handleTitleChange = React.useCallback(
    (nextTitle: string) => {
      // Clearing the title hands it back to the preview.
      isTitleEditedRef.current = nextTitle.trim().length > 0;
      setTitle(nextTitle);
      setErrors((current) => (current.title ? { ...current, title: undefined } : current));
      clearSaveError();
    },
    [clearSaveError],
  );

  // A title cleared while the preview is in takes the preview's title back once the
  // field is left; a later preview fills an empty field by itself.
  const handleTitleBlur = React.useCallback(() => {
    const previewTitle = linkPreview?.title?.trim();
    if (title.trim() || !previewTitle) {
      return;
    }
    isTitleEditedRef.current = false;
    setTitle(previewTitle);
    setErrors((current) => (current.title ? { ...current, title: undefined } : current));
  }, [linkPreview?.title, title]);

  const handleMemoChange = React.useCallback(
    (nextMemo: string) => {
      setMemo(nextMemo);
      clearSaveError();
    },
    [clearSaveError],
  );

  const handleFolderSelect = React.useCallback(
    (selection: FolderPickerSelection) => {
      setFolder(getFolderDraft(selection));
      clearSaveError();
    },
    [clearSaveError],
  );

  const handleProviderSelect = React.useCallback(
    (selection: AiProviderSelection) => {
      setAiProvider(selection);
      clearSaveError();
    },
    [clearSaveError],
  );

  const handleGenerateTodoChange = React.useCallback(
    (next: boolean) => {
      setGenerateTodo(next);
      clearSaveError();
    },
    [clearSaveError],
  );

  const resetForm = React.useCallback(() => {
    setUrl("");
    setAutoFilledUrl("");
    setUrlFillMode("instant");
    setTitle("");
    isTitleEditedRef.current = false;
    appliedPreviewUrlRef.current = null;
    setMemo("");
    setFolder(defaultFolder);
    setAiProvider(null);
    setTodos(createInitialTodos());
    setGenerateTodo(false);
    setErrors({});
    setIsMemoActionsOpen(false);
    setErrorScrollRequest(null);
    setMobileSheetStep("form");
    resetMutation();
  }, [resetMutation]);

  React.useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    const sharedUrl = initialUrl?.trim();
    if (sharedUrl) {
      fillUrlInstantly(sharedUrl);
      setAutoFilledUrl(sharedUrl);
      return;
    }

    Clipboard.getStringAsync()
      .then((clipboardText) => {
        const nextUrl = clipboardText.trim();
        if (nextUrl) {
          // Don't clobber a URL that arrived (e.g. a shared link) while this async
          // clipboard read was in flight behind the iOS paste-permission prompt.
          if (!urlRef.current) {
            fillUrlInstantly(nextUrl);
            setAutoFilledUrl(nextUrl);
          }
        }
      })
      .catch((error: unknown) => {
        handleClipboardReadFailure(error);
      });
  }, [fillUrlInstantly, handleClipboardReadFailure, initialUrl, open, resetForm]);

  const updateTodo = React.useCallback(
    (todoId: TodoEditorId, patch: Partial<TodoDraftEditorItem>) => {
      setTodos((currentTodos) =>
        currentTodos.map((todo) => (todo.id === todoId ? { ...todo, ...patch } : todo)),
      );
      clearSaveError();
    },
    [clearSaveError],
  );

  const handleAddTodo = React.useCallback(() => {
    setTodos((currentTodos) => [
      ...currentTodos,
      {
        id: `${Date.now()}-${currentTodos.length}`,
        title: "",
        mode: "none",
        selectedWeekdays: defaultWeekdays,
        date: null,
        time: null,
      },
    ]);
    clearSaveError();
  }, [clearSaveError]);

  const handleTodoTitleChange = React.useCallback(
    (todoId: TodoEditorId, nextTitle: string) =>
      updateTodo(todoId, { title: nextTitle, titleError: null }),
    [updateTodo],
  );

  const handleTodoModeChange = React.useCallback(
    (todoId: TodoEditorId, nextMode: TodoEditorMode) =>
      updateTodo(todoId, { mode: nextMode, validationError: null, titleError: null }),
    [updateTodo],
  );

  const handleTodoWeekdaysChange = React.useCallback(
    (todoId: TodoEditorId, nextWeekdays: WeekdayValue[]) =>
      updateTodo(todoId, { selectedWeekdays: nextWeekdays, validationError: null }),
    [updateTodo],
  );

  const handleTodoDateChange = React.useCallback(
    (todoId: TodoEditorId, nextDate: DateValue) =>
      updateTodo(todoId, { date: nextDate, validationError: null }),
    [updateTodo],
  );

  const handleTodoTimeChange = React.useCallback(
    (todoId: TodoEditorId, nextTime: TimeValue) =>
      updateTodo(todoId, { time: nextTime, validationError: null }),
    [updateTodo],
  );

  const handleRemoveTodo = React.useCallback(
    (todoId: TodoEditorId) => {
      setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));
      clearSaveError();
    },
    [clearSaveError],
  );

  React.useEffect(() => {
    if (!errorScrollRequest) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      scrollToActionRow(
        errorScrollRequest.index,
        actionListRef.current,
        sheetScroll ?? {
          scrollContent: scrollContentRef.current,
          scrollView: scrollViewRef.current,
        },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [errorScrollRequest, sheetScroll]);

  const handleScanQr = React.useCallback(() => {
    router.push("/qr-scan" as Href);
  }, [router]);

  React.useEffect(() => {
    if (!open || pendingQrResult == null) {
      return;
    }
    fillUrlInstantly(pendingQrResult);
    clearQrResult();
  }, [clearQrResult, fillUrlInstantly, open, pendingQrResult]);

  // Checks the URL, the title and the actions before any request (N1). A stop shows
  // only the field errors and the action errors; an action error inside the folded
  // group opens it and brings the first one into view.
  const checkBeforeSubmit = React.useCallback(
    (kind: SubmitKind): boolean => {
      resetMutation();
      const fieldErrors = getFieldErrors(kind, url, title);
      const checkedTodos = validateTodoDrafts(todos);
      setErrors(fieldErrors);
      setTodos(checkedTodos.todos);
      if (checkedTodos.firstErrorId != null) {
        const index = checkedTodos.todos.findIndex((todo) => todo.id === checkedTodos.firstErrorId);
        setIsMemoActionsOpen(true);
        setErrorScrollRequest({ index });
      }
      return Object.keys(fieldErrors).length === 0 && !checkedTodos.hasError;
    },
    [resetMutation, title, todos, url],
  );

  const handleAiOrganize = React.useCallback(async () => {
    if (isSubmittingRef.current || !checkBeforeSubmit("ai")) {
      return;
    }
    const trimmedUrl = url.trim();
    const trimmedTitle = title.trim();

    // userProviderId only exists on the caller's own providers, so the request is
    // built from myProviders — the catalog the picker shows cannot supply it.
    const target = resolveProviderRequest(myProviders, aiProvider?.providerId ?? null);
    if (!target) {
      showToast({
        description: "사용할 AI 제공자를 먼저 선택해주세요.",
        dismissible: true,
        durationMs: 3000,
        sourceKey: "link-create-ai-model",
        title: "AI 제공자가 필요해요",
        variant: "warning",
      });
      return;
    }

    isSubmittingRef.current = true;
    const aiMemoAndTodoFields = buildAiMemoAndTodoFields(memo, todos);

    try {
      const response = await requestAiSummaryMutation.mutateAsync({
        folderId: folder.id ? Number(folder.id) : null,
        generateTodo,
        modelId: target.modelId,
        title: trimmedTitle ? trimmedTitle : null,
        url: trimmedUrl,
        userProviderId: target.userProviderId,
        ...getLinkPreviewRequestFields(linkPreview),
        ...aiMemoAndTodoFields,
      });

      showToast({
        description: "AI 정리 요청이 접수되었어요.",
        dismissible: true,
        durationMs: 3000,
        sourceKey: "link-create-ai-organize",
        title: "AI 정리 시작",
        variant: "success",
      });

      invalidateLinkQueries();
      // The actions sent with the request now exist, so the 액션 lists are stale.
      if (aiMemoAndTodoFields.todos) {
        void queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() });
      }
      resetForm();
      onCancel();
      // Surface the newly-queued link so the user can watch it move through G → A.
      const newLinkId = response.data?.id;
      if (newLinkId != null) {
        if (onSaved) {
          onSaved(newLinkId);
        } else if (mode === "wide") {
          router.replace(`/links?linkId=${newLinkId}` as Href);
        } else {
          router.push(`/links/${newLinkId}` as Href);
        }
      }
    } catch (error: unknown) {
      reportError(error, {
        area: "link-create-form:ai-organize",
        extra: { mode },
      });
      showToast({
        description: "AI 정리 요청에 실패했어요. 잠시 후 다시 시도해주세요.",
        dismissible: true,
        durationMs: 3000,
        sourceKey: "link-create-ai-organize",
        title: "AI 정리 실패",
        variant: "warning",
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }, [
    aiProvider?.providerId,
    checkBeforeSubmit,
    folder.id,
    myProviders,
    generateTodo,
    invalidateLinkQueries,
    linkPreview,
    memo,
    mode,
    onCancel,
    onSaved,
    queryClient,
    requestAiSummaryMutation,
    resetForm,
    router,
    showToast,
    title,
    todos,
    url,
  ]);

  // Saves even while the preview is still loading: the link then goes without its
  // images, and the server fills the thumbnail in later (alink-backend#195).
  const handleSave = React.useCallback(async () => {
    if (isSubmittingRef.current || !checkBeforeSubmit("save")) {
      return;
    }

    isSubmittingRef.current = true;
    try {
      const todoPayload = buildLinkTodoRequests(todos);

      const response = await createLinkMutation.mutateAsync({
        url: url.trim(),
        title: title.trim(),
        memo: memo.trim() || undefined,
        tags: [],
        sourceType: "INPUT",
        folderId: folder.id ? Number(folder.id) : null,
        todos: todoPayload,
        ...getLinkPreviewRequestFields(linkPreview),
      });

      invalidateLinkQueries();
      if (todoPayload.length > 0) {
        void queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() });
      }
      resetForm();
      onSaved?.(response.data.id);
    } catch (error: unknown) {
      reportError(error, {
        area: "link-create-form:save",
        extra: { mode },
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }, [
    checkBeforeSubmit,
    createLinkMutation,
    folder.id,
    invalidateLinkQueries,
    linkPreview,
    memo,
    mode,
    onSaved,
    queryClient,
    resetForm,
    title,
    todos,
    url,
  ]);

  const pendingRequest = createLinkMutation.isPending
    ? "save"
    : requestAiSummaryMutation.isPending
      ? "ai"
      : null;
  const isBusy = pendingRequest != null;

  // Anything the user put in that closing would throw away. A title that is only the
  // preview's, a blank action row and the default provider do not count.
  const trimmedTitle = title.trim();
  const hasInput =
    (url.trim() !== "" && url.trim() !== autoFilledUrl.trim()) ||
    (trimmedTitle !== "" && trimmedTitle !== (linkPreview?.title ?? "").trim()) ||
    memo.trim() !== "" ||
    todos.some((todo) => todo.title.trim() !== "" || todo.mode !== "none") ||
    folder.id != null ||
    (aiProvider != null && aiProvider.providerId !== defaultProviderId) ||
    generateTodo;
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = React.useState(false);
  const requestClose = React.useCallback(() => {
    if (!hasInput || isBusy) {
      return true;
    }
    setIsCloseConfirmOpen(true);
    return false;
  }, [hasInput, isBusy]);
  React.useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

  const handleDiscardAndClose = React.useCallback(() => {
    setIsCloseConfirmOpen(false);
    onCancel();
  }, [onCancel]);
  const handleSaveFromConfirm = React.useCallback(() => {
    setIsCloseConfirmOpen(false);
    void handleSave();
  }, [handleSave]);
  const closeConfirm = (
    <UnsavedChangesDialog
      open={isCloseConfirmOpen}
      onDiscard={handleDiscardAndClose}
      onOpenChange={setIsCloseConfirmOpen}
      onSave={handleSaveFromConfirm}
    />
  );

  const bottomBar = (
    <LinkCreateBottomBar
      defaultProviderId={defaultProviderId}
      generateTodo={generateTodo}
      hasSaveError={hasSaveError}
      mode={mode}
      pendingRequest={pendingRequest}
      provider={providerState}
      todoErrorCount={countTodoDraftErrors(todos)}
      onAiOrganize={handleAiOrganize}
      onGenerateTodoChange={handleGenerateTodoChange}
      onOpenProviderStep={() => setMobileSheetStep("ai-model-picker")}
      onProviderSelect={handleProviderSelect}
      onSave={handleSave}
    />
  );

  const memoActions = (
    <View className="border-t border-border-soft pt-5">
      <LinkCreateMemoActions
        actionListRef={actionListRef}
        disabled={isBusy}
        memo={memo}
        mode={mode}
        open={isMemoActionsOpen}
        todos={todos}
        onAddTodo={handleAddTodo}
        onChangeTodoDate={handleTodoDateChange}
        onChangeTodoMode={handleTodoModeChange}
        onChangeTodoTime={handleTodoTimeChange}
        onChangeTodoTitle={handleTodoTitleChange}
        onChangeTodoWeekdays={handleTodoWeekdaysChange}
        onMemoChange={handleMemoChange}
        onOpenChange={setIsMemoActionsOpen}
        onRemoveTodo={handleRemoveTodo}
      />
    </View>
  );

  const isMobile = mode === "mobile";
  const urlInput = (
    <Input
      accessibilityLabel="URL"
      aria-invalid={Boolean(errors.url)}
      className={cn(
        "min-w-0 rounded-xl px-3.5",
        isMobile ? "h-11 text-base" : "h-10 text-sm",
        errors.url && "border-destructive/70",
      )}
      value={url}
      editable={!isBusy}
      autoCapitalize="none"
      keyboardType="url"
      placeholder={URL_PLACEHOLDER}
      onChangeText={handleUrlChange}
    />
  );
  const urlField = (
    <FormField
      error={errors.url}
      help={url.trim() ? null : URL_HELP}
      label="URL"
    >
      {isMobile ? (
        <View className="flex-row gap-2">
          <View className="min-w-0 flex-1">{urlInput}</View>
          <Pressable
            accessibilityLabel="QR 스캔"
            accessibilityRole="button"
            className="size-11 shrink-0 items-center justify-center rounded-xl border border-input bg-card active:bg-accent"
            disabled={isBusy}
            onPress={handleScanQr}
          >
            <Icon
              as={QrCode}
              size={18}
              className="text-foreground"
            />
          </Pressable>
        </View>
      ) : (
        urlInput
      )}
    </FormField>
  );
  const titleField = (
    <FormField
      error={errors.title}
      label="제목"
      labelTail={TITLE_LABEL_TAIL}
    >
      <TitleField isLoading={isPreviewLoading}>
        <Input
          accessibilityLabel="제목"
          aria-invalid={Boolean(errors.title)}
          className={cn(
            "rounded-xl px-3.5",
            isMobile ? "h-11 text-base" : "h-10 text-sm",
            isPreviewLoading && "pr-10",
            errors.title && "border-destructive/70",
          )}
          value={title}
          editable={!isBusy}
          maxLength={TITLE_MAX_LENGTH}
          placeholder={TITLE_PLACEHOLDER}
          onBlur={handleTitleBlur}
          onChangeText={handleTitleChange}
        />
      </TitleField>
    </FormField>
  );
  const folderField = (
    <FormField
      help={folder.id == null ? FOLDER_HELP : null}
      label="폴더"
    >
      {isMobile ? (
        <FolderTrigger
          disabled={isBusy}
          isMobile
          label={folder.label}
          onPress={() => setMobileSheetStep("folder-picker")}
        />
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <FolderTrigger
              disabled={isBusy}
              isMobile={false}
              label={folder.label}
            />
          </PopoverTrigger>
          <FolderPickerPopoverContent
            selectedFolderId={folder.id ? Number(folder.id) : null}
            onSelect={handleFolderSelect}
          />
        </Popover>
      )}
    </FormField>
  );

  if (isMobile) {
    const stepTitle =
      mobileSheetStep === "folder-picker"
        ? "폴더 선택"
        : mobileSheetStep === "ai-model-picker"
          ? "AI 제공자 선택"
          : "새 링크 추가";

    return (
      <View className="w-full">
        <View className="gap-5">
          <SheetHeader
            title={stepTitle}
            onBack={isMobileSubStep ? () => setMobileSheetStep("form") : undefined}
          />

          {mobileSheetStep === "form" ? (
            <>
              <View className="gap-3.5">
                <GroupTitle>링크</GroupTitle>
                <LinkPreviewImage
                  isLoading={isPreviewLoading}
                  mode={mode}
                  preview={linkPreview}
                />
                {urlField}
                {titleField}
                {folderField}
              </View>
              {memoActions}

              <SheetFooter>{bottomBar}</SheetFooter>
            </>
          ) : mobileSheetStep === "folder-picker" ? (
            <FolderPickerList
              selectedFolderId={folder.id ? Number(folder.id) : null}
              onSelect={(selection) => {
                handleFolderSelect(selection);
                setMobileSheetStep("form");
              }}
            />
          ) : (
            <AiProviderPickerList
              defaultProviderId={defaultProviderId}
              selectedProviderId={
                providerState.status === "ready" ? providerState.selection.providerId : null
              }
              onSelect={(selection) => {
                handleProviderSelect(selection);
                setMobileSheetStep("form");
              }}
            />
          )}
        </View>
        {closeConfirm}
      </View>
    );
  }

  return (
    <View className="min-h-0 shrink">
      <ScrollView
        ref={scrollViewRef}
        className="min-h-0 shrink"
        contentContainerClassName="px-8 pb-6 pt-5"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View
          ref={scrollContentRef}
          className="gap-6"
        >
          <View className="gap-3.5">
            <GroupTitle>링크</GroupTitle>
            <View className="flex-row items-start gap-4">
              <LinkPreviewImage
                isLoading={isPreviewLoading}
                mode={mode}
                preview={linkPreview}
              />
              <View className="min-w-0 flex-1 gap-3.5">
                {urlField}
                {titleField}
                {folderField}
              </View>
            </View>
          </View>
          {memoActions}
        </View>
      </ScrollView>

      <View className="border-t border-border-soft pb-5 pl-8 pr-6 pt-4">{bottomBar}</View>
      {closeConfirm}
    </View>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      className="text-sm font-bold text-foreground"
    >
      {children}
    </Text>
  );
}

function FormField({
  children,
  error,
  help,
  label,
  labelTail,
}: {
  children: React.ReactNode;
  error?: string;
  help?: string | null;
  label: string;
  labelTail?: string;
}) {
  return (
    <View className="min-w-0 gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
        {labelTail ? (
          <Text className="text-xs font-medium text-muted-foreground">{labelTail}</Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text className="text-xs font-medium leading-[17px] text-destructive">{error}</Text>
      ) : help ? (
        <Text className="text-xs leading-[17px] text-muted-foreground">{help}</Text>
      ) : null}
    </View>
  );
}

const FolderTrigger = React.forwardRef<
  View,
  { isMobile: boolean; label: string } & Omit<React.ComponentProps<typeof Pressable>, "children">
>(function FolderTrigger({ isMobile, label, ...props }, ref) {
  return (
    <Pressable
      ref={ref}
      accessibilityLabel={`폴더, ${label}`}
      accessibilityRole="button"
      className={cn(
        "flex-row items-center gap-2 rounded-xl border border-input bg-background px-3.5 active:bg-accent web:hover:border-primary",
        isMobile ? "h-11" : "h-10",
      )}
      {...props}
    >
      <Icon
        as={FolderOpen}
        size={isMobile ? 18 : 16}
        className="shrink-0 text-foreground"
      />
      <Text
        className={cn("min-w-0 flex-1 text-foreground", isMobile ? "text-base" : "text-sm")}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Icon
        as={isMobile ? ChevronRight : ChevronDown}
        size={14}
        className="shrink-0 text-muted-foreground"
      />
    </Pressable>
  );
});

function FolderPickerPopoverContent({
  selectedFolderId,
  onSelect,
}: {
  selectedFolderId: number | null;
  onSelect: (selection: FolderPickerSelection) => void;
}) {
  const popoverContext = usePopoverContext();
  const isAddingFolderRef = React.useRef(false);

  const handleAddDialogOpenChange = React.useCallback((open: boolean) => {
    isAddingFolderRef.current = open;
  }, []);

  const handleInteractOutside = React.useCallback((event: { preventDefault: () => void }) => {
    if (isAddingFolderRef.current) {
      event.preventDefault();
    }
  }, []);

  return (
    <PopoverContent
      align="start"
      side="bottom"
      className="w-80 p-3 web:max-h-[calc(var(--radix-popover-content-available-height)-16px)]"
      onInteractOutside={handleInteractOutside}
    >
      <FolderPickerList
        className="min-h-0 shrink"
        listMaxHeight={POPOVER_FOLDER_LIST_MAX_HEIGHT}
        selectedFolderId={selectedFolderId}
        onAddDialogOpenChange={handleAddDialogOpenChange}
        onSelect={(selection) => {
          onSelect(selection);
          popoverContext.onOpenChange(false);
        }}
      />
    </PopoverContent>
  );
}

// Main image of the fetched preview, beside the fields (wide) or above them (mobile),
// only when the page has one. While the preview loads, the slot shows a spinner.
function LinkPreviewImage({
  isLoading,
  mode,
  preview,
}: {
  isLoading: boolean;
  mode: LinkCreateFormMode;
  preview: LinkPreview | null;
}) {
  const thumbnailUrl = preview?.thumbnailUrl ?? null;
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const frameClassName = cn(
    "shrink-0 overflow-hidden border border-border bg-muted",
    mode === "wide" ? "h-[110px] w-[176px] rounded-xl" : "aspect-video w-full rounded-[14px]",
  );

  if (isLoading) {
    return (
      <View
        accessibilityLabel="대표 이미지를 불러오는 중"
        className={cn(frameClassName, "items-center justify-center")}
        testID="link-create-preview-image-loading"
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!thumbnailUrl || failedUrl === thumbnailUrl) {
    return null;
  }

  return (
    <View
      className={frameClassName}
      testID="link-create-preview-image"
    >
      <Image
        accessibilityLabel="대표 이미지"
        contentFit="cover"
        source={{ uri: thumbnailUrl }}
        style={{ height: "100%", width: "100%" }}
        onError={() => setFailedUrl(thumbnailUrl)}
      />
    </View>
  );
}

// The title stays typeable while the preview loads; the spinner only says that a
// title may still arrive.
function TitleField({ children, isLoading }: { children: React.ReactNode; isLoading: boolean }) {
  return (
    <View className="relative justify-center">
      {children}
      {isLoading ? (
        <View
          accessibilityLabel={PREVIEW_LOADING_LABEL}
          className="absolute right-3"
          pointerEvents="none"
          testID="link-create-title-loading"
        >
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}

export { LinkCreateForm };
export type { LinkCreateFormHandle, LinkCreateFormMode };
