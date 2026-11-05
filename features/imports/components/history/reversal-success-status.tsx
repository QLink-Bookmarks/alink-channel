import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import type { ReversalStatus } from "../../hooks/use-reversal-status";

import { CircleCheck } from "lucide-react-native";

function ReversalSuccessStatus({ status }: { status: ReversalStatus | null }) {
  return (
    <View
      role="status"
      aria-live="polite"
      accessibilityLiveRegion="polite"
      className="w-full"
      testID="reversal-success-status"
    >
      {status ? (
        <Animated.View
          key={status.key}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
        >
          <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-muted px-3.5 py-2.5">
            <Icon
              as={CircleCheck}
              size={16}
              className="shrink-0 text-success"
            />
            <Text className="min-w-0 flex-1 text-sm text-foreground">{status.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

export { ReversalSuccessStatus };
