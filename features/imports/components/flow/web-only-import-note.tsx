import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const WEB_ONLY_IMPORT_NOTE = "북마크 가져오기는 웹에서 할 수 있어요";

function WebOnlyImportNote({ className }: { className?: string }) {
  return (
    <View
      className={cn("justify-center", className)}
      testID="web-only-import-note"
    >
      <Text className="text-center text-sm text-muted-foreground">{WEB_ONLY_IMPORT_NOTE}</Text>
    </View>
  );
}

export { WEB_ONLY_IMPORT_NOTE, WebOnlyImportNote };
