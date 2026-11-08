import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { handleFolderPickerArrowKey } from "../lib/folder-picker-arrow-keys";
import { webKeyDownProps } from "../lib/web-key-down";
import type { Folder } from "../types";

import { Check } from "lucide-react-native/icons";

const UNCATEGORIZED_PICKER_OPTION = { label: "미분류", icon: "🗂️" };
const DEFAULT_FOLDER_EMOJI = "📁";

function getFolderLabel(folder: Folder): string {
  return folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name;
}

function FolderPickerRow({
  label,
  emoji,
  leading,
  accessibilityLabel,
  selected,
  isLarge,
  onPress,
}: {
  label: string;
  emoji?: string;
  leading?: React.ReactNode;
  accessibilityLabel?: string;
  selected: boolean;
  isLarge: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      aria-checked={selected}
      {...webKeyDownProps(handleFolderPickerArrowKey)}
      className={cn(
        "flex-row items-center gap-3 rounded-xl web:transition-colors web:motion-reduce:transition-none",
        isLarge ? "min-h-12 px-2" : "min-h-10 px-3",
        selected ? "bg-accent" : "active:bg-muted web:hover:bg-muted",
      )}
      onPress={onPress}
    >
      {leading ? (
        <View
          aria-hidden
          className={cn("shrink-0 items-center", isLarge ? "w-6" : "w-[18px]")}
        >
          {leading}
        </View>
      ) : emoji ? (
        <Text
          aria-hidden
          className={cn("shrink-0 text-center", isLarge ? "w-6 text-base" : "w-[18px] text-sm")}
        >
          {emoji}
        </Text>
      ) : null}
      <Text
        className={cn(
          "min-w-0 flex-1 font-medium text-foreground",
          isLarge ? "text-base" : "text-sm",
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        className="size-[18px] shrink-0 items-center justify-center"
        testID={selected ? "folder-picker-selected-mark" : undefined}
      >
        {selected ? (
          <Icon
            as={Check}
            size={18}
            className="text-accent-foreground"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export { DEFAULT_FOLDER_EMOJI, FolderPickerRow, UNCATEGORIZED_PICKER_OPTION, getFolderLabel };
