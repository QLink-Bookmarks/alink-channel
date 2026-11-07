import { Platform } from "react-native";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import * as CheckboxPrimitive from "@rn-primitives/checkbox";

import { Check } from "lucide-react-native/icons";

const DEFAULT_HIT_SLOP = 24;

function Checkbox({
  className,
  checkedClassName,
  indicatorClassName,
  iconClassName,
  size = "md",
  shape = "square",
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  checkedClassName?: string;
  indicatorClassName?: string;
  iconClassName?: string;
  size?: "sm" | "md";
  shape?: "square" | "round";
}) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "shrink-0 border-[1.5px] border-muted-foreground/75 shadow-sm shadow-black/5 dark:bg-input/30",
        size === "sm" ? "size-3.5" : "size-4",
        shape === "round" ? "rounded-full" : "rounded-[4px]",
        Platform.select({
          web: "aria-invalid:ring-destructive aria-invalid:border-destructive peer cursor-default outline-none transition-shadow focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed",
          native: "overflow-hidden",
        }),
        props.checked && cn("border-primary", checkedClassName),
        props.disabled && "opacity-50",
        className,
      )}
      hitSlop={DEFAULT_HIT_SLOP}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn(
          "h-full w-full items-center justify-center bg-primary",
          shape === "round" ? "rounded-full" : "rounded-[2.5px]",
          indicatorClassName,
        )}
      >
        <Icon
          as={Check}
          size={size === "sm" ? 10 : 12}
          strokeWidth={Platform.OS === "web" ? 2.5 : 3.5}
          className={cn("text-primary-foreground", iconClassName)}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
