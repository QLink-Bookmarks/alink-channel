import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { TodoItem } from "@/features/todos/components/todo-item/todo-item";

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

type LinkDetailActionCard = Omit<React.ComponentProps<typeof TodoItem>, "variant"> & {
  id: React.Key;
};

function LinkDetailActionList({ items }: { items: LinkDetailActionCard[] }) {
  return (
    <View
      className="gap-2"
      testID="link-detail-todo-list"
    >
      {items.map(({ id, ...item }) => (
        <TodoItem
          key={id}
          variant="display"
          {...item}
        />
      ))}
    </View>
  );
}

export { LinkDetailActionList, LinkDetailActionSection };
