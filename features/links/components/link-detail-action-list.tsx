import { View } from "react-native";

import { Text } from "@/components/ui/text";

function LinkDetailActionSection({
  action,
  children,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      className="gap-1 border-t border-border-soft py-2.5"
      testID="link-detail-todos"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-xs font-semibold leading-8 text-muted-foreground">액션</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function LinkDetailActionList({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="gap-2"
      testID="link-detail-todo-list"
    >
      {children}
    </View>
  );
}

export { LinkDetailActionList, LinkDetailActionSection };
