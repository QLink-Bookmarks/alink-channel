type SortDirection = "asc" | "desc";

type ListSort<K extends string> = {
  key: K;
  direction: SortDirection;
};

type SortCriterion<K extends string> = {
  key: K;
  label: string;
  // The direction a first press gives: the one people use most for this criterion.
  firstDirection: SortDirection;
};

const SORT_DIRECTION_WORDS: Record<SortDirection, string> = {
  asc: "오름차순",
  desc: "내림차순",
};

function reverseSortDirection(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc";
}

/**
 * Pressing a criterion chip: the chip that is on reverses its direction, a chip that is off turns on
 * in its own first direction.
 */
function pressSortCriterion<K extends string>(
  current: ListSort<K>,
  criterion: Pick<SortCriterion<K>, "key" | "firstDirection">,
): ListSort<K> {
  if (current.key === criterion.key) {
    return { key: current.key, direction: reverseSortDirection(current.direction) };
  }
  return { key: criterion.key, direction: criterion.firstDirection };
}

function isSameListSort<K extends string>(a: ListSort<K>, b: ListSort<K>) {
  return a.key === b.key && a.direction === b.direction;
}

// "제목, 오름차순" — what a screen reader says for the criterion that is on.
function getSortCriterionLabel(label: string, direction: SortDirection) {
  return `${label}, ${SORT_DIRECTION_WORDS[direction]}`;
}

export {
  SORT_DIRECTION_WORDS,
  getSortCriterionLabel,
  isSameListSort,
  pressSortCriterion,
  reverseSortDirection,
};
export type { ListSort, SortCriterion, SortDirection };
