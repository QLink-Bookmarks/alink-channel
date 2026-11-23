import * as React from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmojiPickerGrid } from "@/components/ui/emoji-picker-grid";
import { Input } from "@/components/ui/input";
import { PublicAddressRow } from "@/components/ui/public-address-row";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";

import {
  useCreateFolderMutation,
  useSetFolderPrivacyMutation,
  useUpdateFolderMutation,
} from "../mutations";
import { useFolderDetailQuery } from "../queries";
import type { Folder } from "../types";
import { VisibilityField } from "./visibility-field";

const PUBLISH_TITLE = "폴더를 전체 공개할까요?";
const PUBLISH_DESCRIPTION =
  "기존 링크는 모두 나만 보기로 유지되고, 새로 추가하는 링크는 전체 공개돼요.";
const FOLDER_VISIBILITY_HELP = "전체 공개하면 주소를 아는 누구나 공개 링크와 할 일을 볼 수 있어요.";

type CreateFolderDialogMode = "wide" | "mobile";

type CreatedFolder = {
  id: number;
  isShared: boolean;
};

type CreateFolderDialogProps = {
  mode: CreateFolderDialogMode;
  open: boolean;
  defaultShared?: boolean;
  stackBehavior?: "switch" | "push";
  onOpenChange: (open: boolean) => void;
  onCreated?: (folder: CreatedFolder) => void;
};

function CreateFolderDialog({
  mode,
  open,
  defaultShared = false,
  stackBehavior = "switch",
  onOpenChange,
  onCreated,
}: CreateFolderDialogProps) {
  const [name, setName] = React.useState("");
  const [emoji, setEmoji] = React.useState<string | null>(null);
  const [isShared, setIsShared] = React.useState(false);
  const [isPublic, setIsPublic] = React.useState(false);
  const [created, setCreated] = React.useState<CreatedFolder>();
  const [validationError, setValidationError] = React.useState<string | undefined>();
  const mutation = useCreateFolderMutation();
  const resetMutation = mutation.reset;
  const saving = React.useRef(false);
  const privacy = useFolderDetailQuery(open ? (created?.id ?? null) : null);

  React.useEffect(() => {
    if (open) {
      setIsShared(defaultShared);
      return;
    }
    setName("");
    setEmoji(null);
    setIsShared(false);
    setIsPublic(false);
    setCreated(undefined);
    setValidationError(undefined);
    resetMutation();
  }, [defaultShared, open, resetMutation]);

  const handleSave = React.useCallback(async () => {
    if (saving.current || created) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("폴더 이름을 입력해주세요.");
      return;
    }

    saving.current = true;
    try {
      const response = await mutation.mutateAsync({ name: trimmed, emoji, isShared, isPublic });
      const result = { id: response.data.id, isShared };
      if (isPublic) {
        setCreated(result);
        return;
      }
      onOpenChange(false);
      onCreated?.(result);
    } catch {
      return;
    } finally {
      saving.current = false;
    }
  }, [created, emoji, isPublic, isShared, mutation, name, onCreated, onOpenChange]);

  const handleOpenChange = (next: boolean) => {
    if (!next && saving.current) return;
    onOpenChange(next);
    if (!next && created) onCreated?.(created);
  };

  const isMobile = mode === "mobile";
  const body = created ? (
    <View className="gap-3">
      <Text role="status">폴더를 만들었어요.</Text>
      <FolderPrivacyStatus
        addressFolderId={created.id}
        query={privacy}
      />
      <Button onPress={() => handleOpenChange(false)}>
        <Text>완료</Text>
      </Button>
    </View>
  ) : (
    <FolderFormBody
      emoji={emoji}
      errorMessage={
        mutation.error ? "폴더 생성에 실패했어요. 잠시 후 다시 시도해주세요." : undefined
      }
      isPending={mutation.isPending}
      isShared={isShared}
      visibility={
        <VisibilityField
          disabled={mutation.isPending}
          help={FOLDER_VISIBILITY_HELP}
          isPublic={isPublic}
          onChange={setIsPublic}
        />
      }
      name={name}
      showActions={!isMobile}
      validationError={validationError}
      onCancel={() => handleOpenChange(false)}
      onEmojiChange={setEmoji}
      onNameChange={(next) => {
        setName(next);
        if (validationError) {
          setValidationError(undefined);
        }
      }}
      onSave={handleSave}
      onSharedChange={setIsShared}
    />
  );

  if (mode === "wide") {
    return (
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>새 폴더</DialogTitle>
          </DialogHeader>
          <ScrollView
            className="max-h-[65vh]"
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
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
      footer={
        created ? undefined : (
          <FolderFormActions
            isPending={mutation.isPending}
            onCancel={() => handleOpenChange(false)}
            onSave={handleSave}
          />
        )
      }
      stackBehavior={stackBehavior}
      onOpenChange={handleOpenChange}
    >
      <View className="gap-3">
        <Text className="text-lg font-semibold text-foreground">새 폴더</Text>
        {body}
      </View>
    </Sheet>
  );
}

