import * as React from "react";
import { View } from "react-native";

import { type DateValue } from "@/components/ui/date-picker";
import { DateTimePickerButton } from "@/components/ui/date-time-picker-button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { type TimeValue, formatTimeLabel } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

import { X } from "lucide-react-native/icons";

type TodoEditorMode = "none" | "time" | "recurring";
type TodoEditorVisibility = "public" | "private";
type WeekdayValue = (typeof weekdayOptions)[number]["value"];

const weekdayOptions = [
  { label: "월", value: "mon" },
  { label: "화", value: "tue" },
  { label: "수", value: "wed" },
  { label: "목", value: "thu" },
  { label: "금", value: "fri" },
  { label: "토", value: "sat" },
  { label: "일", value: "sun" },
] as const;

const allWeekdayValues = weekdayOptions.map((weekday) => weekday.value);
const weekdayLabelByValue = Object.fromEntries(
  weekdayOptions.map((weekday) => [weekday.value, weekday.label]),
) as Record<WeekdayValue, string>;
const weekdaySortOrder: Record<WeekdayValue, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const DATE_PLACEHOLDER = "년-월-일";
const TIME_PLACEHOLDER = "오전 09:00";

function formatRecurringPattern(selectedWeekdays: WeekdayValue[], timeLabel: string) {
  const normalizedWeekdays = Array.from(new Set(selectedWeekdays)).sort(
    (left, right) => weekdaySortOrder[left] - weekdaySortOrder[right],
  );

  if (normalizedWeekdays.length === allWeekdayValues.length) {
    return `매일 ${timeLabel}`;
  }

  const isWeekdayOnly =
    normalizedWeekdays.length === 5 &&
    normalizedWeekdays.every((weekday) => ["mon", "tue", "wed", "thu", "fri"].includes(weekday));

  if (isWeekdayOnly) {
    return `평일 ${timeLabel}`;
  }

  const isWeekendOnly =
    normalizedWeekdays.length === 2 &&
    normalizedWeekdays.includes("sat") &&
    normalizedWeekdays.includes("sun");

  if (isWeekendOnly) {
    return `주말 ${timeLabel}`;
  }

  const weekdayLabel = normalizedWeekdays.map((weekday) => weekdayLabelByValue[weekday]).join(", ");

  return `${weekdayLabel} ${timeLabel}`;
}

const TodoEditor = React.memo(TodoEditorBase);

function TodoEditorBase({
  className,
  value,
  index = 1,
  mode,
  selectedWeekdays = allWeekdayValues,
  date = null,
  time = null,
  validationError,
  showPastWarning,
  onChangeText,
  onModeChange,
  onSelectedWeekdaysChange,
  onRemove,
  pickerMode = "wide",
  onDateChange,
  onTimeChange,
}: {
  className?: string;
  index?: number;
  value: string;
  mode: TodoEditorMode;
  selectedWeekdays?: WeekdayValue[];
  date?: DateValue | null;
  time?: TimeValue | null;
  /** Inline error rendered under the date/time row when the user attempts save. */
  validationError?: string | null;
  /** Non-blocking hint when the chosen date+time is already in the past. */
  showPastWarning?: boolean;
  visibility?: TodoEditorVisibility;
  onChangeText?: (value: string) => void;
  onModeChange?: (value: TodoEditorMode) => void;
  onSelectedWeekdaysChange?: (value: WeekdayValue[]) => void;
  onVisibilityChange?: (value: TodoEditorVisibility) => void;
  onRemove?: () => void;
  /** Layout mode for the picker — wide opens a Popover, mobile opens a Sheet. */
  pickerMode?: "wide" | "mobile";
  onDateChange?: (next: DateValue) => void;
  onTimeChange?: (next: TimeValue) => void;
}) {
  const timeLabel = time ? formatTimeLabel(time) : TIME_PLACEHOLDER;
  const recurringPattern = formatRecurringPattern(selectedWeekdays, timeLabel);

  return (
    <View
      className={cn(
        "gap-3 rounded-2xl border border-border bg-surface p-3 shadow-qlink-sm",
        className,
      )}
    >
      <View className="flex-row items-start gap-3">
        <View className="size-8 items-center justify-center rounded-lg bg-muted-foreground">
          <Text className="text-sm font-semibold text-background">{index}</Text>
        </View>
        <View className="flex-1">
          <Input
            className="h-10 text-base"
            value={value}
            onChangeText={onChangeText}
            placeholder="액션 제목"
          />
        </View>
        {onRemove ? (
          <IconButton
            className="mt-0.5"
            icon={X}
            size="sm"
            onPress={onRemove}
          />
        ) : null}
      </View>
      <SegmentedControl
        value={mode}
        block
        className="border-transparent bg-transparent p-0"
        variant="chips"
        options={[
          { label: "시간 없음", value: "none" },
          { label: "시간 선택", value: "time" },
          { label: "반복 알림", value: "recurring" },
        ]}
        onValueChange={(next) => onModeChange?.(next as TodoEditorMode)}
      />

      {mode === "recurring" ? (
        <View className="gap-3">
          <View className="gap-2">
            <Text className="text-sm font-semibold text-muted-foreground">반복 요일</Text>
            <Text className="text-sm font-medium text-foreground">{recurringPattern}</Text>
          </View>
          <SegmentedControl
            value={selectedWeekdays}
            block
            className="flex-wrap"
            selectionMode="multiple"
            variant="chips"
            options={weekdayOptions.map((weekday) => ({
              label: weekday.label,
              value: weekday.value,
            }))}
            onValueChange={(nextValue) => onSelectedWeekdaysChange?.(nextValue as WeekdayValue[])}
          />
        </View>
      ) : null}

      {mode !== "none" ? (
        <View className="gap-2">
          <View className="flex-row gap-3">
            <DateTimePickerButton
              mode={pickerMode}
              kind="time"
              value={time}
              onChange={(next) => onTimeChange?.(next)}
            />
            <DateTimePickerButton
              mode={pickerMode}
              kind="date"
              value={date}
              onChange={(next) => onDateChange?.(next)}
            />
          </View>
          {validationError ? (
            <Text className="text-xs font-medium text-destructive">{validationError}</Text>
          ) : null}
          {showPastWarning ? (
            <Text className="text-xs font-medium text-muted-foreground">
              과거 일자는 알림 발송은 되지 않아요
            </Text>
          ) : null}
        </View>
      ) : null}

      {mode === "recurring" ? (
        <View className="rounded-md bg-muted px-4 py-2.5">
          <Text className="text-sm font-semibold text-muted-foreground">📌 {recurringPattern}</Text>
        </View>
      ) : null}
    </View>
  );
}

export { DATE_PLACEHOLDER, TIME_PLACEHOLDER, TodoEditor };
export type { TodoEditorMode, TodoEditorVisibility, WeekdayValue };
