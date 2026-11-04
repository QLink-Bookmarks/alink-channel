import * as React from "react";
import { Pressable, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import {
  useIsDraggingLink,
  useLinkHandleGesture,
  wasRecentlyDragged,
} from "../../hooks/use-link-drag";
import type { ProposalLink } from "../../lib/proposal-state";
import { PlusBadge } from "./proposal-folder-list";

import { GripVertical, X } from "lucide-react-native/icons";

function getHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

type ProposalLinkRowProps = {
  link: ProposalLink;
  isWide: boolean;
  onOpenPicker: (link: ProposalLink) => void;
  onRemove: (link: ProposalLink) => void;
};

const HANDLE_STYLE = { touchAction: "none", cursor: "grab" } as unknown as React.ComponentProps<
  typeof View
>["style"];

function ProposalLinkRowView({ link, isWide, onOpenPicker, onRemove }: ProposalLinkRowProps) {
  const isDragging = useIsDraggingLink(link.key);
  const gesture = useLinkHandleGesture({
    key: link.key,
    title: link.title,
    url: link.url,
    target: link.target,
  });
  const host = React.useMemo(() => getHost(link.url), [link.url]);

  const handleHandlePress = React.useCallback(() => {
    if (wasRecentlyDragged()) {
      return;
    }
    onOpenPicker(link);
  }, [link, onOpenPicker]);

  const handleRemovePress = React.useCallback(() => onRemove(link), [link, onRemove]);

  return (
    <View
      className={cn(
        "flex-row items-center gap-1 border-b border-border-soft py-1",
        isDragging && "rounded-xl bg-muted opacity-50",
      )}
      testID="import-link-row"
    >
      <GestureDetector gesture={gesture}>
        <View style={HANDLE_STYLE}>
          <Pressable
            accessibilityHint="누르거나 끌어서 폴더 옮기기"
            accessibilityLabel={`${link.title} 폴더 옮기기`}
            accessibilityRole="button"
            className={cn(
              "items-center justify-center rounded-lg active:bg-muted web:hover:bg-muted",
              isWide ? "h-10 w-8" : "size-11",
            )}
            onPress={handleHandlePress}
          >
            <Icon
              as={GripVertical}
              className="size-4 text-muted-foreground"
            />
          </Pressable>
        </View>
      </GestureDetector>
      <PlusBadge />
      <View className="min-w-0 flex-1 gap-0.5 py-1.5 pl-2">
        <Text
          className="text-sm text-foreground"
          numberOfLines={1}
        >
          {link.title}
        </Text>
        <Text
          className="text-xs text-muted-foreground"
          numberOfLines={1}
        >
          {host}
        </Text>
      </View>
      <Pressable
        accessibilityLabel={`${link.title} 가져오지 않기`}
        accessibilityRole="button"
        className="size-11 items-center justify-center rounded-lg active:bg-muted web:hover:bg-muted"
        onPress={handleRemovePress}
      >
        <Icon
          as={X}
          className="size-4 text-muted-foreground"
        />
      </Pressable>
    </View>
  );
}

const ProposalLinkRow = React.memo(ProposalLinkRowView);

export { ProposalLinkRow, getHost };
