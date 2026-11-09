import { Pressable, View } from "react-native";

import { Favicon } from "@/components/ui/favicon";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { Plus, X } from "lucide-react-native/icons";

// View scope: 와이드뷰 전용. md >= 769px에서 사용한다.

function ShortcutTile({
  className,
  label,
  faviconUrl,
  add,
  removable,
  onPress,
  onRemove,
}: {
  className?: string;
  label: string;
  faviconUrl?: string;
  add?: boolean;
  removable?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
}) {
  return (
    <Pressable
      className={cn(
        "group w-24 items-center gap-2 rounded-2xl border border-border-soft bg-surface p-3 shadow-qlink-sm active:border-primary",
        "web:transition-all web:hover:border-primary web:hover:bg-primary/5 web:hover:shadow-qlink-md",
        className,
      )}
      onPress={onPress}
    >
      <View className="relative">
        {add ? (
          <View className="size-8 items-center justify-center rounded-xl border border-dashed border-border bg-surface-elevated">
            <Icon
              as={Plus}
              className="size-4 text-muted-foreground"
            />
          </View>
        ) : (
          <Favicon
            url={faviconUrl}
            fallback={label.slice(0, 1)}
            size="md"
          />
        )}
        {removable ? (
          <Pressable
            className="absolute -right-2 -top-2 size-5 items-center justify-center rounded-full bg-foreground"
            onPress={onRemove}
          >
            <Icon
              as={X}
              className="size-3 text-background"
            />
          </Pressable>
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        className="text-center text-xs font-medium web:transition-colors web:group-hover:text-primary"
      >
        {label}
      </Text>
    </Pressable>
  );
}

export { ShortcutTile };
