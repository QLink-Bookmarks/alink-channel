import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import type { ProposalChange } from "../../lib/proposal-state";
import { getChangeMessage } from "./proposal-copy";

import { CircleCheck, Info, X } from "lucide-react-native/icons";

type ProposalStatusBarProps = {
  change: ProposalChange;
  onUndo: () => void;
  onDismiss: () => void;
};

function ProposalStatusBar({ change, onUndo, onDismiss }: ProposalStatusBarProps) {
  const { message, undoLabel } = getChangeMessage(change);
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      className="flex-row items-center gap-2 rounded-xl bg-muted py-1.5 pl-3.5 pr-1.5"
    >
      <Icon
        as={undoLabel ? CircleCheck : Info}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <Text className="min-w-0 flex-1 py-1 text-[13px] text-foreground">{message}</Text>
      {undoLabel ? (
        <Button
          className="h-9 shrink-0 px-3"
          size="sm"
          variant="ghost"
          onPress={onUndo}
        >
          <Text className="text-[13px] font-semibold text-foreground">{undoLabel}</Text>
        </Button>
      ) : null}
      <Pressable
        accessibilityLabel="알림 닫기"
        accessibilityRole="button"
        className="size-9 shrink-0 items-center justify-center rounded-lg active:bg-accent web:hover:bg-accent"
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
