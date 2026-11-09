import { Pressable, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getDomainFromUrl } from "@/features/home/lib/link-card-mapper";
import { LinkThumbnail } from "@/features/links/components/link-thumbnail/link-thumbnail";
import { cn } from "@/lib/utils";

import { getTodoCardLabel, getTodoDoneToggleLabel } from "../../lib/todo-accessibility-label";
import type { TodoScheduleKind } from "../../lib/todo-schedule-label";

import { AlarmClock, Repeat, Users } from "lucide-react-native/icons";

const SHARED_LABEL = "공유 액션";

// 16px checkbox → 40×40 press area on web (native keeps the checkbox's own hitSlop).
const CHECKBOX_WEB_HIT_SLOP = 12;

// Marks the card's press target so the card can draw the focus ring when it is focused (web).
const cardPressDataProps =
  process.env.EXPO_OS === "web"
    ? ({ dataSet: { cardPress: "true" } } as Record<string, unknown>)
    : null;

type TodoItemVariant = "inline" | "row" | "display";

type TodoItemProps = {
  className?: string;
  variant?: TodoItemVariant;
  text: string;
  done?: boolean;
  /** Pre-formatted schedule line (e.g. "06/04 09:36 (지남)" or "매주 월·목 오전 8:00"). */
  reminderLabel?: string | null;
  /** Picks the schedule icon on the display variant: an alarm clock or a repeat arrow. */
  scheduleKind?: TodoScheduleKind;
  overdue?: boolean;
  /** Source-link URL — when set on the display variant, renders the linked-link row. */
  linkUrl?: string | null;
  /** Source-link title — paired with the domain in the linked-link row. */
  linkTitle?: string | null;
  /** Source-link representative image for the linked-link row's small image cell. */
  linkThumbnailUrl?: string | null;
  /** Source-link favicon, used only when there is no representative image. */
  linkFaviconUrl?: string | null;
  /** Adds a "👥 공유 액션" badge under the reminder. */
  isShared?: boolean;
  /** Legacy free-form badge slot (used by the existing inline/row callers). */
  badge?: string;
  visibility?: "public" | "private";
  /** Display variant: what pressing the card does, read last in its name (e.g. `고치기`). */
  pressHint?: string;
  onToggle?: (done: boolean) => void;
  onPress?: () => void;
};

function ReminderLabel({
  label,
  kind,
  overdue,
}: {
  label: string;
  kind: TodoScheduleKind;
  overdue?: boolean;
}) {
  return (
    <View
      className="flex-row items-center gap-1"
      testID="todo-item-reminder"
    >
      <View
        className="size-3"
        testID={kind === "repeat" ? "todo-item-reminder-repeat" : "todo-item-reminder-once"}
      >
        <Icon
          as={kind === "repeat" ? Repeat : AlarmClock}
          size={12}
          className={overdue ? "text-destructive" : "text-primary"}
        />
      </View>
      <Text
        className={cn(
          "min-w-0 shrink text-[11px] font-semibold",
          overdue ? "text-destructive" : "text-muted-foreground",
        )}
        testID="todo-item-reminder-text"
      >
        {label}
      </Text>
    </View>
  );
}

