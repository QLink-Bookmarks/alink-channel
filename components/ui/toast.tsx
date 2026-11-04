import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { LinearGradient } from "@/components/ui/linear-gradient";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

function Toast({
  className,
  variant = "default",
  title,
  description,
  dismissible = true,
  showProgress = false,
  progressValue = 100,
  actionLabel,
  onAction,
  onDismiss,
  ...props
}: React.ComponentProps<typeof View> & {
  variant?: "default" | "success" | "error" | "warning" | "gradient";
  title: string;
  description?: string;
  dismissible?: boolean;
  showProgress?: boolean;
  progressValue?: number;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const isSolidVariant = variant === "success" || variant === "error" || variant === "warning";
  const solidTextClassName =
    variant === "success"
      ? "text-success-foreground"
      : variant === "error"
        ? "text-destructive-foreground"
        : variant === "warning"
          ? "text-warning-foreground"
          : "text-background";
  const titleClassName =
    isSolidVariant || variant === "gradient" ? solidTextClassName : "text-foreground";
  const descriptionClassName = isSolidVariant
    ? solidTextClassName
    : variant === "gradient"
      ? "text-background/80"
      : "text-muted-foreground";
  const dismissClassName =
    isSolidVariant || variant === "gradient" ? solidTextClassName : "text-muted-foreground";
  const actionBorderClassName =
    variant === "success"
      ? "border-success-foreground/40"
      : variant === "error"
        ? "border-destructive-foreground/40"
        : variant === "warning"
          ? "border-warning-foreground/40"
          : "border-white/60";

  return (
    <View
      className={cn(
        "relative w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-qlink-lg",
        variant === "error" && "border-destructive/30",
        variant === "warning" && "border-warning/40",
        className,
      )}
      {...props}
    >
      {variant === "gradient" ? (
        <LinearGradient
          style={{
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
      ) : (
        <View
          className={cn(
            "absolute inset-0 bg-foreground",
            variant === "success" && "bg-success",
            variant === "error" && "bg-destructive",
            variant === "warning" && "bg-warning",
          )}
        />
      )}
      {showProgress ? (
        <Progress
          className={cn(
            "absolute left-0 right-0 top-0 h-1 rounded-none bg-black/10",
            variant === "default" && "bg-primary/15",
          )}
          indicatorClassName={cn(
            "bg-primary",
            variant === "default" && "bg-primary",
            variant === "gradient" && "bg-background/80",
          )}
          value={progressValue}
        />
      ) : null}
      <View className="flex-row items-start justify-between gap-4 p-4">
        <View className="flex-1 gap-1">
          <Text className={cn("font-semibold", titleClassName)}>{title}</Text>
          {description ? (
            <Text className={cn("text-sm", descriptionClassName)}>{description}</Text>
          ) : null}
          {actionLabel && onAction ? (
            <Button
              className={cn(
                "mt-2 h-8 min-h-0 self-start rounded-full px-3",
                isSolidVariant || variant === "gradient"
                  ? cn(actionBorderClassName, "bg-transparent")
                  : "border-border",
              )}
              size="xs"
              variant="outline"
              onPress={onAction}
            >
              <Text className={cn("font-semibold", titleClassName)}>{actionLabel}</Text>
            </Button>
          ) : null}
        </View>
        {dismissible && onDismiss ? (
          <Pressable
            className="rounded-md px-1"
            onPress={onDismiss}
          >
            <Text className={cn("text-sm font-medium", dismissClassName)}>닫기</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export { Toast };
