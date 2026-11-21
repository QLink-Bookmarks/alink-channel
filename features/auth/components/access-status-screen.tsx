import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

function CheckingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-2xl text-muted-foreground">인증 정보를 확인 중입니다…</Text>
    </View>
  );
}

function AgreementRetryScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
      <Text className="text-center text-muted-foreground">약관 동의 상태를 확인하지 못했어요.</Text>
      <Button onPress={onRetry}>
        <Text>다시 확인</Text>
      </Button>
    </View>
  );
}

export { AgreementRetryScreen, CheckingScreen };
