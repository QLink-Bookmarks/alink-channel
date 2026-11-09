import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { CircleAlert } from "lucide-react-native/icons";

function formatTodoErrorSummary(count: number): string {
  return `확인할 액션이 ${count}개 있어요`;
}

// The red line beside the save buttons that counts the actions still showing an error.
// Renders nothing while every action is fine.
function TodoErrorSummary({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      aria-live="polite"
      className={cn("flex-row items-center gap-1.5", className)}
      testID="todo-error-summary"
    >
      <Icon
        as={CircleAlert}
        size={14}
        className="text-destructive"
      />
      <Text className="text-[13px] font-semibold text-destructive">
        {formatTodoErrorSummary(count)}
      </Text>
    </View>
  );
}

export { TodoErrorSummary, formatTodoErrorSummary };
