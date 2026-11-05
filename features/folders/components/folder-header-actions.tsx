import * as React from "react";
import { ScrollView, View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { AccountRow } from "@/features/account/components/account-row/account-row";
import { useMyProfileQuery } from "@/features/account/queries";
import { getWebAppOrigin } from "@/lib/app-variant";
import { getThemeTokens } from "@/lib/theme";
import { useDisplaySettings } from "@/stores/display-settings";
import { useToastStore } from "@/stores/toast-store";

import { buildInviteShareText } from "../lib/build-invite-share-text";
import { getApiErrorMessage } from "../lib/folder-api-errors";
import { shareInvitation } from "../lib/share-invitation";
import { useCreateFolderInvitationMutation, useDeleteFolderMemberMutation } from "../mutations";
import { useFolderMembersQuery } from "../queries";
import type { Folder, FolderMember } from "../types";
import type { CreateFolderDialogMode } from "./create-folder-dialog";
import { EditFolderDialog } from "./create-folder-dialog";
import { FolderRemovalFlow, type FolderRemovalKind } from "./folder-removal-flow";

import * as Clipboard from "expo-clipboard";
import { type Href, useRouter } from "expo-router";
import { ChevronLeft, Copy, LogOut, Pencil, Send, Trash2 } from "lucide-react-native/icons";

// 36px buttons with a 44×44 touch area.
const HEADER_HIT_SLOP = 4;

type FolderHeaderActionsProps = {
  mode: CreateFolderDialogMode;
  folder: Folder;
};

function FolderHeaderActions({ mode, folder }: FolderHeaderActionsProps) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isShareOpen, setIsShareOpen] = React.useState(false);
  const [removalKind, setRemovalKind] = React.useState<FolderRemovalKind | null>(null);
  const theme = useDisplaySettings((state) => state.display.theme);
  const accent = useDisplaySettings((state) => state.display.accent);
  const tokens = React.useMemo(() => getThemeTokens(theme, accent), [accent, theme]);
  const myProfileQuery = useMyProfileQuery();
  const myUserId = myProfileQuery.data?.id;
  // A shared folder's actions depend on my role, so they wait until my profile is known
  // (none while it loads or after it fails). Personal folders are always mine.
  const isRoleKnown = !folder.isShared || (myUserId != null && folder.ownerId != null);
  const isOwner = !folder.isShared || (myUserId != null && myUserId === folder.ownerId);
  const canEdit = isRoleKnown && isOwner;
  const canShare = isRoleKnown && folder.isShared && isOwner;
  const destructiveAction = !isRoleKnown
    ? null
    : isOwner
      ? {
          kind: "delete" as const,
          label: folder.isShared ? "공유 폴더 삭제" : "폴더 삭제",
          icon: Trash2,
        }
      : { kind: "leave" as const, label: "공유 폴더 나가기", icon: LogOut };

  return (
    <>
      {isRoleKnown ? (
        <View className="flex-row items-center gap-2">
          {canEdit ? (
            <IconButton
              accessibilityLabel="폴더 수정"
              hitSlop={HEADER_HIT_SLOP}
              icon={Pencil}
              size="sm"
              variant="ghost"
              onPress={() => setIsEditOpen(true)}
            />
          ) : null}
          {canShare ? (
            <IconButton
              accessibilityLabel="폴더 공유"
              hitSlop={HEADER_HIT_SLOP}
              icon={Send}
              size="sm"
              variant="ghost"
              onPress={() => setIsShareOpen(true)}
            />
          ) : null}
          {destructiveAction ? (
            <>
              {canEdit ? (
                <View
                  aria-hidden
                  className="mx-1.5 h-5 w-px bg-border"
                  testID="folder-header-divider"
                />
              ) : null}
              <IconButton
                accessibilityLabel={destructiveAction.label}
                className="active:bg-destructive/10 web:hover:bg-destructive/10"
                color={tokens.destructiveText}
                hitSlop={HEADER_HIT_SLOP}
                icon={destructiveAction.icon}
                size="sm"
                variant="ghost"
                onPress={() => setRemovalKind(destructiveAction.kind)}
              />
            </>
          ) : null}
        </View>
      ) : null}

      <EditFolderDialog
        folder={folder}
        mode={mode}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />

      <ShareFolderPlaceholder
        folder={folder}
        mode={mode}
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
      />

      {removalKind ? (
        <FolderRemovalFlow
          folder={folder}
          kind={removalKind}
          mode={mode}
          onClose={() => setRemovalKind(null)}
        />
      ) : null}
    </>
  );
}

