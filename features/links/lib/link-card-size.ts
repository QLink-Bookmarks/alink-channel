type LinkCardSize = "small" | "large";

const LINK_CARD_SIZES: LinkCardSize[] = ["small", "large"];

const MIN_CARD_WIDTH: Record<LinkCardSize, { wide: number; mobile: number }> = {
  small: { wide: 196, mobile: 150 },
  large: { wide: 360, mobile: 280 },
};

/** A stored card size, or null when nothing valid was stored. */
function normalizeLinkCardSize(value: unknown): LinkCardSize | null {
  return LINK_CARD_SIZES.includes(value as LinkCardSize) ? (value as LinkCardSize) : null;
}

/** The size shown: the chosen one, or `small` on wide and `large` on mobile until one is chosen. */
function resolveLinkCardSize(chosen: LinkCardSize | null, isWideView: boolean): LinkCardSize {
  return chosen ?? (isWideView ? "small" : "large");
}

/** Narrowest a link card may get before the grid drops a column. */
function getLinkCardMinWidth(size: LinkCardSize, isWideView: boolean): number {
  return MIN_CARD_WIDTH[size][isWideView ? "wide" : "mobile"];
}

export { getLinkCardMinWidth, normalizeLinkCardSize, resolveLinkCardSize };
export type { LinkCardSize };
