import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { Check, Minus } from "lucide-react-native";

type ReversalCheckboxProps = {
  checked: boolean | "indeterminate";
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function ReversalCheckbox({ checked, disabled, label, onPress }: ReversalCheckboxProps) {
  const isOn = checked !== false;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: checked === "indeterminate" ? "mixed" : checked, disabled }}
      aria-checked={checked === "indeterminate" ? "mixed" : checked}
      aria-disabled={disabled}
      disabled={disabled}
      className="size-11 items-center justify-center rounded-lg"
      onPress={onPress}
    >
      <View
        className={cn(
          "size-[18px] items-center justify-center rounded-[5px] border",
          isOn && !disabled ? "border-primary bg-primary" : "border-input bg-background",
          disabled && "opacity-40",
        )}
      >
        {isOn ? (
          <Icon
            as={checked === "indeterminate" ? Minus : Check}
            size={12}
            strokeWidth={3}
            className={disabled ? "text-muted-foreground" : "text-primary-foreground"}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export { ReversalCheckbox };
