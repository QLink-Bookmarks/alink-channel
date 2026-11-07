import type { ApiEnvelope } from "@/features/links/types";
import type { SortDirection } from "@/lib/list-sort";

type DevicePlatform = "WEB" | "NATIVE";
type NotificationContext = "TODO" | "ANNOUNCE";
type NotificationOrderKey = "fired_at";

type PutDeviceRequest = {
  platform: DevicePlatform;
  token: string;
};

type PutDeviceResponseData = {
  id: number;
};

type PutDeviceResponse = ApiEnvelope<PutDeviceResponseData>;

type DeleteDeviceResponse = ApiEnvelope<null>;

type NotificationListItem = {
  id: number;
  title: string;
  message: string;
  firedAt: string;
  readAt?: string | null;
  context: NotificationContext;
  contextId: number;
};

type NotificationScrollResponse = {
  isEmpty: boolean;
  contents: NotificationListItem[];
  nextCursor: string | null;
  hasNext: boolean;
};

type GetNotificationsParams = {
  query?: string;
  type?: NotificationContext;
  orderKey?: NotificationOrderKey;
  order?: SortDirection;
  cursor?: string;
  size?: number;
};

type GetNotificationsResponse = ApiEnvelope<NotificationScrollResponse>;
type ReadNotificationResponse = ApiEnvelope<null>;

type UnreadNotificationCount = {
  unreadCount: number;
};

type GetUnreadNotificationCountResponse = ApiEnvelope<UnreadNotificationCount>;

export type {
  DeleteDeviceResponse,
  DevicePlatform,
  GetNotificationsParams,
  GetNotificationsResponse,
  GetUnreadNotificationCountResponse,
  UnreadNotificationCount,
  NotificationContext,
  NotificationListItem,
  NotificationOrderKey,
  NotificationScrollResponse,
  PutDeviceRequest,
  PutDeviceResponse,
  PutDeviceResponseData,
  ReadNotificationResponse,
};
