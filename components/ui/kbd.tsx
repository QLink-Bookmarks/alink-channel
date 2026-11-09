import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

type KbdProps = React.ComponentProps<typeof View> & {
  size?: "xs" | "sm";
  variant?: "default" | "inverse";
  label?: string;
  labelPosition?: "left" | "right";
  labelClassName?: string;
  keyClassName?: string;
  keyTextClassName?: string;
};

function Kbd({
  className,
  children,
  size = "sm",
  variant = "default",
  label,
  labelPosition = "right",
  labelClassName,
  keyClassName,
  keyTextClassName,
  ...props
}: KbdProps) {
  const labelTextClassName =
    variant === "inverse" ? "text-kbd-inverse-foreground" : "text-muted-foreground";
  const keyContainerClassName =
    variant === "inverse"
      ? "border-kbd-inverse-border bg-kbd-inverse"
      : "border-border-soft bg-surface-elevated";

  const labelElement = label ? (
    <Text className={cn(labelTextClassName, "text-xs", labelClassName)}>{label}</Text>
  ) : null;

  return (
    <View
      className={cn("flex-row items-center gap-1.5", className)}
      {...props}
    >
      {labelPosition === "left" ? labelElement : null}
      <View
        className={cn(
          "items-center justify-center rounded-xs border",
          keyContainerClassName,
          size === "xs" ? "min-h-5 px-1.5" : "min-h-6 px-2",
          keyClassName,
        )}
      >
        <Text
          className={cn("font-mono font-medium", labelTextClassName, "text-xs", keyTextClassName)}
        >
          {children}
        </Text>
      </View>
      {labelPosition === "right" ? labelElement : null}
    </View>
  );
}

export { Kbd };
export type { KbdProps };
