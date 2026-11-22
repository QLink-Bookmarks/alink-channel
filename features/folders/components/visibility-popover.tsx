import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as RadioGroupPrimitive from "@rn-primitives/radio-group";

import { Check, Globe, Lock } from "lucide-react-native/icons";

const choices = [
  { value: "public", label: "전체 공개", icon: Globe },
  { value: "private", label: "나만 보기", icon: Lock },
] as const;

function VisibilityPopover({
  isPublic,
  canPublish = true,
  pending,
  error,
  onOpenChange,
  onChange,
}: {
  isPublic: boolean;
  canPublish?: boolean;
  pending?: boolean;
  error?: string;
  onOpenChange?: (open: boolean) => void;
  onChange: (isPublic: boolean) => void;
}) {
  const selected = isPublic ? choices[0] : choices[1];

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <IconButton
          accessibilityLabel={`공개 설정, ${selected.label}`}
          hitSlop={4}
          icon={selected.icon}
          size="sm"
          variant="ghost"
        />
      </PopoverTrigger>
      <PopoverContent
        accessibilityLabel="공개 설정"
        align="end"
        className="w-48 gap-2 rounded-xl p-2"
        side="bottom"
        sideOffset={8}
      >
        <Text className="px-2 pt-1 text-sm font-semibold">공개 설정</Text>
        <RadioGroup
          accessibilityLabel="공개 설정"
          className="gap-1"
          disabled={pending}
          value={selected.value}
          onValueChange={(value) => onChange(value === "public")}
        >
          {choices.map(({ value, label, icon }) => {
            const disabled = pending || (value === "public" && !canPublish);
            return (
              <RadioGroupPrimitive.Item
                key={value}
                accessibilityLabel={label}
                className={cn(
                  "min-h-11 flex-row items-center gap-2 rounded-lg px-2 web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:-outline-offset-2 web:focus-visible:outline-ring",
                  value === selected.value && "bg-accent",
                  disabled ? "opacity-50" : "active:bg-accent web:hover:bg-accent",
                )}
                disabled={disabled}
                value={value}
              >
                <Icon
                  as={icon}
                  size={16}
                  className="text-foreground"
                />
                <Text className="flex-1 text-sm text-foreground">{label}</Text>
                <RadioGroupPrimitive.Indicator>
                  <Icon
                    as={Check}
                    size={16}
                    className="text-primary"
                  />
                </RadioGroupPrimitive.Indicator>
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroup>
        {error ? (
          <View
            className="px-2 pb-1"
            role="alert"
          >
            <Text className="text-xs text-destructive">{error}</Text>
          </View>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export { VisibilityPopover };
