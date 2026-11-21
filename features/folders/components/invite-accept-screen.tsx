import * as React from "react";
import { ScrollView, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { useAcceptFolderInvitationMutation } from "../mutations";

import { isAxiosError } from "axios";
import { type Href, useRouter } from "expo-router";

type InviteAcceptScreenProps = {
  folderId?: string | null;
  token?: string | null;
  // Fired once the invite is actually accepted, so the caller can drop the
  // stored invite only after it has been consumed.
  onAccepted?: () => void;
  onFailed?: () => void;
};

type InviteAcceptStatus = "reading" | "checking" | "success" | "client-error" | "server-error";

function InviteAcceptScreen({ folderId, token, onAccepted, onFailed }: InviteAcceptScreenProps) {
  const router = useRouter();
  const { mutateAsync, reset } = useAcceptFolderInvitationMutation();
  const [status, setStatus] = React.useState<InviteAcceptStatus>("reading");
  const [acceptedFolderId, setAcceptedFolderId] = React.useState<number | null>(null);
  const [errorMessage, setErrorMessage] = React.useState("");
  const hasSubmittedRef = React.useRef(false);

  React.useEffect(() => {
    hasSubmittedRef.current = false;
    setStatus("reading");
    setAcceptedFolderId(null);
    setErrorMessage("");
    reset();
  }, [folderId, reset, token]);

  React.useEffect(() => {
    if (hasSubmittedRef.current) {
      return;
    }

    const trimmedToken = token?.trim();
    const parsedFolderId = folderId ? Number(folderId) : Number.NaN;

    if (!trimmedToken || !Number.isSafeInteger(parsedFolderId) || parsedFolderId <= 0) {
      hasSubmittedRef.current = true;
      setStatus("client-error");
      setErrorMessage("초대 정보가 올바르지 않아요.");
      onFailed?.();
      return;
    }

    hasSubmittedRef.current = true;
    setStatus("checking");

    mutateAsync({
      id: parsedFolderId,
      payload: { invitation: trimmedToken },
    })
      .then((response) => {
        setAcceptedFolderId(response.data.folderId);
        setStatus("success");
        onAccepted?.();
      })
      .catch((error: unknown) => {
        const statusCode = isAxiosError(error) ? error.response?.status : undefined;
        const isClientError = statusCode != null && statusCode >= 400 && statusCode < 500;

        setStatus(isClientError ? "client-error" : "server-error");
        setErrorMessage(getInviteErrorMessage(error));
        onFailed?.();
      });
  }, [folderId, mutateAsync, onAccepted, onFailed, token]);

  const message =
    status === "reading"
      ? "초대장을 읽고있어요"
      : status === "checking"
        ? "초대장을 확인 중이에요"
        : status === "success"
          ? "초대가 수락됐어요."
          : status === "client-error"
            ? "잘못된 초대장이에요"
            : "예기치 못한 오류가 발생했어요. 나중에 다시 시도해주세요";

  const handleGoFolder = React.useCallback(() => {
    if (acceptedFolderId == null) {
      return;
    }

    router.replace(`/folders/${acceptedFolderId}` as Href);
  }, [acceptedFolderId, router]);

  const handleGoHome = React.useCallback(() => {
    router.replace("/home" as Href);
  }, [router]);

  return (
    <ScrollView
      className="flex-1"
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <View className="min-h-[70vh] items-center justify-center gap-5 px-6 py-12">
        {status === "reading" || status === "checking" ? (
          <ActivityIndicator
            size="large"
            className="py-1"
          />
        ) : null}
        <View className="items-center gap-2">
          <Text className="text-center text-2xl font-extrabold text-foreground">{message}</Text>
          {status === "client-error" || status === "server-error" ? (
            <Text className="text-center text-sm text-muted-foreground">{errorMessage}</Text>
          ) : null}
        </View>
        {status === "success" ? (
          <Button
            className="h-10 self-center"
            variant="gradient"
            onPress={handleGoFolder}
          >
            <Text>폴더로 이동</Text>
          </Button>
        ) : null}
        {status === "client-error" || status === "server-error" ? (
          <Button
            className="h-10 self-center"
            variant="gradient"
            onPress={handleGoHome}
          >
            <Text>홈</Text>
          </Button>
        ) : null}
      </View>
    </ScrollView>
  );
}

function getInviteErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    const envelopeMessage = getEnvelopeErrorMessage(data);

    if (envelopeMessage) {
      return envelopeMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "알 수 없는 오류가 발생했어요.";
}

function getEnvelopeErrorMessage(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) {
    return undefined;
  }

  const error = (data as { error?: unknown }).error;
  if (!error || typeof error !== "object" || !("message" in error)) {
    return undefined;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : undefined;
}

export { InviteAcceptScreen };
export type { InviteAcceptScreenProps };
