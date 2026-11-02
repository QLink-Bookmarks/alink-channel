import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DateValue } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { type TimeValue } from "@/components/ui/time-picker";
import { useMyProfileQuery } from "@/features/account/queries";
import { FolderPickerDialog } from "@/features/folders/components/folder-picker-dialog";
import {
  type FolderPickerSelection,
  UNCATEGORIZED_PICKER_OPTION,
} from "@/features/folders/components/folder-picker-list";
import { getMoveTargetFolderId } from "@/features/folders/lib/folder-pages";
import { useFoldersQuery } from "@/features/folders/queries";
import {
  formatLinkStatus,
  formatSummaryModelLabel,
  getDomainFromUrl,
} from "@/features/home/lib/link-card-mapper";
import { buildShareText } from "@/features/links/lib/build-share-text";
import { formatTagLabel } from "@/features/links/lib/format-tag-label";
import { openLinkUrl } from "@/features/links/lib/open-link-url";
import { shareLink } from "@/features/links/lib/share-link";
import {
  useCopyLinkMutation,
  useDeleteLinkMutation,
  usePatchLinkMutation,
  useSetLinkFavoriteMutation,
  useUpdateLinkMutation,
} from "@/features/links/mutations";
import { getLinkDetailQueryKey } from "@/features/links/queries";
import type {
  LinkDetail,
  LinkDetailResponse,
  LinkTodo,
  UpdateLinkRequest,
} from "@/features/links/types";
import {
  type TodoDraftEditorItem,
  TodoDraftListEditor,
} from "@/features/todos/components/todo-draft-list-editor";
import { type WeekdayValue } from "@/features/todos/components/todo-editor/todo-editor";
import { TodoItem } from "@/features/todos/components/todo-item/todo-item";
import { formatReminderLabel } from "@/features/todos/lib/todo-list-helpers";
import {
  buildScheduleApiFields,
  isScheduleInPast,
  readScheduleFromTodo,
  validateDraft,
} from "@/features/todos/lib/todo-schedule";
import {
  useCreateTodoMutation,
  useDeleteTodoMutation,
  useToggleTodoCompletedMutation,
  useUpdateTodoMutation,
} from "@/features/todos/mutations";
import { reportError } from "@/lib/error-reporting";
import { useGridColumns } from "@/lib/hooks/use-grid-columns";
import { cn } from "@/lib/utils";
import type { FolderSection } from "@/stores/folder-navigation";
import { useToastStore } from "@/stores/toast-store";
import { useQueryClient } from "@tanstack/react-query";

import { DetailActionButton, HoverLabel, RefreshButton } from "./link-detail-parts";
import { LinkThumbnail } from "./link-thumbnail/link-thumbnail";

import { type Href, useRouter } from "expo-router";
import { Ellipsis, FolderPlus, Pencil, Share2, Star, Trash2, X } from "lucide-react-native/icons";

const TODO_GRID_GAP = 10;
const PERSONAL_FOLDER_SECTIONS: FolderSection[] = ["mine"];

