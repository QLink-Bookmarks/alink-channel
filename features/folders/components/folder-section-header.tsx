import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { FolderSection } from "@/stores/folder-navigation";

import { ChevronDown, Plus } from "lucide-react-native/icons";

type FolderSectionSize = "compact" | "large";
type FolderSectionHeaderShadow = "top" | "bottom" | null;

const FOLDER_SECTION_HEADER_HEIGHT: Record<FolderSectionSize, number> = {
  compact: 44,
  large: 52,
};

const FOLDER_SECTION_LABELS: Record<FolderSection, string> = {
  mine: "내 폴더",
  shared: "공유 폴더",
};

type FolderSectionHeaderProps = {
  section: FolderSection;
  isOpen: boolean;
  size?: FolderSectionSize;
  shadow?: FolderSectionHeaderShadow;
  hasDivider?: boolean;
  className?: string;
  onToggle: (section: FolderSection) => void;
  onAddPress: (section: FolderSection) => void;
};

function FolderSectionHeader({
  section,
  isOpen,
  size = "compact",
  shadow = null,
  hasDivider = false,
  className,
  onToggle,
  onAddPress,
}: FolderSectionHeaderProps) {
  const label = FOLDER_SECTION_LABELS[section];
  const isLarge = size === "large";

  return (
    <View
      className={cn(
        "relative z-10 flex-row items-center bg-sidebar",
        isLarge ? "h-[52px]" : "h-11",
        hasDivider && "shadow-section-divider",
        shadow === "top" && "shadow-section-pin-top",
        shadow === "bottom" && "shadow-section-pin-bottom",
        className,
      )}
    >
      <Pressable
        accessibilityLabel={`${label} ${isOpen ? "접기" : "펼치기"}`}
        accessibilityRole="button"
        aria-expanded={isOpen}
        className={cn(
          "group min-w-0 flex-1 flex-row items-center gap-1.5 rounded-xl px-2 active:bg-sidebar-surface-2 web:transition-colors web:hover:bg-sidebar-surface-2 web:motion-reduce:transition-none",
          isLarge ? "h-[52px]" : "h-11",
        )}
        onPress={() => onToggle(section)}
      >
        <Icon
          as={ChevronDown}
          className={cn(
            "text-sidebar-muted web:transition-transform web:duration-200 web:group-hover:text-sidebar-hover web:motion-reduce:transition-none",
            isLarge ? "size-[18px]" : "size-3.5",
            !isOpen && "-rotate-90",
          )}
        />
        <Text
          className={cn(
            "font-semibold text-sidebar-muted web:group-hover:text-sidebar-hover",
            isLarge ? "text-base" : "text-sm",
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel={`${label}에 폴더 추가`}
        accessibilityRole="button"
        className={cn("group items-center justify-center", isLarge ? "size-12" : "-mr-1 size-11")}
        onPress={() => onAddPress(section)}
      >
        <View
          className={cn(
            "items-center justify-center text-sidebar-muted group-active:bg-sidebar-surface-2 web:transition-colors web:group-hover:bg-sidebar-surface-2 web:motion-reduce:transition-none",
            isLarge ? "size-8 rounded-full bg-muted" : "size-6 rounded-md",
          )}
        >
          <Icon
            as={Plus}
            className={cn(
              "text-sidebar-muted web:group-hover:text-primary",
              isLarge ? "size-4" : "size-3.5",
            )}
          />
        </View>
      </Pressable>
    </View>
  );
}

export { FOLDER_SECTION_HEADER_HEIGHT, FOLDER_SECTION_LABELS, FolderSectionHeader };
export type { FolderSectionHeaderProps, FolderSectionHeaderShadow, FolderSectionSize };
