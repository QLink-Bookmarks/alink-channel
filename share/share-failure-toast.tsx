import * as React from "react";
import { AccessibilityInfo } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";

import { Toast } from "@/components/ui/toast";

const TOAST_VISIBLE_MS = 4000;

type ShareFailureToastProps = {
  message: string;
  showKey: number;
  onHide: () => void;
};

function ShareFailureToast({ message, showKey, onHide }: ShareFailureToastProps) {
  const isReducedMotion = useReducedMotion();
  React.useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const timer = setTimeout(onHide, TOAST_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, onHide, showKey]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      className="absolute left-3 right-3 top-3.5 z-20"
      entering={
        isReducedMotion
          ? FadeIn.duration(200).reduceMotion(ReduceMotion.Never)
          : FadeInDown.duration(260)
      }
      exiting={FadeOut.duration(200).reduceMotion(ReduceMotion.Never)}
      pointerEvents="none"
    >
      <Toast
        className="max-w-none"
        dismissible={false}
        role="alert"
        title={message}
      />
    </Animated.View>
  );
}

export { ShareFailureToast, TOAST_VISIBLE_MS };
