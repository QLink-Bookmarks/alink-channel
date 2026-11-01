import * as React from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useChromeStore } from "@/stores/chrome";

import type { LucideIcon } from "lucide-react-native";

// View scope: 모바일 전용. md >= 769px에서는 사용하지 않는다.

type BottomTabItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

function BottomTabs({
  className,
  value,
  items,
  onValueChange,
  style,
  ...props
}: React.ComponentProps<typeof View> & {
  value: string;
  items: BottomTabItem[];
  onValueChange?: (value: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const setBottomTabsHeight = useChromeStore((state) => state.setBottomTabsHeight);

  React.useEffect(() => {
    return () => setBottomTabsHeight(0);
  }, [setBottomTabsHeight]);

  const handleLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      setBottomTabsHeight(event.nativeEvent.layout.height);
    },
    [setBottomTabsHeight],
  );

  return (
    <View
      className={cn(
        "flex-row border-t border-border bg-background px-2 pb-2 pt-1 md:hidden",
        className,
      )}
      style={[
        {
          paddingBottom: insets.bottom + 8,
        },
        style,
      ]}
      onLayout={handleLayout}
      {...props}
    >
      {items.map((item) => {
        const active = item.key === value;

        return (
          <Pressable
            key={item.key}
            className="flex-1 items-center gap-1 py-1"
            onPress={() => onValueChange?.(item.key)}
          >
            <View className={cn("rounded-full p-2", active && "bg-primary/10")}>
              <Icon
                as={item.icon}
                className={cn("size-5", active ? "text-primary" : "text-muted-foreground")}
              />
            </View>
            <Text
              className={cn(
                "text-2xs font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export { BottomTabs };
export type { BottomTabItem };
