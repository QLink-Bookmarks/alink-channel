let detailOpenedFromList: number | null = null;

function markDetailOpenedFromList(id: number) {
  detailOpenedFromList = id;
}

function wasDetailOpenedFromList(id: number) {
  return detailOpenedFromList === id;
}

function clearDetailOpenedFromList() {
  detailOpenedFromList = null;
}

export { clearDetailOpenedFromList, markDetailOpenedFromList, wasDetailOpenedFromList };
