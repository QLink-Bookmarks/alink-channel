import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { ActivityIndicator } from "@/components/ui/activity-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";

import { getImportErrorName } from "../../api";
import type { ReversalStatus } from "../../hooks/use-reversal-status";
import {
  UNFILED_FOLDER_EMOJI,
  UNFILED_FOLDER_LABEL,
  canOpenImportedLinks,
  getImportFailureReasonLabel,
  getImportStartedCopy,
  getImportedLinksFolderId,
  isFillingThumbnails,
} from "../../lib/import-status-copy";
import { useImportQuery } from "../../queries";
import type { ImportDetail, ImportDetailFolder, ImportFailure } from "../../types";
import { ChangeMark } from "./change-mark";
import { ImportStatusBadge } from "./import-status-badge";
import { ReversalSuccessStatus } from "./reversal-success-status";

import * as Clipboard from "expo-clipboard";
import { type Href, useRouter } from "expo-router";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Copy,
  Undo2,
} from "lucide-react-native";

type ImportDetailViewProps = {
  importId: number;
  mode: "panel" | "page";
  onBack: () => void;
  onReverse: (detail: ImportDetail) => void;
  reversalStatus?: ReversalStatus | null;
};

const COPY_NOTICE_MS = 3000;
const COPY_SUCCESS = "주소를 복사했어요.";
const COPY_FAILURE = "주소를 복사하지 못했어요.";

type CopyNotice = { isSuccess: boolean; key: number };

function useCopyFeedback(isPage: boolean) {
  const showToast = useToastStore((state) => state.showToast);
  const [notice, setNotice] = React.useState<CopyNotice | null>(null);

  React.useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), COPY_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const report = React.useCallback(
    (isSuccess: boolean) => {
      if (isPage) {
        setNotice({ isSuccess, key: Date.now() });
        return;
      }
      showToast({
        durationMs: COPY_NOTICE_MS,
        sourceKey: "import-failure-copy",
        title: isSuccess ? COPY_SUCCESS : COPY_FAILURE,
        variant: isSuccess ? "success" : "error",
      });
    },
    [isPage, showToast],
  );

  return { notice, report };
}

