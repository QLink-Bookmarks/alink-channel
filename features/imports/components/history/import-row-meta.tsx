import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

function ImportRowMeta({ parts, className }: { parts: string[]; className?: string }) {
  return (
    <View
      className={cn("min-w-0 flex-row flex-wrap gap-x-1", className)}
      testID="history-row-meta"
    >
      {parts.map((part, index) => {
        const isCount = index > 0;
        return (
          <Text
            key={`${index}-${part}`}
            className={cn(
              "text-sm text-muted-foreground",
              isCount ? "web:whitespace-nowrap" : "shrink",
            )}
          >
            {index < parts.length - 1 ? `${part}\u00a0·` : part}
          </Text>
        );
      })}
    </View>
  );
}

export { ImportRowMeta };
