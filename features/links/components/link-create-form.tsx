import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { SheetFooter } from "@/components/layout/sheet";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { type DateValue } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopoverContext,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
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
import {
  type TodoDraftEditorItem,
  TodoDraftListEditor,
} from "@/features/todos/components/todo-draft-list-editor";
import {
  type TodoEditorMode,
  type WeekdayValue,
} from "@/features/todos/components/todo-editor/todo-editor";
import { validateTodoDrafts } from "@/features/todos/lib/todo-schedule";
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
import { getSaveLabelClassName } from "../lib/save-label-class-name";
import { useCreateLinkMutation } from "../mutations";
import { useLinkPreviewQuery } from "../queries";
import type { LinkPreview } from "../types";

import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  FolderOpen,
  QrCode,
  Save,
} from "lucide-react-native/icons";

type LinkCreateFormMode = "wide" | "mobile";
type MobileSheetStep = "form" | "folder-picker" | "ai-model-picker";
// How the URL field got its current value: typed key by key, or filled at once
// (paste, QR, share, clipboard). Typed URLs wait for a pause before the preview.
type UrlFillMode = "typed" | "instant";

type FolderDraft = {
  id: string | null;
  label: string;
};

type LinkCreateFormProps = {
  mode: LinkCreateFormMode;
  open: boolean;
  initialUrl?: string;
  onCancel: () => void;
  onSaved?: (id: number) => void;
  onMobileSubStepChange?: (isSubStep: boolean) => void;
};

const defaultFolder: FolderDraft = {
  id: null,
  label: "없음 - ✨ AI 자동 분류",
};

