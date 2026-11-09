import { Platform } from "react-native";

import { cn } from "@/lib/utils";
import * as RadioGroupPrimitive from "@rn-primitives/radio-group";

function RadioGroup({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root> & {
  orientation?: "vertical" | "horizontal";
}) {
  return (
    <RadioGroupPrimitive.Root
      className={cn("gap-3", orientation === "horizontal" && "flex-row", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  size = "md",
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & { size?: "sm" | "md" }) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "aspect-square shrink-0 items-center justify-center rounded-full border border-muted-foreground shadow-sm shadow-black/5 dark:bg-input/30",
        size === "sm" ? "size-3.5" : "size-4",
        Platform.select({
          web: "aria-invalid:ring-destructive aria-invalid:border-destructive outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed aria-checked:border-primary",
        }),
        props.disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className={cn("rounded-full bg-primary", size === "sm" ? "size-1.5" : "size-2")}
      />
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
