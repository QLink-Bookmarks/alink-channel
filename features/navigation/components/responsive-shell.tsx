import * as React from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";

import { RouteErrorBoundary } from "@/components/error/route-error-boundary";
import { AppHeader } from "@/components/layout/app-header";
import { BottomTabs } from "@/components/layout/bottom-tabs";
import { BrandHeader } from "@/components/layout/brand-header";
import { Fab } from "@/components/layout/fab";
import { Sheet } from "@/components/layout/sheet";
import { Sidebar, SidebarCTA, SidebarItem, SidebarSection } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Emoji } from "@/components/ui/emoji";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { useMyProfileQuery } from "@/features/account/queries";
import { AnnouncementsHeaderAction } from "@/features/announcements/components/announcements-header-action";
import { CreateFolderDialog } from "@/features/folders/components/create-folder-dialog";
import { FolderHeaderActions } from "@/features/folders/components/folder-header-actions";
import { useFoldersQuery } from "@/features/folders/queries";
import { DetailPanel } from "@/features/links/components/detail-panel/detail-panel";
import { LinkCreateForm } from "@/features/links/components/link-create-form";
import { useLinkDetailQuery, useLinksQuery } from "@/features/links/queries";
import { NotificationBellButton } from "@/features/notifications/components/notification-bell-button";
import { SearchDialog } from "@/features/search/components/search-dialog";
import { useCreateFolderSheet } from "@/stores/create-folder-sheet";
import { useDisplaySettings } from "@/stores/display-settings";
import { useHomeSearchFocus } from "@/stores/home-search-focus";
import { useSearchDialog } from "@/stores/search-dialog";
import { useAnySheetOpen } from "@/stores/sheet-tracker";

import { useAddLinkSheet } from "../hooks/use-add-link-sheet";
import { useLinkOverlayState } from "../hooks/use-link-overlay-state";
import { useShellRouteState } from "../hooks/use-shell-route-state";
import { canOpenWideOverlayInPlace } from "../routes";
import type { MobileTabKey, WideSidebarKey } from "../types";
import { WideKbdHelper } from "./wide-kbd-helper";

import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import {
  BookCopyIcon,
  CheckSquare,
  Folder,
  House,
  ListTodo,
  LucideHome,
  type LucideIcon,
  Plus,
  Search,
  Settings,
} from "lucide-react-native";

const mobileTabItems = [
  { key: "home", label: "홈", icon: House },
  { key: "folders", label: "폴더", icon: Folder },
  { key: "todos", label: "할일", icon: ListTodo },
  { key: "settings", label: "설정", icon: Settings },
] satisfies React.ComponentProps<typeof BottomTabs>["items"];

const widePrimaryItems: {
  href: string;
  key: WideSidebarKey;
  label: string;
  icon: LucideIcon;
}[] = [
  { href: "/home", key: "home", label: "홈", icon: LucideHome },
  { href: "/links", key: "links", label: "전체", icon: BookCopyIcon },
  { href: "/todos", key: "todos", label: "할일", icon: CheckSquare },
];
const UNCATEGORIZED_FOLDER_ID = 0;

