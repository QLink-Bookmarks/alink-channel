import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Sheet } from "@/components/layout/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { ProposalInput } from "../../hooks/use-import-flow";
import { type ImportProposal, useImportProposal } from "../../hooks/use-import-proposal";
import { useDragScrollContainer, useLinkDragDrop } from "../../hooks/use-link-drag";
import {
  type ClientRequestIdMemo,
  buildStartRequestBody,
  getStartRequestSignature,
  resolveClientRequestId,
} from "../../lib/build-start-request";
import { type ProposalLink, getExistingTarget } from "../../lib/proposal-state";
import { formatNumber } from "../../lib/split-import-ranges";
import { useStartImportMutation } from "../../mutations";
import { ImportConfirmDialog } from "./import-confirm-dialog";
import { ProposalDragLayer } from "./proposal-drop-tray";
import { ProposalFolderList } from "./proposal-folder-list";
import { ProposalFolderPicker } from "./proposal-folder-picker";
import {
  type ProposalFolderEntries,
  type ProposalSelection,
  getInitialSelection,
  getProposalFolders,
} from "./proposal-folders";
import { ProposalLinkPane, SkippedList, UnsupportedList } from "./proposal-link-pane";
import { ProposalStatusBar } from "./proposal-status-bar";
import { ProposalSummary } from "./proposal-summary";

import { ChevronDown, ChevronRight, CircleCheck, X } from "lucide-react-native/icons";
import { v4 as createUuid } from "uuid";

type ProposalModalProps = {
  fileName: string;
  input: ProposalInput;
  isWide: boolean;
  onClose: () => void;
  onStarted: () => void;
};

const TITLE = "가져올 내용을 확인해 주세요";

function getFooterCaption(addCount: number, newFolderCount: number) {
  return addCount > 0
    ? `링크 ${formatNumber(addCount)}개와 새 폴더 ${formatNumber(newFolderCount)}개를 추가해요`
    : "가져올 링크가 없어서 가져오기를 할 수 없어요";
}

function isSelectionValid(selection: ProposalSelection, entries: ProposalFolderEntries) {
  if (selection.kind !== "target") {
    return true;
  }
  return (
    selection.target === entries.unfiled.target ||
    entries.mine.some((entry) => entry.target === selection.target) ||
    entries.added.some((entry) => entry.target === selection.target)
  );
}

function CollapsibleList({ title, children }: { title: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(true);
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      <Pressable
        accessibilityRole="button"
        aria-expanded={isOpen}
        className="min-h-12 flex-row items-center gap-2 px-4 active:bg-muted web:hover:bg-muted"
        onPress={() => setIsOpen((current) => !current)}
      >
        <Icon
          as={isOpen ? ChevronDown : ChevronRight}
          className="size-4 text-muted-foreground"
        />
        <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground">{title}</Text>
        <Text className="text-xs text-muted-foreground">{isOpen ? "접기" : "펼치기"}</Text>
      </Pressable>
      {isOpen ? <View className="border-t border-border px-2">{children}</View> : null}
    </View>
  );
}

function NothingToAdd({ proposal }: { proposal: ImportProposal }) {
  const { skipped, unsupported } = proposal.state;
  return (
    <View className="items-center gap-4 px-2 py-8">
      <View className="items-center gap-2">
        <View className="mb-2 size-12 items-center justify-center rounded-2xl bg-muted">
          <Icon
            as={CircleCheck}
            className="size-5 text-muted-foreground"
          />
        </View>
        <Text className="text-center text-lg font-semibold text-foreground">
          새로 추가할 링크가 없어요
        </Text>
        <Text className="max-w-[360px] text-center text-[13px] text-muted-foreground">
          이 파일에는 이미 저장된 링크 {formatNumber(skipped.length)}개와 가져올 수 없는 링크{" "}
          {formatNumber(unsupported.length)}개만 있어요. 다른 브라우저에서 내보낸 파일이 있다면 그
          파일을 올려 주세요.
        </Text>
      </View>
      <View className="w-full max-w-[560px] gap-3">
        {skipped.length > 0 ? (
          <CollapsibleList
            title={`이미 저장된 링크 ${formatNumber(skipped.length)}개는 건너뛰어요`}
          >
            <SkippedList links={skipped} />
          </CollapsibleList>
        ) : null}
        {unsupported.length > 0 ? (
          <CollapsibleList title={`가져오기 불가 링크 ${formatNumber(unsupported.length)}개`}>
            <UnsupportedList links={unsupported} />
          </CollapsibleList>
        ) : null}
      </View>
    </View>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="닫기"
      accessibilityRole="button"
      testID="import-proposal-close"
      className="-mr-2 -mt-1 size-10 items-center justify-center rounded-full active:bg-muted web:hover:bg-muted"
      hitSlop={6}
      onPress={onPress}
    >
      <Icon
        as={X}
        className="size-[18px] text-muted-foreground"
      />
    </Pressable>
  );
}

