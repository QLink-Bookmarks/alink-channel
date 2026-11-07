import { FOLDER_SECTION_HEADER_HEIGHT } from "@/features/folders/components/folder-section-header";
import {
  FOLDER_LIST_PADDING,
  FOLDER_LIST_ROW_GAP,
} from "@/features/folders/components/folder-section-list";

const DEFAULT_SHEET_HEIGHT = 392;
const STEP_PADDING_TOP = 20;
const STEP_NAV_HEIGHT = 44;
const LARGE_ROW_HEIGHT = 48;
const UNCATEGORIZED_GAP = 6;

type FolderStepHeightInput = {
  sectionRowCounts: number[];
  paddingBottom: number;
  maxHeight: number;
};

function getFolderListHeight(rowCount: number) {
  if (rowCount <= 0) {
    return 0;
  }
  return (
    rowCount * LARGE_ROW_HEIGHT + (rowCount - 1) * FOLDER_LIST_ROW_GAP + FOLDER_LIST_PADDING.large
  );
}

function getFolderStepHeight({
  sectionRowCounts,
  paddingBottom,
  maxHeight,
}: FolderStepHeightInput) {
  const base = STEP_PADDING_TOP + STEP_NAV_HEIGHT + LARGE_ROW_HEIGHT + paddingBottom;
  if (sectionRowCounts.length === 0) {
    return Math.min(base, maxHeight);
  }
  const headers = sectionRowCounts.length * FOLDER_SECTION_HEADER_HEIGHT.large;
  const tallestList = Math.max(...sectionRowCounts.map(getFolderListHeight));
  return Math.min(base + UNCATEGORIZED_GAP + headers + tallestList, maxHeight);
}

type SheetPlacement = {
  top: number;
  height: number;
};

function getAvailableSheetHeight({ top, height }: SheetPlacement, windowHeight: number) {
  const hiddenBelowWindow = Math.max(0, top + height - windowHeight);
  return Math.max(0, height - hiddenBelowWindow);
}

function clampSheetHeight(height: number | undefined, containerHeight: number) {
  if (height == null || height <= 0) {
    return containerHeight;
  }
  return Math.min(height, containerHeight);
}

export { DEFAULT_SHEET_HEIGHT, clampSheetHeight, getAvailableSheetHeight, getFolderStepHeight };
export type { FolderStepHeightInput, SheetPlacement };
