import * as React from "react";
import { type TextInput, View } from "react-native";

import { Checkbox } from "@/components/ui/checkbox";
import { type DateValue } from "@/components/ui/date-picker";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { type TimeValue } from "@/components/ui/time-picker";
import {
  DATE_AND_TIME_REQUIRED_ERROR,
  DATE_REQUIRED_ERROR,
  PAST_REMINDER_ERROR,
  TIME_REQUIRED_ERROR,
  getDraftScheduleGap,
  getLivePastError,
} from "@/features/todos/lib/todo-schedule";
import { formatDraftSchedule } from "@/features/todos/lib/todo-schedule-label";
import { getThemeTokens } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDisplaySettings } from "@/stores/display-settings";

import { TodoScheduleChip } from "./todo-schedule-chip";
import {
  DATE_PLACEHOLDER,
  TIME_PLACEHOLDER,
  type TodoEditorMode,
  type TodoScheduleHost,
  TodoSchedulePanel,
  type WeekdayValue,
} from "./todo-schedule-panel";
import { TODO_TITLE_MAX_LENGTH, useTodoTitleLimit } from "./use-todo-title-limit";

import { X } from "lucide-react-native/icons";

type TodoEditorId = number | string;

const TODO_TITLE_COUNTER_FROM = 40;

const MISSING_SCHEDULE_ERRORS = new Set([
  DATE_AND_TIME_REQUIRED_ERROR,
  DATE_REQUIRED_ERROR,
  TIME_REQUIRED_ERROR,
]);

type TodoEditorProps = {
  id: TodoEditorId;
  className?: string;
  value: string;
  mode: TodoEditorMode;
  selectedWeekdays: WeekdayValue[];
  date: DateValue | null;
  time: TimeValue | null;
  /** Schedule error from the last save attempt (missing date/time, no weekday, past time). */
  validationError?: string | null;
  /** Title error from the last save attempt (a schedule without a title). */
  titleError?: string | null;
  /** A saved action may keep a past reminder; only new or changed ones are refused. */
  allowPast?: boolean;
  /** Shows the done checkbox in front of the row (link detail only). */
  check?: boolean;
  done?: boolean;
  open: boolean;
  /** Moves the focus to the title when it turns true. */
  focusRequested?: boolean;
  /** Locks the whole row while it is being saved. */
  disabled?: boolean;
  /** Layout mode for the date/time pickers — wide opens a Popover, mobile opens a Sheet. */
  pickerMode?: "wide" | "mobile";
  /** The colour right behind the action list, used by the open schedule panel. */
  host?: TodoScheduleHost;
  onChangeTitle: (id: TodoEditorId, value: string) => void;
  onChangeMode: (id: TodoEditorId, value: TodoEditorMode) => void;
  onChangeWeekdays: (id: TodoEditorId, value: WeekdayValue[]) => void;
  onChangeDate: (id: TodoEditorId, value: DateValue) => void;
  onChangeTime: (id: TodoEditorId, value: TimeValue) => void;
  onChangeDone?: (id: TodoEditorId, value: boolean) => void;
  onToggleOpen: (id: TodoEditorId) => void;
  onRemove: (id: TodoEditorId) => void;
};

const TodoEditor = React.memo(TodoEditorBase);

