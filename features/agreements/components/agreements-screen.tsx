import * as React from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/text";
import { DeviceNotificationNotice } from "@/features/notifications/components/device-notification-notice";
import { useDeviceNotificationStatus } from "@/features/notifications/hooks/use-device-notification-status";
import { useToastStore } from "@/stores/toast-store";

import { getAgreementErrorMessage } from "../lib/get-agreement-error-message";
import { useUpdateMyAgreementsMutation } from "../mutations";

import { type Href, useRouter } from "expo-router";

type Step = "notification" | "consent";

function ConsentRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <Pressable
        className="flex-1"
        onPress={() => onToggle(!checked)}
      >
        <Text className="text-[15px] leading-6 text-foreground">{children}</Text>
      </Pressable>
    </View>
  );
}

function AgreementsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  const { isEnabled } = useDeviceNotificationStatus();
  const mutation = useUpdateMyAgreementsMutation();

  const [step, setStep] = React.useState<Step | null>(null);
  const [agreePrivacy, setAgreePrivacy] = React.useState(false);
  const [agreeAiUsage, setAgreeAiUsage] = React.useState(false);

  // Decide the entry step once the device-notification permission resolves:
  // show the notification step only when it is off, otherwise go straight to consent.
  React.useEffect(() => {
    if (step !== null || isEnabled === null) {
      return;
    }
    setStep(isEnabled === false ? "notification" : "consent");
  }, [isEnabled, step]);

  const bothChecked = agreePrivacy && agreeAiUsage;
  const isSubmitting = mutation.isPending;

  const handleOpenPrivacy = React.useCallback(
    (event: { stopPropagation?: () => void }) => {
      event.stopPropagation?.();
      router.push("/privacy" as Href);
    },
    [router],
  );

  const handleContinue = React.useCallback(async () => {
    try {
      const response = await mutation.mutateAsync({ allowsPrivacy: true, allowsAiUsage: true });
      if (!response?.success) {
        showToast({
          variant: "error",
          title: response?.error?.message ?? "동의 처리에 실패했어요.",
          sourceKey: "agreements",
        });
        return;
      }
      router.replace("/home" as Href);
    } catch (error) {
      showToast({
        variant: "error",
        title: getAgreementErrorMessage(error),
        sourceKey: "agreements",
      });
    }
  }, [mutation, router, showToast]);

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {step === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : step === "notification" ? (
        <>
          <ScrollView contentContainerClassName="flex-grow px-6 pt-10">
            <View className="mx-auto w-full max-w-md flex-1 gap-6">
              <View className="gap-3">
                <Text className="text-2xl font-bold text-foreground">알림 설정</Text>
                <Text className="text-[15px] leading-7 text-muted-foreground">
                  액션 알림을 받으시려면 기기 알림을 활성화해주세요. 지금 활성화하지 않더라도 설정
                  페이지에서 활성화할 수 있어요.
                </Text>
              </View>
              <View className="rounded-2xl border border-border bg-muted/40 p-4">
                <DeviceNotificationNotice enabledMessage="알림이 허용됐어요! 다음으로 진행해주세요." />
              </View>
            </View>
          </ScrollView>
          <View className="px-6 pb-4 pt-2">
            <View className="mx-auto w-full max-w-md">
              <Button
                variant="gradient"
                gradientAccent="pink"
                className="w-full"
                onPress={() => setStep("consent")}
              >
                <Text>다음으로</Text>
              </Button>
            </View>
          </View>
        </>
      ) : (
        <>
          <ScrollView contentContainerClassName="flex-grow px-6 pt-10">
            <View className="mx-auto w-full max-w-md flex-1 gap-7">
              <View className="gap-2">
                <Text className="text-2xl font-bold text-foreground">서비스 이용 동의</Text>
                <Text className="text-[15px] leading-7 text-muted-foreground">
                  에이링크 이용을 위해 아래 필수 항목에 동의해주세요.
                </Text>
              </View>
              <View className="gap-5">
                <ConsentRow
                  checked={agreePrivacy}
                  onToggle={setAgreePrivacy}
                >
                  (필수) 만 14세 이상이며,{" "}
                  <Text
                    className="text-primary underline"
                    onPress={handleOpenPrivacy}
                  >
                    개인정보 수집·이용
                  </Text>
                  에 동의합니다.
                </ConsentRow>
                <ConsentRow
                  checked={agreeAiUsage}
                  onToggle={setAgreeAiUsage}
                >
                  (필수) AI 요약을 위해 저장 콘텐츠가 외부 AI 서비스 제공사(OpenAI·Google)로
                  전송됨에 동의합니다.
                </ConsentRow>
              </View>
            </View>
          </ScrollView>
          <View className="px-6 pb-4 pt-2">
            <View className="mx-auto w-full max-w-md">
              <Button
                variant="gradient"
                gradientAccent="pink"
                className="w-full"
                disabled={!bothChecked || isSubmitting}
                onPress={handleContinue}
              >
                {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text>계속하기</Text>}
              </Button>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

export { AgreementsScreen };
