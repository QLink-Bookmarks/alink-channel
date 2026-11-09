import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { ChevronLeft } from "lucide-react-native/icons";

function PaneHeader({
  title,
  description,
  actions,
  meta,
  isWide,
  onBack,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: string;
  isWide: boolean;
  onBack?: () => void;
}) {
  return (
    <View
      className={cn(
        "shrink-0 gap-2 border-b border-border",
        isWide ? "px-5 pb-4 pt-4" : "pb-3 pt-1",
      )}
    >
      <View className="min-h-9 flex-row items-center gap-2">
        {onBack ? (
          <Pressable
            accessibilityLabel="폴더 목록으로"
            accessibilityRole="button"
            className="-ml-2 size-11 items-center justify-center rounded-lg active:bg-muted"
            onPress={onBack}
          >
            <Icon
              as={ChevronLeft}
              className="size-5 text-foreground"
            />
          </Pressable>
        ) : null}
        <View className="min-w-0 flex-1 flex-row items-center gap-2">{title}</View>
        {isWide && actions ? (
          <View className="shrink-0 flex-row items-center gap-1">{actions}</View>
        ) : null}
      </View>
      {!isWide && (actions || meta) ? (
        <View className="min-h-9 flex-row items-center gap-1">
          <Text className="min-w-0 flex-1 text-[13px] text-muted-foreground">{meta}</Text>
          {actions}
        </View>
      ) : null}
      {description ? (
        <Text className="text-[13px] leading-5 text-muted-foreground">{description}</Text>
      ) : null}
    </View>
  );
}

function PaneTitle({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="min-w-0 shrink text-lg font-bold text-foreground"
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

export { PaneHeader, PaneTitle };