function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const routeState = useShellRouteState();
  const {
    close: closeAddLinkSheet,
    handleOpenChange: handleAddLinkSheetOpenChange,
    isOpen: isAddLinkSheetOpen,
    open: openAddLinkSheet,
  } = useAddLinkSheet();
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const isCreateFolderSheetOpen = useCreateFolderSheet((state) => state.isOpen);
  const isAnySheetOpen = useAnySheetOpen();
  const setAccent = useDisplaySettings((state) => state.setAccent);
  const setTheme = useDisplaySettings((state) => state.setTheme);
  const isSearchDialogOpen = useSearchDialog((state) => state.isOpen);
  const searchDialogMode = useSearchDialog((state) => state.mode);
  const searchDialogInitialQuery = useSearchDialog((state) => state.initialQuery);
  const openSearchDialog = useSearchDialog((state) => state.open);
  const setSearchDialogOpen = useSearchDialog((state) => state.setOpen);
  const [isAddLinkDialogOpen, setIsAddLinkDialogOpen] = React.useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = React.useState(false);
  const [createFolderShared, setCreateFolderShared] = React.useState(false);
  const [hasOpenedAddLinkSheet, setHasOpenedAddLinkSheet] = React.useState(false);
  const [pendingMobileLinkId, setPendingMobileLinkId] = React.useState<number | null>(null);
  const [sharedLinkUrl, setSharedLinkUrl] = React.useState<string | null>(null);
  const wasAddLinkOpenRef = React.useRef(false);
  const { linkUrl: linkUrlParam } = useLocalSearchParams<{ linkUrl?: string }>();
  const foldersQuery = useFoldersQuery({ size: 15 });
  const myProfileQuery = useMyProfileQuery();
  const isAnnouncementsListRoute = routeState.pathname === "/announcements";
  const avatarEmojiOverride = useDisplaySettings((state) => state.profile.avatarEmoji);
  const profileAvatarEmoji = avatarEmojiOverride ?? myProfileQuery.data?.avatarEmoji ?? "🌸";
  const profileNickname = myProfileQuery.data?.nickname ?? "사용자";
  const profileUsername = myProfileQuery.data?.username ?? "";
  const profileAvatarUrl = myProfileQuery.data?.avatarUrl ?? null;
  const uncategorizedLinksQuery = useLinksQuery({ folderId: UNCATEGORIZED_FOLDER_ID, size: 100 });
  // Link title for the mobile detail header (enabled only on /links/[id]).
  const mobileLinkDetailId = /^\/links\/([^/]+)$/.exec(routeState.pathname)?.[1];
  const mobileLinkDetailQuery = useLinkDetailQuery(mobileLinkDetailId);
  const { detail, error, handleOpenChange, isLoading, isOpen, notFound } = useLinkOverlayState({
    isWideView: routeState.isWideView,
    overlayBaseHref: routeState.overlayBaseHref,
    overlayLinkId: routeState.overlayLinkId,
  });

  React.useEffect(() => {
    const url = linkUrlParam?.trim();
    if (!url) {
      return;
    }
    setSharedLinkUrl(url);
    if (routeState.isWideView) {
      setIsAddLinkDialogOpen(true);
    } else {
      setHasOpenedAddLinkSheet(true);
      openAddLinkSheet();
    }
    router.setParams({ linkUrl: "" });
  }, [linkUrlParam, openAddLinkSheet, routeState.isWideView, router]);

  React.useEffect(() => {
    // Only clear the shared URL on the open -> closed transition. Clearing whenever
    // both are closed races with the open sequence above: when linkUrlParam arrives the
    // open state has not flipped to true yet, so this would wipe the URL we just set
    // before the add-link form can read it.
    const isAddLinkOpen = isAddLinkDialogOpen || isAddLinkSheetOpen;
    if (wasAddLinkOpenRef.current && !isAddLinkOpen) {
      setSharedLinkUrl(null);
    }
    wasAddLinkOpenRef.current = isAddLinkOpen;
  }, [isAddLinkDialogOpen, isAddLinkSheetOpen]);

  const handleMobileTabChange = React.useCallback(
    (value: string) => {
      const nextHrefByTab: Record<MobileTabKey, string> = {
        home: "/home",
        folders: "/folders",
        todos: "/todos",
        settings: "/settings",
      };

      router.replace(nextHrefByTab[value as MobileTabKey] as Href);
    },
    [router],
  );

  const handleBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home" as Href);
  }, [router]);

  const handleWideSearchPress = React.useCallback(() => {
    openSearchDialog({ mode: "link" });
  }, [openSearchDialog]);

  const handleSearchSelectLink = React.useCallback(
    (id: number) => {
      if (canOpenWideOverlayInPlace(routeState.pathname)) {
        router.replace(`${routeState.pathname}?linkId=${id}` as Href);
        return;
      }
      router.replace(`/links?linkId=${id}` as Href);
    },
    [routeState.pathname, router],
  );

  const handleWideAddLinkPress = React.useCallback(() => {
    setIsAddLinkDialogOpen(true);
  }, []);

  const handleWideAddLinkDialogOpenChange = React.useCallback((open: boolean) => {
    setIsAddLinkDialogOpen(open);
  }, []);

  const requestHomeSearchFocus = useHomeSearchFocus((state) => state.requestFocus);
  const handleMobileSearchPress = React.useCallback(() => {
    // Make sure we're on /home before asking MobileHomeScreen to grab focus.
    if (routeState.pathname !== "/home") {
      router.replace("/home" as Href);
    }
    requestHomeSearchFocus();
  }, [requestHomeSearchFocus, routeState.pathname, router]);

  const handleNotificationsPress = React.useCallback(() => {
    router.push("/notifications" as Href);
  }, [router]);

  const handleProfilePress = React.useCallback(() => {
    router.push("/settings" as Href);
  }, [router]);

  const handleFabPress = React.useCallback(() => {
    setHasOpenedAddLinkSheet(true);
    openAddLinkSheet();
  }, [openAddLinkSheet]);

  const handleWideLinkSaved = React.useCallback(
    (id: number) => {
      setIsAddLinkDialogOpen(false);

      if (canOpenWideOverlayInPlace(routeState.pathname)) {
        router.replace(`${routeState.pathname}?linkId=${id}` as Href);
        return;
      }

      router.replace(`/links?linkId=${id}` as Href);
    },
    [routeState.pathname, router],
  );

  const handleMobileLinkSaved = React.useCallback(
    (id: number) => {
      setPendingMobileLinkId(id);
      closeAddLinkSheet();
    },
    [closeAddLinkSheet],
  );

  const isSettingsRoute = routeState.pathname.startsWith("/settings");

  React.useEffect(() => {
    if (!routeState.isWideView || Platform.OS !== "web") {
      return;
    }

    const handleWideKeyboardShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isMetaOrCtrlK = (event.metaKey || event.ctrlKey) && key === "k";

      if (isMetaOrCtrlK) {
        event.preventDefault();
        console.log("shortcut:search");
        openSearchDialog({ mode: "link" });
        return;
      }

      if (key === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        console.log("shortcut:new-link");
        setIsAddLinkDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handleWideKeyboardShortcut);

    return () => {
      window.removeEventListener("keydown", handleWideKeyboardShortcut);
    };
  }, [openSearchDialog, routeState.isWideView]);

  React.useEffect(() => {
    if (routeState.isWideView) {
      setHasOpenedAddLinkSheet(false);
      closeAddLinkSheet();
      return;
    }

    const canKeepSheetOpen =
      routeState.pathname === "/home" ||
      routeState.pathname === "/folders" ||
      routeState.pathname === "/todos" ||
      routeState.pathname.startsWith("/folders/");

    if (!canKeepSheetOpen && isAddLinkSheetOpen) {
      closeAddLinkSheet();
    }
  }, [closeAddLinkSheet, isAddLinkSheetOpen, routeState.isWideView, routeState.pathname]);

  React.useEffect(() => {
    if (routeState.isWideView || isAddLinkSheetOpen || pendingMobileLinkId == null) {
      return;
    }

    router.replace(`/links/${pendingMobileLinkId}` as Href);
    setPendingMobileLinkId(null);
  }, [isAddLinkSheetOpen, pendingMobileLinkId, routeState.isWideView, router]);

  if (routeState.redirectHref) {
    return <Redirect href={routeState.redirectHref as Href} />;
  }

  if (routeState.isWideView) {
    const allFolders = foldersQuery.data?.contents ?? [];
    const myFolders = allFolders.filter((folder) => !folder.isShared);
    const sharedFolders = allFolders.filter((folder) => folder.isShared);
    const isFoldersLoading = foldersQuery.isLoading;
    const uncategorizedCount = uncategorizedLinksQuery.data?.contents.length ?? 0;

    return (
      <View className="flex-1 flex-row bg-background">
        <View className="w-[15%] min-w-56 max-w-80">
          <Sidebar className="h-full w-full min-w-0 max-w-none">
            <View className="flex-1 justify-between gap-6">
              <View className="gap-6">
                <BrandHeader
                  accent={accent}
                  mode={theme}
                />

                <SidebarCTA
                  label={
                    <>
                      <Text className="text-2xl font-semibold leading-none text-primary-foreground">
                        +
                      </Text>
                      <Kbd
                        keyClassName="border-white/20 bg-white/20"
                        keyTextClassName="text-primary-foreground"
                        label="새 링크"
                        labelClassName="text-base font-semibold text-primary-foreground"
                        labelPosition="left"
                      >
                        N
                      </Kbd>
                    </>
                  }
                  onPress={handleWideAddLinkPress}
                />

                <View className="gap-1">
                  {widePrimaryItems.map((item) => (
                    <SidebarItem
                      key={item.key}
                      active={routeState.wideSidebarKey === item.key}
                      icon={item.icon}
                      label={item.label}
                      labelClassName="text-base"
                      onPress={() => router.replace(item.href as Href)}
                    />
                  ))}
                </View>

                <SidebarSection title="내 폴더">
                  <View className="gap-1">
                    {isFoldersLoading ? (
                      <ActivityIndicator
                        size="small"
                        className="py-3"
                      />
                    ) : (
                      <>
                        {myFolders.map((folder) => {
                          const href = `/folders/${folder.id}`;
                          return (
                            <SidebarItem
                              key={folder.id}
                              active={routeState.pathname === href}
                              count={folder.linkCounts}
                              label={folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name}
                              labelClassName="text-base"
                              onPress={() => router.replace(href as Href)}
                            />
                          );
                        })}
                        <SidebarItem
                          active={routeState.pathname === `/folders/${UNCATEGORIZED_FOLDER_ID}`}
                          count={uncategorizedCount}
                          label="🗂️ 미분류"
                          labelClassName="text-base"
                          onPress={() =>
                            router.replace(`/folders/${UNCATEGORIZED_FOLDER_ID}` as Href)
                          }
                        />
                        <SidebarAddItem
                          label="+  폴더 추가"
                          onPress={() => {
                            setCreateFolderShared(false);
                            setIsCreateFolderOpen(true);
                          }}
                        />
                      </>
                    )}
                  </View>
                </SidebarSection>

                <SidebarSection title="공유 폴더">
                  <View className="gap-1">
                    {isFoldersLoading ? null : (
                      <>
                        {sharedFolders.map((folder) => {
                          const href = `/folders/${folder.id}`;
                          return (
                            <SidebarItem
                              key={folder.id}
                              active={routeState.pathname === href}
                              count={folder.linkCounts}
                              meta={`${folder.shareCounts}명 참여`}
                              label={folder.emoji ? `${folder.emoji} ${folder.name}` : folder.name}
                              labelClassName="text-base"
                              onPress={() => router.replace(href as Href)}
                            />
                          );
                        })}
                        <SidebarAddItem
                          label="+  공유폴더 추가"
                          onPress={() => {
                            setCreateFolderShared(true);
                            setIsCreateFolderOpen(true);
                          }}
                        />
                      </>
                    )}
                  </View>
                </SidebarSection>
              </View>

              <View className="gap-3 border-t border-sidebar-border pt-3">
                <ThemeSwitcher
                  accent={accent}
                  mode={theme}
                  variant="switch"
                  onAccentChange={setAccent}
                  onModeChange={setTheme}
                />

                <Button
                  className="h-auto min-h-0 w-full items-center justify-start gap-3 bg-transparent px-5 py-2 shadow-none web:hover:bg-sidebar-surface-2 sm:h-auto"
                  variant="ghost"
                  onPress={handleProfilePress}
                >
                  <Avatar
                    alt={`${profileNickname} avatar`}
                    size="xs"
                  >
                    {profileAvatarUrl ? <AvatarImage source={{ uri: profileAvatarUrl }} /> : null}
                    <AvatarFallback>
                      <Emoji className="text-xl">{profileAvatarEmoji}</Emoji>
                    </AvatarFallback>
                  </Avatar>
                  <View className="min-w-0 flex-1 items-start">
                    <Text
                      numberOfLines={1}
                      className="text-left text-base font-semibold text-sidebar-hover"
                    >
                      {profileNickname}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className="text-left text-sm text-sidebar-muted"
                    >
                      {profileUsername}
                    </Text>
                  </View>
                </Button>
              </View>
            </View>
          </Sidebar>
        </View>

        <View className="flex-1 bg-background">
          <Topbar
            className="flex"
            placeholder="링크 · 요약 · 태그 검색…"
            variant="default"
            searchReadOnly
            searchLeftSlot={<Emoji className="text-xl">🔍</Emoji>}
            searchRightSlot={<Kbd size="sm">⌘/Ctrl + K</Kbd>}
            onSearchPress={handleWideSearchPress}
            actions={
              <>
                {isAnnouncementsListRoute ? <AnnouncementsHeaderAction mode="wide" /> : null}
                <NotificationBellButton
                  size="sm"
                  onPress={handleNotificationsPress}
                />
                <IconButton
                  accessibilityLabel="설정"
                  icon={Settings}
                  size="sm"
                  variant="ghost"
                  active={isSettingsRoute}
                  onPress={() => router.replace("/settings" as Href)}
                />
              </>
            }
          />
          <View className="relative flex-1">
            <RouteErrorBoundary resetKeys={[routeState.pathname]}>{children}</RouteErrorBoundary>
            <WideKbdHelper />
          </View>
        </View>

        {detail ? (
          <DetailPanel
            detail={detail}
            error={error}
            isLoading={isLoading}
            mode="overlay"
            open={isOpen}
            onDeleted={() => handleOpenChange(false)}
            onOpenChange={handleOpenChange}
          />
        ) : isOpen ? (
          <DetailPanel
            error={error}
            notFound={notFound}
            isLoading={isLoading}
            mode="overlay"
            open={isOpen}
            onDeleted={() => handleOpenChange(false)}
            onOpenChange={handleOpenChange}
          />
        ) : null}

        <SearchDialog
          open={isSearchDialogOpen}
          mode={searchDialogMode}
          initialQuery={searchDialogInitialQuery}
          onOpenChange={setSearchDialogOpen}
          onSelectLink={handleSearchSelectLink}
        />

        <CreateFolderDialog
          mode="wide"
          open={isCreateFolderOpen}
          defaultShared={createFolderShared}
          onOpenChange={setIsCreateFolderOpen}
        />

        <Dialog
          open={isAddLinkDialogOpen}
          onOpenChange={handleWideAddLinkDialogOpenChange}
        >
          <DialogContent className="max-h-[80vh] w-[42rem] max-w-[90vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[42rem]">
            <DialogHeader className="flex-row items-center gap-3 border-b border-border px-8 py-6">
              <Text className="text-2xl font-normal text-muted-foreground">+</Text>
              <DialogTitle className="text-xl">새 링크 추가</DialogTitle>
            </DialogHeader>
            <ScrollView
              className="flex-1"
              contentInsetAdjustmentBehavior="automatic"
              showsVerticalScrollIndicator={false}
            >
              <View className="px-8 py-6">
                <RouteErrorBoundary
                  description="링크 추가 시트를 다시 열어 시도해주세요."
                  resetKeys={[isAddLinkDialogOpen]}
                  title="링크 추가 화면을 불러오지 못했어요"
                  onClose={() => setIsAddLinkDialogOpen(false)}
                >
                  <LinkCreateForm
                    mode="wide"
                    open={isAddLinkDialogOpen}
                    initialUrl={sharedLinkUrl ?? undefined}
                    onCancel={() => setIsAddLinkDialogOpen(false)}
                    onSaved={handleWideLinkSaved}
                  />
                </RouteErrorBoundary>
              </View>
            </ScrollView>
          </DialogContent>
        </Dialog>
      </View>
    );
  }

  const isMobileHome = routeState.pathname === "/home";
  const mobileFolderIdMatch = /^\/folders\/(\d+)$/.exec(routeState.pathname);
  const mobileFolderId = mobileFolderIdMatch ? Number(mobileFolderIdMatch[1]) : Number.NaN;
  const allMobileFolders = foldersQuery.data?.contents ?? [];
  // TODO: Replace this list lookup with useFolderQuery(folderId) when the server exposes GET /api/folders/{id}.
  const mobileFolder =
    Number.isFinite(mobileFolderId) && mobileFolderId !== UNCATEGORIZED_FOLDER_ID
      ? allMobileFolders.find((folder) => folder.id === mobileFolderId)
      : undefined;
  const mobileLinkTitle = mobileLinkDetailId
    ? mobileLinkDetailQuery.data?.title?.trim()
    : undefined;
  const mobileHeaderTitle = mobileFolder
    ? `${mobileFolder.emoji ? `${mobileFolder.emoji} ` : ""}${mobileFolder.name}`
    : mobileLinkTitle || routeState.routeTitle;
  const showMobileFab =
    routeState.pathname === "/home" ||
    routeState.pathname === "/folders" ||
    routeState.pathname === "/todos" ||
    routeState.pathname.startsWith("/folders/");

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        back={!isMobileHome && routeState.showBackButton}
        onBack={handleBack}
        leftSlot={isMobileHome ? <BrandHeader className="px-0 pt-0" /> : undefined}
        rightSlot={
          isMobileHome ? (
            <View className="flex-row items-center gap-1">
              <IconButton
                accessibilityLabel="검색"
                icon={Search}
                size="sm"
                variant="ghost"
                onPress={handleMobileSearchPress}
              />
              <NotificationBellButton
                size="sm"
                onPress={handleNotificationsPress}
              />
            </View>
          ) : mobileFolder ? (
            <FolderHeaderActions
              folder={mobileFolder}
              mode="mobile"
            />
          ) : isAnnouncementsListRoute ? (
            <AnnouncementsHeaderAction mode="mobile" />
          ) : undefined
        }
        title={isMobileHome ? undefined : mobileHeaderTitle}
      />
      <View className="flex-1">
        <RouteErrorBoundary resetKeys={[routeState.pathname]}>{children}</RouteErrorBoundary>
      </View>
      {showMobileFab && !isAnySheetOpen && !isAddLinkSheetOpen && !isCreateFolderSheetOpen ? (
        <Fab
          bottomOffset={96}
          icon={Plus}
          label="새 링크"
          onPress={handleFabPress}
        />
      ) : null}
      <BottomTabs
        items={mobileTabItems}
        value={routeState.mobileTabKey ?? ""}
        onValueChange={handleMobileTabChange}
      />
      {hasOpenedAddLinkSheet && isAddLinkSheetOpen ? (
        <Sheet
          open={isAddLinkSheetOpen}
          fitContent
          onOpenChange={handleAddLinkSheetOpenChange}
        >
          <RouteErrorBoundary
            description="시트를 닫고 다시 열어 시도해주세요."
            resetKeys={[isAddLinkSheetOpen]}
            title="링크 추가 시트를 불러오지 못했어요"
            onClose={closeAddLinkSheet}
          >
            <LinkCreateForm
              mode="mobile"
              open={isAddLinkSheetOpen}
              initialUrl={sharedLinkUrl ?? undefined}
              onCancel={closeAddLinkSheet}
              onSaved={handleMobileLinkSaved}
            />
          </RouteErrorBoundary>
        </Sheet>
      ) : null}
    </View>
  );
}

function SidebarAddItem({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      className="group min-h-8 flex-row items-center rounded-xl border border-dashed border-border px-4 active:bg-sidebar-surface-2 web:transition-colors web:hover:bg-sidebar-surface-2"
      onPress={onPress}
    >
      <Text className="text-sm font-medium text-sidebar-muted web:group-hover:text-primary">
        {label}
      </Text>
    </Pressable>
  );
}

export { ResponsiveShell };
