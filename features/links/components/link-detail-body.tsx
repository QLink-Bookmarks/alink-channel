import { ScrollView, View } from "react-native";

import { cn } from "@/lib/utils";

function LinkDetailBody({
  mode,
  children,
}: {
  mode: "panel" | "screen";
  children: React.ReactNode;
}) {
  const isPanel = mode === "panel";
  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      className={cn("flex-1", isPanel ? "bg-surface" : "bg-background")}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="link-detail"
    >
      <View
        className={cn(
          isPanel
            ? "gap-4 px-5 pb-8 pt-2"
            : "w-full max-w-[600px] gap-3.5 self-center px-4 pb-10 pt-3",
        )}
      >
        {children}
      </View>
    </ScrollView>
  );
}

export { LinkDetailBody };
