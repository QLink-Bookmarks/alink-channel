import * as React from "react";
import { ActivityIndicator, View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmojiPickerGrid } from "@/components/ui/emoji-picker-grid";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";

import { useCreateFolderMutation, useUpdateFolderMutation } from "../mutations";
import type { Folder } from "../types";

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
  const [validationError, setValidationError] = React.useState<string | undefined>();
  const mutation = useCreateFolderMutation();
  const resetMutation = mutation.reset;

  React.useEffect(() => {
    if (open) {
      setIsShared(defaultShared);
      return;
    }
    setName("");
    setEmoji(null);
    setIsShared(false);
    setValidationError(undefined);
    resetMutation();
  }, [defaultShared, open, resetMutation]);

  const handleSave = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("폴더 이름을 입력해주세요.");
      return;
    }

    try {
      const response = await mutation.mutateAsync({ name: trimmed, emoji, isShared });
      onOpenChange(false);
      onCreated?.({ id: response.data.id, isShared });
    } catch (error) {
      console.log("folders:create:failed", error);
    }
  }, [emoji, isShared, mutation, name, onCreated, onOpenChange]);

  const isMobile = mode === "mobile";
  const body = (
    <FolderFormBody
      emoji={emoji}
      errorMessage={
        mutation.error ? "폴더 생성에 실패했어요. 잠시 후 다시 시도해주세요." : undefined
      }
      isPending={mutation.isPending}
      isShared={isShared}
      name={name}
      showActions={!isMobile}
      validationError={validationError}
      onCancel={() => onOpenChange(false)}
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
        onOpenChange={onOpenChange}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>새 폴더</DialogTitle>
          </DialogHeader>
          {body}
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
        <FolderFormActions
          isPending={mutation.isPending}
          onCancel={() => onOpenChange(false)}
          onSave={handleSave}
        />
      }
      stackBehavior={stackBehavior}
      onOpenChange={onOpenChange}
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
  const mutation = useUpdateFolderMutation();
  const resetMutation = mutation.reset;

  React.useEffect(() => {
    if (open) {
      setName(folder.name);
      setEmoji(folder.emoji ?? null);
      setIsShared(folder.isShared);
      setValidationError(undefined);
      resetMutation();
    }
  }, [folder.emoji, folder.id, folder.isShared, folder.name, open, resetMutation]);

  const handleSave = React.useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError("폴더 이름을 입력해주세요.");
      return;
    }

    try {
      const response = await mutation.mutateAsync({
        id: folder.id,
        payload: { name: trimmed, emoji, isShared },
      });
      onOpenChange(false);
      onUpdated?.(response.data.id);
    } catch (error) {
      console.log("folders:update:failed", error);
    }
  }, [emoji, folder.id, isShared, mutation, name, onOpenChange, onUpdated]);

  const body = (
    <FolderFormBody
      emoji={emoji}
      errorMessage={
        mutation.error ? "폴더 수정에 실패했어요. 잠시 후 다시 시도해주세요." : undefined
      }
      isPending={mutation.isPending}
      isShared={isShared}
      name={name}
      validationError={validationError}
      onCancel={() => onOpenChange(false)}
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
        onOpenChange={onOpenChange}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>폴더 수정</DialogTitle>
          </DialogHeader>
          {body}
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
      onOpenChange={onOpenChange}
    >
      <View className="gap-3">
        <Text className="text-lg font-semibold text-foreground">폴더 수정</Text>
        {body}
      </View>
    </Sheet>
  );
}

function FolderFormBody({
  name,
  emoji,
  isShared,
  validationError,
  errorMessage,
  isPending,
  showActions = true,
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
            공유 링크와 멤버 초대를 사용할 수 있어요.
          </Text>
        </View>
        <Switch
          checked={isShared}
          onCheckedChange={onSharedChange}
        />
      </View>
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
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : null}
    </View>
  );
}

function FolderFormActions({
  isPending,
  onCancel,
  onSave,
}: {
  isPending: boolean;
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

export { CreateFolderDialog, EditFolderDialog };
export type {
  CreatedFolder,
  CreateFolderDialogMode,
  CreateFolderDialogProps,
  EditFolderDialogProps,
};
