import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { SegmentedControl, type SegmentedControlProps } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import type { LinkOrder } from "@/features/links/types";
import { cn } from "@/lib/utils";

import { Star } from "lucide-react-native/icons";

const ORDER_OPTIONS: { label: string; value: LinkOrder }[] = [
  { label: "최신순", value: "latest" },
  { label: "오래된순", value: "earliest" },
  { label: "가나다순", value: "laxico" },
];

type OrderFilterProps = {
  value: LinkOrder;
  onValueChange: (value: LinkOrder) => void;
  favoriteOnly?: boolean;
  onFavoriteOnlyChange?: (next: boolean) => void;
  variant?: SegmentedControlProps["variant"];
  className?: string;
};

function OrderFilter({
  value,
  onValueChange,
  favoriteOnly = false,
  onFavoriteOnlyChange,
  variant = "chipsBadge",
  className,
}: OrderFilterProps) {
  const isBadge = variant === "chipsBadge";

  return (
    <View className={cn("flex-row items-center gap-2", className)}>
      <SegmentedControl
        labelClassName="text-sm"
        options={ORDER_OPTIONS}
        selectionMode="single"
        value={value}
        variant={variant}
        onValueChange={(next) => {
          if (typeof next === "string") {
            onValueChange(next as LinkOrder);
          }
        }}
      />
      {onFavoriteOnlyChange ? (
        <Pressable
          className={cn(
            "min-h-8 flex-row items-center justify-center gap-1 border px-2.5",
            isBadge ? "rounded-full" : "rounded-xl",
            favoriteOnly ? "border-warning bg-warning/15" : "border-border bg-card",
          )}
          onPress={() => onFavoriteOnlyChange(!favoriteOnly)}
        >
          <Icon
            as={Star}
            size={13}
            className={favoriteOnly ? "fill-warning text-warning-icon" : "text-muted-foreground"}
          />
          <Text
            className={cn(
              "text-sm font-medium",
              favoriteOnly ? "text-warning" : "text-muted-foreground",
            )}
          >
            바로가기
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export { ORDER_OPTIONS, OrderFilter };
export type { OrderFilterProps };
