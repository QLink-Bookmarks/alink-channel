import * as React from "react";
import { View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import { getImportErrorName } from "../../api";
import { formatNumber } from "../../lib/split-import-ranges";

import { CircleAlert, RotateCw } from "lucide-react-native/icons";

type StartErrorKind = "retry" | "nothing-to-import";

const START_ERROR_COPY: Record<StartErrorKind, string> = {
  retry: "잠시 후 다시 시도해 주세요.",
  "nothing-to-import": "이미 모두 저장된 링크라 새로 가져올 링크가 없어요",
};

function getStartErrorKind(error: unknown): StartErrorKind {
  return getImportErrorName(error) === "IMPORT_NOTHING_TO_IMPORT" ? "nothing-to-import" : "retry";
}

type ImportConfirmDialogProps = {
  open: boolean;
  linkCount: number;
  folderCount: number;
  onCancel: () => void;
  onStart: () => Promise<void>;
  onPendingChange: (isPending: boolean) => void;
};

function ImportConfirmDialog({
  open,
  linkCount,
  folderCount,
  onCancel,
  onStart,
  onPendingChange,
}: ImportConfirmDialogProps) {
  const [isPending, setIsPending] = React.useState(false);
  const [errorKind, setErrorKind] = React.useState<StartErrorKind | null>(null);
  const pendingRef = React.useRef(false);
  const [wasOpen, setWasOpen] = React.useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setErrorKind(null);
      setIsPending(false);
    }
  }

  React.useEffect(() => {
    if (open) {
      pendingRef.current = false;
    }
  }, [open]);

  React.useEffect(() => {
    onPendingChange(isPending);
  }, [isPending, onPendingChange]);

  const handleStart = React.useCallback(async () => {
    if (pendingRef.current || errorKind === "nothing-to-import") {
      return;
    }
    pendingRef.current = true;
    setIsPending(true);
    setErrorKind(null);
    try {
      await onStart();
    } catch (error) {
      pendingRef.current = false;
      setIsPending(false);
      setErrorKind(getStartErrorKind(error));
    }
  }, [errorKind, onStart]);

  const isRetry = errorKind === "retry";
  const isStartBlocked = isPending || errorKind === "nothing-to-import";

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next && !pendingRef.current) {
        onCancel();
      }
    },
    [onCancel],
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <AlertDialogContent className="w-[440px] max-w-[92vw] gap-5 sm:max-w-[92vw]">
        <AlertDialogHeader>
          <AlertDialogTitle>가져오기를 시작할까요?</AlertDialogTitle>
        </AlertDialogHeader>
        {errorKind ? (
          <Alert
            icon={CircleAlert}
            variant="danger"
          >
            <AlertTitle className="font-semibold">가져오기를 시작하지 못했어요</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              {START_ERROR_COPY[errorKind]}
            </AlertDescription>
          </Alert>
        ) : null}
        <View className="gap-3">
          <Text className="text-[15px] text-foreground">
            링크 <Text className="font-bold">{formatNumber(linkCount)}개</Text>와 새 폴더{" "}
            <Text className="font-bold">{formatNumber(folderCount)}개</Text>를 추가할게요.
          </Text>
          <Text className="text-[13px] leading-5 text-muted-foreground">
            가져오는 동안 잠시 기다려 주세요. 결과는 ‘가져오기 기록’에서 볼 수 있어요.
          </Text>
        </View>
        <AlertDialogFooter className="flex-row justify-end gap-2">
          <Button
            className="h-10 rounded-xl px-4"
            disabled={isPending}
            variant="outline"
            onPress={onCancel}
          >
            <Text className="text-sm font-semibold">취소</Text>
          </Button>
          <Button
            accessibilityState={{ busy: isPending, disabled: isStartBlocked }}
            aria-busy={isPending}
            className="h-10 flex-row gap-2 rounded-xl px-4"
            disabled={isStartBlocked}
            onPress={() => void handleStart()}
          >
            {isPending ? <ActivityIndicator tone="onPrimary" /> : null}
            {isRetry && !isPending ? (
              <Icon
                as={RotateCw}
                className="size-4 text-primary-foreground"
              />
            ) : null}
            <Text className="text-sm font-semibold">
              {isPending ? "가져오는 중…" : isRetry ? "다시 시도" : "시작"}
            </Text>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ImportConfirmDialog, getStartErrorKind };
export type { StartErrorKind };
