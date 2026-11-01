import { View } from "react-native";

import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";

import { useUnreadNotificationCountQuery } from "../queries";

import { Bell } from "lucide-react-native/icons";

type NotificationBellButtonProps = {
  onPress: () => void;
  size?: "sm" | "md" | "lg";
};

// Bell with an unread-count badge. Count comes from the shared unread query, so
// it stays in sync with reads and incoming pushes (which invalidate that query).
function NotificationBellButton({ onPress, size = "sm" }: NotificationBellButtonProps) {
  const { data } = useUnreadNotificationCountQuery();
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <View className="relative">
      <IconButton
        accessibilityLabel="알림"
        icon={Bell}
        size={size}
        variant="ghost"
        onPress={onPress}
      />
      {unreadCount > 0 ? (
        <View
          className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border border-background bg-destructive px-1"
          pointerEvents="none"
          accessibilityLabel={`안 읽은 알림 ${unreadCount}개`}
        >
          <Text className="text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export { NotificationBellButton };
