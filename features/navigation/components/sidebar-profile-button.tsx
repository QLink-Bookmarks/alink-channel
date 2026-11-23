import { View } from "react-native";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Emoji } from "@/components/ui/emoji";
import { Text } from "@/components/ui/text";
import { useMyProfileQuery } from "@/features/account/queries";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";

type SidebarProfileButtonProps = {
  className?: string;
  onPress: () => void;
};

function SidebarProfileButton({ className, onPress }: SidebarProfileButtonProps) {
  const avatarEmojiOverride = useDisplaySettings((state) => state.profile.avatarEmoji);
  const { data: profile } = useMyProfileQuery();
  const avatarEmoji = avatarEmojiOverride ?? profile?.avatarEmoji ?? "🌸";
  const nickname = profile?.nickname ?? "사용자";

  return (
    <Button
      className={cn(
        "h-auto min-h-0 min-w-0 flex-1 items-center justify-start gap-3 bg-transparent py-2 pl-5 pr-3 shadow-none web:hover:bg-sidebar-surface-2 sm:h-auto",
        className,
      )}
      variant="ghost"
      onPress={onPress}
    >
      <Avatar
        alt={`${nickname} avatar`}
        size="xs"
      >
        {profile?.avatarUrl ? <AvatarImage source={{ uri: profile.avatarUrl }} /> : null}
        <AvatarFallback>
          <Emoji className="text-xl">{avatarEmoji}</Emoji>
        </AvatarFallback>
      </Avatar>
      <View className="min-w-0 flex-1 items-start">
        <Text
          numberOfLines={1}
          className="text-left text-base font-semibold text-sidebar-hover"
        >
          {nickname}
        </Text>
        <Text
          numberOfLines={1}
          className="text-left text-sm text-sidebar-muted"
        >
          {profile?.username ?? ""}
        </Text>
      </View>
    </Button>
  );
}

export { SidebarProfileButton };
