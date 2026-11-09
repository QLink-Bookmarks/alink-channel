import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react-native";

// View scope: 모바일 전용. md >= 769px에서는 사용하지 않는다.

function Fab({
  className,
  icon,
  label,
  onPress,
}: {
  className?: string;
  icon: LucideIcon;
  label?: string;
  onPress?: () => void;
}) {
  return (
    <Button
      accessibilityLabel={label}
      className={cn("size-14 rounded-full shadow-qlink-fab dark:shadow-qlink-fab-dark", className)}
      onPress={onPress}
      size="icon"
      variant="gradient"
    >
      <Icon
        as={icon}
        className="relative size-6 text-primary-foreground"
      />
    </Button>
  );
}

function FabMenu({
  className,
  open,
  items,
}: {
  className?: string;
  open: boolean;
  items: { label: string; icon?: LucideIcon; onPress?: () => void }[];
}) {
  if (!open) {
    return null;
  }

  return (
    <View
      className={cn(
        "absolute bottom-24 right-6 z-modal gap-2 rounded-2xl border border-border bg-card p-2 shadow-qlink-lg",
        className,
      )}
    >
      {items.map((item) => (
        <Pressable
          key={item.label}
          className="min-h-10 flex-row items-center gap-2 rounded-xl px-3 active:bg-accent"
          onPress={item.onPress}
        >
          {item.icon ? (
            <Icon
              as={item.icon}
              className="size-4 text-muted-foreground"
            />
          ) : null}
          <Text className="text-sm font-medium">{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export { Fab, FabMenu };
