import { View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholder with the same frame as `LinkCard`: the 16:9 image cell and the
 * fixed-height rows below it, so loaded cards fill the same spots.
 */
function LinkCardSkeleton({ className }: { className?: string }) {
  return (
    <View
      accessibilityLabel="링크 불러오는 중"
      className={cn("overflow-hidden rounded-[14px] border border-border bg-card", className)}
      testID="link-card-skeleton"
    >
      <View className="aspect-video w-full border-b border-border-soft bg-muted">
        <Skeleton className="absolute inset-0 rounded-none" />
      </View>
      <View className="gap-1.5 px-3 pb-3 pt-2.5">
        <View className="h-9 gap-1.5">
          <Skeleton className="h-3 w-[90%]" />
          <Skeleton className="h-3 w-[60%]" />
        </View>
        <View className="h-[18px] justify-center">
          <Skeleton className="h-2.5 w-[45%]" />
        </View>
        <View className="h-5 justify-center">
          <Skeleton className="h-2.5 w-[35%]" />
        </View>
      </View>
    </View>
  );
}

export { LinkCardSkeleton };
