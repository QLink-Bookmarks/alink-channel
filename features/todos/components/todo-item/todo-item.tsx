import { Platform, Pressable, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { getDomainFromUrl } from "@/features/home/lib/link-card-mapper";
import { LinkThumbnail } from "@/features/links/components/link-thumbnail/link-thumbnail";
import { cn } from "@/lib/utils";

import { AlarmClock, Users } from "lucide-react-native/icons";

/**
 * On web we need to stop click bubbling so the checkbox tap doesn't also fire the outer
 * card press. Native already stops at the inner Pressable thanks to the responder system.
 */
const stopPropagationProps =
  Platform.OS === "web"
    ? ({
        onClick: (event: { stopPropagation?: () => void }) => {
          event.stopPropagation?.();
        },
      } as Record<string, unknown>)
    : null;

type TodoItemVariant = "inline" | "row" | "display";

type TodoItemProps = {
  className?: string;
  variant?: TodoItemVariant;
  text: string;
  done?: boolean;
  /** Pre-formatted reminder string (e.g. "06/04 09:36" or "06/04 09:36 (지남)"). */
  reminderLabel?: string | null;
  overdue?: boolean;
  /** Source-link URL — when set on the display variant, renders the linked-link row. */
  linkUrl?: string | null;
  /** Source-link title — paired with the domain in the linked-link row. */
  linkTitle?: string | null;
  /** Source-link representative image for the linked-link row's small image cell. */
  linkThumbnailUrl?: string | null;
  /** Source-link favicon, used only when there is no representative image. */
  linkFaviconUrl?: string | null;
  /** Adds a "👥 공유 할 일" badge under the reminder. */
  isShared?: boolean;
  /** Legacy free-form badge slot (used by the existing inline/row callers). */
  badge?: string;
  visibility?: "public" | "private";
  onToggle?: (done: boolean) => void;
  onPress?: () => void;
};

function ReminderLabel({ label, overdue }: { label: string; overdue?: boolean }) {
  return (
    <View
      className="flex-row items-center gap-1"
      testID="todo-item-reminder"
    >
      <Icon
        as={AlarmClock}
        size={12}
        className={overdue ? "text-destructive" : "text-primary"}
      />
      <Text
        className={cn("text-[11px] font-semibold", overdue ? "text-destructive" : "text-primary")}
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
  overdue,
  linkUrl,
  linkTitle,
  linkThumbnailUrl,
  linkFaviconUrl,
  isShared,
  badge,
  visibility,
  onToggle,
  onPress,
}: TodoItemProps) {
  if (variant === "display") {
    const domain = linkUrl ? getDomainFromUrl(linkUrl) : null;
    const hasLinkRow = Boolean(linkUrl || linkTitle);
    const isOverdue = Boolean(overdue && !done);

    return (
      <Pressable
        className={cn(
          "overflow-hidden rounded-[14px] border border-border bg-card",
          "web:transition-colors web:hover:border-primary",
          isOverdue && "border-destructive/40 bg-destructive/5",
          className,
        )}
        testID={isOverdue ? "todo-item-overdue" : "todo-item"}
        onPress={onPress}
      >
        <View className="flex-1 flex-row items-start gap-3 px-4 py-3.5">
          <View
            className="pt-px"
            {...(stopPropagationProps ?? null)}
          >
            <Checkbox
              accessibilityLabel={done ? "완료 취소" : "완료 표시"}
              checked={done ?? false}
              shape="round"
              onCheckedChange={(value) => onToggle?.(value === true)}
            />
          </View>
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
            {reminderLabel || isShared ? (
              <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                {reminderLabel ? (
                  <ReminderLabel
                    label={reminderLabel}
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
                      공유 할 일
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
