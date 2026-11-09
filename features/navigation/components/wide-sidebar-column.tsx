import * as React from "react";
import { Pressable, View } from "react-native";

import { SidebarRailItem } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import type { FolderSection } from "@/stores/folder-navigation";
import { useFolderNavigation } from "@/stores/folder-navigation";

import { useWideShellInsets } from "../hooks/use-wide-shell-insets";
import type { WideSidebarKey } from "../types";
import { WideSidebar } from "./wide-sidebar";
import { WideSidebarRail } from "./wide-sidebar-rail";

import { Menu } from "lucide-react-native";

type WideSidebarColumnProps = {
  pathname: string;
  activeKey: WideSidebarKey | null;
  folderListKey?: React.Key;
  isOverlayOpen: boolean;
  onOverlayDismiss: () => void;
  onNavigate: (href: string) => void;
  onAddLinkPress: () => void;
  onAddFolderPress: (section: FolderSection) => void;
  onProfilePress: () => void;
};

function useMountStages() {
  const [isMounted, setIsMounted] = React.useState(false);
  const [canAnimate, setCanAnimate] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isMounted) {
      return;
    }
    const frame = requestAnimationFrame(() => setCanAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [isMounted]);

  return { isMounted, canAnimate };
}

function WideSidebarColumn({
  pathname,
  activeKey,
  folderListKey,
  isOverlayOpen,
  onOverlayDismiss,
  onNavigate,
  onAddLinkPress,
  onAddFolderPress,
  onProfilePress,
}: WideSidebarColumnProps) {
  const isCollapsed = useFolderNavigation((state) => state.isSidebarCollapsed);
  const hasHydrated = useFolderNavigation((state) => state.hasHydrated);
  const toggleSidebarCollapsed = useFolderNavigation((state) => state.toggleSidebarCollapsed);
  const { isMounted, canAnimate } = useMountStages();
  const isReady = hasHydrated && isMounted;
  const insets = useWideShellInsets();
  const hasInsets = insets.top > 0 || insets.bottom > 0;

  const handleToggle = React.useCallback(() => {
    toggleSidebarCollapsed();
  }, [toggleSidebarCollapsed]);

  return (
    <View
      testID="wide-sidebar-column"
      className={cn(
        "relative overflow-hidden",
        isCollapsed ? "w-20 min-w-20 max-w-20" : "w-[15%] min-w-56 max-w-80",
        isReady &&
          canAnimate &&
          "web:transition-[width,min-width,max-width] web:duration-220 web:ease-out web:motion-reduce:transition-none",
        isOverlayOpen && "z-20",
        hasInsets && "bg-sidebar",
      )}
      style={hasInsets ? { paddingTop: insets.top, paddingBottom: insets.bottom } : undefined}
    >
      <View
        aria-hidden={isOverlayOpen}
        className="h-full w-full"
      >
        {isReady ? (
          isCollapsed ? (
            <WideSidebarRail
              activeKey={activeKey}
              pathname={pathname}
              onAddFolderPress={onAddFolderPress}
              onAddLinkPress={onAddLinkPress}
              onExpand={handleToggle}
              onNavigate={onNavigate}
              onProfilePress={onProfilePress}
            />
          ) : (
            <WideSidebar
              activeKey={activeKey}
              folderListKey={folderListKey}
              pathname={pathname}
              onAddFolderPress={onAddFolderPress}
              onAddLinkPress={onAddLinkPress}
              onCollapse={handleToggle}
              onNavigate={onNavigate}
              onProfilePress={onProfilePress}
            />
          )
        ) : null}
      </View>
      {hasInsets ? (
        <View
          className="absolute bottom-0 right-0 top-0 w-px bg-sidebar-border"
          pointerEvents="none"
        />
      ) : null}
      {isOverlayOpen ? (
        <>
          <Pressable
            accessibilityLabel="링크 상세 닫기"
            accessibilityRole="button"
            className="absolute bottom-0 left-0 right-0 top-0 bg-overlay"
            onPress={onOverlayDismiss}
          />
          <View
            className={cn("absolute top-3", isCollapsed ? "left-0 right-0 items-center" : "left-3")}
            style={hasInsets ? { marginTop: insets.top } : undefined}
          >
            <SidebarRailItem
              aria-expanded={!isCollapsed}
              icon={Menu}
              label={isCollapsed ? "사이드바 펼치기" : "사이드바 줄이기"}
              onPress={handleToggle}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

export { WideSidebarColumn };
export type { WideSidebarColumnProps };
