import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

// View scope: 모바일 전용. md >= 769px에서는 사용하지 않는다.

function AccountRow({
  className,
  label,
  value,
  avatarEmoji,
  avatarUrl,
  actionLabel,
  action,
  destructive,
  onActionPress,
}: {
  className?: string;
  label: string;
  value?: string;
  avatarEmoji?: string | null;
  avatarUrl?: string | null;
  actionLabel?: string;
  action?: ReactNode;
  destructive?: boolean;
  onActionPress?: () => void;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-between gap-3 rounded-2xl border border-border-soft bg-card p-4",
        className,
      )}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-3">
        <Avatar
          alt={value ?? label}
          size="md"
        >
          {avatarUrl ? <AvatarImage source={{ uri: avatarUrl }} /> : null}
          <AvatarFallback>
            <Text className="text-lg">{avatarEmoji ?? "🙂"}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">{label}</Text>
          {value ? <Text className="font-medium">{value}</Text> : null}
        </View>
      </View>
      {action ? action : null}
      {actionLabel ? (
        <Pressable onPress={onActionPress}>
          <Text
            className={cn("text-sm font-semibold text-primary", destructive && "text-destructive")}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export { AccountRow };