function ShareFolderPlaceholder({
  mode,
  open,
  folder,
  onOpenChange,
}: {
  mode: CreateFolderDialogMode;
  open: boolean;
  folder: Folder;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const theme = useDisplaySettings((state) => state.display.theme);
  const accent = useDisplaySettings((state) => state.display.accent);
  const tokens = React.useMemo(() => getThemeTokens(theme, accent), [accent, theme]);
  const myProfileQuery = useMyProfileQuery();
  const myUserId = myProfileQuery.data?.id;
  const isOwner = folder.ownerId != null && myUserId === folder.ownerId;
  const showToast = useToastStore((state) => state.showToast);
  const [view, setView] = React.useState<"overview" | "invite">("overview");
  const [durationDays, setDurationDays] = React.useState("");
  const [invitationUrl, setInvitationUrl] = React.useState("");
  const [selectedMember, setSelectedMember] = React.useState<FolderMember | null>(null);
  const membersQuery = useFolderMembersQuery(folder.id, open);
  const invitationMutation = useCreateFolderInvitationMutation();
  const deleteMemberMutation = useDeleteFolderMemberMutation();
  const resetInvitationMutation = invitationMutation.reset;
  const resetDeleteMemberMutation = deleteMemberMutation.reset;

  React.useEffect(() => {
    if (!open) {
      setView("overview");
      setDurationDays("");
      setInvitationUrl("");
      setSelectedMember(null);
      resetInvitationMutation();
      resetDeleteMemberMutation();
    }
  }, [open, resetDeleteMemberMutation, resetInvitationMutation]);

  const handleDurationDaysChange = React.useCallback((next: string) => {
    const digits = next.replace(/\D/g, "");

    if (!digits) {
      setDurationDays("");
      return;
    }

    const parsed = Number(digits);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      setDurationDays(String(parsed));
    }
  }, []);

  const handleCreateInvitation = React.useCallback(async () => {
    const parsedDurationDays = durationDays ? Number(durationDays) : null;
    const response = await invitationMutation.mutateAsync({
      id: folder.id,
      payload: {
        durationDays:
          parsedDurationDays && Number.isSafeInteger(parsedDurationDays) && parsedDurationDays > 0
            ? parsedDurationDays
            : null,
      },
    });

    setInvitationUrl(resolveInvitationUrl(response.data.invitation, folder.id));
  }, [durationDays, folder.id, invitationMutation]);

  const handleCopyInvitation = React.useCallback(() => {
    if (!invitationUrl) {
      return;
    }

    Clipboard.setStringAsync(invitationUrl).catch((error: unknown) => {
      console.log("folders:share:copy-failed", error);
    });
  }, [invitationUrl]);

  const handleShareInvitation = React.useCallback(async () => {
    if (!invitationUrl) {
      return;
    }

    const username = myProfileQuery.data?.nickname ?? "사용자";
    const { title, text } = buildInviteShareText({ username, inviteUrl: invitationUrl });
    const result = await shareInvitation({ title, text });

    if (result === "copied") {
      showToast({
        durationMs: 3000,
        sourceKey: "folder-invite-share",
        title: "초대 링크를 복사했어요.",
        variant: "success",
      });
    } else if (result === "failed") {
      showToast({
        durationMs: 3000,
        sourceKey: "folder-invite-share",
        title: "초대 링크 공유에 실패했어요.",
        variant: "error",
      });
    }
  }, [invitationUrl, myProfileQuery.data?.nickname, showToast]);

  const handleConfirmDeleteMember = React.useCallback(async () => {
    if (!selectedMember) {
      return;
    }

    try {
      await deleteMemberMutation.mutateAsync({
        id: folder.id,
        memberId: selectedMember.userId,
      });
    } catch {
      return;
    }
    setSelectedMember(null);
    onOpenChange(false);
    showToast({
      dismissible: true,
      durationMs: 3000,
      sourceKey: "folder-member-delete",
      title: "공유 폴더 멤버에서 제외됐습니다.",
      variant: "success",
    });
    router.replace("/home" as Href);
  }, [deleteMemberMutation, folder.id, onOpenChange, router, selectedMember, showToast]);

  const memberRows = React.useMemo(() => {
    const members = membersQuery.data?.members ?? [];
    const hasOwner = members.some((member) => member.userId === membersQuery.data?.ownerId);

    if (!membersQuery.data || hasOwner) {
      return members;
    }

    return [
      {
        role: "OWNER",
        userId: membersQuery.data.ownerId,
        userNickname: membersQuery.data.ownerNickname,
      },
      ...members,
    ];
  }, [membersQuery.data]);

  const memberErrorMessage = getApiErrorMessage(membersQuery.error);
  const deleteErrorMessage = getApiErrorMessage(deleteMemberMutation.error);
  const isSelfLeave =
    selectedMember != null &&
    selectedMember.userId === myUserId &&
    selectedMember.userId !== folder.ownerId;

  const membersList = (
    <View className="gap-2">
      {memberRows.map((member) => {
        const isOwnerMember = member.userId === membersQuery.data?.ownerId;
        // TODO: Delegate 서버 구현 후 owner row의 위임/삭제 액션 UX를 연결한다.
        const canDelete = !isOwnerMember && (isOwner || member.userId === myUserId);

        return (
          <AccountRow
            key={member.userId}
            avatarEmoji={member.avatarEmoji}
            avatarUrl={member.avatarUrl}
            label={isOwnerMember ? "소유자" : "멤버"}
            value={member.userNickname}
            action={
              canDelete ? (
                <IconButton
                  accessibilityLabel={`${member.userNickname} 멤버 제외`}
                  className="active:bg-destructive/10 web:hover:bg-destructive/10"
                  color={tokens.destructiveText}
                  icon={Trash2}
                  size="sm"
                  variant="ghost"
                  onPress={() => setSelectedMember(member)}
                />
              ) : undefined
            }
          />
        );
      })}
    </View>
  );

  const overviewBody = (
    <View className="gap-4">
      {membersQuery.isLoading ? (
        <ActivityIndicator
          size="large"
          className="self-center py-8"
        />
      ) : membersQuery.isError ? (
        <Text className="text-sm font-medium text-destructive">
          {memberErrorMessage ?? "공유 폴더 멤버를 불러오지 못했어요."}
        </Text>
      ) : memberRows.length > 0 ? (
        mode === "wide" ? (
          <ScrollView
            className="max-h-80"
            showsVerticalScrollIndicator={false}
          >
            {membersList}
          </ScrollView>
        ) : (
          membersList
        )
      ) : (
        <Text className="text-sm text-muted-foreground">아직 공유 폴더 멤버가 없어요.</Text>
      )}
      <View className="flex-row justify-end gap-2">
        <Button
          className="h-10"
          variant="outline"
          onPress={() => onOpenChange(false)}
        >
          <Text>닫기</Text>
        </Button>
        {isOwner ? (
          <Button
            className="h-10"
            onPress={() => setView("invite")}
          >
            <Icon
              as={Send}
              size={16}
              className="text-primary-foreground"
            />
            <Text>공유하기</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );

  const inviteBody = (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">초대 링크</Text>
        <View className="flex-row items-center gap-2">
          <Input
            className="h-10 flex-1 rounded-xl px-4 text-base"
            editable={false}
            placeholder="초대 링크를 생성해주세요."
            value={invitationUrl}
          />
          <IconButton
            accessibilityLabel="초대 링크 복사"
            disabled={!invitationUrl}
            icon={Copy}
            size="sm"
            onPress={handleCopyInvitation}
          />
        </View>
      </View>
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">만료 일수</Text>
        <Input
          className="h-10 rounded-xl px-4 text-base"
          inputMode="numeric"
          keyboardType="number-pad"
          placeholder="비워두면 무기한"
          value={durationDays}
          onChangeText={handleDurationDaysChange}
        />
      </View>
      {invitationMutation.error ? (
        <Text className="text-sm font-medium text-destructive">
          초대 링크 생성에 실패했어요. 잠시 후 다시 시도해주세요.
        </Text>
      ) : null}
      <View className="flex-row justify-center gap-2">
        <Button
          className="h-10"
          disabled={invitationMutation.isPending}
          onPress={handleCreateInvitation}
        >
          {invitationMutation.isPending ? <ActivityIndicator size="small" /> : null}
          <Text>초대 링크 생성</Text>
        </Button>
        <Button
          className="h-10"
          disabled={!invitationUrl}
          variant="gradient"
          onPress={handleShareInvitation}
        >
          <Text>초대 링크 보내기</Text>
        </Button>
      </View>
    </View>
  );

  const body = view === "invite" ? inviteBody : overviewBody;
  const title = view === "invite" ? "초대 링크" : "폴더 공유";
  const description =
    view === "invite"
      ? "초대 링크를 생성해 공유할 수 있어요."
      : "공유 폴더 멤버를 확인하고 관리할 수 있어요.";
  const titleContent =
    view === "invite" ? (
      <View className="flex-row items-center gap-2">
        <IconButton
          accessibilityLabel="공유 안내로 돌아가기"
          icon={ChevronLeft}
          size="sm"
          variant="ghost"
          onPress={() => setView("overview")}
        />
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
      </View>
    ) : (
      <Text className="text-lg font-semibold text-foreground">{title}</Text>
    );

  if (mode === "wide") {
    return (
      <>
        <Dialog
          open={open}
          onOpenChange={onOpenChange}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              {view === "invite" ? titleContent : <DialogTitle>{title}</DialogTitle>}
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
        <FolderMemberDeleteDialog
          errorMessage={deleteErrorMessage}
          isPending={deleteMemberMutation.isPending}
          isSelfLeave={isSelfLeave}
          member={selectedMember}
          mode={mode}
          open={selectedMember != null}
          onConfirm={handleConfirmDeleteMember}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setSelectedMember(null);
              resetDeleteMemberMutation();
            }
          }}
        />
      </>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <>
      <Sheet
        open={open}
        fitContent
        onOpenChange={onOpenChange}
      >
        <View className="gap-3">
          {titleContent}
          {body}
        </View>
      </Sheet>
      <FolderMemberDeleteDialog
        errorMessage={deleteErrorMessage}
        isPending={deleteMemberMutation.isPending}
        isSelfLeave={isSelfLeave}
        member={selectedMember}
        mode={mode}
        open={selectedMember != null}
        onConfirm={handleConfirmDeleteMember}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedMember(null);
            resetDeleteMemberMutation();
          }
        }}
      />
    </>
  );
}

