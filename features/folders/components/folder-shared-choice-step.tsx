import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react-native";
import { ChevronRight, Trash2, UserRound } from "lucide-react-native/icons";

function SharedChoiceButton({
  icon,
  title,
  description,
  isDestructive = false,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  isDestructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={title}
      accessibilityRole="button"
      className="min-h-16 flex-row items-center gap-3 rounded-xl border border-border p-3.5 active:bg-accent web:hover:bg-accent"
      onPress={onPress}
    >
      <View
        className={cn(
          "size-9 shrink-0 items-center justify-center rounded-[10px]",
          isDestructive ? "bg-destructive/10" : "bg-muted",
        )}
      >
        <Icon
          as={icon}
          className={cn("size-4", isDestructive ? "text-destructive" : "text-foreground")}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className={cn(
            "text-[15px] font-semibold",
            isDestructive ? "text-destructive" : "text-foreground",
          )}
        >
          {title}
        </Text>
        <Text className="text-[13px] text-muted-foreground">{description}</Text>
      </View>
      <Icon
        as={ChevronRight}
        className="size-4 shrink-0 text-muted-foreground"
      />
    </Pressable>
  );
}

/** `위임` / `폴더 삭제` choice for a shared folder owner with other members. */
function FolderSharedChoiceStep({
  onTransferPress,
  onDeletePress,
}: {
  onTransferPress: () => void;
  onDeletePress: () => void;
}) {
  return (
    <View className="gap-2">
      <SharedChoiceButton
        description="멤버 한 명에게 소유권을 넘기고 나는 폴더에서 나가요. 내가 넣은 링크는 폴더에 남아요."
        icon={UserRound}
        title="위임"
        onPress={onTransferPress}
      />
      <SharedChoiceButton
        isDestructive
        description="모든 멤버에게서 폴더가 사라져요. 링크를 옮길지 지울지는 다음 단계에서 골라요."
        icon={Trash2}
        title="폴더 삭제"
        onPress={onDeletePress}
      />
    </View>
  );
}

export { FolderSharedChoiceStep };
