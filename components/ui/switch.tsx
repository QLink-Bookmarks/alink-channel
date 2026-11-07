import { Platform, View } from "react-native";

import { LinearGradient } from "@/components/ui/linear-gradient";
import { cn } from "@/lib/utils";
import * as SwitchPrimitives from "@rn-primitives/switch";

function Switch({
  className,
  size = "md",
  thumbContent,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root> & {
  size?: "sm" | "md";
  thumbContent?: React.ReactNode;
}) {
  const isSmall = size === "sm";
  return (
    <SwitchPrimitives.Root
      className={cn(
        "relative flex shrink-0 flex-row items-center overflow-hidden rounded-full border border-transparent",
        isSmall ? "h-4 w-7" : "h-[1.15rem] w-8",
        Platform.select({
          web: "peer inline-flex outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed",
        }),
        props.checked ? "shadow-qlink-sm" : "bg-input shadow-sm shadow-black/5 dark:bg-input/80",
        props.disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {props.checked ? (
        <LinearGradient
          style={{
            bottom: 0,
            // On native, overflow:hidden on the parent doesn't reliably clip
            // absolute-positioned children — set borderRadius here so the
            // gradient itself rounds to match the pill shape.
            borderRadius: 9999,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
      ) : null}
      {!props.checked ? (
        <View className="absolute inset-0 rounded-full bg-input dark:bg-input/80" />
      ) : null}
      <SwitchPrimitives.Thumb
        className={cn(
          "relative z-10 items-center justify-center rounded-full bg-background shadow-sm shadow-black/10 transition-transform",
          isSmall ? "size-3.5" : "size-4",
          Platform.select({
            web: "pointer-events-none inline-flex ring-0",
          }),
          props.checked
            ? isSmall
              ? "translate-x-3 dark:bg-primary-foreground"
              : "translate-x-3.5 dark:bg-primary-foreground"
            : "translate-x-0 dark:bg-foreground",
        )}
      >
        {thumbContent ? (
          <View className="absolute inset-0 items-center justify-center">{thumbContent}</View>
        ) : null}
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  );
}

export { Switch };
