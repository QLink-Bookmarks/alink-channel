import * as React from "react";
import { View } from "react-native";

import { type DateValue } from "@/components/ui/date-picker";
import { DateTimePickerButton } from "@/components/ui/date-time-picker-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { type TimeValue } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

type TodoEditorMode = "none" | "time" | "recurring";
type WeekdayValue = (typeof weekdayOptions)[number]["value"];
type TodoScheduleHost = "card" | "background" | "surface";

const weekdayOptions = [
  { label: "월", value: "mon" },
  { label: "화", value: "tue" },
  { label: "수", value: "wed" },
  { label: "목", value: "thu" },
  { label: "금", value: "fri" },
  { label: "토", value: "sat" },
  { label: "일", value: "sun" },
] as const;

const modeOptions = [
  { label: "알림 없음", value: "none" },
  { label: "한 번", value: "time" },
  { label: "반복", value: "recurring" },
];

const DATE_PLACEHOLDER = "날짜 선택";
const TIME_PLACEHOLDER = "시간 선택";
const REPEAT_UNTIL_HELP = "이 날까지 알려요";

// The open panel takes the colour right behind the action list, so the list only
// has two tones: that background and the soft action face.
const hostClassName: Record<TodoScheduleHost, string> = {
  card: "bg-card",
  background: "bg-background",
  surface: "bg-surface",
};

const invalidFieldClassName = "border-destructive/70";

type TodoSchedulePanelProps = {
  mode: TodoEditorMode;
  selectedWeekdays: WeekdayValue[];
  date: DateValue | null;
  time: TimeValue | null;
  /** The schedule error shown under the fields. */
  error?: string | null;
  /** Which fields to outline in red. */
  invalidDate?: boolean;
  invalidTime?: boolean;
  host?: TodoScheduleHost;
  pickerMode?: "wide" | "mobile";
  disabled?: boolean;
  onModeChange: (next: TodoEditorMode) => void;
  onSelectedWeekdaysChange: (next: WeekdayValue[]) => void;
  onDateChange: (next: DateValue) => void;
  onTimeChange: (next: TimeValue) => void;
};

function FieldLabel({ children }: { children: string }) {
  return <Text className="text-xs font-medium text-muted-foreground">{children}</Text>;
}

// The schedule panel under a chip: 알림 없음 / 한 번 / 반복. A one-time reminder reads
// date then time; a repeat reads weekdays, time, then its end date.
function TodoSchedulePanel({
  mode,
  selectedWeekdays,
  date,
  time,
  error,
  invalidDate = false,
  invalidTime = false,
  host = "background",
  pickerMode = "wide",
  disabled = false,
  onModeChange,
  onSelectedWeekdaysChange,
  onDateChange,
  onTimeChange,
}: TodoSchedulePanelProps) {
  const timeField = (
    <View className="flex-1 gap-1.5">
      <FieldLabel>시간</FieldLabel>
      <View className="h-10 flex-row">
        <DateTimePickerButton
          mode={pickerMode}
          kind="time"
          disabled={disabled}
          placeholder={TIME_PLACEHOLDER}
          className={cn(invalidTime && invalidFieldClassName)}
          value={time}
          onChange={onTimeChange}
        />
      </View>
    </View>
  );

  return (
    <View
      className={cn(
        "-mt-1 gap-3 rounded-[10px] p-3",
        hostClassName[host],
        disabled && "opacity-50",
      )}
      pointerEvents={disabled ? "none" : "auto"}
      testID="todo-schedule-panel"
    >
      <SegmentedControl
        accessibilityLabel="알림"
        value={mode}
        block
        disabled={disabled}
        variant="track"
        labelClassName="text-[13px] font-semibold"
        options={modeOptions}
        onValueChange={(next) => onModeChange(next as TodoEditorMode)}
      />

      {mode === "time" ? (
        <View className="flex-row gap-2.5">
          <View className="flex-1 gap-1.5">
            <FieldLabel>날짜</FieldLabel>
            <View className="h-10 flex-row">
              <DateTimePickerButton
                mode={pickerMode}
                kind="date"
                disabled={disabled}
                placeholder={DATE_PLACEHOLDER}
                className={cn(invalidDate && invalidFieldClassName)}
                value={date}
                onChange={onDateChange}
              />
            </View>
          </View>
          {timeField}
        </View>
      ) : null}

      {mode === "recurring" ? (
        <>
          <View className="gap-1.5">
            <FieldLabel>요일</FieldLabel>
            <SegmentedControl
              accessibilityLabel="요일"
              value={selectedWeekdays}
              block
              disabled={disabled}
              selectionMode="multiple"
              variant="chips"
              labelClassName="text-[13px] font-semibold"
              options={weekdayOptions.map((weekday) => ({
                label: weekday.label,
                value: weekday.value,
              }))}
              onValueChange={(next) => onSelectedWeekdaysChange(next as WeekdayValue[])}
            />
          </View>
          <View className="flex-row gap-2.5">
            {timeField}
            <View className="flex-1 gap-1.5">
              <FieldLabel>종료일</FieldLabel>
              <View className="h-10 flex-row">
                <DateTimePickerButton
                  mode={pickerMode}
                  kind="date"
                  disabled={disabled}
                  placeholder={DATE_PLACEHOLDER}
                  className={cn(invalidDate && invalidFieldClassName)}
                  value={date}
                  onChange={onDateChange}
                />
              </View>
              <Text className="text-xs text-muted-foreground">{REPEAT_UNTIL_HELP}</Text>
            </View>
          </View>
        </>
      ) : null}

      {error ? <Text className="text-xs font-medium text-destructive">{error}</Text> : null}
    </View>
  );
}

export { DATE_PLACEHOLDER, TIME_PLACEHOLDER, TodoSchedulePanel, weekdayOptions };
export type { TodoEditorMode, TodoSchedulePanelProps, TodoScheduleHost, WeekdayValue };
