import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { ChevronLeft } from "lucide-react-native/icons";

// View scope: 반응형. md 미만은 좁은 뷰, md 이상은 와이드뷰로 동작한다.

function AppHeader({
  className,
  title,
  back,
  leftSlot,
  rightSlot,
  transparent,
  onBack,
  style,
  ...props
}: React.ComponentProps<typeof View> & {
  title?: string;
  back?: boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  transparent?: boolean;
  sticky?: boolean;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={cn(
        "min-h-14 flex-row items-center justify-between gap-3 border-b border-border px-4",
        transparent ? "bg-transparent" : "bg-background",
        className,
      )}
      style={[
        {
          minHeight: 56 + insets.top,
          paddingTop: insets.top,
        },
        style,
      ]}
      {...props}
    >
      <View className="min-w-10 flex-row items-center">
        {back ? (
          <IconButton
            accessibilityLabel="뒤로"
            icon={ChevronLeft}
            size="sm"
            variant="ghost"
            onPress={onBack}
          />
        ) : (
          leftSlot
        )}
      </View>
      {title ? (
        <Text
          className="flex-1 text-center text-base font-semibold"
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      <View className="min-w-10 flex-row items-center justify-end">{rightSlot}</View>
    </View>
  );
}

export { AppHeader };
