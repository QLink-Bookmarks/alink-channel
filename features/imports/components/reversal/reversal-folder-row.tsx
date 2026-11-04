import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  type ReversalExclusions,
  type ReversalFolderItem,
  getFolderCheck,
  getFolderSelectedCount,
  isFolderRemoved,
} from "../../lib/reversal-selection";
import { ChangeMark } from "../history/change-mark";
import { ReversalCheckbox } from "./reversal-checkbox";
import { getReversalFolderLabel } from "./reversal-copy";

import { Check, ChevronRight, Folder, Users } from "lucide-react-native";

type ReversalFolderRowProps = {
  folder: ReversalFolderItem;
  exclusions: ReversalExclusions;
  isActive: boolean;
  showChevron: boolean;
  disabled?: boolean;
  onSelect: (folder: ReversalFolderItem) => void;
  onToggle: (folder: ReversalFolderItem) => void;
};

function ReversalFolderRow({
  folder,
  exclusions,
  isActive,
  showChevron,
  disabled,
  onSelect,
  onToggle,
}: ReversalFolderRowProps) {
  const { name, emoji } = getReversalFolderLabel(folder);
  const check = getFolderCheck(folder, exclusions);
  const selected = getFolderSelectedCount(folder, exclusions);
  const removed = isFolderRemoved(folder, exclusions);

  return (
    <View
      className={cn(
        "flex-row items-center rounded-xl border pr-2",
        isActive ? "border-border bg-accent" : "border-transparent",
      )}
      testID={`reversal-folder-${folder.key}`}
    >
      <ReversalCheckbox
        checked={check.checked}
        disabled={check.disabled || disabled}
        label={`${name}의 가져온 항목 모두 지우기`}
        onPress={() => onToggle(folder)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} 폴더 보기`}
        accessibilityState={{ selected: isActive }}
        className="min-h-11 min-w-0 flex-1 flex-row items-center gap-2 rounded-lg py-2"
        onPress={() => onSelect(folder)}
      >
        {removed ? <ChangeMark kind="remove" /> : null}
        {emoji ? (
          <Text className="text-base">{emoji}</Text>
        ) : (
          <Icon
            as={Folder}
            size={16}
            className="text-muted-foreground"
          />
        )}
        <Text
          className={cn(
            "min-w-0 shrink text-sm text-foreground",
            isActive && "font-semibold",
            folder.isDone && "text-muted-foreground",
          )}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View className="ml-auto flex-row items-center gap-1.5 pl-2">
          <FolderNote folder={folder} />
          <FolderCount
            folder={folder}
            selected={selected}
          />
        </View>
        {showChevron ? (
          <Icon
            as={ChevronRight}
            size={16}
            className="text-muted-foreground"
          />
        ) : null}
      </Pressable>
    </View>
  );
}

function FolderNote({ folder }: { folder: ReversalFolderItem }) {
  if (folder.kind === "EXISTING") {
    return <Text className="text-xs text-muted-foreground">기존</Text>;
  }
  if (folder.state === "SHARED") {
    return (
      <View className="flex-row items-center gap-0.5">
        <Icon
          as={Users}
          size={12}
          className="text-muted-foreground"
        />
        <Text className="text-xs text-muted-foreground">공유</Text>
      </View>
    );
  }
  if (folder.state === "DELETED") {
    return <Text className="text-xs text-muted-foreground">이미 삭제됨</Text>;
  }
  return null;
}

function FolderCount({ folder, selected }: { folder: ReversalFolderItem; selected: number }) {
  const hasOnlyDoneLinks =
    folder.isDone ||
    (folder.links.some((link) => link.isDone) &&
      !folder.isRemovable &&
      folder.links.every((link) => link.isDone || link.state === "DELETED"));
  if (hasOnlyDoneLinks) {
    return (
      <View className="flex-row items-center gap-0.5">
        <Icon
          as={Check}
          size={12}
          className="text-muted-foreground"
        />
        <Text className="text-xs text-muted-foreground">지웠어요</Text>
      </View>
    );
  }
  if (selected > 0) {
    return <Text className="text-sm font-bold text-destructive">-{selected}</Text>;
  }
  return <Text className="text-xs text-muted-foreground">남겨요</Text>;
}

export { ReversalFolderRow };
