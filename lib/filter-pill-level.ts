// How much of the applied filter the collapsed button spells out: the criterion name with its arrow
// ("text"), or only marks (★ and a sort icon, "mark") when the text would hide the 1st chips.
type FilterPillLevel = "text" | "mark";

// The 1st chip row fades out over its last 16px, so a chip only counts as whole left of the fade.
const PRIMARY_FADE_WIDTH = 16;
// Space between the 1st chip row and the button.
const PILL_ROW_GAP = 8;

type PickPillLevelInput = {
  // Width of the whole row.
  rowWidth: number;
  // Right edge (from the row's left) of the last 1st chip that must stay whole, usually the third one;
  // null when the row has no 1st chips, or the wide layout where the pill never squeezes them.
  protectRight: number | null;
  // Measured pill width per level; a level not measured yet is left out.
  pillWidths: Partial<Record<FilterPillLevel, number>>;
};

/** The most detailed level that keeps the protected 1st chips whole; "mark" when none does. */
function pickPillLevel({
  rowWidth,
  protectRight,
  pillWidths,
}: PickPillLevelInput): FilterPillLevel {
  if (protectRight == null || rowWidth <= 0) {
    return "text";
  }
  const textWidth = pillWidths.text;
  if (textWidth == null) {
    return "text";
  }
  const visibleRight = rowWidth - textWidth - PILL_ROW_GAP - PRIMARY_FADE_WIDTH;
  return protectRight <= visibleRight ? "text" : "mark";
}

export { PILL_ROW_GAP, PRIMARY_FADE_WIDTH, pickPillLevel };
export type { FilterPillLevel, PickPillLevelInput };