function TodoItem({
  className,
  variant = "row",
  text,
  done,
  reminderLabel,
  scheduleKind = "once",
  overdue,
  linkUrl,
  linkTitle,
  linkThumbnailUrl,
  linkFaviconUrl,
  isShared,
  badge,
  visibility,
  pressHint,
  onToggle,
  onPress,
}: TodoItemProps) {
  if (variant === "display") {
    const domain = linkUrl ? getDomainFromUrl(linkUrl) : null;
    const hasLinkRow = Boolean(linkUrl || linkTitle);
    const isOverdue = Boolean(overdue && !done);
    const scheduleLabel = done ? null : reminderLabel;
    const linkLabel = [domain, linkTitle].filter(Boolean).join(" · ");
    const cardLabel = getTodoCardLabel(text, [
      scheduleLabel,
      isShared && SHARED_LABEL,
      linkLabel,
      pressHint,
    ]);

    // The checkbox sits over the card instead of inside its press target, so it stays its
    // own control for screen readers (a native Pressable groups its children into one
    // element) and its press never reaches the card. A spacer keeps its place.
    return (
      <View
        className={cn(
          "relative overflow-hidden rounded-[14px] border border-border bg-card",
          "web:transition-colors web:hover:border-primary",
          "web:has-[>[data-card-press]:focus-visible]:ring-[3px] web:has-[>[data-card-press]:focus-visible]:ring-ring",
          isOverdue && "border-destructive/40 bg-destructive/5",
          className,
        )}
        testID={isOverdue ? "todo-item-overdue" : "todo-item"}
      >
        {/* Over the spacer (the card's 14px padding and the spacer's 1px), first so it is read and
            focused before the card, and above the card's press target. */}
        <View className="absolute left-4 top-[15px] z-10">
          <Checkbox
            accessibilityLabel={getTodoDoneToggleLabel(text, done ?? false)}
            checked={done ?? false}
            shape="round"
            webHitSlop={CHECKBOX_WEB_HIT_SLOP}
            onCheckedChange={(value) => onToggle?.(value === true)}
          />
        </View>
        <Pressable
          accessibilityLabel={cardLabel}
          accessibilityRole="button"
          className="grow web:outline-none"
          onPress={onPress}
          {...cardPressDataProps}
        >
          {/* grow, not flex-1: native flex:1 uses basis 0, which collapses this content-sized card on relayout (#15). */}
          <View className="grow flex-row items-start gap-3 px-4 py-3.5">
            <View className="mt-px size-4" />
            <View className="min-w-0 flex-1 gap-1.5">
              <Text
                className={cn(
                  "text-[13px] font-semibold leading-[18px] text-foreground",
                  done && "text-muted-foreground line-through",
                )}
                testID="todo-item-title"
              >
                {text}
              </Text>
              {scheduleLabel || isShared ? (
                <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                  {scheduleLabel ? (
                    <ReminderLabel
                      kind={scheduleKind}
                      label={scheduleLabel}
                      overdue={isOverdue}
                    />
                  ) : null}
                  {isShared ? (
                    <View className="flex-row items-center gap-1">
                      <Icon
                        as={Users}
                        size={12}
                        className="text-muted-foreground"
                      />
                      <Text className="text-[11px] font-semibold text-muted-foreground">
                        {SHARED_LABEL}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
          {hasLinkRow ? (
            <View
              className="flex-row items-center gap-2 border-t border-border-soft px-4 py-2"
              testID="todo-item-link"
            >
              <LinkThumbnail
                domain={domain ?? linkTitle ?? "?"}
                faviconUrl={linkFaviconUrl}
                size="small"
                testID="todo-item-link-thumbnail"
                thumbnailUrl={linkThumbnailUrl}
              />
              <Text
                className="min-w-0 flex-1 text-[11px] text-muted-foreground"
                numberOfLines={1}
              >
                {domain ? (
                  <Text className="text-[11px] font-semibold text-foreground">{domain}</Text>
                ) : null}
                {domain && linkTitle ? " · " : null}
                {linkTitle}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      className={cn(
        "flex-row items-center gap-3 rounded-xl border border-border-soft bg-surface p-3",
        variant === "inline" && "border-transparent bg-transparent p-0",
        className,
      )}
      onPress={onPress}
    >
      <Checkbox
        checked={done ?? false}
        shape="round"
        onCheckedChange={(value) => onToggle?.(value === true)}
      />
      <View className="flex-1 gap-1">
        <Text
          className={cn(
            "text-sm",
            done && "text-muted-foreground line-through",
            overdue && "text-destructive",
          )}
        >
          {text}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {badge ? (
            <Badge variant={overdue ? "overdue" : "todo"}>
              <Text>{badge}</Text>
            </Badge>
          ) : null}
          {reminderLabel ? (
            <Badge variant={overdue ? "overdue" : "todo"}>
              <Text>{reminderLabel}</Text>
            </Badge>
          ) : null}
          {visibility ? (
            <Badge variant={visibility}>
              <Text>{visibility}</Text>
            </Badge>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export { TodoItem };
export type { TodoItemProps, TodoItemVariant };
