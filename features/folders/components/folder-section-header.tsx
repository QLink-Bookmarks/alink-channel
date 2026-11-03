import { Pressable, View } from "react-native";

import { Emoji } from "@/components/ui/emoji";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { FolderSection } from "@/stores/folder-navigation";

import type { Folder } from "../types";

import { ChevronDown, Plus } from "lucide-react-native/icons";

type FolderSectionSize = "compact" | "large";
type FolderSectionTone = "sidebar" | "surface";
type FolderSectionHeaderShadow = "top" | "bottom" | null;
type FolderSectionCurrentFolder = Pick<Folder, "name" | "emoji">;

const FOLDER_SECTION_HEADER_HEIGHT: Record<FolderSectionSize, number> = {
  compact: 44,
  large: 52,
};

const FOLDER_SECTION_LABELS: Record<FolderSection, string> = {
  mine: "내 폴더",
  shared: "공유 폴더",
};

type FolderSectionHeaderProps<K extends string = FolderSection> = {
  section: K;
  label: string;
  isOpen: boolean;
  canAdd?: boolean;
  size?: FolderSectionSize;
  tone?: FolderSectionTone;
  shadow?: FolderSectionHeaderShadow;
  currentFolder?: FolderSectionCurrentFolder | null;
  hasDivider?: boolean;
  isAddDisabled?: boolean;
  isToggleDisabled?: boolean;
  className?: string;
  onToggle: (section: K) => void;
  onAddPress?: (section: K) => void;
};

function FolderSectionHeader<K extends string = FolderSection>({
  section,
  label,
  isOpen,
  canAdd = true,
  size = "compact",
  tone = "sidebar",
  shadow = null,
  currentFolder = null,
  hasDivider = false,
  isAddDisabled = false,
  isToggleDisabled = false,
  className,
  onToggle,
  onAddPress,
}: FolderSectionHeaderProps<K>) {
  const isLarge = size === "large";
  const isSurface = !isLarge && tone === "surface";
  const pathFolder = isOpen ? null : currentFolder;
  const pathEmoji = pathFolder?.emoji ?? "📁";
  const toggleLabel = `${label} ${isOpen ? "접기" : "펼치기"}`;
  const labelTextClassName = isLarge
    ? "text-base text-foreground"
    : isSurface
      ? "text-xs text-muted-foreground web:group-hover:text-foreground"
      : "text-sm text-sidebar-muted web:group-hover:text-sidebar-hover";
  const pathTextSize = isLarge ? "text-base" : isSurface ? "text-xs" : "text-sm";

  return (
    <View
      // shadow-section-rest: NativeWind가 transform/shadow 클래스가 처음 붙을 때 컴포넌트를 바꿔 끼워 iOS에서 Couldn't find a navigation context 오류가 난다. 기본값을 늘 붙여 둔다. 지우지 말 것.
      className={cn(
        "relative z-10 flex-row items-center shadow-section-rest",
        isLarge ? "h-[52px] bg-background pl-2 pr-1" : isSurface ? "h-11" : "h-11 bg-sidebar",
        hasDivider && (isLarge ? "shadow-section-divider-strong" : "shadow-section-divider"),
        shadow === "top" && (isLarge ? "shadow-section-pin-top-strong" : "shadow-section-pin-top"),
        shadow === "bottom" &&
          (isLarge ? "shadow-section-pin-bottom-strong" : "shadow-section-pin-bottom"),
        className,
      )}
    >
      <Pressable
        accessibilityLabel={
          pathFolder ? `${toggleLabel}, 현재 폴더 ${pathFolder.name} 포함` : toggleLabel
        }
        accessibilityRole="button"
        aria-expanded={isOpen}
        disabled={isToggleDisabled}
        className={cn(
          "group min-w-0 flex-1 flex-row items-center rounded-xl px-2 web:transition-colors web:motion-reduce:transition-none",
          isLarge
            ? "h-[52px] gap-2 active:bg-muted web:hover:bg-muted"
            : isSurface
              ? "h-11 gap-1.5 active:bg-accent web:hover:bg-accent"
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
                : isSurface
                  ? "size-3.5 text-muted-foreground web:group-hover:text-foreground"
                  : "size-3.5 text-sidebar-muted web:group-hover:text-sidebar-hover",
            )}
          />
        </View>
        <Text
          className={cn("shrink-0 font-semibold", labelTextClassName)}
          numberOfLines={1}
        >
          {label}
        </Text>
        {pathFolder ? (
          <View
            aria-hidden
            className="shrink-0 flex-row items-center gap-[5px]"
          >
            <Text
              className={cn(
                pathTextSize,
                isLarge || isSurface ? "text-muted-foreground" : "text-sidebar-muted",
              )}
            >
              /
            </Text>
            <Emoji className={pathTextSize}>{pathEmoji}</Emoji>
          </View>
        ) : null}
      </Pressable>
      {canAdd ? (
        <Pressable
          accessibilityLabel={`${label}에 폴더 추가`}
          accessibilityRole="button"
          disabled={isAddDisabled}
          className={cn(
            "group shrink-0 items-center justify-center",
            isLarge ? "size-12" : "-mr-1 size-11",
            isAddDisabled && "opacity-50",
          )}
          onPress={() => onAddPress?.(section)}
        >
          <View
            className={cn(
              "items-center justify-center web:transition-colors web:motion-reduce:transition-none",
              isLarge
                ? "size-8 rounded-full bg-muted group-active:bg-accent"
                : isSurface
                  ? "size-6 rounded-md group-active:bg-accent web:group-hover:bg-accent"
                  : "size-6 rounded-md group-active:bg-sidebar-surface-2 web:group-hover:bg-sidebar-surface-2",
            )}
          >
            <Icon
              as={Plus}
              className={cn(
                isLarge
                  ? "size-4 text-foreground"
                  : isSurface
                    ? "size-3.5 text-muted-foreground web:group-hover:text-primary"
                    : "size-3.5 text-sidebar-muted web:group-hover:text-primary",
              )}
            />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

export { FOLDER_SECTION_HEADER_HEIGHT, FOLDER_SECTION_LABELS, FolderSectionHeader };
export type {
  FolderSectionCurrentFolder,
  FolderSectionHeaderProps,
  FolderSectionHeaderShadow,
  FolderSectionSize,
  FolderSectionTone,
};
