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
      // shadow-section-rest: NativeWind가 transform/shadow 클래스가 처음 붙을 때 컴포넌트를 바꿔 끼워 iOS에서 Couldn't find a navigation context 오류가 난다. 기본값을 늘 붙여 둔다. 지우지 말 것.
      className={cn(
        "relative z-10 flex-row items-center shadow-section-rest",
        isLarge ? "h-[52px] bg-background pl-2 pr-1" : "h-11 bg-sidebar",
        hasDivider && (isLarge ? "shadow-section-divider-strong" : "shadow-section-divider"),
        shadow === "top" && (isLarge ? "shadow-section-pin-top-strong" : "shadow-section-pin-top"),
        shadow === "bottom" &&
          (isLarge ? "shadow-section-pin-bottom-strong" : "shadow-section-pin-bottom"),
        className,
      )}
    >
      <Pressable
        accessibilityLabel={`${label} ${isOpen ? "접기" : "펼치기"}`}
        accessibilityRole="button"
        aria-expanded={isOpen}
        className={cn(
          "group min-w-0 flex-1 flex-row items-center rounded-xl px-2 web:transition-colors web:motion-reduce:transition-none",
          isLarge
            ? "h-[52px] gap-2 active:bg-muted web:hover:bg-muted"
            : "h-11 gap-1.5 active:bg-sidebar-surface-2 web:hover:bg-sidebar-surface-2",
        )}
        onPress={() => onToggle(section)}
      >
        <View
          // rotate-0: NativeWind가 transform/shadow 클래스가 처음 붙을 때 컴포넌트를 바꿔 끼워 iOS에서 Couldn't find a navigation context 오류가 난다. 기본값을 늘 붙여 둔다. 지우지 말 것.
          className={cn(
            "items-center justify-center web:transition-transform web:duration-200 web:motion-reduce:transition-none",
            isOpen ? "rotate-0" : "-rotate-90",
          )}
        >
          <Icon
            as={ChevronDown}
            className={cn(
              isLarge
                ? "size-[18px] text-muted-foreground"
                : "size-3.5 text-sidebar-muted web:group-hover:text-sidebar-hover",
            )}
          />
        </View>
        <Text
          className={cn(
            "font-semibold",
            isLarge
              ? "text-base text-foreground"
              : "text-sm text-sidebar-muted web:group-hover:text-sidebar-hover",
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
            "items-center justify-center web:transition-colors web:motion-reduce:transition-none",
            isLarge
              ? "size-8 rounded-full bg-muted group-active:bg-accent"
              : "size-6 rounded-md group-active:bg-sidebar-surface-2 web:group-hover:bg-sidebar-surface-2",
          )}
        >
          <Icon
            as={Plus}
            className={cn(
              isLarge
                ? "size-4 text-foreground"
                : "size-3.5 text-sidebar-muted web:group-hover:text-primary",
            )}
          />
        </View>
      </Pressable>
    </View>
  );
}

export { FOLDER_SECTION_HEADER_HEIGHT, FOLDER_SECTION_LABELS, FolderSectionHeader };
export type { FolderSectionHeaderProps, FolderSectionHeaderShadow, FolderSectionSize };
