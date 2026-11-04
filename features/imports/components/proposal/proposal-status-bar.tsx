import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { ProposalStatusLine } from "../../lib/proposal-state";
import { getStatusMessage } from "./proposal-copy";

import { CircleCheck, Info, Undo2, X } from "lucide-react-native/icons";

type ProposalStatusBarProps = {
  line: ProposalStatusLine;
  isWide: boolean;
  onUndo: () => void;
  onDismiss: () => void;
};

function ProposalStatusBar({ line, isWide, onUndo, onDismiss }: ProposalStatusBarProps) {
  const { message, undoLabel } = getStatusMessage(line);
  const depth = line.kind === "change" ? line.depth : 0;
  return (
    <View
      accessibilityLiveRegion="polite"
      aria-live="polite"
      className={cn(
        "shrink-0 flex-row items-center rounded-xl bg-muted",
        isWide ? "gap-2 py-1.5 pl-3.5 pr-1.5" : "gap-0.5 pl-3.5",
      )}
      testID="import-status-bar"
    >
      {isWide ? (
        <Icon
          as={undoLabel ? CircleCheck : Info}
          className="size-4 shrink-0 text-muted-foreground"
        />
      ) : null}
      <Text
        className="min-w-0 flex-1 py-1 text-[13px] text-foreground"
        numberOfLines={isWide ? undefined : 1}
      >
        {message}
      </Text>
      {undoLabel ? (
        <Button
          accessibilityLabel={`${undoLabel}, 되돌릴 수 있는 변경 ${depth}개`}
          className={cn(
            "shrink-0 flex-row gap-1.5 self-center px-2.5",
            isWide ? "h-9 sm:h-9" : "h-11 sm:h-11",
          )}
          size="sm"
          variant="ghost"
          onPress={onUndo}
        >
          <Icon
            as={Undo2}
            className="size-4 text-foreground"
          />
          <Text className="text-[13px] font-semibold text-foreground">{undoLabel}</Text>
          <View
            aria-hidden
            className="h-5 min-w-5 items-center justify-center rounded-full border border-border bg-card px-1.5"
          >
            <Text className="text-xs font-semibold tabular-nums text-muted-foreground">
              {depth}
            </Text>
          </View>
        </Button>
      ) : null}
      <Pressable
        accessibilityLabel="알림 닫기"
        accessibilityRole="button"
        className={cn(
          "shrink-0 items-center justify-center rounded-lg active:bg-accent web:hover:bg-accent",
          isWide ? "size-9" : "size-11",
        )}
        onPress={onDismiss}
      >
        <Icon
          as={X}
          className="size-4 text-muted-foreground"
        />
      </Pressable>
    </View>
  );
}

export { ProposalStatusBar };
