import * as React from "react";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { type Href, useRouter } from "expo-router";

function NotFoundScreen() {
  const router = useRouter();
  const handleGoHome = React.useCallback(() => {
    router.replace("/" as Href);
  }, [router]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View className="min-h-[70vh] items-center justify-center gap-5 px-6 py-12">
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-extrabold text-foreground">
            페이지를 찾을 수 없어요
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            요청하신 페이지가 없거나 이동되었어요.
          </Text>
        </View>
        <Button
          className="h-10 self-center"
          variant="gradient"
          onPress={handleGoHome}
        >
          <Text>홈으로</Text>
        </Button>
      </View>
    </ScrollView>
  );
}

export { NotFoundScreen };
