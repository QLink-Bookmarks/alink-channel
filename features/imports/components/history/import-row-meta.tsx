import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

function ImportRowMeta({ parts, className }: { parts: string[]; className?: string }) {
  return (
    <View
      className={cn("flex-row flex-wrap gap-x-1", className)}
      testID="import-row-meta"
    >
      {parts.map((part, index) => (
        <Text
          key={`${index}-${part}`}
          className="text-sm text-muted-foreground web:whitespace-nowrap"
          numberOfLines={1}
        >
          {index < parts.length - 1 ? `${part} ·` : part}
        </Text>
      ))}
    </View>
  );
}

export { ImportRowMeta };