function ProposalModal({ fileName, input, isWide, onClose, onStarted }: ProposalModalProps) {
  const proposal = useImportProposal(input);
  const { state, summary, isDirty } = proposal;
  const entries = React.useMemo(
    () => getProposalFolders(state, proposal.myFolders),
    [proposal.myFolders, state],
  );
  const [selection, setSelection] = React.useState<ProposalSelection | null>(null);
  const [renamingTarget, setRenamingTarget] = React.useState<string | null>(null);
  const [pickerLink, setPickerLink] = React.useState<ProposalLink | null>(null);
  const isPickerOpenRef = React.useRef(false);
  isPickerOpenRef.current = pickerLink != null;
  const [isDiscardOpen, setIsDiscardOpen] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const startMutation = useStartImportMutation();
  const leftScrollRef = useDragScrollContainer();
  const rightScrollRef = useDragScrollContainer();
  const hasNothingToAdd = state.links.length === 0;

  useLinkDragDrop(proposal.moveLink);

  const initialSelection = React.useMemo(() => getInitialSelection(entries), [entries]);
  const validSelection =
    selection &&
    isSelectionValid(selection, entries) &&
    !(selection.kind === "removed" && summary.removedCount === 0)
      ? selection
      : null;
  const activeSelection = isWide ? (validSelection ?? initialSelection) : validSelection;

  const requestClose = React.useCallback(() => {
    if (isSaving) {
      return;
    }
    if (isDirty) {
      setIsDiscardOpen(true);
      return;
    }
    onClose();
  }, [isDirty, isSaving, onClose]);

  const handleSelect = React.useCallback((next: ProposalSelection) => {
    setRenamingTarget(null);
    setSelection(next);
  }, []);

  const handleRenameStart = React.useCallback((target: string) => {
    setSelection({ kind: "target", target });
    setRenamingTarget(target);
  }, []);

  const { renameNewFolder } = proposal;
  const handleRenameEnd = React.useCallback(
    (target: string, value: string | null) => {
      setRenamingTarget(null);
      if (value == null) {
        return;
      }
      const check = renameNewFolder(target, value);
      if (check.type === "merge-existing") {
        setSelection({ kind: "target", target: getExistingTarget(check.folderId) });
      } else if (check.type === "merge-new") {
        setSelection({ kind: "target", target: check.target });
      }
    },
    [renameNewFolder],
  );

  const { discardUnusedPickerFolders } = proposal;
  const handlePickerClose = React.useCallback(() => {
    setPickerLink(null);
    discardUnusedPickerFolders();
  }, [discardUnusedPickerFolders]);

  const { mutateAsync: startImport } = startMutation;
  const clientRequestRef = React.useRef<ClientRequestIdMemo | null>(null);
  const handleStart = React.useCallback(async () => {
    const body = buildStartRequestBody({ state, fileName });
    const memo = resolveClientRequestId(
      clientRequestRef.current,
      getStartRequestSignature(body),
      createUuid,
    );
    clientRequestRef.current = memo;
    await startImport({ clientRequestId: memo.id, ...body });
    onStarted();
  }, [fileName, onStarted, startImport, state]);

  const handleShowSkipped = React.useCallback(
    () => handleSelect({ kind: "skipped" }),
    [handleSelect],
  );
  const handleShowUnsupported = React.useCallback(
    () => handleSelect({ kind: "unsupported" }),
    [handleSelect],
  );

  const statusBar = proposal.statusLine ? (
    <ProposalStatusBar
      isWide={isWide}
      line={proposal.statusLine}
      onDismiss={proposal.dismissChange}
      onUndo={proposal.undo}
    />
  ) : null;

  const summaryView = (
    <ProposalSummary
      isWide={isWide}
      summary={summary}
      onShowSkipped={handleShowSkipped}
      onShowUnsupported={handleShowUnsupported}
    />
  );

  const folderList = (
    <ProposalFolderList
      entries={entries}
      isWide={isWide}
      selection={activeSelection}
      removedCount={summary.removedCount}
      skipCount={summary.skipCount}
      unsupportedCount={summary.unsupportedCount}
      onRename={handleRenameStart}
      onSelect={handleSelect}
    />
  );

  const linkPane = activeSelection ? (
    <ProposalLinkPane
      isWide={isWide}
      proposal={proposal}
      renamingTarget={renamingTarget}
      selection={activeSelection}
      onBack={isWide ? undefined : () => setSelection(null)}
      onOpenPicker={setPickerLink}
      onRenameEnd={handleRenameEnd}
      onRenameStart={handleRenameStart}
      onSelect={handleSelect}
    />
  ) : null;

  const caption = getFooterCaption(summary.addCount, summary.newFolderCount);
  const canImport = summary.addCount > 0 && !isSaving;

  const overlays = (
    <>
      <ProposalFolderPicker
        isWide={isWide}
        link={pickerLink}
        proposal={proposal}
        onClose={handlePickerClose}
      />
      <ImportConfirmDialog
        folderCount={summary.newFolderCount}
        linkCount={summary.addCount}
        open={isConfirmOpen}
        onCancel={() => setIsConfirmOpen(false)}
        onPendingChange={setIsSaving}
        onStart={handleStart}
      />
      <AlertDialog
        open={isDiscardOpen}
        onOpenChange={setIsDiscardOpen}
      >
        <AlertDialogContent className="w-[400px] max-w-[92vw] sm:max-w-[92vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>수정한 내용이 사라져요</AlertDialogTitle>
            <AlertDialogDescription>
              지금 닫으면 옮기거나 지운 내용과 바꾼 폴더 이름이 모두 사라져요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel>
              <Text>계속 수정하기</Text>
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onPress={() => {
                setIsDiscardOpen(false);
                onClose();
              }}
            >
              <Text>닫기</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  const dragLayer = (
    <ProposalDragLayer
      entries={entries}
      isWide={isWide}
    />
  );

  if (isWide) {
    return (
      <>
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              requestClose();
            }
          }}
        >
          <DialogContent
            hideCloseButton
            className="h-[88vh] max-h-[880px] w-[1080px] max-w-[94vw] gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[94vw]"
          >
            <View className="flex-row items-start gap-3 px-6 pb-4 pt-6">
              <View className="min-w-0 flex-1 gap-1">
                <DialogTitle className="text-xl font-bold">{TITLE}</DialogTitle>
                <DialogDescription numberOfLines={1}>{fileName}</DialogDescription>
              </View>
              <CloseButton onPress={requestClose} />
            </View>
            <View className="gap-3 px-6">
              {summaryView}
              {statusBar}
            </View>
            {hasNothingToAdd ? (
              <ScrollView
                className="min-h-0 flex-1"
                contentContainerClassName="px-6"
                contentInsetAdjustmentBehavior="automatic"
              >
                <NothingToAdd proposal={proposal} />
              </ScrollView>
            ) : (
              <View className="mx-6 mt-3 min-h-0 flex-1 flex-row overflow-hidden rounded-2xl border border-border">
                <ScrollView
                  ref={leftScrollRef}
                  accessibilityLabel="폴더"
                  className="w-[320px] grow-0 border-r border-border bg-muted/40"
                  contentContainerClassName="p-2"
                  contentInsetAdjustmentBehavior="automatic"
                >
                  {folderList}
                </ScrollView>
                <ScrollView
                  ref={rightScrollRef}
                  accessibilityLabel="선택한 폴더의 링크"
                  className="min-w-0 flex-1"
                  contentInsetAdjustmentBehavior="automatic"
                >
                  {linkPane}
                </ScrollView>
              </View>
            )}
            <View className="mt-4 flex-row items-center gap-3 border-t border-border px-6 py-4">
              <Text className="min-w-0 flex-1 text-[13px] text-muted-foreground">{caption}</Text>
              <Button
                className="h-10 rounded-xl px-4"
                disabled={isSaving}
                variant="outline"
                onPress={requestClose}
              >
                <Text className="text-sm font-semibold">{hasNothingToAdd ? "닫기" : "취소"}</Text>
              </Button>
              <Button
                className="h-10 rounded-xl px-4"
                disabled={!canImport}
                onPress={() => setIsConfirmOpen(true)}
              >
                <Text className="text-sm font-semibold">가져오기</Text>
              </Button>
            </View>
            {dragLayer}
          </DialogContent>
        </Dialog>
        {overlays}
      </>
    );
  }

  return (
    <>
      <Sheet
        open
        defaultSize="92%"
        dismissible={!isDirty && !isSaving}
        footer={
          <View className="gap-2">
            <Button
              className="h-12 w-full rounded-xl"
              disabled={!canImport}
              onPress={() => setIsConfirmOpen(true)}
            >
              <Text className="text-base font-semibold">가져오기</Text>
            </Button>
            <Button
              className="h-12 w-full rounded-xl"
              disabled={isSaving}
              variant="outline"
              onPress={requestClose}
            >
              <Text className="text-base font-semibold">{hasNothingToAdd ? "닫기" : "취소"}</Text>
            </Button>
            <Text className="text-center text-xs text-muted-foreground">{caption}</Text>
          </View>
        }
        hideCloseButton
        maxSize="92%"
        onOpenChange={(open) => {
          if (!open && !isPickerOpenRef.current) {
            requestClose();
          }
        }}
      >
        <View className="gap-4">
          <View className="flex-row items-start gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <Text
                accessibilityRole="header"
                className="text-lg font-bold text-foreground"
              >
                {TITLE}
              </Text>
              <Text
                className="text-xs text-muted-foreground"
                numberOfLines={1}
              >
                {fileName}
              </Text>
            </View>
            <CloseButton onPress={requestClose} />
          </View>
          {summaryView}
          {statusBar}
          {hasNothingToAdd ? (
            <NothingToAdd proposal={proposal} />
          ) : (
            <View className={cn(activeSelection ? "" : "-mx-1")}>
              {activeSelection ? linkPane : folderList}
            </View>
          )}
        </View>
      </Sheet>
      {overlays}
      {dragLayer}
    </>
  );
}

export { ProposalModal };
