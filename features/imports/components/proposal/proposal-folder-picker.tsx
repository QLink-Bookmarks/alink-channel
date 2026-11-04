import * as React from "react";
import { View } from "react-native";

import { useIsInsideSheet } from "@/components/layout/sheet";
import { Text } from "@/components/ui/text";
import { FolderPickerDialog } from "@/features/folders/components/folder-picker-dialog";
import {
  FolderPickerRow,
  type FolderPickerSelection,
  getFolderLabel,
  useFolderPickerListMaxHeight,
} from "@/features/folders/components/folder-picker-list";
import { FolderSectionsView } from "@/features/folders/components/folder-sections";
import { NestedListBoundary } from "@/features/folders/components/nested-list-boundary";
import { cn } from "@/lib/utils";

import type { ImportProposal } from "../../hooks/use-import-proposal";
import {
  type ProposalLink,
  type ProposalTarget,
  UNFILED_TARGET,
  getExistingTarget,
  isNewTarget,
} from "../../lib/proposal-state";
import { withRo, withWa } from "./proposal-copy";
import { KEYBOARD_HINT, type NameHint, ProposalNameInput } from "./proposal-name-input";

type PickerSectionKey = "existing" | "new";

type PickerRow =
  | { kind: "folder"; id: ProposalTarget; label: string; name: string; emoji: string }
  | { kind: "draft" };

type PickerListProps = {
  link: ProposalLink;
  proposal: ImportProposal;
  selectedId: string | null;
  isPending: boolean;
  listMaxHeight?: number;
  className?: string;
  onSelect: (selection: FolderPickerSelection<string>) => void;
};

const UNFILED_OPTION = { label: "미분류", emoji: "🗂️" };
const DEFAULT_FOLDER_EMOJI = "📁";
const DRAFT_KEY = "draft";

function getRowKey(row: PickerRow) {
  return row.kind === "draft" ? DRAFT_KEY : row.id;
}

function getInitialSection(target: ProposalTarget): PickerSectionKey {
  return isNewTarget(target) ? "new" : "existing";
}