function ImportDetailView({
  importId,
  mode,
  onBack,
  onReverse,
  reversalStatus,
}: ImportDetailViewProps) {
  const router = useRouter();
  const detailQuery = useImportQuery(importId);
  const copyFeedback = useCopyFeedback(mode === "page");
  const detail = detailQuery.data;
  const isNotFound =
    !Number.isFinite(importId) ||
    (detailQuery.isError && getImportErrorName(detailQuery.error) === "IMPORT_NOT_FOUND");

  if (isNotFound) {
    return (
      <DetailNotice
        mode={mode}
        title="가져오기 기록을 찾을 수 없어요"
        description="삭제되었거나 접근할 수 없는 기록이에요."
        actionLabel="가져오기 기록으로"
        onAction={onBack}
        onBack={onBack}
      />
    );
  }

  if (detailQuery.isError && !detail) {
    return (
      <DetailNotice
        mode={mode}
        title="기록을 불러오지 못했어요"
        description="네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        actionLabel="다시 시도"
        onAction={() => void detailQuery.refetch()}
        onBack={onBack}
      />
    );
  }

  if (!detail) {
    return (
      <View className="flex-1">
        {mode === "panel" ? <PanelHeader onBack={onBack} /> : null}
        <ActivityIndicator
          size="large"
          className="flex-1 py-16"
        />
      </View>
    );
  }

  const linksFolderId = canOpenImportedLinks(detail) ? getImportedLinksFolderId(detail) : null;
  const handleOpenLinks = () => {
    if (linksFolderId != null) {
      router.push(`/folders/${linksFolderId}` as Href);
    }
  };
  const statusBadge = (
    <ImportStatusBadge
      status={detail.status}
      isFillingThumbnails={isFillingThumbnails(detail)}
    />
  );
  const isPage = mode === "page";
  const openLinksButton =
    linksFolderId != null ? (
      <Button
        size={isPage ? "lg" : "default"}
        className={isPage ? "w-full" : undefined}
        onPress={handleOpenLinks}
      >
        <Text>가져온 링크 보기</Text>
        <Icon
          as={ArrowRight}
          size={16}
          className="text-primary-foreground"
        />
      </Button>
    ) : null;
  const reverseButton = detail.isReversible ? (
    <Button
      variant="outline"
      size={isPage ? "lg" : "default"}
      className={isPage ? "w-full" : undefined}
      accessibilityLabel="이 가져오기 되돌리기"
      onPress={() => onReverse(detail)}
    >
      <Icon
        as={Undo2}
        size={16}
        className="text-foreground"
      />
      <Text>되돌리기</Text>
    </Button>
  ) : null;

  return (
    <View className="flex-1">
      <View
        className={cn(
          "gap-2",
          isPage
            ? "items-start px-4 pb-1 pt-4"
            : "flex-row items-center border-b border-border px-3 py-3",
        )}
      >
        {mode === "panel" ? (
          <IconButton
            accessibilityLabel="가져오기 기록으로"
            hitSlop={4}
            icon={ChevronLeft}
            size="sm"
            variant="ghost"
            onPress={onBack}
          />
        ) : null}
        <Text
          role="heading"
          className={cn(
            "min-w-0 text-lg font-semibold text-foreground",
            isPage ? "self-stretch" : "flex-1",
          )}
          numberOfLines={1}
        >
          {detail.fileName}
        </Text>
        {statusBadge}
      </View>

      {reversalStatus !== undefined ? (
        <View className="px-4">
          <ReversalSuccessStatus status={reversalStatus} />
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 p-4"
        showsVerticalScrollIndicator={false}
      >
        <DetailSummary detail={detail} />
        <DetailFailures
          detail={detail}
          onCopyResult={copyFeedback.report}
        />
        <DetailFolders detail={detail} />
      </ScrollView>

      {openLinksButton || reverseButton || copyFeedback.notice ? (
        <View
          className={cn(
            "border-t border-border bg-background px-4 py-3",
            isPage ? "gap-2" : "flex-row justify-end gap-2",
          )}
        >
          {isPage && copyFeedback.notice ? (
            <View
              key={copyFeedback.notice.key}
              role="status"
              accessibilityLiveRegion="polite"
              className="flex-row items-center justify-center gap-1.5 py-1"
              testID="import-copy-notice"
            >
              <Icon
                as={copyFeedback.notice.isSuccess ? CircleCheck : CircleAlert}
                size={16}
                className={copyFeedback.notice.isSuccess ? "text-success" : "text-destructive"}
              />
              <Text className="text-base font-medium text-foreground">
                {copyFeedback.notice.isSuccess ? COPY_SUCCESS : COPY_FAILURE}
              </Text>
            </View>
          ) : null}
          {isPage ? openLinksButton : reverseButton}
          {isPage ? reverseButton : openLinksButton}
        </View>
      ) : null}
    </View>
  );
}

function PanelHeader({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-row items-center gap-2 border-b border-border px-3 py-3">
      <IconButton
        accessibilityLabel="가져오기 기록으로"
        hitSlop={4}
        icon={ChevronLeft}
        size="sm"
        variant="ghost"
        onPress={onBack}
      />
    </View>
  );
}

function DetailNotice({
  mode,
  title,
  description,
  actionLabel,
  onAction,
  onBack,
}: {
  mode: "panel" | "page";
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  onBack: () => void;
}) {
  return (
    <View className="flex-1">
      {mode === "panel" ? <PanelHeader onBack={onBack} /> : null}
      <View className="flex-1 items-center justify-center gap-3 px-6 py-16">
        <Text className="text-center text-base font-semibold text-foreground">{title}</Text>
        <Text className="text-center text-sm text-muted-foreground">{description}</Text>
        <Button
          variant="outline"
          onPress={onAction}
        >
          <Text>{actionLabel}</Text>
        </Button>
      </View>
    </View>
  );
}

function DetailSummary({ detail }: { detail: ImportDetail }) {
  const startedCopy = getImportStartedCopy(detail.createdAt);
  return (
    <View className="gap-3">
      {startedCopy ? <Text className="text-sm text-muted-foreground">{startedCopy}</Text> : null}
      {detail.skippedCount > 0 ? (
        <Text className="text-sm text-muted-foreground">
          이미 저장된 링크 {detail.skippedCount}개는 건너뛰었어요.
        </Text>
      ) : null}
      <View className="flex-row overflow-hidden rounded-2xl border border-border bg-card">
        <SummaryCell
          label="추가된 링크"
          value={`+${detail.linkCount}`}
          isAdded
        />
        <SummaryCell
          label="새 폴더"
          value={`+${detail.folderCount}`}
          isAdded
          hasDivider
        />
        <SummaryCell
          label="실패"
          value={String(detail.failedCount)}
          hasDivider
        />
      </View>
    </View>
  );
}

function SummaryCell({
  label,
  value,
  isAdded,
  hasDivider,
}: {
  label: string;
  value: string;
  isAdded?: boolean;
  hasDivider?: boolean;
}) {
  return (
    <View
      className={cn("flex-1 gap-1 px-3 py-3", hasDivider && "border-l border-border")}
      role="group"
      aria-label={label}
    >
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className={cn("text-lg font-bold", isAdded ? "text-success" : "text-foreground")}>
        {value}
      </Text>
    </View>
  );
}

function DetailFailures({
  detail,
  onCopyResult,
}: {
  detail: ImportDetail;
  onCopyResult: (isSuccess: boolean) => void;
}) {
  if (detail.failures.length === 0) {
    return null;
  }
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">
        실패한 항목 {detail.failures.length}개
      </Text>
      <View
        className="overflow-hidden rounded-2xl border border-border bg-card"
        role="list"
        aria-label="실패한 항목"
      >
        {detail.failures.map((failure, index) => (
          <DetailFailureRow
            key={`${failure.url}-${index}`}
            failure={failure}
            isFirst={index === 0}
            onCopyResult={onCopyResult}
          />
        ))}
      </View>
    </View>
  );
}

function DetailFailureRow({
  failure,
  isFirst,
  onCopyResult,
}: {
  failure: ImportFailure;
  isFirst: boolean;
  onCopyResult: (isSuccess: boolean) => void;
}) {
  const name = failure.title || failure.url;
  const handleCopy = () => {
    Clipboard.setStringAsync(failure.url)
      .then((copied) => onCopyResult(copied !== false))
      .catch(() => onCopyResult(false));
  };

  return (
    <View
      role="listitem"
      className={cn(
        "min-w-0 flex-row items-center gap-2 overflow-hidden py-1.5 pl-3 pr-1",
        !isFirst && "border-t border-border",
      )}
    >
      <View className="min-w-0 flex-1 gap-0.5 py-1">
        <Text
          className="text-base font-medium text-foreground"
          numberOfLines={1}
        >
          {name}
        </Text>
        {failure.title ? (
          <Text
            className="text-sm text-muted-foreground"
            numberOfLines={1}
          >
            {failure.url}
          </Text>
        ) : null}
        <Text className="text-sm text-destructive">
          {getImportFailureReasonLabel(failure.reason)}
        </Text>
      </View>
      <IconButton
        accessibilityLabel={`${name} 주소 복사`}
        icon={Copy}
        size="md"
        variant="ghost"
        onPress={handleCopy}
      />
    </View>
  );
}

function getFolderLabel(folder: ImportDetailFolder) {
  if (folder.kind === "UNFILED" || folder.name == null) {
    return { name: UNFILED_FOLDER_LABEL, emoji: UNFILED_FOLDER_EMOJI };
  }
  return { name: folder.name, emoji: folder.emoji ?? null };
}

function DetailFolders({ detail }: { detail: ImportDetail }) {
  const folders = detail.folders.filter((folder) => folder.links.length > 0);
  if (folders.length === 0) {
    return null;
  }
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">추가된 폴더와 링크</Text>
      <View className="gap-2">
        {folders.map((folder, index) => (
          <DetailFolder
            key={`${folder.kind}-${folder.folderId ?? "unfiled"}-${index}`}
            folder={folder}
            defaultExpanded={index === 0}
          />
        ))}
      </View>
    </View>
  );
}

