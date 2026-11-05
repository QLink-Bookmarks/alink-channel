import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { FolderLinkChoice, FolderLinkCounts } from "../lib/folder-delete-request";
import { FolderChoiceGroup } from "./folder-link-choice";

import { ChevronRight, Link2, LogOut, Trash2, Users } from "lucide-react-native/icons";

type FolderDeleteTarget = {
  /** `null` is 미분류. */
  id: number | null;
  name: string;
  emoji: string;
};

const UNCATEGORIZED_DELETE_TARGET: FolderDeleteTarget = { id: null, name: "미분류", emoji: "🗂️" };

function getOthersLinksLine(count: number) {
  return `다른 사람이 넣은 링크 ${count}개는 그 사람의 미분류로 옮겨져요.`;
}

function getPersonalDeleteDescription(counts: FolderLinkCounts) {
  if (counts.mine > 0) {
    return `링크 ${counts.mine}개를 어떻게 할지 골라주세요.`;
  }
  return counts.others > 0
    ? getOthersLinksLine(counts.others)
    : "빈 폴더예요. 삭제해도 옮겨지는 링크가 없어요.";
}

function getSharedDeleteDescription({
  otherMemberCount,
  linkCount,
  choice,
}: {
  otherMemberCount: number;
  linkCount: number;
  choice: FolderLinkChoice;
}) {
  if (otherMemberCount > 0) {
    return "삭제한 폴더는 되돌릴 수 없어요.";
  }
  if (linkCount === 0) {
    return "나만 있는 빈 공유 폴더예요. 삭제해도 옮겨지는 링크가 없어요.";
  }
  return choice === "keep"
    ? `나만 있는 공유 폴더예요. 링크 ${linkCount}개는 각자 넣은 사람의 미분류로 이동해요.`
    : `나만 있는 공유 폴더예요. 링크 ${linkCount}개가 모두 삭제돼요.`;
}