function ProposalPickerList({
  link,
  proposal,
  selectedId,
  isPending,
  listMaxHeight,
  className,
  onSelect,
}: PickerListProps) {
  const isLarge = useIsInsideSheet();
  const maxHeight = useFolderPickerListMaxHeight(listMaxHeight);
  const [openSection, setOpenSection] = React.useState<PickerSectionKey | null>(() =>
    getInitialSection(link.target),
  );
  const [isDrafting, setIsDrafting] = React.useState(false);
  const { myFolders, state } = proposal;

  const sections = React.useMemo(() => {
    const existingRows: PickerRow[] = myFolders
      .filter((folder) => !folder.isShared)
      .map((folder) => ({
        kind: "folder",
        id: getExistingTarget(folder.id),
        label: getFolderLabel(folder),
        name: folder.name,
        emoji: folder.emoji ?? DEFAULT_FOLDER_EMOJI,
      }));
    const newRows: PickerRow[] = state.newFolders.map((folder) => ({
      kind: "folder",
      id: folder.target,
      label: folder.name,
      name: folder.name,
      emoji: DEFAULT_FOLDER_EMOJI,
    }));
    return [
      { key: "existing" as const, label: "내 폴더", rows: existingRows, canAdd: false },
      {
        key: "new" as const,
        label: "새 폴더",
        rows: isDrafting ? [...newRows, { kind: "draft" as const }] : newRows,
        canAdd: true,
        emptyComponent: (
          <View className="gap-0.5 px-3 pb-2 pt-1.5">
            <Text className="text-sm font-semibold text-foreground">아직 폴더가 없어요</Text>
            <Text className="text-xs text-muted-foreground">+로 새 폴더를 만들어요.</Text>
          </View>
        ),
      },
    ];
  }, [isDrafting, myFolders, state.newFolders]);

  const liveRef = React.useRef({ selectedId, isLarge, onSelect, proposal });
  liveRef.current = { selectedId, isLarge, onSelect, proposal };

  const getDraftHint = React.useCallback((value: string): NameHint => {
    const check = liveRef.current.proposal.checkName(null, value);
    switch (check.type) {
      case "blocked":
        return { text: "공유 폴더와 같은 이름은 쓸 수 없어요", tone: "danger" };
      case "merge-existing":
        return { text: `기존 폴더 ${withRo(check.name)} 합쳐져요`, tone: "info" };
      case "merge-new":
        return { text: `새 폴더 ${withWa(check.name)} 합쳐져요`, tone: "info" };
      default:
        return KEYBOARD_HINT;
    }
  }, []);

  const handleDraftSubmit = React.useCallback((value: string) => {
    const { proposal: current, onSelect: select } = liveRef.current;
    const check = current.checkName(null, value);
    if (check.type === "blocked") {
      return false;
    }
    setIsDrafting(false);
    if (check.type === "merge-existing") {
      select({ id: getExistingTarget(check.folderId), label: check.name });
      return;
    }
    if (check.type === "merge-new") {
      select({ id: check.target, label: check.name });
      return;
    }
    if (check.type === "ok") {
      select({ id: current.addPickerFolder(check.name), label: check.name });
    }
  }, []);

  const handleDraftCancel = React.useCallback(() => setIsDrafting(false), []);

  const renderRow = React.useCallback(
    (row: PickerRow) => {
      if (row.kind === "draft") {
        return (
          <View className="py-1">
            <View className="rounded-xl border border-primary bg-card p-2">
              <ProposalNameInput
                accessibilityLabel="새 폴더 이름"
                getHint={getDraftHint}
                initialValue=""
                inputClassName="h-9 text-sm"
                onCancel={handleDraftCancel}
                onSubmit={handleDraftSubmit}
              />
            </View>
          </View>
        );
      }
      const { selectedId: current, isLarge: large, onSelect: select } = liveRef.current;
      return (
        <FolderPickerRow
          accessibilityLabel={row.label}
          emoji={row.emoji}
          isLarge={large}
          label={row.name}
          selected={current === row.id}
          onPress={() => select({ id: row.id, label: row.name })}
        />
      );
    },
    [getDraftHint, handleDraftCancel, handleDraftSubmit],
  );

  const handleToggle = React.useCallback((section: PickerSectionKey) => {
    setOpenSection((current) => (current === section ? null : section));
  }, []);

  const handleAddPress = React.useCallback(() => {
    setOpenSection("new");
    setIsDrafting(true);
  }, []);

  return (
    <View className={cn("gap-1.5", className ?? "min-h-0 shrink")}>
      <View className={cn(isLarge && "px-3")}>
        <FolderPickerRow
          emoji={UNFILED_OPTION.emoji}
          isLarge={isLarge}
          label={UNFILED_OPTION.label}
          selected={selectedId === UNFILED_TARGET}
          onPress={() => onSelect({ id: UNFILED_TARGET, label: UNFILED_OPTION.label })}
        />
      </View>
      <NestedListBoundary>
        <FolderSectionsView
          extraData={`${selectedId ?? ""}|${isLarge}`}
          getRowKey={getRowKey}
          hasLeadingDivider
          isAddDisabled={isPending || isDrafting}
          listMaxHeight={maxHeight}
          openSection={openSection}
          sections={sections}
          size={isLarge ? "large" : "compact"}
          tone="surface"
          renderRow={renderRow}
          onAddPress={handleAddPress}
          onToggle={handleToggle}
        />
      </NestedListBoundary>
    </View>
  );
}

type ProposalFolderPickerProps = {
  link: ProposalLink | null;
  proposal: ImportProposal;
  isWide: boolean;
  onClose: () => void;
};

function ProposalFolderPicker({ link, proposal, isWide, onClose }: ProposalFolderPickerProps) {
  const lastLinkRef = React.useRef(link);
  if (link) {
    lastLinkRef.current = link;
  }
  const shownLink = link ?? lastLinkRef.current;
  const { moveLink } = proposal;

  const handleConfirm = React.useCallback(
    async (selection: FolderPickerSelection<string>) => {
      if (shownLink) {
        moveLink(shownLink.key, selection.id);
      }
    },
    [moveLink, shownLink],
  );

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose],
  );

  if (!shownLink) {
    return null;
  }

  return (
    <FolderPickerDialog<string>
      confirmLabel="확인"
      description="이동할 폴더를 선택해주세요."
      errorMessage="폴더를 옮기지 못했어요. 다시 시도해 주세요."
      initialFolderId={shownLink.target}
      open={link != null}
      pendingLabel="옮기는 중…"
      presentation={isWide ? "dialog" : "sheet"}
      stackBehavior="push"
      title="폴더 이동"
      renderList={(slot) => (
        <ProposalPickerList
          key={shownLink.key}
          className={slot.className}
          isPending={slot.isPending}
          link={shownLink}
          listMaxHeight={slot.listMaxHeight}
          proposal={proposal}
          selectedId={slot.selectedId}
          onSelect={slot.onSelect}
        />
      )}
      onConfirm={handleConfirm}
      onOpenChange={handleOpenChange}
    />
  );
}

export { ProposalFolderPicker };
