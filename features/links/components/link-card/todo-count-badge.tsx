import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TodoCountSummary } from "@/features/home/lib/link-card-mapper";
import { cn } from "@/lib/utils";

import { AlarmClock, Check, CircleAlert, SquareCheck } from "lucide-react-native/icons";

function CountItem({
  icon,
  count,
  tone,
}: {
  icon: React.ComponentProps<typeof Icon>["as"];
  count?: number;
  tone: "default" | "dueSoon" | "overdue";
}) {
  return (
    <View className="flex-row items-center gap-[3px]">
      <Icon
        as={icon}
        size={13}
        className={cn(
          tone === "default" && "text-muted-foreground",
          tone === "dueSoon" && "text-warning",
          tone === "overdue" && "text-destructive",
        )}
      />
      {count != null ? (
        <Text
          className={cn(
            "text-[11px] font-semibold",
            tone === "default" && "text-muted-foreground",
            tone === "dueSoon" && "text-foreground",
            tone === "overdue" && "text-destructive",
          )}
        >
          {count}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Linked todo counts on a link card: normal, due soon (reminder within 24 hours) and overdue,
 * each as an icon and a number; a kind with zero is hidden. All done shows a single check.
 * The same sentence is the tooltip and the accessible name.
 */
function TodoCountBadge({
  className,
  summary,
  onPress,
}: {
  className?: string;
  summary: TodoCountSummary;
  /** The counts sit inside the card body, so pressing them does what the body does. */
  onPress?: () => void;
}) {
  const counts = (
    <>
      {summary.allDone ? (
        <CountItem
          icon={Check}
          tone="default"
        />
      ) : (
        <>
          {summary.normal > 0 ? (
            <CountItem
              icon={SquareCheck}
              count={summary.normal}
              tone="default"
            />
          ) : null}
          {summary.dueSoon > 0 ? (
            <CountItem
              icon={AlarmClock}
              count={summary.dueSoon}
              tone="dueSoon"
            />
          ) : null}
          {summary.overdue > 0 ? (
            <CountItem
              icon={CircleAlert}
              count={summary.overdue}
              tone="overdue"
            />
          ) : null}
        </>
      )}
    </>
  );

  // The tooltip is a hover affordance. On native a tap on the counts belongs to the card
  // (it opens the detail), so the counts carry only the accessible name there.
  if (process.env.EXPO_OS !== "web") {
    return (
      <View
        accessible
        accessibilityLabel={summary.label}
        className={cn("flex-row items-center gap-2", className)}
        testID="todo-count-badge"
      >
        {counts}
      </View>
    );
  }

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger
        accessibilityLabel={summary.label}
        className={cn("flex-row items-center gap-2", className)}
        testID="todo-count-badge"
        onPress={onPress}
      >
        {counts}
      </TooltipTrigger>
      <TooltipContent>
        <Text>{summary.label}</Text>
      </TooltipContent>
    </Tooltip>
  );
}

export { TodoCountBadge };
