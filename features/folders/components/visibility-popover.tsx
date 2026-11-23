import type { Ref } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PublicAddressRow } from "@/components/ui/public-address-row";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import type { TriggerRef } from "@rn-primitives/popover";

import { Check, Globe, Lock } from "lucide-react-native/icons";

const choices = [
  { value: "public", label: "전체 공개", icon: Globe },
  { value: "private", label: "나만 보기", icon: Lock },
] as const;
const isWeb = process.env.EXPO_OS === "web";

const statusMessages = {
  checking: "공개 설정을 확인하는 중이에요.",
  unavailable: "공개 설정을 확인하지 못했어요.",
  saving: "공개 설정을 변경하는 중이에요.",
  "save-error": "공개 설정을 저장하지 못했어요.",
  ready: undefined,
};

function VisibilityPopover({
  folderId,
  isPublic,
  canPublish = true,
  pending,
  error,
  status = "ready",
  confirming,
  triggerRef,
  onOpenChange,
  onChange,
  onRetry,
}: {
  folderId?: number;
  isPublic: boolean;
  canPublish?: boolean;
  pending?: boolean;
  error?: string;
  status?: keyof typeof statusMessages;
  confirming?: boolean;
  triggerRef?: Ref<TriggerRef>;
  onOpenChange?: (open: boolean) => void;
  onChange: (isPublic: boolean) => void;
  onRetry?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const selected = isPublic ? choices[0] : choices[1];
  const isFolder = folderId !== undefined;
  const isBusy = status === "checking" || status === "saving";
  const isUnavailable = status === "unavailable";
  const hasError = Boolean(error) || isUnavailable || status === "save-error";
  const message = statusMessages[status] ?? error;

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        ref={triggerRef}
        asChild
      >
        <IconButton
          accessibilityLabel={`공개 설정, ${selected.label}`}
          hitSlop={4}
          icon={selected.icon}
          size="sm"
          variant="ghost"
        />
      </PopoverTrigger>
      <PopoverContent
        accessible={false}
        accessibilityState={{ busy: isBusy || pending }}
        align="end"
        className={cn("gap-2 rounded-xl p-2", !isFolder && "w-48")}
        insets={
          isFolder ? { ...insets, left: insets.left + 12, right: insets.right + 12 } : undefined
        }
        side="bottom"
        sideOffset={8}
        style={
          isFolder ? { width: Math.min(288, width - insets.left - insets.right - 24) } : undefined
        }
        {...(isWeb && {
          onInteractOutside: (event) => {
            if (confirming) event.preventDefault();
          },
        })}
      >
        <Text className="px-2 pt-1 text-sm font-semibold">공개 설정</Text>
        <View
          accessible={false}
          accessibilityLabel={isWeb ? "공개 설정" : undefined}
          className="gap-1"
          role={isWeb ? "group" : undefined}
        >
          {choices.map(({ value, label, icon }) => {
            const checked = value === selected.value;
            const disabled =
              isBusy || isUnavailable || confirming || (value === "public" && !canPublish);
            return (
              <View
                key={value}
                className="gap-1"
              >
                <Pressable
                  accessibilityLabel={label}
                  role={isWeb ? "button" : "radio"}
                  accessibilityState={isWeb ? undefined : { checked }}
                  aria-pressed={isWeb ? checked : undefined}
                  aria-checked={isWeb ? undefined : checked}
                  className={cn(
                    "min-h-11 flex-row items-center gap-2 rounded-lg px-2 web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:-outline-offset-2 web:focus-visible:outline-ring",
                    checked && "bg-accent",
                    disabled ? "opacity-50" : "active:bg-accent web:hover:bg-accent",
                  )}
                  disabled={disabled}
                  onPress={() => {
                    if (!pending && !checked) onChange(value === "public");
                  }}
                >
                  <Icon
                    as={icon}
                    size={16}
                    className="text-foreground"
                  />
                  <Text className="flex-1 text-sm text-foreground">{label}</Text>
                  {checked ? (
                    <Icon
                      as={Check}
                      size={16}
                      className="text-primary"
                    />
                  ) : null}
                </Pressable>
                {folderId !== undefined &&
                value === "public" &&
                isPublic &&
                status !== "checking" &&
                !isUnavailable ? (
                  <PublicAddressRow path={`/folders/${folderId}`} />
                ) : null}
              </View>
            );
          })}
        </View>
        {message ? (
          <View
            className="items-start gap-1 px-2 pb-1"
            role={hasError ? "alert" : "status"}
          >
            <Text
              className={cn("text-xs", hasError ? "text-destructive" : "text-muted-foreground")}
            >
              {message}
            </Text>
            {isUnavailable ? (
              <Button
                size="sm"
                variant="outline"
                onPress={onRetry}
              >
                <Text>다시 확인</Text>
              </Button>
            ) : null}
          </View>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export { VisibilityPopover };
