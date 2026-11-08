import * as React from "react";
import { Platform, View } from "react-native";

import { RouteErrorBoundary } from "@/components/error/route-error-boundary";
import { AppHeader } from "@/components/layout/app-header";
import { BottomTabs } from "@/components/layout/bottom-tabs";
import { BrandHeader } from "@/components/layout/brand-header";
import { Fab } from "@/components/layout/fab";
import { Sheet } from "@/components/layout/sheet";
import { Topbar } from "@/components/layout/topbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Text } from "@/components/ui/text";
import { AnnouncementsHeaderAction } from "@/features/announcements/components/announcements-header-action";
import {
  CreateFolderDialog,
  type CreatedFolder,
} from "@/features/folders/components/create-folder-dialog";
import { FolderHeaderActions } from "@/features/folders/components/folder-header-actions";
import { FOLDER_SECTIONS_SHEET_TIMING } from "@/features/folders/hooks/use-section-accordion";
import { UNCATEGORIZED_FOLDER_ID } from "@/features/folders/lib/folder-pages";
import { useFolderQuery } from "@/features/folders/queries";
import { DetailPanel } from "@/features/links/components/detail-panel/detail-panel";
import {
  LinkCreateForm,
  type LinkCreateFormHandle,
} from "@/features/links/components/link-create-form";
import { isLinkNotFound } from "@/features/links/lib/is-link-not-found";
import { useLinkDetailQuery } from "@/features/links/queries";
import { NotificationBellButton } from "@/features/notifications/components/notification-bell-button";
import { SearchDialog } from "@/features/search/components/search-dialog";
import { cn } from "@/lib/utils";
import { useCreateFolderSheet } from "@/stores/create-folder-sheet";
import {
  type FolderSection,
  setFolderScrollOffset,
  useFolderNavigation,
} from "@/stores/folder-navigation";
import { useHomeSearchFocus } from "@/stores/home-search-focus";
import { requestLeave } from "@/stores/leave-guard";
import { useSearchDialog } from "@/stores/search-dialog";
import { useAnySheetOpen } from "@/stores/sheet-tracker";

import { useAddLinkSheet } from "../hooks/use-add-link-sheet";
import { useLinkOverlayState } from "../hooks/use-link-overlay-state";
import { type ShellActions, ShellActionsContext } from "../hooks/use-shell-actions";
import { useShellRouteState } from "../hooks/use-shell-route-state";
import { useWideShellInsets } from "../hooks/use-wide-shell-insets";
import { getFolderIdFromPath } from "../lib/folder-path";
import { isNewLinkShortcut, suppressNextTextInput } from "../lib/new-link-shortcut";
import { canOpenWideOverlayInPlace } from "../routes";
import type { MobileTabKey } from "../types";
import { WideSidebarColumn } from "./wide-sidebar-column";

import { type Href, Redirect, useGlobalSearchParams, useRouter } from "expo-router";
import { Folder, House, ListTodo, Plus, Search, Settings } from "lucide-react-native";

const mobileTabItems = [
  { key: "home", label: "홈", icon: House },
  { key: "folders", label: "폴더", icon: Folder },
  { key: "todos", label: "액션", icon: ListTodo },
  { key: "settings", label: "설정", icon: Settings },
] satisfies React.ComponentProps<typeof BottomTabs>["items"];

function ResponsiveShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const routeState = useShellRouteState();
  const wideInsets = useWideShellInsets();
  const {
    close: closeAddLinkSheet,
    handleOpenChange: handleAddLinkSheetOpenChange,
    isOpen: isAddLinkSheetOpen,
    open: openAddLinkSheet,
  } = useAddLinkSheet();
  const isCreateFolderSheetOpen = useCreateFolderSheet((state) => state.isOpen);
  const isAnySheetOpen = useAnySheetOpen();
  const isSearchDialogOpen = useSearchDialog((state) => state.isOpen);
  const searchDialogMode = useSearchDialog((state) => state.mode);
  const searchDialogInitialQuery = useSearchDialog((state) => state.initialQuery);
  const openSearchDialog = useSearchDialog((state) => state.open);
  const setSearchDialogOpen = useSearchDialog((state) => state.setOpen);
  const [isAddLinkDialogOpen, setIsAddLinkDialogOpen] = React.useState(false);
  const [addLinkFormKey, setAddLinkFormKey] = React.useState(0);
  const [isAddLinkSheetSubStep, setIsAddLinkSheetSubStep] = React.useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = React.useState(false);
  const [createFolderSection, setCreateFolderSection] = React.useState<FolderSection>("mine");
  const [sidebarFolderListKey, setSidebarFolderListKey] = React.useState(0);
  const [hasOpenedAddLinkSheet, setHasOpenedAddLinkSheet] = React.useState(false);
  const [pendingMobileLinkId, setPendingMobileLinkId] = React.useState<number | null>(null);
  const [sharedLinkUrl, setSharedLinkUrl] = React.useState<string | null>(null);
  const wasAddLinkOpenRef = React.useRef(false);
  const addLinkFormRef = React.useRef<LinkCreateFormHandle>(null);
  const { linkUrl: linkUrlParam } = useGlobalSearchParams<{ linkUrl?: string }>();
  const openFolderSection = useFolderNavigation((state) => state.openSectionOn);
  const isAnnouncementsListRoute = routeState.pathname === "/announcements";
  const mobileFolderId = getFolderIdFromPath(routeState.pathname) ?? Number.NaN;
  const mobileFolderQuery = useFolderQuery(mobileFolderId, {
    enabled: !routeState.isWideView && mobileFolderId !== UNCATEGORIZED_FOLDER_ID,
  });
  // The mobile link detail draws its own header (back + toolbar) once the detail is loaded.
  const mobileLinkDetailId = /^\/links\/([^/]+)$/.exec(routeState.pathname)?.[1];
  const mobileLinkDetailQuery = useLinkDetailQuery(
    routeState.isWideView ? null : mobileLinkDetailId,
  );
  const { detail, error, handleOpenChange, isLoading, isOpen, notFound } = useLinkOverlayState({
    isWideView: routeState.isWideView,
    overlayBaseHref: routeState.overlayBaseHref,
    overlayLinkId: routeState.overlayLinkId,
  });
  // Closing the detail asks first while its action editor holds unsaved edits.
  const handleOverlayOpenChange = React.useCallback(
    (open: boolean) => {
      if (open) {
        handleOpenChange(true);
        return;
      }
      requestLeave(() => handleOpenChange(false));
    },
    [handleOpenChange],
  );

  const lastPathnameRef = React.useRef(routeState.pathname);
  React.useEffect(() => {
    if (lastPathnameRef.current === routeState.pathname) {
      return;
    }
    lastPathnameRef.current = routeState.pathname;
    setIsAddLinkDialogOpen(false);
  }, [routeState.pathname]);

  React.useEffect(() => {
    const url = linkUrlParam?.trim();
    if (!url) {
      return;
    }
    setSharedLinkUrl(url);
    if (routeState.isWideView) {
      setAddLinkFormKey((key) => key + 1);
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
      requestLeave(() => {
        if (canOpenWideOverlayInPlace(routeState.pathname)) {
          router.replace(`${routeState.pathname}?linkId=${id}` as Href);
          return;
        }
        router.replace(`/links?linkId=${id}` as Href);
      });
    },
    [routeState.pathname, router],
  );

  const handleWideAddLinkPress = React.useCallback(() => {
    setIsAddLinkDialogOpen(true);
  }, []);

  // A user close (×, Esc, outside) asks the form first; it confirms when it holds input.
  const handleWideAddLinkDialogOpenChange = React.useCallback((open: boolean) => {
    if (!open && addLinkFormRef.current?.requestClose() === false) {
      return;
    }
    setIsAddLinkDialogOpen(open);
  }, []);

  const handleAddLinkSheetCloseRequest = React.useCallback(
    () => addLinkFormRef.current?.requestClose() ?? true,
    [],
  );

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

  const handleWideNavigate = React.useCallback(
    (href: string) => {
      router.replace(href as Href);
    },
    [router],
  );

  const handleWideAddFolderPress = React.useCallback((section: FolderSection) => {
    setCreateFolderSection(section);
    setIsCreateFolderOpen(true);
  }, []);

  const handleWideFolderCreated = React.useCallback(
    (folder: CreatedFolder) => {
      const section: FolderSection = folder.isShared ? "shared" : "mine";
      setFolderScrollOffset("sidebar", section, 0);
      openFolderSection("sidebar", section);
      setSidebarFolderListKey((key) => key + 1);
    },
    [openFolderSection],
  );

  const handleProfilePress = React.useCallback(() => {
    router.push("/settings" as Href);
  }, [router]);

  const handleFabPress = React.useCallback(() => {
    setHasOpenedAddLinkSheet(true);
    openAddLinkSheet();
  }, [openAddLinkSheet]);

  const shellActions = React.useMemo<ShellActions>(
    () => ({ openNewLink: handleFabPress }),
    [handleFabPress],
  );

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
      const key = event.key?.toLowerCase();
      const isMetaOrCtrlK = (event.metaKey || event.ctrlKey) && key === "k";

      if (isMetaOrCtrlK) {
        event.preventDefault();
        openSearchDialog({ mode: "link" });
        return;
      }

      if (isNewLinkShortcut(event)) {
        event.preventDefault();
        suppressNextTextInput(window);
        setSearchDialogOpen(false);
        setIsAddLinkDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handleWideKeyboardShortcut, true);

    return () => {
      window.removeEventListener("keydown", handleWideKeyboardShortcut, true);
    };
  }, [openSearchDialog, routeState.isWideView, setSearchDialogOpen]);

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
      routeState.pathname === "/qr-scan" ||
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

  // While redirecting, the shell root stays in the same fragment slot (hidden, not unmounted) so the
  // route Slot is never remounted and keeps its navigation state. {redirect} renders last so its
  // replace runs after the hidden route screens' own Redirects (route-screens.tsx); rendering it
  // first lets those win and lands on /home again.
  const { redirectHref } = routeState;
  const redirectCover = redirectHref ? <View className="flex-1 bg-background" /> : null;
  const redirect = redirectHref ? (
    <Redirect
      key={redirectHref}
      href={redirectHref as Href}
    />
  ) : null;

  if (routeState.isWideView) {
    return (
      <>
        {redirectCover}
        <View className={cn("flex-1 flex-row bg-background", redirectHref && "hidden")}>
          <WideSidebarColumn
            activeKey={routeState.wideSidebarKey}
            folderListKey={sidebarFolderListKey}
            isOverlayOpen={isOpen}
            pathname={routeState.pathname}
            onAddFolderPress={handleWideAddFolderPress}
            onAddLinkPress={handleWideAddLinkPress}
            onNavigate={handleWideNavigate}
            onOverlayDismiss={() => handleOverlayOpenChange(false)}
            onProfilePress={handleProfilePress}
          />

          <View
            className="flex-1 bg-background"
            style={{ paddingTop: wideInsets.top, paddingBottom: wideInsets.bottom }}
          >
            <Topbar
              className="flex"
              placeholder="링크 · 요약 · 태그 검색…"
              variant="default"
              searchReadOnly
              searchLeftSlot={
                <Icon
                  as={Search}
                  size={16}
                  className="text-muted-foreground"
                />
              }
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
                    hitSlop={4}
                    icon={Settings}
                    size="sm"
                    variant="ghost"
                    active={isSettingsRoute}
                    onPress={() => router.replace("/settings" as Href)}
                  />
                </>
              }
            />
            <View
              className="relative flex-1"
              role="main"
            >
              <RouteErrorBoundary resetKeys={[routeState.pathname]}>{children}</RouteErrorBoundary>
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
              onOpenChange={handleOverlayOpenChange}
            />
          ) : isOpen ? (
            <DetailPanel
              error={error}
              notFound={notFound}
              isLoading={isLoading}
              mode="overlay"
              open={isOpen}
              onDeleted={() => handleOpenChange(false)}
              onOpenChange={handleOverlayOpenChange}
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
            defaultShared={createFolderSection === "shared"}
            onCreated={handleWideFolderCreated}
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
              <RouteErrorBoundary
                key={addLinkFormKey}
                className="mx-8 my-6"
                description="링크 추가 시트를 다시 열어 시도해주세요."
                resetKeys={[isAddLinkDialogOpen]}
                title="링크 추가 화면을 불러오지 못했어요"
                onClose={() => setIsAddLinkDialogOpen(false)}
              >
                <LinkCreateForm
                  ref={addLinkFormRef}
                  mode="wide"
                  open={isAddLinkDialogOpen}
                  initialUrl={sharedLinkUrl ?? undefined}
                  onCancel={() => setIsAddLinkDialogOpen(false)}
                  onSaved={handleWideLinkSaved}
                />
              </RouteErrorBoundary>
            </DialogContent>
          </Dialog>
        </View>
        {redirect}
      </>
    );
  }

  const isMobileHome = routeState.pathname === "/home";
  // Folder detail keeps its title right after the back button, so the title does not shift with
  // the role-dependent actions on the right. Every other mobile header stays centered.
  const isMobileFolderDetail = getFolderIdFromPath(routeState.pathname) !== undefined;
  const mobileFolder = mobileFolderQuery.folder;
  const isMobileLinkDetailShown =
    mobileLinkDetailId !== undefined &&
    mobileLinkDetailQuery.data !== undefined &&
    !(mobileLinkDetailQuery.isError && isLinkNotFound(mobileLinkDetailQuery.error));
  const mobileHeaderTitle = mobileFolder
    ? `${mobileFolder.emoji ? `${mobileFolder.emoji} ` : ""}${mobileFolder.name}`
    : routeState.routeTitle;
  const showMobileFab =
    routeState.pathname === "/home" ||
    routeState.pathname === "/todos" ||
    routeState.pathname.startsWith("/folders/");

  return (
    <>
      {redirectCover}
      <View className={cn("flex-1 bg-background", redirectHref && "hidden")}>
        {isMobileLinkDetailShown ? null : (
          <AppHeader
            back={!isMobileHome && routeState.showBackButton}
            onBack={handleBack}
            leftSlot={isMobileHome ? <BrandHeader className="px-0 pt-0" /> : undefined}
            rightSlot={
              isMobileHome ? (
                <View className="flex-row items-center gap-2">
                  <IconButton
                    accessibilityLabel="검색"
                    hitSlop={4}
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
            titleAlign={isMobileFolderDetail ? "start" : "center"}
          />
        )}
        <View
          className="flex-1"
          role="main"
        >
          <ShellActionsContext value={shellActions}>
            <RouteErrorBoundary resetKeys={[routeState.pathname]}>{children}</RouteErrorBoundary>
          </ShellActionsContext>
          {showMobileFab && !isAnySheetOpen && !isAddLinkSheetOpen && !isCreateFolderSheetOpen ? (
            <Fab
              className="absolute bottom-2 right-6 z-fixed"
              icon={Plus}
              label="새 링크"
              onPress={handleFabPress}
            />
          ) : null}
        </View>
        <BottomTabs
          items={mobileTabItems}
          value={routeState.mobileTabKey ?? ""}
          onValueChange={handleMobileTabChange}
        />
        {hasOpenedAddLinkSheet && isAddLinkSheetOpen ? (
          <Sheet
            open={isAddLinkSheetOpen}
            fitContent
            fixedHeader
            hideCloseButton={isAddLinkSheetSubStep}
            resizeTiming={FOLDER_SECTIONS_SHEET_TIMING}
            onCloseRequest={handleAddLinkSheetCloseRequest}
            onOpenChange={handleAddLinkSheetOpenChange}
          >
            <RouteErrorBoundary
              description="시트를 닫고 다시 열어 시도해주세요."
              resetKeys={[isAddLinkSheetOpen]}
              title="링크 추가 시트를 불러오지 못했어요"
              onClose={closeAddLinkSheet}
            >
              <LinkCreateForm
                ref={addLinkFormRef}
                mode="mobile"
                open={isAddLinkSheetOpen}
                initialUrl={sharedLinkUrl ?? undefined}
                onCancel={closeAddLinkSheet}
                onMobileSubStepChange={setIsAddLinkSheetSubStep}
                onSaved={handleMobileLinkSaved}
              />
            </RouteErrorBoundary>
          </Sheet>
        ) : null}
      </View>
      {redirect}
    </>
  );
}

export { ResponsiveShell };
