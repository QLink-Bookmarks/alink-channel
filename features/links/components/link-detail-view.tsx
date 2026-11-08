import * as React from "react";
import { ActivityIndicator, BackHandler, Pressable, ScrollView, View } from "react-native";

import { AppHeader } from "@/components/layout/app-header";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { PressableHitSlopArea } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { useMyProfileQuery } from "@/features/account/queries";
import { FolderPickerDialog } from "@/features/folders/components/folder-picker-dialog";
import {
  type FolderPickerSelection,
  UNCATEGORIZED_PICKER_OPTION,
} from "@/features/folders/components/folder-picker-list";
import { getMoveTargetFolderId } from "@/features/folders/lib/folder-pages";
import { useFoldersQuery } from "@/features/folders/queries";
import { buildShareText } from "@/features/links/lib/build-share-text";
import { shareLink } from "@/features/links/lib/share-link";
import {
  useCopyLinkMutation,
  useDeleteLinkMutation,
  usePatchLinkMutation,
  useSetLinkFavoriteMutation,
  useUpdateLinkMutation,
} from "@/features/links/mutations";
import { getLinkDetailQueryKey, useLinkDetailExcerptRecheck } from "@/features/links/queries";
import type { LinkDetail, LinkDetailResponse, UpdateLinkRequest } from "@/features/links/types";
import { reportError } from "@/lib/error-reporting";
import { cn } from "@/lib/utils";
import type { FolderSection } from "@/stores/folder-navigation";
import { hasLeaveGuard, requestLeave } from "@/stores/leave-guard";
import { useToastStore } from "@/stores/toast-store";
import { useQueryClient } from "@tanstack/react-query";

import { LinkDetailActionsSection } from "./link-detail-actions-section";
import { LinkDetailAiSurface } from "./link-detail-ai-surface";
import { LinkDetailHead } from "./link-detail-head";
import { LinkDetailMyNotes, type LinkFieldsUpdate } from "./link-detail-my-notes";
import { LinkDetailToolbar } from "./link-detail-toolbar";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

import { type Href, useRouter } from "expo-router";
import { Trash2 } from "lucide-react-native/icons";

type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

const PERSONAL_FOLDER_SECTIONS: FolderSection[] = ["mine"];
const DELETE_HIT_SLOP = 4;

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
    memo: overrides.memo !== undefined ? overrides.memo : detail.memo,
    sourceType: detail.sourceType,
    summary: overrides.summary !== undefined ? overrides.summary : detail.summary,
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
    // PUT/PATCH responses carry no page body; keep the excerpt the detail already has.
    content: incoming.content ?? base.content ?? null,
    tags: incoming.tags ?? base.tags ?? [],
    todos: incoming.todos ?? base.todos ?? [],
  };
}

function DeleteLinkButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="링크 삭제"
      accessibilityRole="button"
      className="h-9 flex-row items-center gap-1.5 self-start rounded-[10px] px-2 active:bg-destructive/10 web:transition-colors web:hover:bg-destructive/10"
      hitSlop={DELETE_HIT_SLOP}
      testID="link-detail-delete"
      onPress={onPress}
    >
      <PressableHitSlopArea hitSlop={DELETE_HIT_SLOP} />
      <Icon
        as={Trash2}
        size={15}
        className="text-destructive"
      />
      <Text className="text-[13px] font-semibold text-destructive">링크 삭제</Text>
    </Pressable>
  );
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
  const updateLinkMutation = useUpdateLinkMutation(detail.id);
  const setFavoriteMutation = useSetLinkFavoriteMutation();
  const myProfileQuery = useMyProfileQuery();
  const foldersQuery = useFoldersQuery({ size: 15 });
  const copyLinkMutation = useCopyLinkMutation(detail.id);
  const patchLinkMutation = usePatchLinkMutation(detail.id);
  const showToast = useToastStore((state) => state.showToast);
  const dismissToast = useToastStore((state) => state.dismissToast);
  const deleteLinkMutation = useDeleteLinkMutation(detail.id);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [hasRefreshFailed, setHasRefreshFailed] = React.useState(false);
  const [isEditingActions, setIsEditingActions] = React.useState(false);
  const isRefreshingRef = React.useRef(false);
  const isSavingEditRef = React.useRef(false);
  // Covers the detail refetch before the PUT too, which the mutation's own state does not.
  const [isSavingEdit, setIsSavingEdit] = React.useState(false);
  const tags = React.useMemo(() => detail.tags ?? [], [detail.tags]);
  const todos = React.useMemo(() => detail.todos ?? [], [detail.todos]);
  const [isFolderMoveOpen, setIsFolderMoveOpen] = React.useState(false);
  const [isCopyFolderOpen, setIsCopyFolderOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  // isEditOpenRef lets handleRequestCloseEdit ignore close requests that arrive after the sheet is already closed; a backstop now that sheet.tsx (#32) no longer echoes code-driven closes.
  const isEditOpenRef = React.useRef(false);
  const setEditSheetOpen = React.useCallback((open: boolean) => {
    isEditOpenRef.current = open;
    setIsEditOpen(open);
  }, []);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [summaryDraft, setSummaryDraft] = React.useState("");
  const [isUnsavedEditOpen, setIsUnsavedEditOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  useLinkDetailExcerptRecheck(detail.id, detail.content);

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

  // PUT replaces the whole link: read the latest detail first, so a representative image
  // the server filled in after the detail opened (alink-backend#195) is sent back as is.
  const updateLinkFields = React.useCallback(
    async (overrides: Partial<Pick<UpdateLinkRequest, "memo" | "summary" | "tags" | "title">>) => {
      const queryKey = getLinkDetailQueryKey(detail.id);
      await queryClient.refetchQueries({ exact: true, queryKey }, { throwOnError: true });
      const latest = queryClient.getQueryData<LinkDetail>(queryKey) ?? detail;
      const response = await updateLinkMutation.mutateAsync(
        buildUpdateLinkPayload(latest, overrides),
      );
      handleDetailUpdated(response);
      // The merge keeps known values over nulls, so a cleared memo or summary is set here.
      queryClient.setQueryData<LinkDetail>(queryKey, (current) =>
        current ? { ...current, ...overrides } : current,
      );
    },
    [detail, handleDetailUpdated, queryClient, updateLinkMutation],
  );

  const handleUpdateNotes = React.useCallback(
    (update: LinkFieldsUpdate) => updateLinkFields(update),
    [updateLinkFields],
  );

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
      // The web build can also copy the text or fail; the native one only shares.
      const result = (await shareLink(payload)) as ShareOutcome;
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
    setEditSheetOpen(true);
  }, [detail.summary, detail.title, setEditSheetOpen]);

  const dismissLinkDetailToasts = React.useCallback(() => {
    for (const item of useToastStore.getState().items) {
      if (item.sourceKey?.startsWith("link-detail-")) {
        dismissToast(item.id);
      }
    }
  }, [dismissToast]);

  const handleOpenFolderMove = React.useCallback(() => {
    dismissLinkDetailToasts();
    setIsFolderMoveOpen(true);
  }, [dismissLinkDetailToasts]);

  const handleOpenCopyFolder = React.useCallback(() => {
    dismissLinkDetailToasts();
    setIsCopyFolderOpen(true);
  }, [dismissLinkDetailToasts]);

  const isEditDirty =
    titleDraft.trim() !== detail.title.trim() ||
    summaryDraft.trim() !== (detail.summary ?? "").trim();

  const handleSaveEdit = React.useCallback(async () => {
    if (isSavingEditRef.current) {
      return;
    }
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
    isSavingEditRef.current = true;
    setIsSavingEdit(true);
    try {
      await updateLinkFields({
        summary: summaryDraft.trim() ? summaryDraft.trim() : null,
        title: nextTitle,
      });
      setIsUnsavedEditOpen(false);
      setEditSheetOpen(false);
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
    } finally {
      isSavingEditRef.current = false;
      setIsSavingEdit(false);
    }
  }, [detail.id, setEditSheetOpen, showToast, summaryDraft, titleDraft, updateLinkFields]);

  // Edits live in a modal, so the user can't scroll away and lose the save
  // action. If they try to dismiss with unsaved changes, confirm first.
  const handleRequestCloseEdit = React.useCallback(() => {
    if (!isEditOpenRef.current || isSavingEditRef.current) {
      return;
    }
    if (isEditDirty) {
      if (mode !== "panel") {
        setEditSheetOpen(false);
      }
      setIsUnsavedEditOpen(true);
      return;
    }
    setEditSheetOpen(false);
  }, [isEditDirty, mode, setEditSheetOpen]);

  const handleUnsavedEditOpenChange = React.useCallback(
    (open: boolean) => {
      setIsUnsavedEditOpen(open);
      if (!open) {
        setEditSheetOpen(true);
      }
    },
    [setEditSheetOpen],
  );

  const handleDiscardEdit = React.useCallback(() => {
    setIsUnsavedEditOpen(false);
    setEditSheetOpen(false);
  }, [setEditSheetOpen]);

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

  const handleBack = React.useCallback(() => {
    requestLeave(() => {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace("/home" as Href);
    });
  }, [router]);

  // Android back asks first too while the action editor holds unsaved edits.
  React.useEffect(() => {
    if (mode !== "screen") {
      return;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!hasLeaveGuard()) {
        return false;
      }
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack, mode]);

  const isPanel = mode === "panel";
  const toolbar = (
    <LinkDetailToolbar
      isCopyPending={copyLinkMutation.isPending}
      isEditing={isEditingActions}
      isFavorite={detail.isFavorite}
      isMyOwnLink={isMyOwnLink}
      mode={mode}
      refreshFailed={hasRefreshFailed}
      refreshing={isRefreshing}
      onClose={onClose}
      onCopy={handleOpenCopyFolder}
      onEdit={openEditSheet}
      onRefresh={handleRefresh}
      onShare={handleShare}
      onToggleFavorite={handleToggleFavorite}
    />
  );

  const body = (
    <ScrollView
      // iOS: the keyboard insets the scroll area, so the action editor's 저장 can be
      // scrolled above it while a title is being typed.
      automaticallyAdjustKeyboardInsets
      className={cn("flex-1", isPanel ? "bg-surface" : "bg-background")}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="link-detail"
    >
      <View
        className={cn(
          isPanel
            ? "gap-4 px-5 pb-8 pt-2"
            : "w-full max-w-[600px] gap-3.5 self-center px-4 pb-10 pt-3",
        )}
      >
        {isPanel ? toolbar : null}
        <LinkDetailHead
          faviconUrl={detail.faviconUrl}
          isVideo={detail.isVideo}
          mode={mode}
          status={detail.status}
          thumbnailUrl={detail.thumbnailUrl}
          title={detail.title}
          url={detail.url}
          workModel={detail.workModel}
        />
        <LinkDetailAiSurface
          excerpt={detail.content?.excerpt ?? null}
          status={detail.status}
          summary={detail.summary}
          url={detail.url}
          workModel={detail.workModel}
        />
        <LinkDetailMyNotes
          key={detail.id}
          folderEmoji={detail.folderEmoji}
          folderName={detail.folderName}
          isEditingActions={isEditingActions}
          linkId={detail.id}
          memo={detail.memo}
          tags={tags}
          onOpenFolderMove={handleOpenFolderMove}
          onUpdateLink={handleUpdateNotes}
        >
          <LinkDetailActionsSection
            key={detail.id}
            linkId={detail.id}
            mode={mode}
            todos={todos}
            onEditingChange={setIsEditingActions}
          />
        </LinkDetailMyNotes>
        <View className="mt-1 border-t border-border-soft pt-3">
          <DeleteLinkButton onPress={() => setIsDeleteDialogOpen(true)} />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <>
      {isPanel ? (
        body
      ) : (
        <View className="flex-1 bg-background">
          <AppHeader
            back
            rightSlot={toolbar}
            onBack={handleBack}
          />
          {body}
        </View>
      )}

      <FolderPickerDialog
        confirmLabel="확인"
        description="이동할 폴더를 선택해주세요."
        errorMessage="폴더를 옮기지 못했어요. 다시 시도해 주세요."
        initialFolderId={detail.folderId ?? null}
        noneOption={UNCATEGORIZED_PICKER_OPTION}
        open={isFolderMoveOpen}
        pendingLabel="옮기는 중"
        presentation={isPanel ? "dialog" : "sheet"}
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
        presentation={isPanel ? "dialog" : "sheet"}
        title="개인 폴더로 추가"
        visibleSections={PERSONAL_FOLDER_SECTIONS}
        onConfirm={handleCopyToPersonalConfirm}
        onOpenChange={setIsCopyFolderOpen}
      />

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

      {isPanel ? (
        <Dialog
          open={isEditOpen}
          onOpenChange={(next) => (next ? setEditSheetOpen(true) : handleRequestCloseEdit())}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>수정하기</DialogTitle>
              <DialogDescription>제목과 한 줄 요약을 수정해요.</DialogDescription>
            </DialogHeader>
            <LinkEditFields
              title={titleDraft}
              summary={summaryDraft}
              saving={isSavingEdit}
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
          onOpenChange={(next) => (next ? setEditSheetOpen(true) : handleRequestCloseEdit())}
        >
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">수정하기</Text>
            <LinkEditFields
              title={titleDraft}
              summary={summaryDraft}
              saving={isSavingEdit}
              canSave={isEditDirty}
              onChangeTitle={setTitleDraft}
              onChangeSummary={setSummaryDraft}
              onCancel={handleRequestCloseEdit}
              onSave={handleSaveEdit}
            />
          </View>
        </Sheet>
      )}

      <UnsavedChangesDialog
        open={isUnsavedEditOpen}
        saving={isSavingEdit}
        onDiscard={handleDiscardEdit}
        onOpenChange={handleUnsavedEditOpenChange}
        onSave={handleSaveEdit}
      />
    </>
  );
}

export { LinkDetailView };
