const SECTION_TRANSITION_MS = 240;
const SETTLED_MAX_HEIGHT = 100_000;

type SectionHeights = Record<string, number>;

type SectionPlan = {
  from: SectionHeights;
  to: SectionHeights;
};

function getAvailableListHeight({
  availableTotal,
  minHeight,
  headersHeight,
}: {
  availableTotal: number | undefined;
  minHeight: number | undefined;
  headersHeight: number;
}) {
  if (availableTotal == null || !(availableTotal > 0)) {
    return Infinity;
  }
  return Math.max(0, Math.max(availableTotal, minHeight ?? 0) - headersHeight);
}

function getOpenTarget(natural: number, availableListHeight: number) {
  return Math.max(0, Math.min(natural, availableListHeight));
}

function getPlanTargets(keys: readonly string[], openKey: string | null, target: number) {
  const to: SectionHeights = {};
  for (const key of keys) {
    to[key] = key === openKey ? target : 0;
  }
  if (openKey != null) {
    to[openKey] = target;
  }
  return to;
}

function interpolateSectionHeight(plan: SectionPlan, key: string, progress: number) {
  "worklet";
  const from = plan.from[key] ?? 0;
  const to = plan.to[key] ?? 0;
  return from + (to - from) * progress;
}

function getReservedHeight(headersHeight: number, closing: readonly number[], target: number) {
  const closingTotal = closing.reduce((sum, height) => sum + height, 0);
  return headersHeight + Math.max(closingTotal, target);
}

function getTransitionMinHeight(settled: number | undefined, next: number | undefined) {
  if (settled == null && next == null) {
    return undefined;
  }
  return Math.max(settled ?? 0, next ?? 0);
}

export {
  SECTION_TRANSITION_MS,
  SETTLED_MAX_HEIGHT,
  getAvailableListHeight,
  getOpenTarget,
  getPlanTargets,
  getReservedHeight,
  getTransitionMinHeight,
  interpolateSectionHeight,
};
export type { SectionHeights, SectionPlan };