function FolderMemberDeleteDialog({
  errorMessage,
  isPending,
  isSelfLeave,
  member,
  mode,
  open,
  onConfirm,
  onOpenChange,
}: {
  errorMessage?: string;
  isPending: boolean;
  isSelfLeave: boolean;
  member: FolderMember | null;
  mode: CreateFolderDialogMode;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const title = isSelfLeave ? "공유 폴더 나가기" : "공유 폴더 멤버 제외";
  const description = isSelfLeave
    ? "공유 폴더에서 나가시겠어요?"
    : `${member?.userNickname ?? "멤버"}을 제외시키겠어요?`;
  const body = (
    <View className="gap-4">
      {mode === "mobile" ? (
        <View className="gap-2">
          <Text className="text-lg font-semibold text-foreground">{title}</Text>
          <Text className="text-sm text-muted-foreground">{description}</Text>
        </View>
      ) : null}
      {errorMessage ? (
        <Text className="text-sm font-medium text-destructive">{errorMessage}</Text>
      ) : null}
      <View className="flex-row justify-end gap-2">
        <Button
          className="h-10"
          disabled={isPending}
          variant="outline"
          onPress={() => onOpenChange(false)}
        >
          <Text>취소</Text>
        </Button>
        <Button
          className="h-10"
          disabled={isPending}
          variant="destructive"
          onPress={onConfirm}
        >
          {isPending ? <ActivityIndicator size="small" /> : null}
          <Text>확인</Text>
        </Button>
      </View>
    </View>
  );

  if (mode === "wide") {
    return (
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {errorMessage ? (
            <Text className="text-sm font-medium text-destructive">{errorMessage}</Text>
          ) : null}
          <DialogFooter className="flex-row justify-end">
            <Button
              className="h-10"
              disabled={isPending}
              variant="outline"
              onPress={() => onOpenChange(false)}
            >
              <Text>취소</Text>
            </Button>
            <Button
              className="h-10"
              disabled={isPending}
              variant="destructive"
              onPress={onConfirm}
            >
              {isPending ? <ActivityIndicator size="small" /> : null}
              <Text>확인</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <Sheet
      open={open}
      fitContent
      stackBehavior="push"
      onOpenChange={onOpenChange}
    >
      {body}
    </Sheet>
  );
}

function resolveInvitationUrl(invitation: string, folderId: number) {
  // Always hand out a web link (never a `qlinkchannel://` deep link) so the
  // invite opens the web accept page first; mobile then hops into the app from
  // there. Host is pinned per build variant.
  return `${getWebAppOrigin()}/invite?token=${encodeURIComponent(invitation)}&folderId=${folderId}`;
}

export { FolderHeaderActions };
export type { FolderHeaderActionsProps };
