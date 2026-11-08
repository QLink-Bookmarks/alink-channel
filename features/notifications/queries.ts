import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";

import { getNotifications, getUnreadNotificationCount } from "./api";
import type { GetNotificationsParams } from "./types";

const notificationQueryKeys = {
  all: ["notifications"] as const,
  list: (params: GetNotificationsParams) => ["notifications", "list", params] as const,
  unread: () => ["notifications", "unread"] as const,
};

function useNotificationsQuery(params: GetNotificationsParams = {}) {
  const resolvedParams: GetNotificationsParams = {
    orderKey: "fired_at",
    order: "desc",
    size: 30,
    ...params,
  };

  return useQuery({
    queryFn: async () => {
      const response = await getNotifications(resolvedParams);
      return response.data;
    },
    queryKey: notificationQueryKeys.list(resolvedParams),
  });
}

// Single source of truth for the bell badge. Invalidated on read
// (useReadNotificationMutation) and on incoming pushes (push bridges), so the
// count stays consistent instead of being hand-incremented.
function useUnreadNotificationCountQuery() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  return useQuery({
    enabled: hasHydrated && Boolean(accessToken),
    queryFn: async () => {
      const response = await getUnreadNotificationCount();
      return response.data;
    },
    queryKey: notificationQueryKeys.unread(),
  });
}

export { notificationQueryKeys, useNotificationsQuery, useUnreadNotificationCountQuery };