const defaultWeekdays: WeekdayValue[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function getTodoTitle(todo: LinkTodo) {
  return todo.title ?? todo.content ?? "할 일";
}

function getTodoDone(todo: LinkTodo) {
  return todo.done ?? todo.completed ?? Boolean(todo.completedAt);
}

function buildTodoDrafts(todos: LinkTodo[]): TodoDraftEditorItem[] {
  return todos.map((todo) => {
    const schedule = readScheduleFromTodo({
      reminderAt: todo.reminderAt,
      dueAt: todo.dueAt,
      repeatUntil: todo.repeatUntil,
      repeatDays: todo.repeatDays ?? null,
      repeatTime: todo.repeatTime,
    });
    return {
      id: todo.id,
      mode: schedule.mode,
      date: schedule.date,
      time: schedule.time,
      selectedWeekdays: schedule.selectedWeekdays.length
        ? schedule.selectedWeekdays
        : defaultWeekdays,
      title: getTodoTitle(todo),
    };
  });
}

function createEmptyTodoDraft(index: number): TodoDraftEditorItem {
  return {
    id: `draft-${Date.now()}-${index}`,
    mode: "none",
    date: null,
    time: null,
    selectedWeekdays: defaultWeekdays,
    title: "",
  };
}

function DetailSection({
  title,
  action,
  children,
  testID,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      className="gap-2.5"
      testID={testID}
    >
      <View className="min-h-8 flex-row items-center justify-between gap-3">
        <Text className="text-xs font-semibold text-muted-foreground">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function DetailPlaceholder({ label }: { label: string }) {
  return (
    <View className="rounded-[14px] border border-dashed border-border px-4 py-3.5">
      <Text className="text-xs font-medium text-muted-foreground">{label}</Text>
    </View>
  );
}

function buildUpdateLinkPayload(
  detail: LinkDetail,
  overrides: Partial<Pick<UpdateLinkRequest, "memo" | "summary" | "tags" | "title">> = {},
): UpdateLinkRequest {
  // TODO: Switch link detail field updates to PATCH /api/links/{id} when the server exposes partial update support.
  // PUT replaces the whole link, so every preserved field (esp. folderId) must be
  // resent — otherwise the server drops the link back to uncategorized, and clears
  // the representative image, the favicon and the video flag.
  return {
    faviconUrl: detail.faviconUrl ?? null,
    folderId: detail.folderId ?? null,
    isVideo: detail.isVideo ?? false,
    thumbnailUrl: detail.thumbnailUrl ?? null,
    memo: overrides.memo ?? detail.memo,
    sourceType: detail.sourceType,
    summary: overrides.summary ?? detail.summary,
    tags: overrides.tags ?? detail.tags,
    title: overrides.title ?? detail.title,
    url: detail.url,
  };
}

function LinkEditFields({
  title,
  summary,
  onChangeTitle,
  onChangeSummary,
  onCancel,
  onSave,
  saving,
  canSave,
}: {
  title: string;
  summary: string;
  onChangeTitle: (value: string) => void;
  onChangeSummary: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
}) {
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">제목</Text>
        <Input
          className="h-11 rounded-xl px-4 text-base"
          value={title}
          maxLength={300}
          placeholder="링크 제목"
          onChangeText={onChangeTitle}
        />
      </View>
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">한 줄 요약</Text>
        <Textarea
          className="min-h-24 rounded-xl bg-card px-4 py-3 text-base dark:bg-card"
          value={summary}
          placeholder="한 줄 요약을 입력해주세요"
          onChangeText={onChangeSummary}
        />
      </View>
      <View className="flex-row gap-3 pt-1">
        <Button
          className="h-11 flex-1"
          variant="outline"
          disabled={saving}
          onPress={onCancel}
        >
          <Text>취소</Text>
        </Button>
        <Button
          className="h-11 flex-1"
          disabled={saving || !canSave}
          onPress={onSave}
        >
          {saving ? <ActivityIndicator /> : <Text>저장</Text>}
        </Button>
      </View>
    </View>
  );
}

function mergeLinkDetail(base: LinkDetail, incoming: Partial<LinkDetail>): LinkDetail {
  return {
    ...base,
    ...incoming,
    // Update responses (PUT/PATCH) can omit or null the folder fields; keep the
    // known values so the folder-move modal still preselects the current folder.
    folderId: incoming.folderId ?? base.folderId ?? null,
    folderEmoji: incoming.folderEmoji ?? base.folderEmoji ?? null,
    folderName: incoming.folderName ?? base.folderName ?? null,
    // The PUT response does not echo the preview fields; the request resent them unchanged.
    thumbnailUrl: incoming.thumbnailUrl ?? base.thumbnailUrl ?? null,
    faviconUrl: incoming.faviconUrl ?? base.faviconUrl ?? null,
    isVideo: incoming.isVideo ?? base.isVideo ?? false,
    memo: incoming.memo ?? base.memo ?? null,
    summary: incoming.summary ?? base.summary ?? null,
    tags: incoming.tags ?? base.tags ?? [],
    todos: incoming.todos ?? base.todos ?? [],
  };
}

function LinkDetailView({
  detail,
  mode,
  onClose,
  onDeleted,
}: {
  detail: LinkDetail;
  mode: "panel" | "screen";
  onClose?: () => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const memoInputRef = React.useRef<TextInput>(null);
  const updateLinkMutation = useUpdateLinkMutation(detail.id);
  const setFavoriteMutation = useSetLinkFavoriteMutation();
  const myProfileQuery = useMyProfileQuery();
  const foldersQuery = useFoldersQuery({ size: 15 });
  const copyLinkMutation = useCopyLinkMutation(detail.id);
  const patchLinkMutation = usePatchLinkMutation(detail.id);
  const showToast = useToastStore((state) => state.showToast);
  const deleteLinkMutation = useDeleteLinkMutation(detail.id);
  const createTodoMutation = useCreateTodoMutation();
  const updateTodoMutation = useUpdateTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation();
  const toggleTodoCompletedMutation = useToggleTodoCompletedMutation();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [hasRefreshFailed, setHasRefreshFailed] = React.useState(false);
  const isRefreshingRef = React.useRef(false);
  const todoGrid = useGridColumns({
    gap: TODO_GRID_GAP,
    // The wide panel is 380–520px inside its padding: 180px keeps it at two columns.
    minItemWidth: mode === "panel" ? 180 : 300,
  });
  const domain = React.useMemo(() => getDomainFromUrl(detail.url), [detail.url]);
  const tags = React.useMemo(() => detail.tags ?? [], [detail.tags]);
  const todos = React.useMemo(() => detail.todos ?? [], [detail.todos]);
  const dueTodos = todos.filter((todo) => !getTodoDone(todo));
  const [isTagInputVisible, setIsTagInputVisible] = React.useState(false);
  const [tagDraft, setTagDraft] = React.useState("");
  const [isTagEditMode, setIsTagEditMode] = React.useState(false);
  const [pendingTagName, setPendingTagName] = React.useState<string | null>(null);
  const [isFolderMoveOpen, setIsFolderMoveOpen] = React.useState(false);
  const [isCopyFolderOpen, setIsCopyFolderOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [summaryDraft, setSummaryDraft] = React.useState("");
  const [isUnsavedEditOpen, setIsUnsavedEditOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isMemoEditing, setIsMemoEditing] = React.useState(false);
  const [memoDraft, setMemoDraft] = React.useState(detail.memo ?? "");
  const [isTodoEditorOpen, setIsTodoEditorOpen] = React.useState(false);
  const [pendingTodoIds, setPendingTodoIds] = React.useState<string[]>([]);
  const [todoDrafts, setTodoDrafts] = React.useState<TodoDraftEditorItem[]>(() =>
    buildTodoDrafts(todos),
  );
  const [todoEditorError, setTodoEditorError] = React.useState<string | null>(null);

  const linkStatusMeta = React.useMemo(
    () => formatLinkStatus(detail.status, detail.workModel),
    [detail.status, detail.workModel],
  );
  const summaryModelLabel = React.useMemo(
    () => formatSummaryModelLabel(detail.status, detail.workModel),
    [detail.status, detail.workModel],
  );

  const currentFolder = React.useMemo(
    () =>
      detail.folderId != null
        ? (foldersQuery.data?.contents ?? []).find((folder) => folder.id === detail.folderId)
        : undefined,
    [detail.folderId, foldersQuery.data?.contents],
  );
  const isSharedFolder = currentFolder?.isShared === true;
  const isFolderOwner =
    currentFolder?.ownerId != null &&
    myProfileQuery.data?.id != null &&
    currentFolder.ownerId === myProfileQuery.data.id;
  const isMyOwnLink = !isSharedFolder || isFolderOwner;
  const folderLabel = detail.folderName
    ? `${detail.folderEmoji ?? "📁"} ${detail.folderName}`
    : "📭 폴더 없음";

  const isTodoMutationPending =
    createTodoMutation.isPending || updateTodoMutation.isPending || deleteTodoMutation.isPending;
  const hasInvalidTodoDraft = todoDrafts.some((todo) => !todo.title.trim());

  React.useEffect(() => {
    setMemoDraft(detail.memo ?? "");
  }, [detail.memo]);

  React.useEffect(() => {
    if (!isTodoEditorOpen) {
      setTodoDrafts(buildTodoDrafts(todos));
      setTodoEditorError(null);
    }
  }, [isTodoEditorOpen, todos]);

  React.useEffect(() => {
    if (!isMemoEditing) {
      return;
    }

    const timeoutId = setTimeout(() => {
      memoInputRef.current?.focus();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [isMemoEditing]);

  const handleDetailUpdated = React.useCallback(
    (response: LinkDetailResponse) => {
      queryClient.setQueryData<LinkDetail>(getLinkDetailQueryKey(detail.id), (currentDetail) =>
        mergeLinkDetail(currentDetail ?? detail, response.data as Partial<LinkDetail>),
      );
      // Cards show the title, tags and star, so the link lists follow the detail.
      void queryClient.invalidateQueries({ queryKey: ["links", "list"] });
    },
    [detail, queryClient],
  );

  const refreshDetail = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: getLinkDetailQueryKey(detail.id),
    });
  }, [detail.id, queryClient]);

  // Link cards show todo counts, so every todo change also refreshes the link lists.
  const invalidateLinkLists = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["links", "list"] });
  }, [queryClient]);

  const handleRefresh = React.useCallback(async () => {
    // One refresh at a time: extra presses while it runs are ignored.
    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      // Refetch the detail query itself; a failure rejects and the cached detail stays.
      await queryClient.refetchQueries(
        { exact: true, queryKey: getLinkDetailQueryKey(detail.id) },
        { throwOnError: true },
      );
      setHasRefreshFailed(false);
    } catch (error: unknown) {
      setHasRefreshFailed(true);
      showToast({
        description: "잠시 후 다시 시도해주세요.",
        dismissible: true,
        durationMs: 4000,
        sourceKey: "link-detail-refresh",
        title: "새로고침에 실패했어요.",
        variant: "error",
      });
      reportError(error, { area: "link-detail-view:refresh", extra: { linkId: detail.id } });
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [detail.id, queryClient, showToast]);

  const handleFolderMoveConfirm = React.useCallback(
    async (selection: FolderPickerSelection) => {
      try {
        const response = await patchLinkMutation.mutateAsync({
          folderId: getMoveTargetFolderId(selection.id),
        });
        handleDetailUpdated(response);
      } catch (error: unknown) {
        reportError(error, {
          area: "link-detail-view:folder-move",
          extra: { folderId: selection.id, linkId: detail.id },
        });
        throw error;
      }

      showToast({
        dismissible: true,
        durationMs: 4000,
        sourceKey: "link-detail-folder-move",
        title: selection.id == null ? "폴더에서 꺼냈어요." : `'${selection.label}'(으)로 옮겼어요.`,
        variant: "success",
      });

      void queryClient.invalidateQueries({ queryKey: ["links", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
      // Refetch the authoritative detail so moving out to "없음" clears the folder
      // instead of keeping the merged-in previous value.
      void queryClient.invalidateQueries({ queryKey: getLinkDetailQueryKey(detail.id) });
    },
    [detail.id, handleDetailUpdated, patchLinkMutation, queryClient, showToast],
  );

  const handleTodoCompletedChange = React.useCallback(
    async (todoId: number | string, checked: boolean) => {
      const todoKey = String(todoId);

      if (pendingTodoIds.includes(todoKey)) {
        return;
      }

      const queryKey = getLinkDetailQueryKey(detail.id);
      const previousDetail = queryClient.getQueryData<LinkDetail>(queryKey) ?? detail;

      setPendingTodoIds((currentIds) => [...currentIds, todoKey]);

      queryClient.setQueryData<LinkDetail>(queryKey, (currentDetail) => {
        const baseDetail = currentDetail ?? previousDetail;

        return {
          ...baseDetail,
          todos: (baseDetail.todos ?? []).map((todo) =>
            String(todo.id) === String(todoId)
              ? {
                  ...todo,
                  completed: checked,
                  completedAt: checked ? (todo.completedAt ?? new Date().toISOString()) : null,
                  done: checked,
                }
              : todo,
          ),
        };
      });

      try {
        const response = await toggleTodoCompletedMutation.mutateAsync({
          payload: { isCompleted: checked },
          todoId,
        });

        queryClient.setQueryData<LinkDetail>(queryKey, (currentDetail) => {
          const baseDetail = currentDetail ?? previousDetail;

          return {
            ...baseDetail,
            todos: (baseDetail.todos ?? []).map((todo) =>
              String(todo.id) === String(todoId)
                ? {
                    ...todo,
                    completed: checked,
                    completedAt: checked ? (response.data?.completeAt ?? null) : null,
                    done: checked,
                  }
                : todo,
            ),
          };
        });

        await refreshDetail();
        invalidateLinkLists();
      } catch (error: unknown) {
        queryClient.setQueryData(queryKey, previousDetail);
        reportError(error, {
          area: "link-detail-view:toggle-todo-completed",
          extra: { isCompleted: checked, linkId: detail.id, todoId },
        });
      } finally {
        setPendingTodoIds((currentIds) => currentIds.filter((id) => id !== todoKey));
      }
    },
    [
      detail,
      invalidateLinkLists,
      pendingTodoIds,
      queryClient,
      refreshDetail,
      toggleTodoCompletedMutation,
    ],
  );

  const handleOpenOriginal = React.useCallback(() => {
    openLinkUrl(detail.url);
  }, [detail.url]);

  const handleShowTagInput = React.useCallback(() => {
    setIsTagInputVisible(true);
    setTagDraft("");
    setIsTagEditMode(false);
  }, []);

  const handleTagCreateBlur = React.useCallback(async () => {
    const nextTag = tagDraft.trim();
    setIsTagInputVisible(false);

    if (!nextTag) {
      setTagDraft("");
      return;
    }

    setPendingTagName(nextTag);

    try {
      const response = await updateLinkMutation.mutateAsync(
        buildUpdateLinkPayload(detail, {
          tags: [...tags, nextTag],
        }),
      );

      handleDetailUpdated(response);
    } catch (error: unknown) {
      reportError(error, {
        area: "link-detail-view:add-tag",
        extra: { linkId: detail.id, tag: nextTag },
      });
    } finally {
      setPendingTagName(null);
      setTagDraft("");
    }
  }, [detail, handleDetailUpdated, tagDraft, tags, updateLinkMutation]);

  const handleTagRemove = React.useCallback(
    async (tagToRemove: string) => {
      setPendingTagName(tagToRemove);

      try {
        const response = await updateLinkMutation.mutateAsync(
          buildUpdateLinkPayload(detail, {
            tags: tags.filter((tag) => tag !== tagToRemove),
          }),
        );

        handleDetailUpdated(response);
        if (tags.length <= 1) {
          setIsTagEditMode(false);
        }
      } catch (error: unknown) {
        reportError(error, {
          area: "link-detail-view:remove-tag",
          extra: { linkId: detail.id, tag: tagToRemove },
        });
      } finally {
        setPendingTagName(null);
      }
    },
    [detail, handleDetailUpdated, tags, updateLinkMutation],
  );

  const handleToggleFavorite = React.useCallback(async () => {
    const next = !detail.isFavorite;
    try {
      await setFavoriteMutation.mutateAsync({
        linkId: detail.id,
        payload: { isFavorite: next },
      });
      handleDetailUpdated({
        success: true,
        data: { ...detail, isFavorite: next },
        error: null,
      });
      await queryClient.invalidateQueries({ queryKey: ["links", "list"] });
    } catch (error: unknown) {
      reportError(error, {
        area: "link-detail-view:toggle-favorite",
        extra: { linkId: detail.id, next },
      });
    }
  }, [detail, handleDetailUpdated, queryClient, setFavoriteMutation]);

  const handleShare = React.useCallback(async () => {
    const nickname = myProfileQuery.data?.nickname?.trim() || "ALINKer";
    const payload = buildShareText({
      nickname,
      linkTitle: detail.title,
      linkUrl: detail.url,
    });
    try {
      const result = await shareLink(payload);
      if (result === "copied") {
        showToast({
          description: "공유 문구가 복사됐어요. 원하는 곳에 붙여넣어 주세요.",
          dismissible: true,
          durationMs: 3000,
          sourceKey: "link-detail-share",
          title: "링크 복사 완료",
          variant: "success",
        });
      } else if (result === "failed") {
        showToast({
          description: "공유에 실패했어요. 잠시 후 다시 시도해주세요.",
          dismissible: true,
          durationMs: 3000,
          sourceKey: "link-detail-share",
          title: "공유 실패",
          variant: "warning",
        });
      }
    } catch (error: unknown) {
      reportError(error, {
        area: "link-detail-view:share",
        extra: { linkId: detail.id },
      });
    }
  }, [detail.id, detail.title, detail.url, myProfileQuery.data, showToast]);

  const navigateToLink = React.useCallback(
    (linkId: number) => {
      if (mode === "panel") {
        router.replace(`/links?linkId=${linkId}` as Href);
        return;
      }

      router.push(`/links/${linkId}` as Href);
    },
    [mode, router],
  );

  const handleCopyToPersonalConfirm = React.useCallback(
    async (selection: FolderPickerSelection) => {
      const folderId = selection.id;
      if (detail.folderId == null) {
        return;
      }

      let copiedLinkId: number | undefined;
      try {
        const response = await copyLinkMutation.mutateAsync({
          fromFolderId: detail.folderId,
          toFolderId: folderId,
        });
        copiedLinkId = response.data?.id;
      } catch (error: unknown) {
        reportError(error, {
          area: "link-detail-view:copy-link",
          extra: { fromFolderId: detail.folderId, linkId: detail.id, toFolderId: folderId },
        });
        throw error;
      }

      const nextLinkId = copiedLinkId;
      showToast({
        actionLabel: nextLinkId != null ? "이동" : undefined,
        dismissible: true,
        durationMs: 6000,
        onAction: nextLinkId != null ? () => navigateToLink(nextLinkId) : undefined,
        sourceKey: "link-detail-copy",
        title: "링크가 복사됐어요.",
        variant: "success",
      });

      void queryClient.invalidateQueries({ queryKey: ["links", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
    [copyLinkMutation, detail.folderId, detail.id, navigateToLink, queryClient, showToast],
  );

  const openEditSheet = React.useCallback(() => {
    setTitleDraft(detail.title);
    setSummaryDraft(detail.summary ?? "");
    setIsEditOpen(true);
  }, [detail.summary, detail.title]);

  const isEditDirty =
    titleDraft.trim() !== detail.title.trim() ||
    summaryDraft.trim() !== (detail.summary ?? "").trim();

  const handleSaveEdit = React.useCallback(async () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      showToast({
        title: "제목을 입력해주세요.",
        variant: "warning",
        dismissible: true,
        durationMs: 3000,
        sourceKey: "link-detail-edit",
      });
      return;
    }
    try {
      const response = await updateLinkMutation.mutateAsync(
        buildUpdateLinkPayload(detail, {
          summary: summaryDraft.trim() ? summaryDraft.trim() : null,
          title: nextTitle,
        }),
      );
      handleDetailUpdated(response);
      setIsUnsavedEditOpen(false);
      setIsEditOpen(false);
      showToast({
        title: "수정했어요.",
        variant: "success",
        dismissible: true,
        durationMs: 3000,
        sourceKey: "link-detail-edit",
      });
    } catch (error: unknown) {
      reportError(error, { area: "link-detail-view:edit", extra: { linkId: detail.id } });
      showToast({
        title: "수정에 실패했어요.",
        description: "잠시 후 다시 시도해주세요.",
        variant: "error",
        dismissible: true,
        durationMs: 3000,
        sourceKey: "link-detail-edit",
      });
    }
  }, [detail, handleDetailUpdated, showToast, summaryDraft, titleDraft, updateLinkMutation]);

  // Edits live in a modal, so the user can't scroll away and lose the save
  // action. If they try to dismiss with unsaved changes, confirm first.
  const handleRequestCloseEdit = React.useCallback(() => {
    if (isEditDirty) {
      setIsUnsavedEditOpen(true);
      return;
    }
    setIsEditOpen(false);
  }, [isEditDirty]);

  const handleDiscardEdit = React.useCallback(() => {
    setIsUnsavedEditOpen(false);
    setIsEditOpen(false);
  }, []);

  const handleDeleteLink = React.useCallback(async () => {
    if (deleteLinkMutation.isPending) {
      return;
    }

    try {
      await deleteLinkMutation.mutateAsync();
      setIsDeleteDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["links", "list"] }),
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
      ]);
      onDeleted?.();
    } catch (error: unknown) {
      reportError(error, {
        area: "link-detail-view:delete-link",
        extra: { linkId: detail.id },
      });
    }
  }, [deleteLinkMutation, detail.id, onDeleted, queryClient]);

  const handleMemoEditStart = React.useCallback(() => {
    setMemoDraft(detail.memo ?? "");
    setIsMemoEditing(true);
  }, [detail.memo]);

  const handleMemoEditCancel = React.useCallback(() => {
    setMemoDraft(detail.memo ?? "");
    setIsMemoEditing(false);
  }, [detail.memo]);

  const handleMemoConfirm = React.useCallback(async () => {
    try {
      const response = await updateLinkMutation.mutateAsync(
        buildUpdateLinkPayload(detail, {
          memo: memoDraft.trim() ? memoDraft.trim() : null,
        }),
      );

      handleDetailUpdated(response);
      setMemoDraft(response.data.memo ?? "");
      setIsMemoEditing(false);
    } catch (error: unknown) {
      reportError(error, {
        area: "link-detail-view:update-memo",
        extra: { linkId: detail.id },
      });
    }
  }, [detail, handleDetailUpdated, memoDraft, updateLinkMutation]);

  const handleTodoEditorOpen = React.useCallback(() => {
    setTodoDrafts(buildTodoDrafts(todos));
    setTodoEditorError(null);
    setIsTodoEditorOpen(true);
  }, [todos]);

  const handleTodoEditorClose = React.useCallback(() => {
    if (isTodoMutationPending) {
      return;
    }

    setIsTodoEditorOpen(false);
    setTodoDrafts(buildTodoDrafts(todos));
    setTodoEditorError(null);
  }, [isTodoMutationPending, todos]);

  const handleAddTodoDraft = React.useCallback(() => {
    setTodoDrafts((currentDrafts) => [
      ...currentDrafts,
      createEmptyTodoDraft(currentDrafts.length),
    ]);
  }, []);

  const handleTodoDraftTitleChange = React.useCallback(
    (todoId: number | string, nextTitle: string) => {
      setTodoDrafts((currentDrafts) =>
        currentDrafts.map((todo) => (todo.id === todoId ? { ...todo, title: nextTitle } : todo)),
      );
    },
    [],
  );

  const handleTodoDraftModeChange = React.useCallback(
    (todoId: number | string, nextMode: TodoDraftEditorItem["mode"]) => {
      setTodoDrafts((currentDrafts) =>
        currentDrafts.map((todo) => (todo.id === todoId ? { ...todo, mode: nextMode } : todo)),
      );
    },
    [],
  );

  const handleTodoDraftWeekdaysChange = React.useCallback(
    (todoId: number | string, nextWeekdays: WeekdayValue[]) => {
      setTodoDrafts((currentDrafts) =>
        currentDrafts.map((todo) =>
          todo.id === todoId ? { ...todo, selectedWeekdays: nextWeekdays } : todo,
        ),
      );
    },
    [],
  );

  const handleTodoDraftRemove = React.useCallback((todoId: number | string) => {
    setTodoDrafts((currentDrafts) => currentDrafts.filter((todo) => todo.id !== todoId));
  }, []);

  const handleTodoDraftDateChange = React.useCallback(
    (todoId: number | string, nextDate: DateValue) => {
      setTodoDrafts((currentDrafts) =>
        currentDrafts.map((todo) =>
          todo.id === todoId ? { ...todo, date: nextDate, validationError: null } : todo,
        ),
      );
    },
    [],
  );

  const handleTodoDraftTimeChange = React.useCallback(
    (todoId: number | string, nextTime: TimeValue) => {
      setTodoDrafts((currentDrafts) =>
        currentDrafts.map((todo) =>
          todo.id === todoId ? { ...todo, time: nextTime, validationError: null } : todo,
        ),
      );
    },
    [],
  );

  const handleTodoSave = React.useCallback(async () => {
    if (hasInvalidTodoDraft) {
      setTodoEditorError("할 일 제목을 모두 입력해주세요.");
      return;
    }

    // Schedule validation: any todo with title that's in time/recurring mode must
    // have date + time (and recurring needs at least one weekday).
    let hasScheduleError = false;
    const nextDrafts = todoDrafts.map((draft) => {
      if (draft.title.trim().length === 0) return draft;
      const error = validateDraft(draft);
      if (error) hasScheduleError = true;
      return { ...draft, validationError: error };
    });
    if (hasScheduleError) {
      setTodoDrafts(nextDrafts);
      setTodoEditorError("필수 항목을 입력해주세요.");
      return;
    }

    setTodoEditorError(null);

    const originalTodosById = new Map(todos.map((todo) => [String(todo.id), todo]));
    const removedTodoIds = todos
      .filter((todo) => !todoDrafts.some((draft) => String(draft.id) === String(todo.id)))
      .map((todo) => todo.id);

    try {
      for (const todoId of removedTodoIds) {
        await deleteTodoMutation.mutateAsync(todoId);
      }

      for (const draft of todoDrafts) {
        const trimmedTitle = draft.title.trim();
        const originalTodo = originalTodosById.get(String(draft.id));
        const schedule = buildScheduleApiFields(draft);

        if (originalTodo) {
          await updateTodoMutation.mutateAsync({
            payload: {
              linkId: detail.id,
              title: trimmedTitle,
              ...schedule,
            },
            todoId: draft.id,
          });
          continue;
        }

        await createTodoMutation.mutateAsync({
          linkId: detail.id,
          title: trimmedTitle,
          ...schedule,
        });
      }

      await refreshDetail();
      setIsTodoEditorOpen(false);
    } catch (error: unknown) {
      setTodoEditorError("할 일 저장에 실패했습니다. 서버 응답을 확인해주세요.");
      reportError(error, {
        area: "link-detail-view:save-todos",
        extra: { linkId: detail.id },
      });
    } finally {
      // Some todos may have changed even when a later request failed.
      invalidateLinkLists();
    }
  }, [
    createTodoMutation,
    deleteTodoMutation,
    detail.id,
    todos,
    hasInvalidTodoDraft,
    invalidateLinkLists,
    refreshDetail,
    todoDrafts,
    updateTodoMutation,
  ]);

  const tagRows = tags.map((tag) => (
    <Pressable
      key={tag}
      className="relative z-40"
      delayLongPress={300}
      hitSlop={8}
      onLongPress={() => setIsTagEditMode(true)}
    >
      <Badge
        className="px-3 py-1"
        variant="tag"
      >
        {pendingTagName === tag ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text>{formatTagLabel(tag)}</Text>
        )}
      </Badge>
      {isTagEditMode && pendingTagName !== tag ? (
        <Pressable
          className="absolute -right-2 -top-2 size-5 items-center justify-center rounded-full bg-foreground"
          onPress={() => handleTagRemove(tag)}
        >
          <Icon
            as={X}
            size={12}
            className="text-background"
          />
        </Pressable>
      ) : null}
    </Pressable>
  ));

  const memoAction = isMemoEditing ? (
    <View className="flex-row items-center gap-2">
      <Button
        className="h-8 rounded-xl px-3"
        disabled={updateLinkMutation.isPending}
        size="sm"
        variant="outline"
        onPress={handleMemoEditCancel}
      >
        <Text>취소</Text>
      </Button>
      <Button
        className="h-8 rounded-xl px-3"
        disabled={updateLinkMutation.isPending}
        size="sm"
        onPress={handleMemoConfirm}
      >
        <Text>{updateLinkMutation.isPending ? "저장 중..." : "확인"}</Text>
      </Button>
    </View>
  ) : (
    <Button
      className="h-8 rounded-xl px-3"
      size="sm"
      variant="outline"
      onPress={handleMemoEditStart}
    >
      <Icon
        as={Pencil}
        size={14}
        className="text-foreground"
      />
      <Text>{detail.memo ? "메모 수정" : "메모 추가"}</Text>
    </Button>
  );

  const decoratedTodoDrafts = React.useMemo(
    () => todoDrafts.map((todo) => ({ ...todo, isPast: isScheduleInPast(todo) })),
    [todoDrafts],
  );

  const overlayMode = mode === "panel" ? "wide" : "mobile";

  const todoEditorContent = (
    <View className="gap-4">
      <TodoDraftListEditor
        addLabel="할 일 추가"
        pickerMode={overlayMode}
        todos={decoratedTodoDrafts}
        onAddTodo={handleAddTodoDraft}
        onChangeTodoTitle={handleTodoDraftTitleChange}
        onChangeTodoMode={handleTodoDraftModeChange}
        onChangeTodoWeekdays={handleTodoDraftWeekdaysChange}
        onChangeTodoDate={handleTodoDraftDateChange}
        onChangeTodoTime={handleTodoDraftTimeChange}
        onRemoveTodo={handleTodoDraftRemove}
      />
      {todoEditorError ? (
        <Text className="text-sm font-medium text-destructive">{todoEditorError}</Text>
      ) : null}
      <View className="flex-row justify-end gap-3">
        <Button
          className="h-10"
          disabled={isTodoMutationPending}
          variant="outline"
          onPress={handleTodoEditorClose}
        >
          <Text>취소</Text>
        </Button>
        <Button
          className="h-10"
          disabled={isTodoMutationPending || hasInvalidTodoDraft}
          onPress={handleTodoSave}
        >
          <Text>{isTodoMutationPending ? "저장 중..." : "저장"}</Text>
        </Button>
      </View>
    </View>
  );

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        testID="link-detail"
      >
        <View
          className={cn("relative gap-5", mode === "panel" ? "px-5 pb-8 pt-4" : "px-4 pb-10 pt-3")}
        >
          {isTagEditMode && !isTagInputVisible ? (
            <Pressable
              className="absolute inset-0 z-20"
              onPress={() => setIsTagEditMode(false)}
            />
          ) : null}

          <View className="flex-row items-center gap-2">
            <Text
              className="min-w-0 flex-1 text-[11px] text-muted-foreground"
              numberOfLines={1}
              testID="link-detail-url"
            >
              {detail.url}
            </Text>
            <RefreshButton
              failed={hasRefreshFailed}
              refreshing={isRefreshing}
              onPress={handleRefresh}
            />
            {mode === "panel" ? (
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                className="size-9 items-center justify-center rounded-xl border border-border bg-card web:transition-colors web:hover:border-primary"
                testID="link-detail-close"
                onPress={onClose}
              >
                <Icon
                  as={X}
                  size={16}
                  className="text-muted-foreground"
                />
              </Pressable>
            ) : null}
          </View>

          <HoverLabel label="원본 열기">
            <Pressable
              accessibilityLabel="원본 열기"
              accessibilityRole="link"
              className={cn(
                "overflow-hidden rounded-[14px] border border-border-soft",
                "web:transition-colors web:hover:border-primary",
              )}
              testID="link-detail-image"
              onPress={handleOpenOriginal}
            >
              <LinkThumbnail
                className={mode === "panel" ? "max-h-[260px]" : undefined}
                domain={domain}
                fallback="domain"
                faviconUrl={detail.faviconUrl}
                fit="auto"
                isVideo={detail.isVideo}
                showHint
                testID="link-detail-thumbnail"
                thumbnailUrl={detail.thumbnailUrl}
              />
            </Pressable>
          </HoverLabel>

          <View className="-mt-1 gap-1.5">
            <Text
              className={cn(
                "font-bold leading-snug text-foreground",
                mode === "panel" ? "text-xl" : "text-lg",
              )}
              testID="link-detail-title"
            >
              {detail.title}
            </Text>
            {linkStatusMeta.label ? (
              <Text
                className={cn(
                  "text-[11px] font-semibold",
                  linkStatusMeta.variant === "progress" && "text-primary",
                  linkStatusMeta.variant === "error" && "text-destructive",
                  linkStatusMeta.variant === "success" && "text-muted-foreground",
                )}
              >
                {linkStatusMeta.label}
              </Text>
            ) : null}
          </View>

          <View
            className="flex-row items-center gap-1.5"
            testID="link-detail-actions"
          >
            <HoverLabel
              label="폴더 이동"
              shrink
            >
              <Pressable
                accessibilityLabel={`폴더 이동, 현재 ${folderLabel}`}
                accessibilityRole="button"
                className={cn(
                  "h-10 min-w-0 max-w-[180px] flex-row items-center gap-1.5 rounded-xl border border-border bg-card px-3",
                  "active:border-primary web:transition-colors web:hover:border-primary",
                )}
                // Inline so it wins over react-native-web's default `flex-shrink: 0`: a long
                // folder name shrinks the chip and the buttons stay on one line.
                style={{ flexShrink: 1 }}
                testID="link-detail-folder"
                onPress={() => setIsFolderMoveOpen(true)}
              >
                <Text
                  className="min-w-0 shrink text-[13px] font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {folderLabel}
                </Text>
              </Pressable>
            </HoverLabel>
            <DetailActionButton
              active={detail.isFavorite}
              icon={Star}
              label={detail.isFavorite ? "바로가기 해제" : "바로가기 추가"}
              testID="link-detail-favorite"
              onPress={handleToggleFavorite}
            />
            <DetailActionButton
              icon={Share2}
              label="공유"
              testID="link-detail-share"
              onPress={handleShare}
            />
            {isMyOwnLink ? (
              <DetailActionButton
                icon={Pencil}
                label="수정하기"
                testID="link-detail-edit"
                onPress={openEditSheet}
              />
            ) : (
              <DetailActionButton
                disabled={copyLinkMutation.isPending}
                icon={FolderPlus}
                label="개인 폴더로 추가"
                testID="link-detail-copy"
                onPress={() => setIsCopyFolderOpen(true)}
              />
            )}
            <View className="min-w-0 flex-1" />
            <DetailActionButton
              icon={Trash2}
              label="링크 삭제"
              testID="link-detail-delete"
              tone="destructive"
              onPress={() => setIsDeleteDialogOpen(true)}
            />
          </View>

          <DetailSection
            title="한 줄 요약"
            testID="link-detail-summary"
            action={
              summaryModelLabel ? (
                <Text
                  className="text-[11px] font-medium text-muted-foreground"
                  numberOfLines={1}
                >
                  {summaryModelLabel}
                </Text>
              ) : null
            }
          >
            {detail.summary ? (
              <Text className="text-[13px] leading-5 text-foreground">{detail.summary}</Text>
            ) : (
              <DetailPlaceholder label="요약이 아직 없어요" />
            )}
          </DetailSection>

          <View
            className="relative z-30 gap-2.5"
            testID="link-detail-tags"
          >
            <View className="relative z-40 min-h-8 flex-row items-center gap-1">
              <Text className="text-xs font-semibold text-muted-foreground">태그</Text>
              <IconButton
                accessibilityLabel="태그 편집"
                className="size-7"
                icon={Ellipsis}
                size="sm"
                variant="ghost"
                hitSlop={8}
                onPress={() => setIsTagEditMode(true)}
              />
            </View>
            <View className="relative z-40 flex-row flex-wrap items-center gap-2">
              {tagRows}
              {pendingTagName && !tags.includes(pendingTagName) ? (
                <Badge
                  className="px-3 py-1"
                  variant="tag"
                >
                  <ActivityIndicator size="small" />
                </Badge>
              ) : null}
              {isTagInputVisible ? (
                <View className="relative z-50 min-w-28 flex-row items-center gap-2 rounded-[10px] border border-border bg-surface-elevated px-3 py-1">
                  <Text className="text-xs font-medium text-muted-foreground">#</Text>
                  <Input
                    autoFocus
                    className="h-7 min-w-16 flex-1 border-0 bg-transparent px-0 py-0 text-sm"
                    value={tagDraft}
                    placeholder="태그"
                    onBlur={handleTagCreateBlur}
                    onChangeText={setTagDraft}
                  />
                </View>
              ) : (
                <Button
                  className="relative z-50 h-8 self-auto rounded-xl px-3"
                  size="sm"
                  variant="outline"
                  onPress={handleShowTagInput}
                >
                  <Text>+ 태그 추가</Text>
                </Button>
              )}
            </View>
          </View>

          <DetailSection
            title="메모"
            action={memoAction}
            testID="link-detail-memo"
          >
            {isMemoEditing ? (
              <Textarea
                ref={memoInputRef}
                className="min-h-28 rounded-[14px] border-border bg-card px-4 py-4 text-base"
                value={memoDraft}
                placeholder="메모를 입력해주세요"
                variant="memo"
                onChangeText={setMemoDraft}
              />
            ) : detail.memo ? (
              <View className="rounded-[14px] border border-border bg-card px-4 py-3.5">
                <Text className="text-[13px] leading-5 text-foreground">{detail.memo}</Text>
              </View>
            ) : (
              <DetailPlaceholder label="메모가 아직 없어요" />
            )}
          </DetailSection>

          <DetailSection
            title={`할 일 ${dueTodos.length}개`}
            testID="link-detail-todos"
          >
            <View className="gap-3">
              {todos.length ? (
                <View
                  className="w-full flex-row flex-wrap"
                  style={{ gap: TODO_GRID_GAP }}
                  testID="link-detail-todo-grid"
                  onLayout={todoGrid.onLayout}
                >
                  {todos.map((todo) => {
                    const done = getTodoDone(todo);
                    const reminderAt = todo.reminderAt ?? todo.dueAt ?? null;
                    const reminderMs = reminderAt ? new Date(reminderAt).getTime() : Number.NaN;
                    const overdue = !done && !Number.isNaN(reminderMs) && reminderMs < Date.now();
                    const reminderLabel = formatReminderLabel(reminderAt, {
                      withOverdueSuffix: overdue,
                    });

                    return (
                      <View
                        key={todo.id}
                        style={todoGrid.itemStyle}
                      >
                        <TodoItem
                          className="h-full"
                          variant="display"
                          text={getTodoTitle(todo)}
                          done={done}
                          overdue={overdue}
                          reminderLabel={reminderLabel}
                          linkUrl={detail.url}
                          linkTitle={detail.title}
                          linkThumbnailUrl={detail.thumbnailUrl}
                          linkFaviconUrl={detail.faviconUrl}
                          onToggle={(nextChecked) =>
                            handleTodoCompletedChange(todo.id, nextChecked)
                          }
                        />
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="items-center rounded-[14px] border border-dashed border-border px-4 py-3.5">
                  <Text className="text-xs font-medium text-muted-foreground">
                    아직 연결된 할 일이 없어요
                  </Text>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                className="items-center rounded-[14px] border border-dashed border-border px-4 py-3.5 web:transition-colors web:hover:border-primary"
                testID="link-detail-todo-edit"
                onPress={handleTodoEditorOpen}
              >
                <Text className="text-[13px] font-semibold text-muted-foreground">
                  + 할 일 추가 / 수정
                </Text>
              </Pressable>
            </View>
          </DetailSection>
        </View>
      </ScrollView>

      <FolderPickerDialog
        confirmLabel="확인"
        description="이동할 폴더를 선택해주세요."
        errorMessage="폴더를 옮기지 못했어요. 다시 시도해 주세요."
        initialFolderId={detail.folderId ?? null}
        noneOption={UNCATEGORIZED_PICKER_OPTION}
        open={isFolderMoveOpen}
        pendingLabel="옮기는 중"
        presentation={mode === "panel" ? "dialog" : "sheet"}
        title="폴더 이동"
        onConfirm={handleFolderMoveConfirm}
        onOpenChange={setIsFolderMoveOpen}
      />

      <FolderPickerDialog
        confirmLabel="추가"
        description="추가할 폴더를 선택해주세요."
        errorMessage="폴더에 추가하지 못했어요. 다시 시도해 주세요."
        noneOption={null}
        open={isCopyFolderOpen}
        pendingLabel="추가하는 중"
        presentation={mode === "panel" ? "dialog" : "sheet"}
        title="개인 폴더로 추가"
        visibleSections={PERSONAL_FOLDER_SECTIONS}
        onConfirm={handleCopyToPersonalConfirm}
        onOpenChange={setIsCopyFolderOpen}
      />

      {mode === "panel" ? (
        <Dialog
          open={isTodoEditorOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleTodoEditorClose();
            } else {
              setIsTodoEditorOpen(true);
            }
          }}
        >
          <DialogContent className="max-h-[80vh] max-w-3xl">
            <DialogHeader>
              <DialogTitle>할 일 추가 / 수정</DialogTitle>
              <DialogDescription>
                각 할 일에 시간 또는 반복 알림을 설정할 수 있어요.
              </DialogDescription>
            </DialogHeader>
            <ScrollView
              className="flex-1"
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
            >
              {todoEditorContent}
            </ScrollView>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet
          open={isTodoEditorOpen}
          fitContent
          onOpenChange={(open) => {
            if (!open) {
              handleTodoEditorClose();
            } else {
              setIsTodoEditorOpen(true);
            }
          }}
        >
          <View className="gap-2">
            <Text className="text-lg font-semibold text-foreground">할 일 추가 / 수정</Text>
            <Text className="text-sm leading-6 text-muted-foreground">
              각 할 일에 시간 또는 반복 알림을 설정할 수 있어요.
            </Text>
          </View>
          {todoEditorContent}
        </Sheet>
      )}

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>링크를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 이 링크 상세를 다시 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center">
            <AlertDialogCancel className="native:px-3 flex-1 justify-center sm:flex-none">
              <Text className="text-center">취소</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              className="native:px-3 flex-1 justify-center sm:flex-none"
              variant="destructive"
              onPress={handleDeleteLink}
            >
              <Text className="text-center">
                {deleteLinkMutation.isPending ? "삭제 중..." : "삭제"}
              </Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {mode === "panel" ? (
        <Dialog
          open={isEditOpen}
          onOpenChange={(next) => (next ? setIsEditOpen(true) : handleRequestCloseEdit())}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>수정하기</DialogTitle>
              <DialogDescription>제목과 한 줄 요약을 수정해요.</DialogDescription>
            </DialogHeader>
            <LinkEditFields
              title={titleDraft}
              summary={summaryDraft}
              saving={updateLinkMutation.isPending}
              canSave={isEditDirty}
              onChangeTitle={setTitleDraft}
              onChangeSummary={setSummaryDraft}
              onCancel={handleRequestCloseEdit}
              onSave={handleSaveEdit}
            />
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet
          open={isEditOpen}
          fitContent
          onOpenChange={(next) => (next ? setIsEditOpen(true) : handleRequestCloseEdit())}
        >
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">수정하기</Text>
            <LinkEditFields
              title={titleDraft}
              summary={summaryDraft}
              saving={updateLinkMutation.isPending}
              canSave={isEditDirty}
              onChangeTitle={setTitleDraft}
              onChangeSummary={setSummaryDraft}
              onCancel={handleRequestCloseEdit}
              onSave={handleSaveEdit}
            />
          </View>
        </Sheet>
      )}

      <AlertDialog
        open={isUnsavedEditOpen}
        onOpenChange={setIsUnsavedEditOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 변경사항이 있어요</AlertDialogTitle>
            <AlertDialogDescription>변경사항을 저장할까요?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <Button
              variant="outline"
              disabled={updateLinkMutation.isPending}
              onPress={handleDiscardEdit}
            >
              <Text>저장 안 함</Text>
            </Button>
            <Button
              disabled={updateLinkMutation.isPending}
              onPress={handleSaveEdit}
            >
              {updateLinkMutation.isPending ? <ActivityIndicator /> : <Text>저장</Text>}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { LinkDetailView };
