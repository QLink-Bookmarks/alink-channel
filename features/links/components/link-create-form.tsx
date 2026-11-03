import * as React from "react";
import {
  Pressable,
  ActivityIndicator as RNActivityIndicator,
  ScrollView,
  View,
} from "react-native";

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
import {
  buildScheduleApiFields,
  isScheduleInPast,
  validateDraft,
} from "@/features/todos/lib/todo-schedule";
import { useClipboardFailureFeedback } from "@/lib/clipboard-feedback";
import { reportError } from "@/lib/error-reporting";
import { getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";
import { useQrScanStore } from "@/stores/qr-scan";
import { useToastStore } from "@/stores/toast-store";
import { useQueryClient } from "@tanstack/react-query";

import { getLinkPreviewRequestFields } from "../lib/link-preview/link-preview-result";
import { useCreateLinkMutation } from "../mutations";
import { useLinkPreviewQuery } from "../queries";
import type { CreateLinkTodoRequest, LinkPreview } from "../types";

import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { ChevronDown, ChevronLeft, FolderOpen, QrCode } from "lucide-react-native/icons";

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

  const handleCancel = React.useCallback(() => {
    resetForm();
    onCancel();
  }, [onCancel, resetForm]);

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
        currentTodos.map((todo) => (todo.id === todoId ? { ...todo, mode: nextMode } : todo)),
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
    if (isPreviewLoading) {
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

    setErrors({});

    try {
      const response = await requestAiSummaryMutation.mutateAsync({
        folderId: folder.id ? Number(folder.id) : null,
        generateTodo,
        modelId: target.modelId,
        title: trimmedTitle ? trimmedTitle : null,
        url: trimmedUrl,
        userProviderId: target.userProviderId,
        ...getLinkPreviewRequestFields(linkPreview),
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
    }
  }, [
    aiProvider?.providerId,
    folder.id,
    myProviders,
    generateTodo,
    invalidateLinkQueries,
    isPreviewLoading,
    linkPreview,
    mode,
    onCancel,
    onSaved,
    requestAiSummaryMutation,
    resetForm,
    router,
    showToast,
    title,
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
    if (isPreviewLoading || !validate()) {
      return;
    }

    // Validate todo schedules. Non-empty todos whose mode is "time" or
    // "recurring" must have both date and time. Show inline errors and abort.
    const todosWithTitles = todos.filter((todo) => todo.title.trim().length > 0);
    let hasScheduleError = false;
    const nextTodos = todos.map((todo) => {
      const hasTitle = todo.title.trim().length > 0;
      const scheduleError = hasTitle ? validateDraft(todo) : null;
      if (scheduleError) hasScheduleError = true;
      return { ...todo, validationError: scheduleError };
    });
    if (hasScheduleError) {
      setTodos(nextTodos);
      return;
    }

    try {
      const todoPayload: CreateLinkTodoRequest[] = todosWithTitles.map((todo) => {
        const trimmedTitle = todo.title.trim();
        const schedule = buildScheduleApiFields(todo);
        return { title: trimmedTitle, ...schedule };
      });

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
      resetForm();
      onSaved?.(response.data.id);
    } catch (error: unknown) {
      console.log("link-create:save-failed", error);
    }
  }, [
    createLinkMutation,
    folder.id,
    invalidateLinkQueries,
    isPreviewLoading,
    linkPreview,
    memo,
    onSaved,
    resetForm,
    title,
    todos,
    url,
    validate,
  ]);

  const aiProviderLabel = aiProvider?.providerLabel ?? "기본 제공자 사용";
  const isSaveDisabled = isPreviewLoading || createLinkMutation.isPending;
  const isAiOrganizeDisabled = isPreviewLoading || requestAiSummaryMutation.isPending;

  const decoratedTodos = React.useMemo(
    () => todos.map((todo) => ({ ...todo, isPast: isScheduleInPast(todo) })),
    [todos],
  );

  if (mode === "mobile") {
    const stepTitle =
      mobileSheetStep === "folder-picker"
        ? "폴더 선택"
        : mobileSheetStep === "ai-model-picker"
          ? "AI 제공자 모델"
          : "링크 추가";

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
            <View className="flex-row items-start gap-2">
              <View className="min-w-0 flex-1">
                <FieldError error={errors.url}>
                  <Input
                    className="h-10 rounded-2xl border-primary/30 bg-background px-5 text-lg"
                    value={url}
                    autoCapitalize="none"
                    keyboardType="url"
                    placeholder="https://..."
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

            <View className="gap-2">
              <Text className="px-1 text-sm font-semibold text-muted-foreground">링크 제목</Text>
              <FieldError error={errors.title}>
                <TitleField isLoading={isPreviewLoading}>
                  <Input
                    className="h-10 rounded-xl border-primary/30 bg-background pr-10"
                    value={title}
                    maxLength={300}
                    placeholder={
                      isPreviewLoading ? "제목을 불러오는 중…" : "AI 생성으로 자동 정리해보세요"
                    }
                    onChangeText={handleTitleChange}
                  />
                </TitleField>
              </FieldError>
            </View>

            <View className="flex-row gap-3">
              <Button
                className="h-10 flex-1 flex-row gap-2 rounded-2xl"
                disabled={isSaveDisabled}
                onPress={handleSave}
              >
                {isPreviewLoading ? <ButtonSpinner /> : null}
                <Text>저장</Text>
              </Button>
              <Button
                className="h-10 flex-1 flex-row gap-2 rounded-2xl"
                disabled={isAiOrganizeDisabled}
                variant="gradient"
                onPress={handleAiOrganize}
              >
                {isPreviewLoading ? <ButtonSpinner /> : null}
                <Text>AI 정리</Text>
              </Button>
            </View>

            <MobileOptionCard
              eyebrow="폴더"
              icon={folder.id ? undefined : "✨"}
              label={folder.id ? folder.label : "AI 자동 분류"}
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

            {createLinkMutation.error ? (
              <Text className="text-sm font-medium text-destructive">
                링크 저장에 실패했습니다. 잠시 후 다시 시도해주세요.
              </Text>
            ) : null}

            <Button
              className="self-center bg-transparent shadow-none"
              variant="ghost"
              onPress={handleCancel}
            >
              <Text className="text-base font-semibold text-muted-foreground">취소</Text>
            </Button>
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
          <View className="flex-row items-center gap-2">
            <Text className="text-sm font-semibold text-muted-foreground">URL</Text>
            <Text className="text-sm font-semibold text-muted-foreground">
              📋 클립보드 자동 감지
            </Text>
          </View>
          <FieldError error={errors.url}>
            <Input
              className="h-10 rounded-xl px-4 text-lg"
              value={url}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://www.example.com"
              onChangeText={handleUrlChange}
            />
          </FieldError>
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-muted-foreground">제목</Text>
          <FieldError error={errors.title}>
            <TitleField isLoading={isPreviewLoading}>
              <Input
                className="h-10 rounded-xl px-4 pr-10 text-lg"
                value={title}
                maxLength={300}
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
            <Text className="text-sm font-semibold text-muted-foreground">폴더</Text>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  accessibilityLabel={`폴더, ${folder.label}`}
                  className="h-10 w-full flex-row justify-start rounded-xl px-4"
                  variant="outline"
                >
                  <View className="min-w-0 flex-1 flex-row items-center gap-2">
                    <Icon
                      as={FolderOpen}
                      size={18}
                      className="text-primary"
                    />
                    <Text
                      className="min-w-0 flex-1 text-sm font-medium leading-5 text-foreground"
                      numberOfLines={1}
                    >
                      {folder.label}
                    </Text>
                    <Icon
                      as={ChevronDown}
                      size={14}
                      className="text-muted-foreground"
                    />
                  </View>
                </Button>
              </PopoverTrigger>
              <FolderPickerPopoverContent
                selectedFolderId={folder.id ? Number(folder.id) : null}
                onSelect={handleFolderSelect}
              />
            </Popover>
          </View>
          <View className="min-w-0 flex-1 gap-2">
            <Text className="text-sm font-semibold text-muted-foreground">메모 (선택)</Text>
            <Textarea
              className="scrollbar-none h-10 min-h-10 rounded-xl py-2.5 text-base web:resize-none"
              value={memo}
              numberOfLines={1}
              placeholder="간단한 메모"
              scrollEnabled={false}
              onChangeText={setMemo}
            />
          </View>
        </View>

        <GenerateTodoRow
          value={generateTodo}
          onValueChange={setGenerateTodo}
        />

        {/* TODO: AI 요약 제공자 API와 실제 옵션이 정리되면 와이드 전용 선택 UI 복구 */}

        <View className="gap-3">
          <Text className="text-sm font-semibold text-muted-foreground">
            ✅ 할 일 (선택, 여러 개 가능)
          </Text>
          <TodoDraftListEditor
            addLabel="할 일 추가"
            pickerMode={mode}
            todos={decoratedTodos}
            onAddTodo={handleAddTodo}
            onChangeTodoTitle={handleTodoTitleChange}
            onChangeTodoMode={handleTodoModeChange}
            onChangeTodoWeekdays={handleTodoWeekdaysChange}
            onChangeTodoDate={handleTodoDateChange}
            onChangeTodoTime={handleTodoTimeChange}
            onRemoveTodo={handleRemoveTodo}
          />
        </View>

        {createLinkMutation.error ? (
          <Text className="text-sm font-medium text-destructive">
            링크 저장에 실패했습니다. 잠시 후 다시 시도해주세요.
          </Text>
        ) : null}
      </ScrollView>

      <View className="flex-row items-center justify-end gap-3 border-t border-border px-8 py-5">
        <Button
          className="h-10"
          variant="outline"
          onPress={handleCancel}
        >
          <Text>취소</Text>
        </Button>
        <Button
          className="h-10 flex-row gap-2"
          disabled={isSaveDisabled}
          onPress={handleSave}
        >
          {isPreviewLoading ? <ButtonSpinner /> : null}
          <Text>저장</Text>
        </Button>
        <Button
          className="h-10 flex-row gap-2"
          disabled={isAiOrganizeDisabled}
          variant="gradient"
          onPress={handleAiOrganize}
        >
          {isPreviewLoading ? <ButtonSpinner /> : null}
          <Text>AI 정리</Text>
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="h-10 flex-row items-center gap-1 rounded-2xl px-3"
              variant="outline"
            >
              <Text className="text-sm font-semibold">{aiProviderLabel}</Text>
              <Icon
                as={ChevronDown}
                size={14}
                className="text-foreground"
              />
            </Button>
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
// TODO(#5): swap this for `LinkThumbnail` from features/links/components/link-thumbnail
// once PR 1 (presentation) is merged.
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

function ButtonSpinner() {
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  return (
    <RNActivityIndicator
      accessibilityLabel="미리보기를 불러오는 중"
      color={getThemeTokens(theme, accent).primaryForeground}
      size="small"
    />
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
        <Text className="text-sm font-semibold text-foreground">할 일 생성</Text>
        <Text className="text-xs leading-4 text-muted-foreground">
          AI 요약 시 링크에 데드라인이 있으면 할 일을 자동으로 생성해줘요
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
