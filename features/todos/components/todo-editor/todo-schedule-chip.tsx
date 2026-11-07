import * as React from "react";
import { Pressable } from "react-native";

import { Icon } from "@/components/ui/icon";
import { PressableHitSlopArea } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import type { DraftScheduleGap } from "@/features/todos/lib/todo-schedule";
import type { TodoSchedule } from "@/features/todos/lib/todo-schedule-label";
import { cn } from "@/lib/utils";

import { AlarmClock, ChevronDown, ChevronUp, Repeat } from "lucide-react-native/icons";

const NO_SCHEDULE_LABEL = "알림 없음";

const GAP_LABEL: Record<DraftScheduleGap, string> = {
  date: "날짜 미정",
  time: "시간 미정",
  weekdays: "요일 미정",
};

const CHIP_HIT_SLOP = { top: 6, bottom: 6, left: 2, right: 2 };

type TodoScheduleChipProps = {
  repeat: boolean;
  schedule: TodoSchedule | null;
  gap: DraftScheduleGap | null;
  open: boolean;
  invalid?: boolean;
  disabled?: boolean;
  testID?: string;
  onPress: () => void;
};

function getChipLabel(schedule: TodoSchedule | null, gap: DraftScheduleGap | null): string {
  if (gap) return GAP_LABEL[gap];
  return schedule?.label ?? NO_SCHEDULE_LABEL;
}

// The schedule line under an action title: "알림 없음", a missing field, or the shared
// schedule label. Pressing it opens and closes the schedule panel right below.
function TodoScheduleChip({
  repeat,
  schedule,
  gap,
  open,
  invalid = false,
  disabled = false,
  testID,
  onPress,
}: TodoScheduleChipProps) {
  const label = getChipLabel(schedule, gap);
  // Red only for an error: a saved action may still read "(지남)" without being refused.
  const isSet = gap == null && schedule != null && schedule.kind !== "none";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === NO_SCHEDULE_LABEL ? label : `알림 ${label}`}
      accessibilityState={{ expanded: open, disabled }}
      aria-expanded={open}
      className={cn(
        "relative h-8 max-w-full flex-row items-center gap-1.5 self-start rounded-[10px] border border-border bg-card px-2.5",
        "web:outline-none web:focus-visible:ring-[3px] web:focus-visible:ring-ring",
        open && "border-primary",
        invalid && "border-destructive/70",
        disabled && "opacity-50",
      )}
      disabled={disabled}
      hitSlop={CHIP_HIT_SLOP}
      testID={testID}
      onPress={onPress}
    >
      <PressableHitSlopArea hitSlop={CHIP_HIT_SLOP} />
      <Icon
        as={repeat ? Repeat : AlarmClock}
        size={14}
        className={cn(
          "text-muted-foreground",
          isSet && "text-primary",
          invalid && "text-destructive",
        )}
      />
      <Text
        numberOfLines={1}
        className={cn(
          "shrink text-xs font-semibold text-muted-foreground",
          isSet && "text-foreground",
          invalid && "text-destructive",
        )}
      >
        {label}
      </Text>
      <Icon
        as={open ? ChevronUp : ChevronDown}
        size={13}
        className={invalid ? "text-destructive" : "text-muted-foreground"}
      />
    </Pressable>
  );
}

export { GAP_LABEL, NO_SCHEDULE_LABEL, TodoScheduleChip };
export type { TodoScheduleChipProps };
