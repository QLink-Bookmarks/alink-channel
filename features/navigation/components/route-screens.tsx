import { ScrollView, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";
import { isAdminRole } from "@/features/account/lib/roles";
import { useMyProfileQuery } from "@/features/account/queries";
import { FolderHeaderActions } from "@/features/folders/components/folder-header-actions";
import { MobileFoldersScreen } from "@/features/folders/components/mobile-folders-screen";
import { UNCATEGORIZED_FOLDER_ID } from "@/features/folders/lib/folder-pages";
import { useFolderQuery } from "@/features/folders/queries";
import { LinkListView } from "@/features/home/components/link-list-view";
import { MobileHomeScreen } from "@/features/home/components/mobile-home-screen";
import { WideHomeScreen } from "@/features/home/components/wide-home-screen";
import { LinkDetailScreen } from "@/features/links/components/link-detail-screen";
import { NotificationInboxScreen } from "@/features/notifications/components/notification-inbox-screen";
import { PostDetailScreen } from "@/features/posts/components/post-detail-screen";
import { PostListScreen } from "@/features/posts/components/post-list-screen";
import { SettingsScreen } from "@/features/settings/components/settings-screen";
import { TodosScreen } from "@/features/todos/components/todos-screen/todos-screen";

import { useShellRouteState } from "../hooks/use-shell-route-state";
import { readParamValue } from "../routes";

import { type Href, Redirect, useLocalSearchParams } from "expo-router";
import { BookCopyIcon } from "lucide-react-native";

function HomeRouteScreen() {
  const { isWideView } = useShellRouteState();

  if (isWideView) {
    return <WideHomeScreen />;
  }

  return <MobileHomeScreen />;
}

function FoldersRouteScreen() {
  const { isWideView } = useShellRouteState();

  // Wide view has no folders page — the shell redirects /folders to /home.
  if (isWideView) {
    return <Redirect href={"/home" as Href} />;
  }

  return <MobileFoldersScreen />;
}

function FolderDetailRouteScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; linkId?: string | string[] }>();
  const folderId = readParamValue(params.id);
  const linkIdParam = readParamValue(params.linkId);
  const folderIdNumber = folderId ? Number(folderId) : Number.NaN;
  const isUncategorizedFolder = folderIdNumber === UNCATEGORIZED_FOLDER_ID;
  const folderQuery = useFolderQuery(folderIdNumber, { enabled: !isUncategorizedFolder });

  if (isUncategorizedFolder) {
    return (
      <LinkListView
        folderId={UNCATEGORIZED_FOLDER_ID}
        title="미분류"
        emoji="🗂️"
        basePath={`/folders/${UNCATEGORIZED_FOLDER_ID}`}
        activeLinkId={linkIdParam ? Number(linkIdParam) : undefined}
      />
    );
  }

  const folder = folderQuery.folder;

  if (folder) {
    return (
      <LinkListView
        folderId={folder.id}
        title={folder.name}
        emoji={folder.emoji ?? undefined}
        meta={`${folder.linkCounts}개 링크`}
        basePath={`/folders/${folder.id}`}
        headerActions={
          <FolderHeaderActions
            folder={folder}
            mode="wide"
          />
        }
        activeLinkId={linkIdParam ? Number(linkIdParam) : undefined}
      />
    );
  }

  if (folderQuery.isError) {
    return (
      <FolderNoticeScreen
        emoji="⚠️"
        title="폴더를 불러오지 못했어요"
        description="네트워크 연결을 확인한 뒤 다시 시도해주세요."
        onRetry={folderQuery.retry}
      />
    );
  }

  if (folderQuery.isNotFound) {
    return (
      <FolderNoticeScreen
        emoji="📁"
        title="폴더를 찾을 수 없어요"
        description="삭제된 폴더이거나 접근 권한이 없는 폴더예요."
      />
    );
  }

  return (
    <ActivityIndicator
      size="large"
      className="flex-1 py-16"
    />
  );
}

function FolderNoticeScreen({
  emoji,
  title,
  description,
  onRetry,
}: {
  emoji: string;
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="flex-grow justify-center"
      showsVerticalScrollIndicator={false}
    >
      <EmptyState
        emoji={emoji}
        title={title}
        description={description}
        actions={
          onRetry ? (
            <Button
              variant="outline"
              onPress={onRetry}
            >
              <Text>다시 시도</Text>
            </Button>
          ) : undefined
        }
      />
    </ScrollView>
  );
}