// One action in the editor: a soft face with a ghost title, ×, and the schedule chip
// that opens the schedule panel right below it. Holds no state of its own besides
// the title focus.
function TodoEditorBase({
  id,
  className,
  value,
  mode,
  selectedWeekdays,
  date,
  time,
  validationError = null,
  titleError = null,
  allowPast = false,
  check = false,
  done = false,
  open,
  focusRequested = false,
  disabled = false,
  pickerMode = "wide",
  host = "background",
  onChangeTitle,
  onChangeMode,
  onChangeWeekdays,
  onChangeDate,
  onChangeTime,
  onChangeDone,
  onToggleOpen,
  onRemove,
}: TodoEditorProps) {
  const inputRef = React.useRef<TextInput>(null);
  const [isTitleFocused, setIsTitleFocused] = React.useState(false);
  const accent = useDisplaySettings((state) => state.display.accent);
  const theme = useDisplaySettings((state) => state.display.theme);
  const tokens = React.useMemo(() => getThemeTokens(theme, accent), [accent, theme]);
  const isMobile = pickerMode === "mobile";

  React.useEffect(() => {
    if (focusRequested) {
      inputRef.current?.focus();
    }
  }, [focusRequested]);

  const nowMs = Date.now();
  const draft = { id, title: value, mode, selectedWeekdays, date, time, done, allowPast };
  const schedule = formatDraftSchedule(draft, nowMs);
  const gap = getDraftScheduleGap(draft);
  const scheduleError = validationError ?? getLivePastError(draft, nowMs);
  const isPastError = scheduleError === PAST_REMINDER_ERROR;
  const isMissingError = scheduleError != null && MISSING_SCHEDULE_ERRORS.has(scheduleError);
  const showCounter = !done && value.length >= TODO_TITLE_COUNTER_FROM;
  const isCounterFull = value.length >= TODO_TITLE_MAX_LENGTH;

  const handleChangeTitle = React.useCallback(
    (next: string) => onChangeTitle(id, next),
    [id, onChangeTitle],
  );
  const titleLimit = useTodoTitleLimit(handleChangeTitle, value);

  // A field mounted again to show a cut title keeps the focus.
  React.useEffect(() => {
    if (titleLimit.inputKey > 0) inputRef.current?.focus();
  }, [titleLimit.inputKey]);

  return (
    <View
      className={cn(
        "flex-row gap-3 rounded-[14px] bg-muted/40 px-3.5 py-3",
        check && "pl-[17px]",
        className,
      )}
      testID="todo-editor"
    >
      {check ? (
        <Checkbox
          accessibilityLabel={done ? "완료 취소" : "완료 표시"}
          checked={done}
          className={isMobile ? "mt-[11px]" : "mt-2"}
          shape="round"
          disabled={disabled}
          onCheckedChange={(next) => onChangeDone?.(id, next)}
        />
      ) : null}
      <View className="min-w-0 flex-1 gap-2">
        <View className="flex-row items-center gap-1.5">
          <View className="relative min-w-0 flex-1 justify-center">
            <Input
              key={titleLimit.inputKey}
              ref={inputRef}
              accessibilityLabel="액션 제목"
              aria-invalid={titleError != null}
              className={cn(
                "-ml-2 border-transparent bg-transparent px-2 font-semibold shadow-none dark:bg-transparent",
                isMobile ? "h-10 text-base" : "h-[34px] text-[13px]",
                // The hover border would cover the focus border, so it shows only unfocused.
                isTitleFocused ? "bg-card dark:bg-card" : "web:hover:border-input",
                titleError != null && "border-destructive/70 web:hover:border-destructive/70",
                showCounter && "pr-14",
                // iOS reuses native text inputs and keeps a strike in the reused one's
                // placeholder, so the done title is struck through on web only.
                done && "text-muted-foreground web:line-through",
              )}
              editable={!disabled}
              maxLength={titleLimit.maxLength}
              placeholder="액션 제목"
              style={titleError != null ? { borderColor: tokens.destructive } : undefined}
              value={value}
              onBlur={() => setIsTitleFocused(false)}
              onChangeText={titleLimit.handleChangeText}
              onFocus={() => setIsTitleFocused(true)}
            />
            {showCounter ? (
              <Text
                className={cn(
                  "pointer-events-none absolute right-2 text-xs tabular-nums text-muted-foreground",
                  isCounterFull && "font-bold text-primary",
                )}
                testID="todo-editor-title-counter"
              >
                {`${value.length}/${TODO_TITLE_MAX_LENGTH}`}
              </Text>
            ) : null}
          </View>
          <IconButton
            accessibilityLabel="액션 삭제"
            disabled={disabled}
            icon={X}
            size="sm"
            variant="ghost"
            className="size-8"
            onPress={() => onRemove(id)}
          />
        </View>
        {titleError ? (
          <Text className="-mt-1 text-xs font-medium text-destructive">{titleError}</Text>
        ) : null}

        {done ? null : (
          <>
            <TodoScheduleChip
              repeat={mode === "recurring"}
              schedule={schedule}
              gap={gap}
              open={open}
              invalid={scheduleError != null}
              disabled={disabled}
              testID="todo-schedule-chip"
              onPress={() => onToggleOpen(id)}
            />
            {open ? (
              <TodoSchedulePanel
                mode={mode}
                selectedWeekdays={selectedWeekdays}
                date={date}
                time={time}
                error={scheduleError}
                invalidDate={isMissingError && date == null}
                invalidTime={(isMissingError && time == null) || isPastError}
                host={host}
                pickerMode={pickerMode}
                disabled={disabled}
                onModeChange={(next) => onChangeMode(id, next)}
                onSelectedWeekdaysChange={(next) => onChangeWeekdays(id, next)}
                onDateChange={(next) => onChangeDate(id, next)}
                onTimeChange={(next) => onChangeTime(id, next)}
              />
            ) : scheduleError ? (
              <Text className="text-xs font-medium text-destructive">{scheduleError}</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

export {
  DATE_PLACEHOLDER,
  TIME_PLACEHOLDER,
  TODO_TITLE_COUNTER_FROM,
  TODO_TITLE_MAX_LENGTH,
  TodoEditor,
};
export type { TodoEditorId, TodoEditorMode, TodoEditorProps, WeekdayValue };
