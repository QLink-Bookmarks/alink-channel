import { View } from "react-native";

import { RadioGroup } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import * as RadioGroupPrimitive from "@rn-primitives/radio-group";

function VisibilityField({
  isPublic,
  disabled,
  help,
  onChange,
}: {
  isPublic: boolean;
  disabled?: boolean;
  help: string;
  onChange: (isPublic: boolean) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">공개 설정</Text>
      <RadioGroup
        accessibilityLabel="공개 설정"
        disabled={disabled}
        orientation="horizontal"
        value={isPublic ? "public" : "private"}
        onValueChange={(value) => onChange(value === "public")}
      >
        {[
          { value: "private", label: "나만 보기" },
          { value: "public", label: "전체 공개" },
        ].map(({ value, label }) => (
          <RadioGroupPrimitive.Item
            key={value}
            accessibilityLabel={label}
            className={cn(
              "min-h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border px-3",
              "web:focus-visible:outline web:focus-visible:outline-2 web:focus-visible:outline-ring",
              disabled ? "opacity-60" : "active:bg-accent web:hover:bg-accent",
              (value === "public") === isPublic && "border-primary bg-accent",
            )}
            value={value}
            disabled={disabled}
          >
            <View className="size-3.5 items-center justify-center rounded-full border border-muted-foreground">
              <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
            </View>
            <Text className="text-sm font-medium text-foreground">{label}</Text>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroup>
      <Text className="text-xs text-muted-foreground">{help}</Text>
    </View>
  );
}

export { VisibilityField };