function TodosRouteScreen() {
  const { isWideView } = useShellRouteState();
  return <TodosScreen mode={isWideView ? "wide" : "mobile"} />;
}

function NotificationsRouteScreen() {
  const { isWideView } = useShellRouteState();
  return <NotificationInboxScreen mode={isWideView ? "wide" : "mobile"} />;
}

function LinksRouteScreen() {
  const { isWideView } = useShellRouteState();
  const params = useLocalSearchParams<{ linkId?: string | string[] }>();
  const linkIdParam = readParamValue(params.linkId);

  // Mobile has no full-links page — the shell redirects /links to /home.
  if (!isWideView) {
    return <Redirect href={"/home" as Href} />;
  }

  return (
    <LinkListView
      title="전체 보기"
      icon={BookCopyIcon}
      basePath="/links"
      activeLinkId={linkIdParam ? Number(linkIdParam) : undefined}
    />
  );
}

function LinkDetailRouteScreen() {
  const { isWideView } = useShellRouteState();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const linkId = readParamValue(params.id);

  if (!isWideView) {
    return <LinkDetailScreen linkId={linkId} />;
  }

  // Wide view shows the detail as an overlay over the list, so a direct
  // /links/[id] hit redirects to the canonical overlay URL (which renders the
  // link, or a "찾으시는 링크가 없어요" state if it doesn't exist).
  return <Redirect href={(linkId ? `/links?linkId=${linkId}` : "/links") as Href} />;
}

function SettingsRouteScreen() {
  const { isWideView } = useShellRouteState();
  return <SettingsScreen mode={isWideView ? "wide" : "mobile"} />;
}

function AnnouncementsRouteScreen() {
  const { isWideView } = useShellRouteState();
  return (
    <PostListScreen
      mode={isWideView ? "wide" : "mobile"}
      type="ANNOUNCEMENT"
      basePath="/announcements"
      title="공지사항"
      emptyEmoji="📢"
      emptyTitle="아직 공지사항이 없어요"
      emptyDescription="새로운 소식이 올라오면 여기에서 확인할 수 있어요."
    />
  );
}

function AnnouncementDetailRouteScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = readParamValue(params.id);
  return (
    <PostDetailScreen
      postId={postId}
      backPath="/announcements"
    />
  );
}

function PermissionDeniedScreen() {
  return (
    <View className="flex-1">
      <EmptyState
        className="flex-1"
        emoji="🔒"
        title="페이지 권한이 없어요"
        description="이 페이지에 접근할 수 있는 권한이 없어요."
      />
    </View>
  );
}

function useAdminGate() {
  const profileQuery = useMyProfileQuery();
  return { isLoading: profileQuery.isLoading, isAdmin: isAdminRole(profileQuery.data?.role) };
}

function FeedbacksRouteScreen() {
  const { isWideView } = useShellRouteState();
  const { isLoading, isAdmin } = useAdminGate();
  if (isLoading) {
    return (
      <ActivityIndicator
        size="large"
        className="flex-1 py-16"
      />
    );
  }
  if (!isAdmin) {
    return <PermissionDeniedScreen />;
  }
  return (
    <PostListScreen
      mode={isWideView ? "wide" : "mobile"}
      type="FEEDBACK"
      basePath="/feedbacks"
      title="피드백"
      emptyEmoji="📮"
      emptyTitle="아직 피드백이 없어요"
      emptyDescription="사용자들이 보낸 피드백이 여기에 모여요."
    />
  );
}

function FeedbackDetailRouteScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = readParamValue(params.id);
  const { isLoading, isAdmin } = useAdminGate();
  if (isLoading) {
    return (
      <ActivityIndicator
        size="large"
        className="flex-1 py-16"
      />
    );
  }
  if (!isAdmin) {
    return <PermissionDeniedScreen />;
  }
  return (
    <PostDetailScreen
      postId={postId}
      backPath="/feedbacks"
      imagesClickable
    />
  );
}

export {
  AnnouncementDetailRouteScreen,
  AnnouncementsRouteScreen,
  FeedbackDetailRouteScreen,
  FeedbacksRouteScreen,
  FolderDetailRouteScreen,
  FoldersRouteScreen,
  HomeRouteScreen,
  LinkDetailRouteScreen,
  LinksRouteScreen,
  NotificationsRouteScreen,
  SettingsRouteScreen,
  TodosRouteScreen,
};
