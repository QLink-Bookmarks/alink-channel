import { Pressable, View } from "react-native";

import { Emoji } from "@/components/ui/emoji";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type FolderTileProps = {
  className?: string;
  emoji?: string | null;
  name: string;
  count?: number | string;
  add?: boolean;
  onPress?: () => void;
};

function FolderTile({ className, emoji, name, count, add, onPress }: FolderTileProps) {
  if (add) {
    return (
      <Pressable
        className={cn(
          "min-h-[88px] items-center justify-center rounded-2xl border border-dashed border-border bg-transparent px-4 py-4",
          className,
        )}
        onPress={onPress}
      >
        <Text className="text-sm font-semibold text-muted-foreground">+ {name}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      className={cn(
        "relative min-h-[88px] flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-qlink-sm",
        className,
      )}
      onPress={onPress}
    >
      <View className="size-10 items-center justify-center rounded-2xl bg-muted">
        <Emoji className="text-xl">{emoji ?? "📁"}</Emoji>
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text
          className="text-base font-semibold text-foreground"
          numberOfLines={1}
        >
          {name}
        </Text>
        {count != null ? <Text className="text-xs text-muted-foreground">{count}개</Text> : null}
      </View>
    </Pressable>
  );
}

export { FolderTile };
export type { FolderTileProps };
