import type { LinkDetailContent } from "../types";

/** Re-checks run this long after the detail opened (elapsed time, not cumulative gaps). */
const EXCERPT_RECHECK_OFFSETS_MS = [3000, 6000, 12000] as const;

type ExcerptRecheckInput = {
  /** When the detail opened (ms). */
  openedAt: number;
  /** Now (ms). */
  now: number;
  /** Re-checks already run since the detail opened. */
  recheckCount: number;
  /** `content` of the latest detail response. */
  content: LinkDetailContent | null | undefined;
};

/**
 * Milliseconds until the next silent re-check of a detail, or null to stop. Re-checks run
 * only while the server says the body is still being collected (`isPending`), stop once
 * an excerpt is in, and stop after three.
 */
function getExcerptRecheckDelay({
  openedAt,
  now,
  recheckCount,
  content,
}: ExcerptRecheckInput): number | null {
  if (content?.isPending !== true || content.excerpt) {
    return null;
  }
  const offset = EXCERPT_RECHECK_OFFSETS_MS[recheckCount];
  if (offset === undefined) {
    return null;
  }
  return Math.max(0, openedAt + offset - now);
}

export { EXCERPT_RECHECK_OFFSETS_MS, getExcerptRecheckDelay };
export type { ExcerptRecheckInput };
