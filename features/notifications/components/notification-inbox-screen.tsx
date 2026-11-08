import * as React from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { getTodos } from "@/features/todos/api";
import { todoQueryKeys } from "@/features/todos/queries";
import { reportError } from "@/lib/error-reporting";
import {
  useListMemoryKey,
  useListScrollMemory,
  useRememberedState,
} from "@/lib/hooks/use-list-scroll-memory";
import { usePullToRefresh } from "@/lib/hooks/use-pull-to-refresh";
import { useQueryClient } from "@tanstack/react-query";

import { useReadNotificationMutation } from "../mutations";
import { useNotificationsQuery } from "../queries";
import type { NotificationListItem } from "../types";
import { NotificationCard } from "./notification-card";

import { type Href, useRouter } from "expo-router";
import { Bell } from "lucide-react-native";

type NotificationInboxScreenMode = "mobile" | "wide";

type NotificationFilter = "all" | "TODO" | "ANNOUNCE";

const NOTIFICATION_SEGMENTS = [
  { label: "전체", value: "all" },
  { label: "액션", value: "TODO" },
  { label: "공지사항", value: "ANNOUNCE" },
];

function NotificationInboxScreen({ mode }: { mode: NotificationInboxScreenMode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const memoryKey = useListMemoryKey(mode);
  const [filter, setFilter] = useRememberedState<NotificationFilter>(memoryKey, "filter", "all");
  // Filter server-side so each tab gets its own full page (a client-side filter
  // would leave uneven page sizes as items of other types are dropped).
  const notificationsQuery = useNotificationsQuery({
    size: 30,
    ...(filter === "all" ? {} : { type: filter }),
  });
  const readNotificationMutation = useReadNotificationMutation();
  const notifications = notificationsQuery.data?.contents ?? [];
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const { isRefreshing, handleRefresh } = usePullToRefresh(notificationsQuery.refetch);
  const { scrollViewRef, scrollViewProps } = useListScrollMemory({
    memoryKey,
    contentKey: filter,
    isLoading: notificationsQuery.isLoading,
    hasContent: notifications.length > 0,
  });

  const navigateToTodoContext = React.useCallback(
    async (notification: NotificationListItem) => {
      if (notification.context !== "TODO") {
        return;
      }
      const params = { orderKey: "created_at", order: "desc", size: 50 } as const;
      const todosData = await queryClient.fetchQuery({
        queryKey: todoQueryKeys.list(params),
        queryFn: async () => (await getTodos(params)).data,
      });
      const todo = todosData?.contents.find((entry) => entry.id === notification.contextId);
      if (!todo) {
        return;
      }
      const target =
        mode === "wide"
          ? (`/links?linkId=${todo.linkId}` as Href)
          : (`/links/${todo.linkId}` as Href);
      router.push(target);
    },
    [mode, queryClient, router],
  );

  const handleNotificationPress = React.useCallback(
    async (notification: NotificationListItem) => {
      try {
        if (!notification.readAt) {
          await readNotificationMutation.mutateAsync(notification.id);
        }
        if (notification.context === "ANNOUNCE") {
          router.push(`/announcements/${notification.contextId}` as Href);
          return;
        }
        await navigateToTodoContext(notification);
      } catch (error: unknown) {
        reportError(error, {
          area: "notification-inbox-screen:read",
          extra: {
            context: notification.context,
            contextId: notification.contextId,
            notificationId: notification.id,
          },
        });
      }
    },
    [navigateToTodoContext, readNotificationMutation, router],
  );

  if (mode === "wide") {
    return (
      <ScrollView
        ref={scrollViewRef}
        {...scrollViewProps}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        }
      >
        <PageHeader
          title="알림"
          icon={Bell}
          meta={unreadCount > 0 ? `안 읽은 알림 ${unreadCount}개` : "새 알림이 없어요"}
        />
        <View className="w-full max-w-4xl gap-3 px-6 pb-10 pt-2">
          <SegmentedControl
            variant="chipsBadge"
            className="self-start"
            value={filter}
            options={NOTIFICATION_SEGMENTS}
            onValueChange={(value) => setFilter(value as NotificationFilter)}
          />
          {notificationsQuery.isLoading ? (
            <ActivityIndicator
              size="large"
              className="py-16"
            />
          ) : notifications.length === 0 ? (
            <EmptyState
              emoji="🔔"
              title="알림이 없어요"
              description="새 알림이 도착하면 이곳에 표시돼요."
            />
          ) : (
            <View className="gap-3">
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  disabled={readNotificationMutation.isPending}
                  notification={notification}
                  onPress={handleNotificationPress}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      {...scrollViewProps}
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      }
    >
      <View className="gap-3 px-4 pb-24 pt-4">
        <SegmentedControl
          variant="chipsBadge"
          className="self-start"
          value={filter}
          options={NOTIFICATION_SEGMENTS}
          onValueChange={(value) => setFilter(value as NotificationFilter)}
        />
        {notificationsQuery.isLoading ? (
          <ActivityIndicator
            size="large"
            className="py-16"
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            emoji="🔔"
            title="알림이 없어요"
            description="새 알림이 도착하면 이곳에 표시돼요."
          />
        ) : (
          notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              disabled={readNotificationMutation.isPending}
              notification={notification}
              onPress={handleNotificationPress}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

export { NotificationInboxScreen };
export type { NotificationInboxScreenMode };