const defaultWeekdays: WeekdayValue[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const TITLE_MAX_LENGTH = 300;
const URL_PLACEHOLDER = "https://www.example.com";
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

function LinkCreateForm({
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
  // Blocks a second AI 정리 press before the pending state re-renders the button.
  const isAiOrganizingRef = React.useRef(false);
  const [url, setUrl] = React.useState("");
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
  const handleFolderSelect = React.useCallback((selection: FolderPickerSelection) => {
    setFolder(getFolderDraft(selection));
  }, []);
  const [aiProvider, setAiProvider] = React.useState<AiProviderSelection | null>(null);
  const [todos, setTodos] = React.useState<TodoDraftEditorItem[]>(createInitialTodos);
  const [generateTodo, setGenerateTodo] = React.useState(false);
  const [errors, setErrors] = React.useState<{ url?: string; title?: string }>({});
  const [mobileSheetStep, setMobileSheetStep] = React.useState<MobileSheetStep>("form");
  const isMobileSubStep = mobileSheetStep !== "form";

  React.useEffect(() => {
    onMobileSubStepChange?.(isMobileSubStep);
  }, [isMobileSubStep, onMobileSubStepChange]);

  React.useEffect(() => {
    return () => onMobileSubStepChange?.(false);
  }, [onMobileSubStepChange]);

  React.useEffect(() => {
    if (aiProvider || !aiProviders) {
      return;
    }
    const matchedProvider =
      aiProviders.find((provider) => provider.providerId === defaultProvider.id) ?? aiProviders[0];
    if (!matchedProvider) {
      return;
    }
    setAiProvider(getProviderSelection(matchedProvider));
  }, [aiProvider, aiProviders, defaultProvider.id]);

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
    },
    [url],
  );

  const fillUrlInstantly = React.useCallback((nextUrl: string) => {
    setUrlFillMode("instant");
    setUrl(nextUrl);
  }, []);

  const handleTitleChange = React.useCallback((nextTitle: string) => {
    // Clearing the title hands it back to the preview.
    isTitleEditedRef.current = nextTitle.trim().length > 0;
    setTitle(nextTitle);
  }, []);

  const resetForm = React.useCallback(() => {
    setUrl("");
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
          }
        }
      })
      .catch((error: unknown) => {
        handleClipboardReadFailure(error);
      });
  }, [fillUrlInstantly, handleClipboardReadFailure, initialUrl, open, resetForm]);

  const handleAddTodo = React.useCallback(() => {
    setTodos((currentTodos) => [
      ...currentTodos,
      {
        id: `${Date.now()}-${currentTodos.length}`,
        title: "",
        mode: "recurring",
        selectedWeekdays: defaultWeekdays,
        date: null,
        time: null,
      },
    ]);
  }, []);

  const handleTodoTitleChange = React.useCallback((todoId: string | number, nextTitle: string) => {
    setTodos((currentTodos) =>
      currentTodos.map((todo) => (todo.id === todoId ? { ...todo, title: nextTitle } : todo)),
    );
  }, []);

  const handleTodoModeChange = React.useCallback(
    (todoId: string | number, nextMode: TodoEditorMode) => {
      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === todoId ? { ...todo, mode: nextMode, validationError: null } : todo,
        ),
      );
    },
    [],
  );

  const handleTodoWeekdaysChange = React.useCallback(
    (todoId: string | number, nextWeekdays: WeekdayValue[]) => {
      setTodos((currentTodos) =>
        currentTodos.map((todo) =>
          todo.id === todoId ? { ...todo, selectedWeekdays: nextWeekdays } : todo,
        ),
      );
    },
    [],
  );

  const handleRemoveTodo = React.useCallback((todoId: string | number) => {
    setTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));
  }, []);

  const handleTodoDateChange = React.useCallback((todoId: number | string, nextDate: DateValue) => {
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === todoId ? { ...todo, date: nextDate, validationError: null } : todo,
      ),
    );
  }, []);

  const handleTodoTimeChange = React.useCallback((todoId: number | string, nextTime: TimeValue) => {
    setTodos((currentTodos) =>
      currentTodos.map((todo) =>
        todo.id === todoId ? { ...todo, time: nextTime, validationError: null } : todo,
      ),
    );
  }, []);

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

  const handleAiOrganize = React.useCallback(async () => {
    if (isPreviewLoading || isAiOrganizingRef.current || createLinkMutation.isPending) {
      return;
    }
    const trimmedUrl = url.trim();
    const trimmedTitle = title.trim();
    const nextErrors: { url?: string; title?: string } = {};

    if (!trimmedUrl) {
      nextErrors.url = "URL을 입력해주세요.";
    }

    if (trimmedTitle && trimmedTitle.length > TITLE_MAX_LENGTH) {
      nextErrors.title = `제목은 ${TITLE_MAX_LENGTH}자 이내로 입력해주세요.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const checkedTodos = validateTodoDrafts(todos);
    if (checkedTodos.hasError) {
      setErrors({});
      setTodos(checkedTodos.todos);
      return;
    }

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

    isAiOrganizingRef.current = true;
    setErrors({});
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
      isAiOrganizingRef.current = false;
    }
  }, [
    aiProvider?.providerId,
    createLinkMutation.isPending,
    folder.id,
    myProviders,
    generateTodo,
    invalidateLinkQueries,
    isPreviewLoading,
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

  const validate = React.useCallback(() => {
    const nextErrors: { url?: string; title?: string } = {};

    if (!url.trim()) {
      nextErrors.url = "URL을 입력해주세요.";
    }

    if (!title.trim()) {
      nextErrors.title = "제목을 입력해주세요.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  }, [title, url]);

  const handleSave = React.useCallback(async () => {
    if (isPreviewLoading || isAiOrganizingRef.current || !validate()) {
      return;
    }

    const checkedTodos = validateTodoDrafts(todos);
    if (checkedTodos.hasError) {
      setTodos(checkedTodos.todos);
      return;
    }

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
    }
  }, [
    createLinkMutation,
    folder.id,
    invalidateLinkQueries,
    isPreviewLoading,
    linkPreview,
    memo,
    mode,
    onSaved,
    queryClient,
    resetForm,
    title,
    todos,
    url,
    validate,
  ]);

  const aiProviderLabel = aiProvider?.providerLabel ?? "기본 제공자 사용";
  const isSaveDisabled =
    isPreviewLoading || createLinkMutation.isPending || requestAiSummaryMutation.isPending;
  const isAiOrganizeDisabled =
    isPreviewLoading || createLinkMutation.isPending || requestAiSummaryMutation.isPending;

  const actions = (
    <LinkCreateActions
      hasSaveError={Boolean(createLinkMutation.error)}
      isAiOrganizeDisabled={isAiOrganizeDisabled}
      isPreviewLoading={isPreviewLoading}
      isSaveDisabled={isSaveDisabled}
      mode={mode}
      onAiOrganize={handleAiOrganize}
      onSave={handleSave}
    />
  );

  if (mode === "mobile") {
    const stepTitle =
      mobileSheetStep === "folder-picker"
        ? "폴더 선택"
        : mobileSheetStep === "ai-model-picker"
          ? "AI 제공자 선택"
          : "새 링크 추가";

    return (
      <View className="gap-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="w-10 items-start">
            {isMobileSubStep ? (
              <Pressable
                accessibilityLabel="뒤로"
                accessibilityRole="button"
                className="size-10 items-center justify-center rounded-full active:bg-accent web:hover:bg-accent"
                onPress={() => setMobileSheetStep("form")}
              >
                <Icon
                  as={ChevronLeft}
                  size={18}
                  className="text-foreground"
                />
              </Pressable>
            ) : null}
          </View>
          <Text className="flex-1 text-center text-xl font-bold text-primary">{stepTitle}</Text>
          <View className="size-10" />
        </View>

        {mobileSheetStep === "form" ? (
          <>
            <LinkPreviewImage
              isLoading={isPreviewLoading}
              mode={mode}
              preview={linkPreview}
            />
            <View className="gap-2">
              <UrlFieldLabel className="px-1" />
              <View className="flex-row items-start gap-2">
                <View className="min-w-0 flex-1">
                  <FieldError error={errors.url}>
                    <Input
                      accessibilityLabel="URL"
                      className="h-10 rounded-2xl border-primary/30 bg-background px-5 text-lg"
                      value={url}
                      autoCapitalize="none"
                      keyboardType="url"
                      placeholder={URL_PLACEHOLDER}
                      onChangeText={handleUrlChange}
                    />
                  </FieldError>
                </View>
                <Button
                  className="h-10 shrink-0 flex-row items-center gap-1 rounded-2xl bg-primary px-2.5"
                  onPress={handleScanQr}
                >
                  <Icon
                    as={QrCode}
                    size={14}
                    className="text-primary-foreground"
                  />
                  <Text className="text-xs font-semibold text-primary-foreground">QR</Text>
                </Button>
              </View>
            </View>

            <View className="gap-2">
              <Text className="px-1 text-sm font-semibold text-muted-foreground">제목</Text>
              <FieldError error={errors.title}>
                <TitleField isLoading={isPreviewLoading}>
                  <Input
                    accessibilityLabel="제목"
                    className="h-10 rounded-xl border-primary/30 bg-background pr-10"
                    value={title}
                    maxLength={TITLE_MAX_LENGTH}
                    placeholder={
                      isPreviewLoading ? "제목을 불러오는 중…" : "AI 생성으로 자동 정리해보세요"
                    }
                    onChangeText={handleTitleChange}
                  />
                </TitleField>
              </FieldError>
            </View>

            <MobileOptionCard
              eyebrow="폴더"
              label={folder.label}
              onPress={() => setMobileSheetStep("folder-picker")}
            />
            <GenerateTodoRow
              value={generateTodo}
              onValueChange={setGenerateTodo}
            />
            <MobileOptionCard
              eyebrow="AI 제공자"
              icon="🤖"
              label={aiProviderLabel}
              onPress={() => setMobileSheetStep("ai-model-picker")}
            />

            <SheetFooter>{actions}</SheetFooter>
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
            selectedProviderId={aiProvider?.providerId ?? defaultProvider.id ?? null}
            onSelect={(selection) => {
              setAiProvider(selection);
              setMobileSheetStep("form");
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View className="min-h-0 shrink">
      <ScrollView
        className="min-h-0 shrink"
        contentContainerClassName="gap-5 px-8 py-6"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <LinkPreviewImage
          isLoading={isPreviewLoading}
          mode={mode}
          preview={linkPreview}
        />
        <View className="gap-2">
          <UrlFieldLabel />
          <FieldError error={errors.url}>
            <Input
              accessibilityLabel="URL"
              className="h-10 rounded-xl px-4 text-lg"
              value={url}
              autoCapitalize="none"
              keyboardType="url"
              placeholder={URL_PLACEHOLDER}
              onChangeText={handleUrlChange}
            />
          </FieldError>
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-muted-foreground">제목</Text>
          <FieldError error={errors.title}>
            <TitleField isLoading={isPreviewLoading}>
              <Input
                accessibilityLabel="제목"
                className="h-10 rounded-xl px-4 pr-10 text-lg"
                value={title}
                maxLength={TITLE_MAX_LENGTH}
                placeholder={
                  isPreviewLoading ? "제목을 불러오는 중…" : "AI 생성으로 자동 정리해보세요"
                }
                onChangeText={handleTitleChange}
              />
            </TitleField>
          </FieldError>
        </View>

        <View className="flex-row gap-4">
          <View className="min-w-0 flex-1 gap-2">
            <Text className="text-sm font-semibold leading-5 text-muted-foreground">폴더</Text>
            <Popover>
              <PopoverTrigger asChild>
                <WideSelectTrigger
                  accessibilityLabel={`폴더, ${folder.label}`}
                  icon={
                    <Icon
                      as={FolderOpen}
                      size={18}
                      className="text-primary"
                    />
                  }
                  label={folder.label}
                />
              </PopoverTrigger>
              <FolderPickerPopoverContent
                selectedFolderId={folder.id ? Number(folder.id) : null}
                onSelect={handleFolderSelect}
              />
            </Popover>
          </View>
          <View className="min-w-0 flex-1 gap-2">
            <Text className="text-sm font-semibold leading-5 text-muted-foreground">AI 제공자</Text>
            <Popover>
              <PopoverTrigger asChild>
                <WideSelectTrigger
                  accessibilityLabel={`AI 제공자, ${aiProviderLabel}`}
                  icon={<Text className="text-base leading-5">🤖</Text>}
                  label={aiProviderLabel}
                />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                className="max-h-[60vh] w-80 overflow-y-auto p-3"
              >
                <AiProviderPickerListWithClose
                  selectedProviderId={aiProvider?.providerId ?? defaultProvider.id ?? null}
                  onSelect={setAiProvider}
                />
              </PopoverContent>
            </Popover>
          </View>
        </View>

        <GenerateTodoRow
          value={generateTodo}
          onValueChange={setGenerateTodo}
        />

        <View className="gap-2">
          <Text className="text-sm font-semibold text-muted-foreground">메모 (선택)</Text>
          <Textarea
            accessibilityLabel="메모"
            className="scrollbar-none h-10 min-h-10 rounded-xl py-2.5 text-base web:resize-none"
            value={memo}
            numberOfLines={1}
            placeholder="간단한 메모"
            scrollEnabled={false}
            onChangeText={setMemo}
          />
        </View>

        <View className="gap-3">
          <Text className="text-sm font-semibold text-muted-foreground">
            ✅ 액션 (선택, 여러 개 가능)
          </Text>
          <TodoDraftListEditor
            addLabel="액션 추가"
            pickerMode={mode}
            todos={todos}
            onAddTodo={handleAddTodo}
            onChangeTodoTitle={handleTodoTitleChange}
            onChangeTodoMode={handleTodoModeChange}
            onChangeTodoWeekdays={handleTodoWeekdaysChange}
            onChangeTodoDate={handleTodoDateChange}
            onChangeTodoTime={handleTodoTimeChange}
            onRemoveTodo={handleRemoveTodo}
          />
        </View>
      </ScrollView>

      <View className="border-t border-border px-8 py-5">{actions}</View>
    </View>
  );
}

function WideSelectTrigger({
  icon,
  label,
  ...props
}: React.ComponentProps<typeof Button> & { icon: React.ReactNode; label: string }) {
  return (
    <Button
      className="h-10 w-full flex-row justify-start rounded-xl px-4"
      variant="outline"
      {...props}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        {icon}
        <Text
          className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Icon
          as={ChevronDown}
          size={14}
          className="text-muted-foreground"
        />
      </View>
    </Button>
  );
}

function LinkCreateActions({
  hasSaveError,
  isAiOrganizeDisabled,
  isPreviewLoading,
  isSaveDisabled,
  mode,
  onAiOrganize,
  onSave,
}: {
  hasSaveError: boolean;
  isAiOrganizeDisabled: boolean;
  isPreviewLoading: boolean;
  isSaveDisabled: boolean;
  mode: LinkCreateFormMode;
  onAiOrganize: () => void;
  onSave: () => void;
}) {
  const isSheet = mode === "mobile";
  const labelClassName = isSheet ? "text-base font-semibold" : "text-sm font-semibold";
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const saveTextClassName = getSaveLabelClassName(accent, theme);

  return (
    <View className="gap-2.5">
      {hasSaveError ? (
        <View
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          className="flex-row items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5"
        >
          <Icon
            as={CircleAlert}
            className="size-4 shrink-0 text-destructive"
          />
          <Text className="min-w-0 flex-1 text-[13px] font-medium text-foreground">
            링크 저장에 실패했습니다. 잠시 후 다시 시도해주세요.
          </Text>
        </View>
      ) : null}
      <View className={cn("flex-row gap-2", !isSheet && "justify-end")}>
        <Button
          className={cn(
            "flex-row gap-2 rounded-xl bg-primary/15 shadow-none active:bg-primary/20",
            process.env.EXPO_OS === "web" && "hover:bg-primary/20",
            isSheet ? "h-12 flex-1" : "h-10 px-[18px] sm:h-10",
          )}
          disabled={isSaveDisabled}
          variant="secondary"
          onPress={onSave}
        >
          {isPreviewLoading ? (
            <ActivityIndicator accessibilityLabel={PREVIEW_LOADING_LABEL} />
          ) : (
            <Icon
              as={Save}
              className={saveTextClassName}
              size={isSheet ? 18 : 16}
            />
          )}
          <Text className={cn(labelClassName, saveTextClassName)}>저장</Text>
        </Button>
        <Button
          className={cn(
            "flex-row gap-2 rounded-xl",
            isSheet ? "h-12 flex-[2]" : "h-10 w-44 px-[18px] sm:h-10",
          )}
          disabled={isAiOrganizeDisabled}
          variant="gradient"
          onPress={onAiOrganize}
        >
          {isPreviewLoading ? (
            <ActivityIndicator
              accessibilityLabel={PREVIEW_LOADING_LABEL}
              tone="onPrimary"
            />
          ) : null}
          <Text className={labelClassName}>AI 정리</Text>
        </Button>
      </View>
    </View>
  );
}

function UrlFieldLabel({ className }: { className?: string }) {
  return (
    <View className={cn("flex-row items-center gap-2", className)}>
      <Text className="text-sm font-semibold text-muted-foreground">URL</Text>
      <Text className="text-sm font-semibold text-muted-foreground">📋 클립보드 자동 감지</Text>
    </View>
  );
}

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

function AiProviderPickerListWithClose({
  selectedProviderId,
  onSelect,
}: {
  selectedProviderId: number | null;
  onSelect: (selection: AiProviderSelection) => void;
}) {
  const popoverContext = usePopoverContext();

  return (
    <AiProviderPickerList
      selectedProviderId={selectedProviderId}
      onSelect={(selection) => {
        onSelect(selection);
        popoverContext.onOpenChange(false);
      }}
    />
  );
}

// Main image of the fetched preview, shown at the top of the form only when the page
// has one. While the preview loads, the slot shows a loading state.
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
    "w-full overflow-hidden rounded-xl border border-border bg-muted",
    mode === "wide" ? "h-48" : "aspect-video",
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

function TitleField({ children, isLoading }: { children: React.ReactNode; isLoading: boolean }) {
  return (
    <View className="relative justify-center">
      {children}
      {isLoading ? (
        <View
          accessibilityLabel="제목을 불러오는 중"
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

function FieldError({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <View className="gap-1">
      {children}
      {error ? <Text className="text-sm font-medium text-destructive">{error}</Text> : null}
    </View>
  );
}

function GenerateTodoRow({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-primary/30 bg-background px-4 py-3">
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-sm font-semibold text-foreground">액션 생성</Text>
        <Text className="text-xs leading-4 text-muted-foreground">
          AI 정리 때 링크에 마감일이 있으면 액션을 자동으로 만들어줘요
        </Text>
      </View>
      <Switch
        checked={value}
        onCheckedChange={onValueChange}
      />
    </View>
  );
}

function MobileOptionCard({
  eyebrow,
  icon,
  label,
  onPress,
}: {
  eyebrow: string;
  icon?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-background px-4 py-3">
      <View className="min-w-0 flex-1 gap-1.5">
        <Text className="text-sm font-semibold text-muted-foreground">{eyebrow}</Text>
        <View className="min-w-0 flex-row items-center gap-1.5">
          {icon ? <Text>{icon}</Text> : null}
          <Text
            className="min-w-0 flex-1 text-base font-bold text-foreground"
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </View>
      <Button
        className="h-10 rounded-2xl border-primary px-4"
        variant="outline"
        onPress={onPress}
      >
        <Text className="text-sm font-bold text-primary">변경</Text>
      </Button>
    </View>
  );
}

export { LinkCreateForm };
export type { LinkCreateFormMode };
