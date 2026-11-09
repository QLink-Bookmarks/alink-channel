import { Pressable, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  type ReversalExclusions,
  type ReversalFolderItem,
  type ReversalLinkItem,
  getReversalLinkOutcome,
  isLinkSelectable,
  isLinkSelected,
} from "../../lib/reversal-selection";
import { ChangeMark } from "../history/change-mark";
import { ReversalCheckbox } from "./reversal-checkbox";
import { getHostLabel } from "./reversal-copy";

import { Check } from "lucide-react-native";

type ReversalLinkRowProps = {
  folder: ReversalFolderItem;
  link: ReversalLinkItem;
  exclusions: ReversalExclusions;
  disabled?: boolean;
  onToggle: (folder: ReversalFolderItem, linkId: number) => void;
};

function ReversalLinkRow({ folder, link, exclusions, disabled, onToggle }: ReversalLinkRowProps) {
  const outcome = getReversalLinkOutcome(folder, link, exclusions);
  const isSelectable = isLinkSelectable(link);
  const isSelected = isLinkSelected(link, exclusions);
  const isMuted = !isSelectable || outcome === "keep" || outcome === "unfiled";
  const host = getHostLabel(link.url);
  const isEdited = link.state === "EDITED";
  const subtitle =
    link.state === "ADDED_LATER" ? "가져온 뒤 직접 저장한 링크라 지우지 않아요" : host;
  const handleToggle = () => onToggle(folder, link.linkId);

  return (
    <View
      className="flex-row items-center gap-1 border-t border-border py-1 pr-3"
      testID={`reversal-link-${link.linkId}`}
    >
      <ReversalCheckbox
        checked={isSelected}
        disabled={!isSelectable || disabled}
        label={`${link.title || host} 지우기`}
        onPress={handleToggle}
      />
      <Pressable
        accessible={false}
        disabled={!isSelectable || disabled}
        className="min-w-0 flex-1 gap-0.5 py-1.5"
        onPress={handleToggle}
      >
        <Text
          className={cn("text-sm text-foreground", isMuted && "text-muted-foreground")}
          numberOfLines={1}
        >
          {link.title || host}
        </Text>
        <View className="min-w-0 flex-row items-center gap-1.5">
          {isEdited ? (
            <Badge
              variant="warning"
              className="py-0"
            >
              <Text className="text-sm font-semibold">가져온 뒤 수정됨</Text>
            </Badge>
          ) : null}
          <Text
            className="min-w-0 shrink text-sm text-muted-foreground"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>
      <LinkOutcome outcome={outcome} />
    </View>
  );
}

function LinkOutcome({ outcome }: { outcome: ReturnType<typeof getReversalLinkOutcome> }) {
  if (outcome === "deleted") {
    return (
      <Badge
        variant="private"
        className="border-border bg-card"
      >
        <Text className="text-sm text-foreground/70">이미 삭제됨</Text>
      </Badge>
    );
  }
  if (outcome === "done") {
    return (
      <View className="flex-row items-center gap-1">
        <Icon
          as={Check}
          size={12}
          className="text-muted-foreground"
        />
        <Text className="text-sm text-muted-foreground">지웠어요</Text>
      </View>
    );
  }
  if (outcome === "remove") {
    return (
      <View className="flex-row items-center gap-1">
        <ChangeMark kind="remove" />
        <Text className="text-sm font-semibold text-destructive">지워요</Text>
      </View>
    );
  }
  if (outcome === "unfiled") {
    return (
      <View className="flex-row items-center gap-1">
        <ChangeMark kind="add" />
        <Text className="text-sm font-semibold text-success">미분류</Text>
      </View>
    );
  }
  return <Text className="text-sm text-muted-foreground">남겨요</Text>;
}

export { ReversalLinkRow };
