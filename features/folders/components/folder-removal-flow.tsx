import * as React from "react";
import { View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { useMyProfileQuery } from "@/features/account/queries";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

import { useFolderRemovalSuccess } from "../hooks/use-folder-removal-success";
import {
  FOLDER_REMOVAL_MESSAGES,
  type FolderRemovalAction,
  type FolderRemovalOutcome,
  classifyFolderRemovalError,
} from "../lib/folder-api-errors";
import {
  type FolderLinkChoice,
  buildFolderDeleteParams,
  getFolderLinkCounts,
  needsFolderNameConfirm,
} from "../lib/folder-delete-request";
import { getFolderDeleteTitle } from "../lib/folder-delete-title";
import { isFolderNameMatch } from "../lib/folder-name-match";
import {
  useDeleteFolderMutation,
  useLeaveFolderMutation,
  useTransferFolderOwnershipMutation,
} from "../mutations";
import { useFolderMembersQuery } from "../queries";
import type { Folder, FolderMember } from "../types";
import {
  type FolderDeleteTarget,
  PersonalFolderDeleteBody,
  SharedFolderDeleteBody,
  UNCATEGORIZED_DELETE_TARGET,
  getPersonalDeleteDescription,
  getSharedDeleteDescription,
} from "./folder-delete-confirm";
import { FOLDER_LEAVE_COPY } from "./folder-leave-confirm";
import { FolderPickerDialog } from "./folder-picker-dialog";
import { UNCATEGORIZED_PICKER_OPTION } from "./folder-picker-list";
import { FolderSharedChoiceStep } from "./folder-shared-choice-step";
import {
  FolderTransferMemberPicker,
  getTransferConfirmDescription,
  getTransferConfirmTitle,
  getTransferSuccessToast,
} from "./folder-transfer-steps";

import { ChevronLeft, CircleAlert } from "lucide-react-native/icons";

/** `delete`: the owner's delete (personal or shared, with transfer); `leave`: a member leaves. */
type FolderRemovalKind = "delete" | "leave";

type FolderRemovalStep =
  | "personal-confirm"
  | "shared-entry"
  | "shared-choice"
  | "shared-confirm"
  | "transfer-pick"
  | "transfer-confirm"
  | "leave-confirm";

type FolderRemovalError = { message: string; blocksCta: boolean };

type FolderRemovalFlowProps = {
  folder: Folder;
  kind: FolderRemovalKind;
  mode: "wide" | "mobile";
  onClose: () => void;
};

const DELETE_TOAST = "폴더를 삭제했어요.";

function getInitialStep(folder: Folder, kind: FolderRemovalKind): FolderRemovalStep {
  if (kind === "leave") {
    return "leave-confirm";
  }
  return folder.isShared ? "shared-entry" : "personal-confirm";
}

function getMemberRows(data: { ownerId: number; members: FolderMember[] } | undefined) {
  const members = data?.members ?? [];
  const otherMembers = data ? members.filter((member) => member.userId !== data.ownerId) : [];
  return { otherMembers, participantCount: otherMembers.length + 1 };
}

/**
 * One controller for the folder delete, transfer and leave steps. Wide shows a Dialog and
 * mobile a Sheet; the steps swap inside the same surface. Mounted only while open, so every
 * open starts fresh: (a), 🗂️ 미분류, an empty name and no chosen member.
 */
function FolderRemovalFlow({ folder, kind, mode, onClose }: FolderRemovalFlowProps) {
  const queryClient = useQueryClient();
  const isSharedOwnerFlow = kind === "delete" && folder.isShared;
  const membersQuery = useFolderMembersQuery(folder.id, isSharedOwnerFlow, {
    retry: 1,
    refetchOnMount: "always",
  });
  const deleteMutation = useDeleteFolderMutation();
  const transferMutation = useTransferFolderOwnershipMutation();
  const leaveMutation = useLeaveFolderMutation();
  const myUserId = useMyProfileQuery().data?.id;
  const { finish, resolvePermissionChange } = useFolderRemovalSuccess({
    folderId: folder.id,
    mode,
  });

  const [step, setStep] = React.useState<FolderRemovalStep>(() => getInitialStep(folder, kind));
  const [choice, setChoice] = React.useState<FolderLinkChoice>("keep");
  const [target, setTarget] = React.useState<FolderDeleteTarget>(UNCATEGORIZED_DELETE_TARGET);
  const [typedName, setTypedName] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [error, setError] = React.useState<FolderRemovalError | null>(null);
  // The move target vanished or became unwritable. Only picking a target again clears it;
  // switching to (b) hides it, and it shows again on (a).
  const [targetError, setTargetError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  // `isPending` lands on the next render; this ref keeps a second press from sending again.
  const pendingRef = React.useRef(false);

  // Fresh counts on open: the folder list (linkCounts, myLinkCounts). Members refetch on mount.
  React.useEffect(() => {
    void queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === "folders" &&
        (query.queryKey[1] === "list" || query.queryKey[1] === "infinite"),
    });
  }, [queryClient]);

  const counts = getFolderLinkCounts(folder);
  const { otherMembers, participantCount } = getMemberRows(membersQuery.data);
  const otherMemberCount = otherMembers.length;
  // A failed refetch keeps cached members (e.g. from the share dialog), so only a successful
  // fetch after this open counts as ready.
  const isMembersReady = membersQuery.isFetchedAfterMount && membersQuery.status === "success";
  const isMembersFailed = membersQuery.isFetchedAfterMount && membersQuery.isError;

  React.useEffect(() => {
    if (step === "shared-entry" && isMembersReady) {
      setStep(otherMemberCount > 0 ? "shared-choice" : "shared-confirm");
    }
  }, [isMembersReady, otherMemberCount, step]);

  const selectedMember =
    selectedUserId == null
      ? null
      : (otherMembers.find((member) => member.userId === selectedUserId) ?? null);

  const handleClose = React.useCallback(() => {
    if (pendingRef.current) {
      return;
    }
    onClose();
  }, [onClose]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        handleClose();
      }
    },
    [handleClose],
  );

  const goToStep = React.useCallback((next: FolderRemovalStep) => {
    if (pendingRef.current) {
      return;
    }
    setError(null);
    setStep(next);
  }, []);

  const handleChoiceChange = React.useCallback((next: FolderLinkChoice) => {
    if (pendingRef.current) {
      return;
    }
    setChoice(next);
    setError(null);
  }, []);

  const handleTypedNameChange = React.useCallback((next: string) => {
    if (pendingRef.current) {
      return;
    }
    setTypedName(next);
  }, []);

  const handleTargetPress = React.useCallback(() => {
    if (pendingRef.current) {
      return;
    }
    setIsPickerOpen(true);
  }, []);

  const handlePickerConfirm = React.useCallback(
    async (selection: { id: number | null; label: string; emoji?: string | null }) => {
      setTarget(
        selection.id == null
          ? UNCATEGORIZED_DELETE_TARGET
          : { id: selection.id, name: selection.label, emoji: selection.emoji ?? "📁" },
      );
      setTargetError(null);
      setError(null);
    },
    [],
  );

  const handleMemberSelect = React.useCallback((userId: number) => {
    if (pendingRef.current) {
      return;
    }
    setSelectedUserId(userId);
    setError(null);
  }, []);

  const runAction = React.useCallback(
    async (
      action: FolderRemovalAction,
      request: () => Promise<unknown>,
      success: { toast: string; hasDeletedLinks: boolean },
    ) => {
      if (pendingRef.current) {
        return;
      }
      pendingRef.current = true;
      setIsPending(true);
      setError(null);

      let outcome: FolderRemovalOutcome;
      try {
        await request();
        outcome = { kind: "done" };
      } catch (requestError) {
        outcome = classifyFolderRemovalError(action, requestError);
      }

      if (outcome.kind === "permission-changed") {
        const resolution = await resolvePermissionChange();
        if (resolution === "ended") {
          pendingRef.current = false;
          onClose();
          return;
        }
        outcome = { kind: "failed", message: FOLDER_REMOVAL_MESSAGES.permissionChanged };
      }

      pendingRef.current = false;
      setIsPending(false);

      switch (outcome.kind) {
        case "done":
          onClose();
          finish({ toast: success.toast, hasDeletedLinks: success.hasDeletedLinks });
          return;
        case "ended":
          onClose();
          finish({ toast: null, hasDeletedLinks: false });
          return;
        case "target-unavailable":
          setTargetError(outcome.message);
          void queryClient.invalidateQueries({
            predicate: (query) =>
              query.queryKey[0] === "folders" && query.queryKey[1] !== "members",
          });
          return;
        case "duplicate-name":
          setError({ message: outcome.message, blocksCta: true });
          return;
        case "member-gone":
          setSelectedUserId(null);
          setStep("transfer-pick");
          setError({ message: outcome.message, blocksCta: false });
          void membersQuery.refetch();
          return;
        case "failed":
          setError({ message: outcome.message, blocksCta: false });
          return;
      }
    },
    [finish, membersQuery, onClose, queryClient, resolvePermissionChange],
  );

  const handleDeletePress = React.useCallback(() => {
    const isDeletingLinks = choice === "delete";
    const hasLinksToChoose = folder.isShared ? counts.total > 0 : counts.mine > 0;
    const effectiveChoice: FolderLinkChoice = hasLinksToChoose ? choice : "keep";
    const params = buildFolderDeleteParams({
      isShared: folder.isShared,
      choice: effectiveChoice,
      targetFolderId: hasLinksToChoose ? target.id : null,
    });
    void runAction("delete", () => deleteMutation.mutateAsync({ id: folder.id, params }), {
      toast: DELETE_TOAST,
      hasDeletedLinks: hasLinksToChoose && isDeletingLinks,
    });
  }, [choice, counts.mine, counts.total, deleteMutation, folder, runAction, target.id]);

  const handleTransferPress = React.useCallback(() => {
    if (!selectedMember) {
      return;
    }
    const ownerId = selectedMember.userId;
    void runAction("transfer", () => transferMutation.mutateAsync({ id: folder.id, ownerId }), {
      toast: getTransferSuccessToast(selectedMember.userNickname),
      hasDeletedLinks: false,
    });
  }, [folder.id, runAction, selectedMember, transferMutation]);

  const handleLeavePress = React.useCallback(() => {
    void runAction(
      "leave",
      async () => {
        if (myUserId == null) {
          throw new Error("folders:leave:unknown-user");
        }
        await leaveMutation.mutateAsync({ id: folder.id, memberId: myUserId });
      },
      { toast: FOLDER_LEAVE_COPY.successToast, hasDeletedLinks: false },
    );
  }, [folder.id, leaveMutation, myUserId, runAction]);

  const ctaBlocked = error?.blocksCta ?? false;
  const visibleTargetError =
    step === "personal-confirm" && choice === "keep" && counts.mine > 0 ? targetError : null;
  let content: FolderRemovalStepContent;

  switch (step) {
    case "personal-confirm": {
      const needsName = needsFolderNameConfirm({
        isShared: false,
        choice,
        myLinkCount: counts.mine,
      });
      const isNameOk = !needsName || isFolderNameMatch(typedName, folder.name);
      content = {
        title: getFolderDeleteTitle({ name: folder.name, emoji: folder.emoji, isShared: false }),
        description: getPersonalDeleteDescription(counts),
        body: (
          <PersonalFolderDeleteBody
            choice={choice}
            counts={counts}
            folderName={folder.name}
            isPending={isPending}
            target={target}
            typedName={typedName}
            onChoiceChange={handleChoiceChange}
            onTargetPress={handleTargetPress}
            onTypedNameChange={handleTypedNameChange}
          />
        ),
        cta: {
          label: "폴더 삭제",
          isDestructive: true,
          disabled: !isNameOk || ctaBlocked || visibleTargetError != null,
          onPress: handleDeletePress,
        },
      };
      break;
    }
    case "shared-entry":
      content = {
        title: "공유 폴더 삭제",
        body: isMembersFailed ? null : (
          <ActivityIndicator
            accessibilityLabel="멤버 목록을 불러오는 중"
            className="py-8"
            size="large"
          />
        ),
        cancelLabel: isMembersFailed ? "닫기" : "취소",
        errorOverride: isMembersFailed ? "공유 폴더 멤버를 불러오지 못했어요." : undefined,
      };
      break;
    case "shared-choice":
      content = {
        title: "공유 폴더를 어떻게 할까요?",
        body: (
          <FolderSharedChoiceStep
            onDeletePress={() => goToStep("shared-confirm")}
            onTransferPress={() => goToStep("transfer-pick")}
          />
        ),
      };
      break;
    case "shared-confirm": {
      const linkCount = counts.total;
      const needsName = needsFolderNameConfirm({ isShared: true, linkCount, otherMemberCount });
      const isNameOk = !needsName || isFolderNameMatch(typedName, folder.name);
      content = {
        title: getFolderDeleteTitle({ name: folder.name, emoji: folder.emoji, isShared: true }),
        description: getSharedDeleteDescription({ otherMemberCount, linkCount }),
        onBack: otherMemberCount > 0 ? () => goToStep("shared-choice") : undefined,
        body: (
          <SharedFolderDeleteBody
            choice={choice}
            folderName={folder.name}
            isPending={isPending}
            linkCount={linkCount}
            needsName={needsName}
            otherMemberCount={otherMemberCount}
            participantCount={participantCount}
            typedName={typedName}
            onChoiceChange={handleChoiceChange}
            onTypedNameChange={handleTypedNameChange}
          />
        ),
        cta: {
          label: "폴더 삭제",
          isDestructive: true,
          disabled: !isNameOk || ctaBlocked,
          onPress: handleDeletePress,
        },
      };
      break;
    }
    case "transfer-pick":
      content =
        otherMemberCount === 0
          ? {
              title: "새 소유자 선택",
              body: (
                <FolderTransferMemberPicker
                  members={otherMembers}
                  selectedUserId={null}
                  onSelect={handleMemberSelect}
                />
              ),
              cta: {
                label: "폴더 삭제",
                isDestructive: true,
                disabled: false,
                onPress: () => goToStep("shared-confirm"),
              },
            }
          : {
              title: "새 소유자 선택",
              description: "소유권을 넘길 멤버를 골라주세요.",
              onBack: () => goToStep("shared-choice"),
              body: (
                <FolderTransferMemberPicker
                  members={otherMembers}
                  selectedUserId={selectedMember?.userId ?? null}
                  onSelect={handleMemberSelect}
                />
              ),
              cta: {
                label: "다음",
                isDestructive: false,
                disabled: selectedMember == null,
                onPress: () => goToStep("transfer-confirm"),
              },
            };
      break;
    case "transfer-confirm": {
      const nickname = selectedMember?.userNickname ?? "멤버";
      content = {
        title: getTransferConfirmTitle(nickname),
        description: getTransferConfirmDescription(nickname),
        onBack: () => goToStep("transfer-pick"),
        body: null,
        cta: {
          label: "위임하고 나가기",
          isDestructive: true,
          disabled: selectedMember == null || ctaBlocked,
          onPress: handleTransferPress,
        },
      };
      break;
    }
    case "leave-confirm":
      content = {
        title: FOLDER_LEAVE_COPY.title,
        description: FOLDER_LEAVE_COPY.description,
        body: null,
        cta: {
          label: FOLDER_LEAVE_COPY.confirmLabel,
          isDestructive: true,
          disabled: false,
          onPress: handleLeavePress,
        },
      };
      break;
  }

  return (
    <>
      <FolderRemovalSurface
        content={content}
        errorMessage={content.errorOverride ?? visibleTargetError ?? error?.message ?? null}
        isPending={isPending}
        mode={mode}
        onCancel={handleClose}
        onOpenChange={handleOpenChange}
      />
      {step === "personal-confirm" ? (
        <FolderPickerDialog
          confirmLabel="확인"
          description="이동할 폴더를 선택해주세요."
          // Choosing a target calls no API, so the picker never shows an error here.
          errorMessage=""
          excludedFolderId={folder.id}
          initialFolderId={target.id}
          noneOption={UNCATEGORIZED_PICKER_OPTION}
          open={isPickerOpen}
          pendingLabel="확인"
          presentation={mode === "wide" ? "dialog" : "sheet"}
          stackBehavior="push"
          title="폴더 이동"
          onConfirm={handlePickerConfirm}
          onOpenChange={setIsPickerOpen}
        />
      ) : null}
    </>
  );
}

