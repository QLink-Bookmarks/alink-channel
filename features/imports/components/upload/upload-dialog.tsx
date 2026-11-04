import * as React from "react";
import { Pressable, View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { ImportFlowFile, ImportFlowStep, UploadError } from "../../hooks/use-import-flow";
import {
  type ImportRange,
  describeImportRange,
  formatNumber,
  getImportRangeLabel,
} from "../../lib/split-import-ranges";
import { BrowserGuide } from "./browser-guide";
import { FileDropZone } from "./file-drop-zone.web";

import { CircleAlert, FileX, RotateCw, TriangleAlert } from "lucide-react-native/icons";

type UploadDialogProps = {
  open: boolean;
  isWide: boolean;
  step: ImportFlowStep;
  onClose: () => void;
  onSelectFile: (file: ImportFlowFile) => void;
  onChooseOtherFile: () => void;
  onPreviewRange: (range: ImportRange) => void;
  onRetryPreview: () => void;
};

const UPLOAD_ERROR_COPY: Record<
  UploadError,
  { title: string; description: (file?: string) => string }
> = {
  type: { title: "북마크 파일이 아니에요", description: () => "HTML 파일만 가져올 수 있어요." },
  size: { title: "파일이 너무 커요", description: () => "10MB 이하 파일만 가져올 수 있어요." },
  format: {
    title: "북마크를 읽을 수 없어요",
    description: (file) =>
      `‘${file ?? "이 파일"}’에는 브라우저 북마크 형식이 없어요. 위 안내대로 다시 내보낸 파일을 골라 주세요.`,
  },
};

function UploadBody({
  step,
  isWide,
  onSelectFile,
}: {
  step: Extract<ImportFlowStep, { name: "upload" }>;
  isWide: boolean;
  onSelectFile: (file: ImportFlowFile) => void;
}) {
  const error = step.error ? UPLOAD_ERROR_COPY[step.error] : null;
  return (
    <View className="gap-4">
      {isWide ? null : (
        <Alert
          icon={TriangleAlert}
          variant="warning"
        >
          <AlertTitle className="font-semibold leading-5">
            북마크 내보내기는 데스크탑 환경의 웹 브라우저만 가능해요.
          </AlertTitle>
        </Alert>
      )}
      <BrowserGuide />
      {error ? (
        <Alert
          icon={CircleAlert}
          variant="danger"
        >
          <AlertTitle className="font-semibold">{error.title}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {error.description(step.fileName)}
          </AlertDescription>
        </Alert>
      ) : null}
      <FileDropZone
        canDrop={isWide}
        onFile={onSelectFile}
      />
    </View>
  );
}

function CenteredState({
  icon,
  isLoading = false,
  title,
  description,
}: {
  icon?: React.ComponentProps<typeof Icon>["as"];
  isLoading?: boolean;
  title: string;
  description: string;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="items-center gap-2 px-4 py-12"
    >
      {isLoading ? (
        <ActivityIndicator className="mb-2" />
      ) : icon ? (
        <View className="mb-2 size-12 items-center justify-center rounded-2xl bg-muted">
          <Icon
            as={icon}
            className="size-5 text-muted-foreground"
          />
        </View>
      ) : null}
      <Text className="text-center text-base font-semibold text-foreground">{title}</Text>
      <Text className="max-w-[340px] text-center text-sm text-muted-foreground">{description}</Text>
    </View>
  );
}

function RangeBody({
  step,
  selectedIndex,
  onSelect,
}: {
  step: Extract<ImportFlowStep, { name: "range" }>;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <View className="gap-3">
      <Alert
        icon={TriangleAlert}
        variant="warning"
      >
        <AlertTitle className="font-semibold">북마크가 {formatNumber(step.total)}개예요</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          한 번에 3,000개까지 가져올 수 있어요. 파일에 들어 있는 순서대로 나눴어요.
        </AlertDescription>
      </Alert>
      <View
        accessibilityLabel="가져올 구간"
        accessibilityRole="radiogroup"
        className="gap-2"
      >
        {step.ranges.map((range) => {
          const isSelected = range.index === selectedIndex;
          return (
            <Pressable
              key={range.index}
              accessibilityLabel={getImportRangeLabel(range)}
              accessibilityRole="radio"
              aria-checked={isSelected}
              className={cn(
                "flex-row items-start gap-3 rounded-xl border px-4 py-3.5 web:transition-colors",
                isSelected
                  ? "border-primary bg-accent"
                  : "border-border bg-card web:hover:bg-muted",
              )}
              onPress={() => onSelect(range.index)}
            >
              <View
                className={cn(
                  "mt-0.5 size-[18px] items-center justify-center rounded-full border-2",
                  isSelected ? "border-primary" : "border-muted-foreground/50",
                )}
              >
                {isSelected ? <View className="size-2 rounded-full bg-primary" /> : null}
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-foreground">
                  {getImportRangeLabel(range)}
                </Text>
                <Text className="text-xs text-muted-foreground">{describeImportRange(range)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-xs leading-5 text-muted-foreground">
        남은 구간은 이 가져오기가 끝난 뒤 같은 파일을 다시 올려서 이어서 가져올 수 있어요. 이미
        가져온 링크는 자동으로 건너뛰어요.
      </Text>
    </View>
  );
}

type FooterAction = {
  label: string;
  variant?: "default" | "outline";
  icon?: React.ComponentProps<typeof Icon>["as"];
  onPress: () => void;
};

function Footer({ actions, isWide }: { actions: FooterAction[]; isWide: boolean }) {
  if (actions.length === 0) {
    return null;
  }
  return (
    <View
      className={cn(
        "flex-row gap-2",
        isWide && "-mx-6 -mb-6 justify-end border-t border-border-soft px-6 pb-5 pt-4",
      )}
    >
      {actions.map((action) => (
        <Button
          key={action.label}
          className={cn(
            "flex-row gap-1.5 rounded-xl",
            isWide ? "h-10 px-4" : "h-12 min-w-0 flex-1",
          )}
          variant={action.variant ?? "default"}
          onPress={action.onPress}
        >
          {action.icon ? (
            <Icon
              as={action.icon}
              className={cn(
                "size-4",
                action.variant === "outline" ? "text-foreground" : "text-primary-foreground",
              )}
            />
          ) : null}
          <Text className={isWide ? "text-sm font-semibold" : "text-base font-semibold"}>
            {action.label}
          </Text>
        </Button>
      ))}
    </View>
  );
}

function UploadDialog({
  open,
  isWide,
  step,
  onClose,
  onSelectFile,
  onChooseOtherFile,
  onPreviewRange,
  onRetryPreview,
}: UploadDialogProps) {
  const [rangeIndex, setRangeIndex] = React.useState(0);
  const rangeKey = step.name === "range" ? step.ranges : null;

  React.useEffect(() => {
    setRangeIndex(0);
  }, [rangeKey]);

  let title = "북마크 가져오기";
  let description: string | null = null;
  let body: React.ReactNode = null;
  let actions: FooterAction[] = [];

  switch (step.name) {
    case "upload":
      description = "브라우저에서 북마크를 HTML 파일로 내보낸 다음 올려 주세요.";
      body = (
        <UploadBody
          isWide={isWide}
          step={step}
          onSelectFile={onSelectFile}
        />
      );
      break;
    case "reading":
    case "preview-loading":
      body = (
        <CenteredState
          isLoading
          title="가져오기의 미리보기를 생성 중입니다."
          description={
            step.name === "reading"
              ? `${step.fileName} · 북마크를 읽고 있어요.`
              : `${step.fileName} · 링크 ${formatNumber(step.linkCount)}개를 정리하고 있어요.`
          }
        />
      );
      actions = [{ label: "취소", variant: "outline", onPress: onClose }];
      break;
    case "no-links":
      body = (
        <CenteredState
          icon={FileX}
          title="가져올 북마크가 없어요"
          description={`‘${step.fileName}’에서 가져올 수 있는 링크를 찾지 못했어요. 북마크가 들어 있는 브라우저에서 다시 내보내 주세요.`}
        />
      );
      actions = [
        { label: "닫기", variant: "outline", onPress: onClose },
        { label: "다른 파일 선택", onPress: onChooseOtherFile },
      ];
      break;
    case "preview-error":
      body = (
        <CenteredState
          icon={CircleAlert}
          title="미리보기를 만들지 못했어요"
          description="서버에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요."
        />
      );
      actions = [
        { label: "닫기", variant: "outline", onPress: onClose },
        { label: "다시 시도", icon: RotateCw, onPress: onRetryPreview },
      ];
      break;
    case "range": {
      title = "가져올 구간을 골라 주세요";
      description = step.fileName;
      const selected = step.ranges[rangeIndex] ?? step.ranges[0];
      body = (
        <RangeBody
          selectedIndex={selected.index}
          step={step}
          onSelect={setRangeIndex}
        />
      );
      actions = [
        { label: "다른 파일 선택", variant: "outline", onPress: onChooseOtherFile },
        { label: "이 구간으로 미리보기", onPress: () => onPreviewRange(selected) },
      ];
      break;
    }
    default:
      break;
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onClose();
    }
  };

  if (isWide) {
    return (
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="max-h-[90vh] w-[560px] max-w-[92vw] gap-5 rounded-[20px] sm:max-w-[92vw]">
          <DialogHeader className="pr-8">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {body}
          <Footer
            actions={actions}
            isWide
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet
      open={open}
      fitContent
      footer={
        actions.length > 0 ? (
          <Footer
            actions={actions}
            isWide={false}
          />
        ) : undefined
      }
      onOpenChange={handleOpenChange}
    >
      <View className="gap-4">
        <View className="gap-1 pr-8">
          <Text
            accessibilityRole="header"
            className="text-lg font-semibold text-foreground"
          >
            {title}
          </Text>
          {description ? (
            <Text className="text-sm text-muted-foreground">{description}</Text>
          ) : null}
        </View>
        {body}
      </View>
    </Sheet>
  );
}

export { UploadDialog };