function FolderNameConfirmField({
  folderName,
  value,
  disabled,
  onChangeText,
}: {
  folderName: string;
  value: string;
  disabled: boolean;
  onChangeText: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text
        className="text-[13px] font-semibold text-muted-foreground"
        nativeID="folder-delete-name-label"
      >
        삭제하려면 폴더 이름을 입력해주세요.
      </Text>
      <Input
        aria-labelledby="folder-delete-name-label"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        className="h-10 rounded-xl px-4 text-base"
        editable={!disabled}
        placeholder={folderName}
        testID="folder-delete-name-input"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function FolderDeleteTargetRow({
  target,
  disabled,
  onPress,
}: {
  target: FolderDeleteTarget;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Text className="text-[13px] font-semibold text-muted-foreground">옮길 폴더</Text>
      <Pressable
        accessibilityLabel={`옮길 폴더 선택, 현재 ${target.name}`}
        accessibilityRole="button"
        className={cn(
          "ml-auto h-10 min-w-0 max-w-[240px] shrink flex-row items-center gap-1.5 rounded-xl border border-border bg-card pl-3 pr-2.5",
          !disabled && "web:hover:border-primary",
          disabled && "opacity-60",
        )}
        disabled={disabled}
        onPress={onPress}
      >
        <Text
          aria-hidden
          className="text-[13.5px]"
        >
          {target.emoji}
        </Text>
        <Text
          className="min-w-0 shrink text-[13.5px] font-semibold text-foreground"
          numberOfLines={1}
        >
          {target.name}
        </Text>
        <Icon
          as={ChevronRight}
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Pressable>
    </View>
  );
}

type PersonalFolderDeleteBodyProps = {
  folderName: string;
  counts: FolderLinkCounts;
  choice: FolderLinkChoice;
  target: FolderDeleteTarget;
  typedName: string;
  isPending: boolean;
  onChoiceChange: (choice: FolderLinkChoice) => void;
  onTargetPress: () => void;
  onTypedNameChange: (value: string) => void;
};

function PersonalFolderDeleteBody({
  folderName,
  counts,
  choice,
  target,
  typedName,
  isPending,
  onChoiceChange,
  onTargetPress,
  onTypedNameChange,
}: PersonalFolderDeleteBodyProps) {
  if (counts.mine === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      <FolderChoiceGroup<FolderLinkChoice>
        accessibilityLabel="링크 처리"
        disabled={isPending}
        options={[
          {
            value: "keep",
            title: "다른 폴더로 옮기기",
            description: `링크 ${counts.mine}개를 고른 폴더로 옮겨요.`,
            selectedExtra: (
              <FolderDeleteTargetRow
                disabled={isPending}
                target={target}
                onPress={onTargetPress}
              />
            ),
          },
          {
            value: "delete",
            title: "링크도 함께 삭제",
            description: `링크 ${counts.mine}개와 링크에 단 액션이 함께 삭제되고 되돌릴 수 없어요.`,
            isDestructive: true,
          },
        ]}
        value={choice}
        onValueChange={onChoiceChange}
      />
      {counts.others > 0 ? (
        <View className="flex-row items-center gap-2">
          <Icon
            as={Users}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <Text className="min-w-0 flex-1 text-[13px] text-foreground/80">
            {getOthersLinksLine(counts.others)}
          </Text>
        </View>
      ) : null}
      {choice === "delete" ? (
        <FolderNameConfirmField
          disabled={isPending}
          folderName={folderName}
          value={typedName}
          onChangeText={onTypedNameChange}
        />
      ) : null}
    </View>
  );
}

function SharedFolderDeleteFacts({
  participantCount,
  linkCount,
  choice,
}: {
  participantCount: number;
  linkCount: number;
  choice: FolderLinkChoice;
}) {
  const isDeletingLinks = choice === "delete";
  const rowClassName = "flex-row items-center gap-2.5 px-3 py-2.5";

  return (
    <View
      aria-label="삭제하면"
      className="overflow-hidden rounded-xl border border-border-soft bg-surface"
      testID="shared-folder-delete-facts"
    >
      <View className={rowClassName}>
        <Icon
          as={Users}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <Text className="min-w-0 flex-1 text-sm text-foreground">
          참여 인원 {participantCount}명
        </Text>
      </View>
      <View className={cn(rowClassName, "border-t border-border-soft")}>
        <Icon
          as={isDeletingLinks ? Trash2 : Link2}
          className={cn(
            "size-4 shrink-0",
            isDeletingLinks ? "text-destructive" : "text-muted-foreground",
          )}
        />
        <Text
          className={cn(
            "min-w-0 flex-1 text-sm",
            isDeletingLinks ? "text-destructive" : "text-foreground",
          )}
        >
          {isDeletingLinks
            ? `링크 ${linkCount}개 · 다른 멤버의 링크까지 모두 삭제`
            : `링크 ${linkCount}개 · 각자 넣은 사람의 미분류로 이동`}
        </Text>
      </View>
      <View className={cn(rowClassName, "border-t border-border-soft")}>
        <Icon
          as={LogOut}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <Text className="min-w-0 flex-1 text-sm text-foreground">
          모든 멤버가 이 폴더를 더 볼 수 없어요
        </Text>
      </View>
    </View>
  );
}

type SharedFolderDeleteBodyProps = {
  folderName: string;
  participantCount: number;
  otherMemberCount: number;
  linkCount: number;
  choice: FolderLinkChoice;
  typedName: string;
  needsName: boolean;
  isPending: boolean;
  onChoiceChange: (choice: FolderLinkChoice) => void;
  onTypedNameChange: (value: string) => void;
};

function SharedFolderDeleteBody({
  folderName,
  participantCount,
  otherMemberCount,
  linkCount,
  choice,
  typedName,
  needsName,
  isPending,
  onChoiceChange,
  onTypedNameChange,
}: SharedFolderDeleteBodyProps) {
  if (otherMemberCount === 0 && linkCount === 0 && !needsName) {
    return null;
  }

  return (
    <View className="gap-3">
      {otherMemberCount > 0 ? (
        <SharedFolderDeleteFacts
          choice={choice}
          linkCount={linkCount}
          participantCount={participantCount}
        />
      ) : null}
      {linkCount > 0 ? (
        <FolderChoiceGroup<FolderLinkChoice>
          accessibilityLabel="링크 처리"
          disabled={isPending}
          options={[
            {
              value: "keep",
              title: "각자의 미분류로 옮기기",
              description: "링크는 넣은 사람의 미분류로 이동해요.",
            },
            {
              value: "delete",
              title: "링크도 모두 삭제",
              description: `다른 멤버가 넣은 링크까지 ${linkCount}개가 모두 삭제돼요.`,
              isDestructive: true,
            },
          ]}
          value={choice}
          onValueChange={onChoiceChange}
        />
      ) : null}
      {needsName ? (
        <FolderNameConfirmField
          disabled={isPending}
          folderName={folderName}
          value={typedName}
          onChangeText={onTypedNameChange}
        />
      ) : null}
    </View>
  );
}

export {
  FolderNameConfirmField,
  PersonalFolderDeleteBody,
  SharedFolderDeleteBody,
  UNCATEGORIZED_DELETE_TARGET,
  getPersonalDeleteDescription,
  getSharedDeleteDescription,
};
export type { FolderDeleteTarget };
