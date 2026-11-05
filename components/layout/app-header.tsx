import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { ChevronLeft } from "lucide-react-native/icons";

// View scope: 반응형. md 미만은 좁은 뷰, md 이상은 와이드뷰로 동작한다.

/**
 * `center`: the title sits centered between the left and right slots (default).
 * `start`: the title follows the back button (or left slot) with an 8px gap, so its left edge
 * does not move with the number of right-side actions; a long title truncates before them.
 */
type AppHeaderTitleAlign = "center" | "start";

function AppHeader({
  className,
  title,
  back,
  leftSlot,
  rightSlot,
  transparent,
  onBack,
  titleAlign = "center",
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
  titleAlign?: AppHeaderTitleAlign;
}) {
  const insets = useSafeAreaInsets();
  const isStart = titleAlign === "start";
  const leftContent = back ? (
    <IconButton
      accessibilityLabel="뒤로"
      hitSlop={4}
      icon={ChevronLeft}
      size="sm"
      variant="ghost"
      onPress={onBack}
    />
  ) : (
    leftSlot
  );

  return (
    <View
      testID="app-header"
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
      {isStart ? (
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {leftContent}
          {title ? (
            <Text
              testID="app-header-title"
              className="min-w-0 flex-1 text-left text-base font-semibold"
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          <View className="min-w-10 flex-row items-center">{leftContent}</View>
          {title ? (
            <Text
              testID="app-header-title"
              className="flex-1 text-center text-base font-semibold"
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : (
            <View className="flex-1" />
          )}
        </>
      )}
      <View
        testID="app-header-right"
        className="min-w-10 shrink-0 flex-row items-center justify-end"
      >
        {rightSlot}
      </View>
    </View>
  );
}

export { AppHeader, type AppHeaderTitleAlign };
