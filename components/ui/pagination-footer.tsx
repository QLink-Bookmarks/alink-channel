import { View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

type PaginationFooterProps = {
  isLoading: boolean;
  isError: boolean;
  errorTitle: string;
  onRetry: () => void;
};

function PaginationFooter({ isLoading, isError, errorTitle, onRetry }: PaginationFooterProps) {
  if (!isLoading && !isError) {
    return null;
  }

  return (
    <View className="min-h-24 items-center justify-center gap-2 py-2">
      {isLoading ? (
        <ActivityIndicator accessibilityLabel="불러오는 중" />
      ) : (
        <>
          <Text className="text-center text-sm text-muted-foreground">{errorTitle}</Text>
          <Button
            className="min-h-11"
            variant="outline"
            onPress={onRetry}
          >
            <Text>다시 시도</Text>
          </Button>
        </>
      )}
    </View>
  );
}

export { PaginationFooter };
