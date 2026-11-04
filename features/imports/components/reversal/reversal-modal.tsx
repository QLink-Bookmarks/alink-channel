import * as React from "react";
import { ScrollView, View } from "react-native";

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
import { useWideView } from "@/lib/hooks/use-wide-view";

import { useReversalSelection } from "../../hooks/use-reversal-selection";
import { formatImportTime } from "../../lib/import-status-copy";
import type { ReversalFolderItem } from "../../lib/reversal-selection";
import type { ImportSummary } from "../../types";
import { getReversalErrorCopy, getReversalHint } from "./reversal-copy";
import { ReversalFolderPane } from "./reversal-folder-pane";
import { ReversalFolderRow } from "./reversal-folder-row";

import { CircleAlert, RefreshCw } from "lucide-react-native";

type ReversalTarget = Pick<ImportSummary, "id" | "fileName" | "createdAt">;

type ReversalModalProps = {
  target: ReversalTarget | null;
  onClose: () => void;
};

function ReversalModal({ target, onClose }: ReversalModalProps) {
  const isWide = useWideView();
  const open = target != null;
  const [sessionKey, setSessionKey] = React.useState(0);
  const [wasOpen, setWasOpen] = React.useState(open);
  const [lastTarget, setLastTarget] = React.useState<ReversalTarget | null>(target);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSessionKey((key) => key + 1);
    }
  }
  if (target && target !== lastTarget) {
    setLastTarget(target);
  }
  const shown = target ?? lastTarget;
  if (!shown) {
    return null;
  }
  return (
    <ReversalSession
      key={sessionKey}
      target={shown}
      open={open}
      isWide={isWide}
      onClose={onClose}
    />
  );
}

function pickDefaultFolder(folders: ReversalFolderItem[]) {
  return folders.find((folder) => folder.isRemovable) ?? folders[0];
}