/**
 * Web Dialog anchored from the top (10vh) instead of centered, so switching choices or showing an
 * error, which change its height, does not move its top edge or the buttons with it.
 */
const DIALOG_TOP_ANCHOR_CLASS =
  process.env.EXPO_OS === "web" ? "justify-start pt-[10vh]" : undefined;

type FolderRemovalStepContent = {
  title: string;
  description?: string;
  onBack?: () => void;
  body: React.ReactNode;
  cta?: {
    label: string;
    isDestructive: boolean;
    disabled: boolean;
    onPress: () => void;
  };
  cancelLabel?: string;
  errorOverride?: string;
};

function FolderRemovalSurface({
  content,
  errorMessage,
  isPending,
  mode,
  onCancel,
  onOpenChange,
}: {
  content: FolderRemovalStepContent;
  errorMessage: string | null;
  isPending: boolean;
  mode: "wide" | "mobile";
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const isSheet = mode === "mobile";
  const { title, description, onBack, body, cta, cancelLabel = "취소" } = content;

  const backButton = onBack ? (
    <IconButton
      accessibilityLabel="이전 단계로"
      className="-ml-2"
      disabled={isPending}
      icon={ChevronLeft}
      size="sm"
      variant="ghost"
      onPress={onBack}
    />
  ) : null;

  const errorLine = errorMessage ? (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="flex-row items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5"
    >
      <Icon
        as={CircleAlert}
        className="size-4 shrink-0 text-destructive"
      />
      <Text className="min-w-0 flex-1 text-[13px] font-medium text-destructive">
        {errorMessage}
      </Text>
    </View>
  ) : null;

  const buttonClassName = isSheet ? "h-12 flex-1 rounded-xl" : "h-10 min-w-[88px] rounded-xl px-4";
  const labelClassName = isSheet ? "text-base font-semibold" : "text-sm font-semibold";
  const ctaDisabled = cta ? cta.disabled : true;

  const footer = (
    <View className="gap-2.5">
      {errorLine}
      <View className={cn("flex-row gap-2", !isSheet && "justify-end")}>
        <Button
          className={buttonClassName}
          disabled={isPending}
          variant="outline"
          onPress={onCancel}
        >
          <Text className={labelClassName}>{cancelLabel}</Text>
        </Button>
        {cta ? (
          <Button
            accessibilityState={{ busy: isPending, disabled: ctaDisabled }}
            aria-busy={isPending}
            className={cn(buttonClassName, "flex-row gap-2")}
            disabled={ctaDisabled}
            testID="folder-removal-cta"
            variant={cta.isDestructive ? "destructive" : "default"}
            onPress={isPending ? undefined : cta.onPress}
          >
            {isPending ? <ActivityIndicator tone="onPrimary" /> : null}
            <Text className={labelClassName}>{cta.label}</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );

  if (!isSheet) {
    const blockWhilePending = (event: { preventDefault: () => void }) => {
      if (isPending) {
        event.preventDefault();
      }
    };
    return (
      <Dialog
        open
        onOpenChange={onOpenChange}
      >
        <DialogContent
          className="max-h-[85vh] w-[480px] max-w-[90vw] gap-4 sm:max-w-[90vw]"
          closeDisabled={isPending}
          overlayClassName={DIALOG_TOP_ANCHOR_CLASS}
          onEscapeKeyDown={blockWhilePending}
          onInteractOutside={blockWhilePending}
        >
          <DialogHeader className="pr-7">
            {backButton ? (
              <View className="flex-row items-center gap-1.5">
                {backButton}
                <DialogTitle className="min-w-0 flex-1 leading-snug">{title}</DialogTitle>
              </View>
            ) : (
              <DialogTitle className="leading-snug">{title}</DialogTitle>
            )}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {body}
          {footer}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet
      open
      dismissible={!isPending}
      fitContent
      footer={footer}
      onOpenChange={onOpenChange}
    >
      <View className="gap-4">
        <View className="gap-2 pr-8">
          <View className="flex-row items-center gap-1.5">
            {backButton}
            <Text
              accessibilityRole="header"
              className="min-w-0 flex-1 text-lg font-semibold text-foreground"
            >
              {title}
            </Text>
          </View>
          {description ? (
            <Text className="text-sm text-muted-foreground">{description}</Text>
          ) : null}
        </View>
        {body}
      </View>
    </Sheet>
  );
}

export { FolderRemovalFlow };
export type { FolderRemovalFlowProps, FolderRemovalKind };
