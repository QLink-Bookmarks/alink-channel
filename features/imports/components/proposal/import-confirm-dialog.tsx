import * as React from "react";
import { View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { getImportErrorName } from "../../api";
import { formatNumber } from "../../lib/split-import-ranges";
import { ProposalConfirmSurface } from "./proposal-confirm-surface";

import { Check, CircleAlert, RotateCw, Undo2 } from "lucide-react-native/icons";

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
  isWide: boolean;
  linkCount: number;
  folderCount: number;
  skipCount: number;
  onCancel: () => void;
  onStart: () => Promise<void>;
  onPendingChange: (isPending: boolean) => void;
};

function ImportConfirmDialog({
  open,
  isWide,
  linkCount,
  folderCount,
  skipCount,
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

  const actionClass = (isWide: boolean) =>
    isWide ? "h-10 rounded-xl px-4 sm:h-10" : "h-12 min-w-0 flex-1 rounded-xl sm:h-12";
  const labelClass = (isWide: boolean) =>
    isWide ? "text-sm font-semibold" : "text-base font-semibold";

  return (
    <ProposalConfirmSurface
      isLocked={isPending}
      isWide={isWide}
      open={open}
      testID="import-confirm"
      title="가져오기를 시작할까요?"
      renderActions={(wide) => (
        <>
          <Button
            className={actionClass(wide)}
            disabled={isPending}
            variant="outline"
            onPress={onCancel}
          >
            <Text className={labelClass(wide)}>취소</Text>
          </Button>
          <Button
            accessibilityState={{ busy: isPending, disabled: isStartBlocked }}
            aria-busy={isPending}
            className={cn(actionClass(wide), "flex-row gap-2")}
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
            <Text className={labelClass(wide)}>
              {isPending ? "가져오는 중…" : isRetry ? "다시 시도" : "시작"}
            </Text>
          </Button>
        </>
      )}
      onOpenChange={handleOpenChange}
    >
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
      <View className="gap-2">
        <Text className="text-[15px] text-foreground">
          링크 <Text className="font-bold">{formatNumber(linkCount)}개</Text>
          {folderCount > 0 ? (
            <>
              와 새 폴더 <Text className="font-bold">{formatNumber(folderCount)}개</Text>를
            </>
          ) : (
            "를"
          )}{" "}
          추가할게요.
        </Text>
        {skipCount > 0 ? (
          <ConfirmLine icon={Check}>
            이미 저장된 링크 {formatNumber(skipCount)}개는 건너뛰어요.
          </ConfirmLine>
        ) : null}
        <ConfirmLine icon={Undo2}>나중에 ‘가져오기 기록’에서 되돌릴 수 있어요.</ConfirmLine>
      </View>
    </ProposalConfirmSurface>
  );
}

function ConfirmLine({
  icon,
  children,
}: {
  icon: React.ComponentProps<typeof Icon>["as"];
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-2">
      <Icon
        as={icon}
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <Text className="min-w-0 flex-1 text-[13px] leading-5 text-muted-foreground">{children}</Text>
    </View>
  );
}

export { ImportConfirmDialog, getStartErrorKind };
export type { StartErrorKind };