function ReversalSession({
  target,
  open,
  isWide,
  onClose,
}: {
  target: ReversalTarget;
  open: boolean;
  isWide: boolean;
  onClose: () => void;
}) {
  const selection = useReversalSelection({
    importId: target.id,
    enabled: open,
    onReversed: onClose,
  });
  const { counts, error, exclusions, folders, hasRemaining, isSubmitting, previewQuery } =
    selection;
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [mobileView, setMobileView] = React.useState<"list" | "folder">("list");
  const activeFolder =
    folders.find((folder) => folder.key === activeKey) ?? pickDefaultFolder(folders);

  const handleClose = React.useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) {
        handleClose();
      }
    },
    [handleClose],
  );
  const handleSelectFolder = React.useCallback((folder: ReversalFolderItem) => {
    setActiveKey(folder.key);
    setMobileView("folder");
  }, []);
  const handleSubmit = React.useCallback(() => {
    void selection.submit();
  }, [selection]);

  const time = formatImportTime(target.createdAt);
  const subtitle = [target.fileName, time, "남길 항목은 체크를 풀어 주세요."]
    .filter(Boolean)
    .join(" · ");
  const hasSelection = counts.links > 0 || counts.folders > 0;
  const isRetry = error?.kind === "failed" && hasRemaining;
  const hint = !hasRemaining
    ? { text: "더 지울 항목이 없어요.", editedNote: null }
    : getReversalHint(counts, { hasError: error != null });
  const submitLabel = isSubmitting ? "되돌리는 중…" : isRetry ? "남은 항목 다시 시도" : "되돌리기";
  const errorCopy = error
    ? getReversalErrorCopy(error.kind, { doneLinkCount: selection.doneLinkCount, hasRemaining })
    : null;

  const errorAlert = errorCopy ? (
    <Alert
      icon={CircleAlert}
      variant="destructive"
    >
      <AlertTitle>{errorCopy.title}</AlertTitle>
      <AlertDescription>{errorCopy.description}</AlertDescription>
    </Alert>
  ) : null;

  const submitButton = (
    <Button
      variant="destructive"
      size={isWide ? "default" : "lg"}
      className={isWide ? undefined : "w-full"}
      disabled={!hasSelection || isSubmitting || !hasRemaining || error?.kind === "not-found"}
      onPress={handleSubmit}
    >
      {isRetry && !isSubmitting ? (
        <Icon
          as={RefreshCw}
          size={16}
          className="text-white"
        />
      ) : null}
      <Text>{submitLabel}</Text>
    </Button>
  );
  const cancelButton = (
    <Button
      variant="outline"
      size={isWide ? "default" : "lg"}
      className={isWide ? undefined : "w-full"}
      disabled={isSubmitting}
      onPress={handleClose}
    >
      <Text>{hasRemaining ? "취소" : "닫기"}</Text>
    </Button>
  );

  const status = renderStatus(previewQuery, folders.length);

  const folderRows = (showChevron: boolean) => (
    <View
      className="gap-0.5"
      role="list"
      aria-label="되돌릴 폴더"
    >
      {folders.map((folder) => (
        <View
          key={folder.key}
          role="listitem"
        >
          <ReversalFolderRow
            folder={folder}
            exclusions={exclusions}
            isActive={isWide && folder.key === activeFolder?.key}
            showChevron={showChevron}
            disabled={isSubmitting}
            onSelect={handleSelectFolder}
            onToggle={selection.toggleFolder}
          />
        </View>
      ))}
    </View>
  );

  if (isWide) {
    return (
      <Dialog
        open={open}
        onOpenChange={handleOpenChange}
      >
        <DialogContent
          hideCloseButton={isSubmitting}
          className="h-[90vh] max-h-[800px] w-[68rem] max-w-[94vw] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[68rem]"
        >
          <DialogHeader className="gap-1 px-6 pb-4 pr-12 pt-5 text-left">
            <DialogTitle>가져오기를 되돌릴까요?</DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </DialogHeader>
          <View className="min-h-0 flex-1 gap-3 px-6 pb-4">
            {errorAlert}
            {status ?? (
              <View className="min-h-0 flex-1 flex-row overflow-hidden rounded-2xl border border-border">
                <ScrollView
                  className="w-80 max-w-[40%] grow-0 border-r border-border"
                  contentContainerClassName="p-2"
                  showsVerticalScrollIndicator={false}
                >
                  {folderRows(false)}
                </ScrollView>
                <ScrollView
                  className="flex-1"
                  showsVerticalScrollIndicator={false}
                >
                  {activeFolder ? (
                    <ReversalFolderPane
                      folder={activeFolder}
                      exclusions={exclusions}
                      disabled={isSubmitting}
                      onToggleFolder={selection.toggleFolder}
                      onToggleLink={selection.toggleLink}
                    />
                  ) : null}
                </ScrollView>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-3 border-t border-border px-6 py-4">
            <Text
              className="flex-1 text-sm text-muted-foreground"
              testID="reversal-hint"
            >
              {hint.text}
              {hint.editedNote ? (
                <Text className="text-sm font-semibold text-warning"> {hint.editedNote}</Text>
              ) : null}
            </Text>
            {cancelButton}
            {submitButton}
          </View>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet
      open={open}
      dismissible={!isSubmitting}
      defaultSize="88%"
      maxSize="92%"
      footer={
        <View className="gap-3">
          <View
            className="gap-0.5"
            testID="reversal-hint"
          >
            <Text className="text-sm text-muted-foreground">{hint.text}</Text>
            {hint.editedNote ? (
              <Text className="text-sm font-semibold text-warning">{hint.editedNote}</Text>
            ) : null}
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">{cancelButton}</View>
            <View className="flex-1">{submitButton}</View>
          </View>
        </View>
      }
      onOpenChange={handleOpenChange}
    >
      <View className="gap-1 pr-10">
        <Text
          role="heading"
          className="text-lg font-semibold text-foreground"
        >
          가져오기를 되돌릴까요?
        </Text>
        <Text className="text-sm text-muted-foreground">{subtitle}</Text>
      </View>
      {errorAlert}
      {status ??
        (mobileView === "folder" && activeFolder ? (
          <View className="-mx-4">
            <ReversalFolderPane
              folder={activeFolder}
              exclusions={exclusions}
              disabled={isSubmitting}
              onBack={() => setMobileView("list")}
              onToggleFolder={selection.toggleFolder}
              onToggleLink={selection.toggleLink}
            />
          </View>
        ) : (
          <View className="-mx-2">{folderRows(true)}</View>
        ))}
    </Sheet>
  );
}

function renderStatus(
  previewQuery: ReturnType<typeof useReversalSelection>["previewQuery"],
  folderCount: number,
) {
  if (previewQuery.isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (previewQuery.isError && !previewQuery.data) {
    return (
      <View className="flex-1 items-center justify-center gap-3 py-16">
        <Text className="text-base font-semibold text-foreground">
          되돌릴 항목을 불러오지 못했어요
        </Text>
        <Button
          variant="outline"
          onPress={() => void previewQuery.refetch()}
        >
          <Text>다시 시도</Text>
        </Button>
      </View>
    );
  }
  if (folderCount === 0) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Text className="text-sm text-muted-foreground">되돌릴 항목이 남아 있지 않아요.</Text>
      </View>
    );
  }
  return null;
}

export { ReversalModal };
export type { ReversalTarget };