type EditFolderDialogProps = {
  mode: CreateFolderDialogMode;
  open: boolean;
  folder: Folder;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (folderId: number) => void;
};

function EditFolderDialog({ mode, open, folder, onOpenChange, onUpdated }: EditFolderDialogProps) {
  const [name, setName] = React.useState(folder.name);
  const [emoji, setEmoji] = React.useState<string | null>(folder.emoji ?? null);
  const [isShared, setIsShared] = React.useState(folder.isShared);
  const [validationError, setValidationError] = React.useState<string | undefined>();
  const [draftPrivacy, setDraftPrivacy] = React.useState<boolean>();
  const [confirming, setConfirming] = React.useState(false);
  const [notice, setNotice] = React.useState<string>();
  const privacy = useFolderDetailQuery(open ? folder.id : null);
  const confirmedVisibility = privacy.isSuccess && typeof privacy.data.isPublic === "boolean";
  const savedPublic = (privacy.data?.isPublic ?? folder.isPublic) === true;
  const isPublic = draftPrivacy ?? savedPublic;
  const saving = React.useRef(false);
  const saveButton = React.useRef<React.ComponentRef<typeof View>>(null);
  const resultNotice = React.useRef<React.ComponentRef<typeof View>>(null);
  const mutation = useUpdateFolderMutation();
  const privacyMutation = useSetFolderPrivacyMutation();
  const resetMutation = mutation.reset;
  const resetPrivacyMutation = privacyMutation.reset;
  const initializedFolder = React.useRef<Folder | null>(null);

  React.useEffect(() => {
    if (!open) {
      initializedFolder.current = null;
      return;
    }
    if (initializedFolder.current?.id === folder.id) return;
    initializedFolder.current = folder;
    setName(folder.name);
    setEmoji(folder.emoji ?? null);
    setIsShared(folder.isShared);
    setValidationError(undefined);
    setDraftPrivacy(undefined);
    setConfirming(false);
    setNotice(undefined);
    resetMutation();
    resetPrivacyMutation();
  }, [folder, open, resetMutation, resetPrivacyMutation]);

  const handleSave = async (confirmed = false) => {
    if (saving.current || (confirming && !confirmed)) return;
    if (draftPrivacy !== undefined && (!confirmedVisibility || privacy.isFetching)) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("폴더 이름을 입력해주세요.");
      return;
    }

    const change = isPublic !== savedPublic && confirmedVisibility ? isPublic : undefined;
    if (change === true && !confirmed) {
      setConfirming(true);
      return;
    }
    saving.current = true;
    setConfirming(false);
    try {
      resetMutation();
      resetPrivacyMutation();
      const initial = initializedFolder.current ?? folder;
      const fieldsChanged =
        trimmed !== initial.name.trim() ||
        emoji !== (initial.emoji ?? null) ||
        isShared !== initial.isShared;
      if (fieldsChanged) {
        await mutation.mutateAsync({
          id: folder.id,
          payload: { name: trimmed, emoji, isShared },
        });
        initializedFolder.current = { ...initial, name: trimmed, emoji, isShared };
      }
      if (change !== undefined) {
        await privacyMutation.mutateAsync({ id: folder.id, isPublic: change });
      }
      onUpdated?.(folder.id);
      if (change === undefined) {
        onOpenChange(false);
        return;
      }
      setDraftPrivacy(undefined);
      setNotice(
        change
          ? "폴더를 전체 공개했어요."
          : "공개를 껐어요. 이제 권한이 있는 사람만 폴더를 열 수 있어요.",
      );
      requestAnimationFrame(() => resultNotice.current?.focus());
    } catch {
      // Mutation errors stay visible in the form so the user can retry.
    } finally {
      saving.current = false;
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!saving.current && !confirming) onOpenChange(next);
  };

  const useSheetActions = mode === "mobile" && process.env.EXPO_OS !== "web";
  const isWriting = mutation.isPending || privacyMutation.isPending;
  const isPending = isWriting || (draftPrivacy !== undefined && privacy.isFetching);
  const body = notice ? (
    <View className="gap-3">
      <View
        ref={resultNotice}
        tabIndex={-1}
        className="rounded"
      >
        <Text role="status">{notice}</Text>
      </View>
      <Button onPress={() => handleOpenChange(false)}>
        <Text>완료</Text>
      </Button>
    </View>
  ) : (
    <FolderFormBody
      emoji={emoji}
      errorMessage={
        privacyMutation.isError
          ? "공개 설정을 저장하지 못했어요."
          : mutation.isError
            ? "폴더 수정에 실패했어요. 잠시 후 다시 시도해주세요."
            : undefined
      }
      isPending={isPending}
      isShared={isShared}
      saveButton={saveButton}
      visibility={
        <View className="gap-3">
          <VisibilityField
            disabled={isWriting || !confirmedVisibility || privacy.isFetching}
            help={FOLDER_VISIBILITY_HELP}
            isPublic={isPublic}
            onChange={setDraftPrivacy}
          />
          <FolderPrivacyStatus query={privacy} />
        </View>
      }
      name={name}
      showActions={!useSheetActions}
      validationError={validationError}
      onCancel={() => handleOpenChange(false)}
      onEmojiChange={setEmoji}
      onNameChange={(next) => {
        setName(next);
        if (validationError) {
          setValidationError(undefined);
        }
      }}
      onSave={() => void handleSave()}
      onSharedChange={setIsShared}
    />
  );

  const confirm = (
    <AlertDialog
      open={confirming}
      onOpenChange={setConfirming}
    >
      <AlertDialogContent
        className="max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!saving.current) saveButton.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{PUBLISH_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>{PUBLISH_DESCRIPTION}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Text>취소</Text>
          </AlertDialogCancel>
          <AlertDialogAction onPress={() => void handleSave(true)}>
            <Text>전체 공개</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (mode === "wide") {
    return (
      <>
        <Dialog
          open={open}
          onOpenChange={handleOpenChange}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>폴더 수정</DialogTitle>
            </DialogHeader>
            <ScrollView
              className="max-h-[65vh]"
              keyboardShouldPersistTaps="handled"
            >
              {body}
            </ScrollView>
          </DialogContent>
        </Dialog>
        {confirm}
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
        footer={
          useSheetActions && !notice ? (
            <FolderFormActions
              isPending={isPending}
              saveButton={saveButton}
              onCancel={() => handleOpenChange(false)}
              onSave={() => void handleSave()}
            />
          ) : undefined
        }
        onOpenChange={handleOpenChange}
      >
        <View className="gap-3">
          <Text className="text-lg font-semibold text-foreground">폴더 수정</Text>
          {body}
        </View>
      </Sheet>
      {confirm}
    </>
  );
}

function FolderPrivacyStatus({
  addressFolderId,
  query,
}: {
  addressFolderId?: number;
  query: ReturnType<typeof useFolderDetailQuery>;
}) {
  if (query.isFetching) {
    return <Text className="text-xs text-muted-foreground">공개 설정을 확인하는 중이에요.</Text>;
  }
  if (query.isError) {
    return (
      <View className="items-start gap-2">
        <Text className="text-xs text-muted-foreground">공개 설정을 확인하지 못했어요.</Text>
        <Button
          variant="outline"
          size="sm"
          onPress={() => void query.refetch()}
        >
          <Text>다시 확인</Text>
        </Button>
      </View>
    );
  }
  return addressFolderId !== undefined && query.data?.isPublic === true ? (
    <PublicAddressRow
      key={addressFolderId}
      path={`/folders/${addressFolderId}`}
    />
  ) : null;
}

function FolderFormBody({
  name,
  emoji,
  isShared,
  validationError,
  errorMessage,
  isPending,
  showActions = true,
  visibility,
  saveButton,
  onNameChange,
  onEmojiChange,
  onSharedChange,
  onCancel,
  onSave,
}: {
  name: string;
  emoji: string | null;
  isShared: boolean;
  validationError?: string;
  errorMessage?: string;
  isPending: boolean;
  showActions?: boolean;
  visibility: React.ReactNode;
  saveButton?: React.RefObject<React.ComponentRef<typeof View> | null>;
  onNameChange: (name: string) => void;
  onEmojiChange: (emoji: string | null) => void;
  onSharedChange: (isShared: boolean) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">폴더 이름</Text>
        <Input
          className="h-10 rounded-xl px-4 text-base"
          autoFocus
          maxLength={100}
          placeholder="예: 디자인 레퍼런스"
          value={name}
          onChangeText={onNameChange}
        />
        {validationError ? (
          <Text className="text-sm font-medium text-destructive">{validationError}</Text>
        ) : null}
        {errorMessage ? (
          <Text className="text-sm font-medium text-destructive">{errorMessage}</Text>
        ) : null}
      </View>
      <View className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground">공유 폴더</Text>
          <Text className="text-xs text-muted-foreground">
            초대 링크로 멤버를 초대하고 함께 편집할 수 있어요.
          </Text>
        </View>
        <Switch
          checked={isShared}
          onCheckedChange={onSharedChange}
        />
      </View>
      {visibility}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-muted-foreground">이모지</Text>
        <EmojiPickerGrid
          value={emoji}
          onChange={onEmojiChange}
          maxHeight={220}
        />
      </View>
      {showActions ? (
        <FolderFormActions
          isPending={isPending}
          saveButton={saveButton}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : null}
    </View>
  );
}

function FolderFormActions({
  isPending,
  saveButton,
  onCancel,
  onSave,
}: {
  isPending: boolean;
  saveButton?: React.RefObject<React.ComponentRef<typeof View> | null>;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <View className="flex-row justify-end gap-2">
      <Button
        className="h-10"
        disabled={isPending}
        variant="outline"
        onPress={onCancel}
      >
        <Text>취소</Text>
      </Button>
      <Button
        ref={(node: React.ComponentRef<typeof Button> | null) => {
          if (saveButton) saveButton.current = node && "focus" in node ? node : null;
        }}
        className="h-10"
        disabled={isPending}
        onPress={onSave}
      >
        {isPending ? <ActivityIndicator size="small" /> : null}
        <Text>저장</Text>
      </Button>
    </View>
  );
}

export { CreateFolderDialog, EditFolderDialog, PUBLISH_DESCRIPTION, PUBLISH_TITLE };
export type {
  CreatedFolder,
  CreateFolderDialogMode,
  CreateFolderDialogProps,
  EditFolderDialogProps,
};
