import * as React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";

import { Button } from "@/components/ui/button";
import {
  DatePicker,
  type DateValue,
  dateValueToDate,
  todayDateValue,
} from "@/components/ui/date-picker";
import { DatePickerOverlay, TimePickerOverlay } from "@/components/ui/date-time-picker-overlay";
import { Icon as UiIcon } from "@/components/ui/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  usePopoverContext,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/text";
import { TimePicker, type TimeValue } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";

import { CalendarDays, Clock3 } from "lucide-react-native/icons";

type Mode = "wide" | "mobile";

type CommonProps = {
  mode: Mode;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

type DateTimePickerButtonProps = CommonProps &
  (
    | {
        kind: "date";
        value: DateValue | null;
        onChange: (next: DateValue) => void;
        minYear?: number;
        maxYear?: number;
      }
    | {
        kind: "time";
        value: TimeValue | null;
        onChange: (next: TimeValue) => void;
      }
  );

const DEFAULT_TIME: TimeValue = { hour: 9, minute: 0 };
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
// Rough height of the picker popover (title, wheels, buttons). When the space under
// the button is smaller and the space above is larger, the popover opens upward.
const POPOVER_ESTIMATED_HEIGHT = 360;

function defaultPlaceholder(kind: "date" | "time") {
  return kind === "date" ? "년-월-일" : "오전 9:00";
}

// `11월 20일 (금)`.
function formatButtonDateLabel(value: DateValue) {
  const weekday = WEEKDAY_LABELS[dateValueToDate(value).getDay()];
  return `${value.month}월 ${value.day}일 (${weekday})`;
}

// `오전 9:00`: twelve-hour, the hour without a leading zero.
function formatButtonTimeLabel({ hour, minute }: TimeValue) {
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${hour12}:${minute.toString().padStart(2, "0")}`;
}

function formatLabel(
  kind: "date" | "time",
  value: DateValue | TimeValue | null,
  placeholder: string,
) {
  if (!value) return placeholder;
  return kind === "date"
    ? formatButtonDateLabel(value as DateValue)
    : formatButtonTimeLabel(value as TimeValue);
}

function buttonClassName(extra?: string) {
  return cn(
    "h-10 flex-1 flex-row items-center justify-start gap-2 rounded-md border border-input bg-background px-3 shadow-sm shadow-black/5",
    "web:outline-none web:focus-visible:ring-[3px] web:focus-visible:ring-ring",
    extra,
  );
}

function ButtonContent({
  kind,
  label,
  filled,
}: {
  kind: "date" | "time";
  label: string;
  filled: boolean;
}) {
  return (
    <>
      <UiIcon
        as={kind === "date" ? CalendarDays : Clock3}
        size={15}
        className="shrink-0 text-muted-foreground"
      />
      <Text
        className={cn("min-w-0 flex-1", labelClassName(filled))}
        numberOfLines={1}
      >
        {label}
      </Text>
    </>
  );
}

// The side with room for the popover: below the button unless the space there is
// short and the space above is larger.
function pickPopoverSide(
  triggerY: number,
  triggerHeight: number,
  windowHeight: number,
): "top" | "bottom" {
  const spaceBelow = windowHeight - (triggerY + triggerHeight);
  return spaceBelow < POPOVER_ESTIMATED_HEIGHT && triggerY > spaceBelow ? "top" : "bottom";
}

function useAutoPopoverSide() {
  const anchorRef = React.useRef<View>(null);
  const { height: windowHeight } = useWindowDimensions();
  const [side, setSide] = React.useState<"top" | "bottom">("bottom");

  const handlePressIn = React.useCallback(() => {
    // The web popover already flips itself when there is no room.
    if (process.env.EXPO_OS === "web") return;
    anchorRef.current?.measureInWindow((_x, y, _width, height) => {
      setSide(pickPopoverSide(y, height, windowHeight));
    });
  }, [windowHeight]);

  return { anchorRef, side, handlePressIn };
}

function labelClassName(filled: boolean) {
  return cn("text-sm", filled ? "text-foreground" : "text-muted-foreground");
}

/**
 * Wheel picker + 취소/확인 footer inside a Popover. Uses `usePopoverContext`
 * to close, so the surrounding `<Popover>` can stay uncontrolled (the trigger
 * opens it, cancel/outside-click close it).
 */
function WidePopoverBody(props: {
  kind: "date" | "time";
  value: DateValue | TimeValue | null;
  onConfirm: (next: DateValue | TimeValue) => void;
  minYear?: number;
  maxYear?: number;
}) {
  const { kind, value, onConfirm, minYear, maxYear } = props;
  const popover = usePopoverContext();
  const initial = React.useMemo<DateValue | TimeValue>(
    () => value ?? (kind === "date" ? todayDateValue() : DEFAULT_TIME),
    [kind, value],
  );
  const [draft, setDraft] = React.useState<DateValue | TimeValue>(initial);

  const openRef = React.useRef(popover.open);
  React.useEffect(() => {
    if (popover.open && !openRef.current) {
      setDraft(initial);
    }
    openRef.current = popover.open;
  }, [initial, popover.open]);

  return (
    <View className="gap-3">
      <Text className="text-base font-semibold text-foreground">
        {kind === "date" ? "날짜 선택" : "시간선택"}
      </Text>
      <View className="-mx-1 border-b border-border" />
      {kind === "date" ? (
        <DatePicker
          value={draft as DateValue}
          onChange={(next) => setDraft(next)}
          minYear={minYear}
          maxYear={maxYear}
        />
      ) : (
        <TimePicker
          value={draft as TimeValue}
          onChange={(next) => setDraft(next)}
        />
      )}
      <View className="-mx-1 border-b border-border" />
      <View className="flex-row gap-2">
        <Button
          className="h-10 flex-1 rounded-xl"
          variant="outline"
          onPress={() => popover.onOpenChange(false)}
        >
          <Text className="text-sm font-semibold">취소</Text>
        </Button>
        <Button
          className="h-10 flex-1 rounded-xl"
          onPress={() => {
            onConfirm(draft);
            popover.onOpenChange(false);
          }}
        >
          <Text className="text-sm font-semibold">확인</Text>
        </Button>
      </View>
    </View>
  );
}

/**
 * Pressable that opens a Popover anchored to itself. Used on wide layouts on
 * all platforms, and on every layout on web (where touch dragging inside a
 * BottomSheetModal doesn't reliably reach a nested ScrollView, so the
 * Sheet-based variant can't be driven by gestures).
 */
function PopoverVariant(props: DateTimePickerButtonProps) {
  const { kind, value, className, disabled } = props;
  const placeholder = props.placeholder ?? defaultPlaceholder(kind);
  const label = formatLabel(kind, value, placeholder);
  const autoSide = useAutoPopoverSide();

  // The Popover root renders a wrapping View. Without h-10 here the row's
  // stretch alignment would collapse the inner button to its text height
  // (CSS quirk: `height` on a flex child doesn't contribute to the parent's
  // intrinsic cross size, only `min-height` would). flex-1 makes the button
  // fill its row slot horizontally.
  return (
    <Popover className="h-10 flex-1">
      <View
        ref={autoSide.anchorRef}
        className="h-10 flex-1 flex-row"
      >
        <PopoverTrigger asChild>
          <Pressable
            className={buttonClassName(className)}
            disabled={disabled}
            onPressIn={autoSide.handlePressIn}
          >
            <ButtonContent
              filled={value != null}
              kind={kind}
              label={label}
            />
          </Pressable>
        </PopoverTrigger>
      </View>
      <PopoverContent
        align="start"
        side={autoSide.side}
        className="w-80 p-4"
      >
        <WidePopoverBody
          kind={kind}
          value={value}
          onConfirm={(next) =>
            kind === "date" ? props.onChange(next as DateValue) : props.onChange(next as TimeValue)
          }
          minYear={kind === "date" ? props.minYear : undefined}
          maxYear={kind === "date" ? props.maxYear : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Pressable that opens a bottom sheet picker. Used on native mobile layouts
 * where a sheet is the natural touch UX.
 */
function SheetVariant(props: DateTimePickerButtonProps) {
  const { kind, value, className, disabled } = props;
  const placeholder = props.placeholder ?? defaultPlaceholder(kind);
  const label = formatLabel(kind, value, placeholder);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Pressable
        className={buttonClassName(className)}
        disabled={disabled}
        onPress={() => setOpen(true)}
      >
        <ButtonContent
          filled={value != null}
          kind={kind}
          label={label}
        />
      </Pressable>
      {kind === "date" ? (
        <DatePickerOverlay
          mode="mobile"
          open={open}
          value={value ?? todayDateValue()}
          minYear={props.minYear}
          maxYear={props.maxYear}
          onCancel={() => setOpen(false)}
          onConfirm={(next) => {
            props.onChange(next);
            setOpen(false);
          }}
        />
      ) : (
        <TimePickerOverlay
          mode="mobile"
          open={open}
          value={value ?? DEFAULT_TIME}
          onCancel={() => setOpen(false)}
          onConfirm={(next) => {
            props.onChange(next);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export type { DateTimePickerButtonProps, Mode };
export { PopoverVariant, SheetVariant, pickPopoverSide };
