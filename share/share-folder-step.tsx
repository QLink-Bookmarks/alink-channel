import * as React from "react";
import { View } from "react-native";

import {
  DEFAULT_FOLDER_EMOJI,
  FolderPickerRow,
  getFolderLabel,
} from "@/features/folders/components/folder-picker-row";
import { FOLDER_SECTION_LABELS } from "@/features/folders/components/folder-section-header";
import {
  type FolderSectionDefinition,
  FolderSectionsView,
} from "@/features/folders/components/folder-sections-view";
import { NestedListBoundary } from "@/features/folders/components/nested-list-boundary";
import type { Folder } from "@/features/folders/types";
import type { FolderSection } from "@/stores/folder-navigation";

import { type ShareFolderChoice, UNCATEGORIZED_CHOICE, toFolderChoice } from "./share-options";
import { ShareStepNav } from "./share-step-nav";

type ShareFolderStepProps = {
  folders: Folder[];
  selectedFolderId: number | null;
  onSelect: (folder: ShareFolderChoice) => void;
  onBack: () => void;
};

function getRowKey(folder: Folder) {
  return String(folder.id);
}

function buildSections(folders: Folder[]): FolderSectionDefinition<FolderSection, Folder>[] {
  const mine = folders.filter((folder) => !folder.isShared);
  const shared = folders.filter((folder) => folder.isShared);
  const sections: FolderSectionDefinition<FolderSection, Folder>[] = [];
  if (mine.length > 0) {
    sections.push({ key: "mine", label: FOLDER_SECTION_LABELS.mine, rows: mine, canAdd: false });
  }
  if (shared.length > 0) {
    sections.push({
      key: "shared",
      label: FOLDER_SECTION_LABELS.shared,
      rows: shared,
      canAdd: false,
    });
  }
  return sections;
}

function ShareFolderStep({ folders, selectedFolderId, onSelect, onBack }: ShareFolderStepProps) {
  const sections = React.useMemo(() => buildSections(folders), [folders]);
  const [openSection, setOpenSection] = React.useState<FolderSection | null>("mine");
  const shownOpenSection =
    openSection === null || sections.some((section) => section.key === openSection)
      ? openSection
      : (sections[0]?.key ?? null);

  const handleToggle = React.useCallback((section: FolderSection) => {
    setOpenSection((current) => (current === section ? null : section));
  }, []);

  const renderRow = React.useCallback(
    (folder: Folder) => (
      <FolderPickerRow
        accessibilityLabel={getFolderLabel(folder)}
        emoji={folder.emoji ?? DEFAULT_FOLDER_EMOJI}
        isLarge
        label={folder.name}
        selected={selectedFolderId === folder.id}
        onPress={() => onSelect(toFolderChoice(folder))}
      />
    ),
    [onSelect, selectedFolderId],
  );

  return (
    <View className="min-h-0 flex-1">
      <ShareStepNav
        title="폴더 선택"
        onBack={onBack}
      />
      <View
        aria-label="폴더 선택"
        className="-mx-3 min-h-0 flex-1 gap-1.5"
        role="radiogroup"
      >
        <View className="px-3">
          <FolderPickerRow
            emoji={UNCATEGORIZED_CHOICE.emoji}
            isLarge
            label={UNCATEGORIZED_CHOICE.name}
            selected={selectedFolderId === null}
            onPress={() => onSelect(UNCATEGORIZED_CHOICE)}
          />
        </View>
        {sections.length > 0 ? (
          <NestedListBoundary>
            <FolderSectionsView
              availableHeight="container"
              className="min-h-0 flex-1"
              extraData={selectedFolderId}
              getRowKey={getRowKey}
              hasLeadingDivider
              isAddDisabled
              openSection={shownOpenSection}
              sections={sections}
              size="large"
              tone="surface"
              renderRow={renderRow}
              onToggle={handleToggle}
            />
          </NestedListBoundary>
        ) : null}
      </View>
    </View>
  );
}

export { ShareFolderStep };