function DetailFolder({
  folder,
  defaultExpanded,
}: {
  folder: ImportDetailFolder;
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const { name, emoji } = getFolderLabel(folder);
  const tag = folder.kind === "EXISTING" ? "기존 폴더" : folder.kind === "NEW" ? "새 폴더" : null;

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${name} 링크 ${folder.links.length}개 ${isExpanded ? "접기" : "펼치기"}`}
        className="min-h-11 flex-row items-center gap-2 px-3 py-2 active:bg-accent web:hover:bg-accent"
        onPress={() => setIsExpanded((value) => !value)}
      >
        <Icon
          as={isExpanded ? ChevronDown : ChevronRight}
          size={16}
          className="text-muted-foreground"
        />
        <ChangeMark kind="add" />
        <Text
          className="min-w-0 shrink text-sm font-semibold text-foreground"
          numberOfLines={1}
        >
          {emoji ? `${emoji} ` : ""}
          {name}
        </Text>
        {tag ? (
          <Badge
            variant="private"
            className="border-border bg-card"
          >
            <Text className="text-sm text-foreground/70">{tag}</Text>
          </Badge>
        ) : null}
        <Text className="ml-auto text-sm font-semibold text-success">+{folder.links.length}</Text>
      </Pressable>
      {isExpanded ? (
        <View role="list">
          {folder.links.map((link) => (
            <View
              key={link.linkId}
              role="listitem"
              className="flex-row items-center gap-2 border-t border-border py-2 pl-10 pr-3"
            >
              <ChangeMark kind="add" />
              <Text
                className="min-w-0 flex-1 text-sm text-foreground"
                numberOfLines={1}
              >
                {link.title || link.url}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export { ImportDetailView };
