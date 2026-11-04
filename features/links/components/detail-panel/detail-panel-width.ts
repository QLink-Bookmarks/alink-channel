const DETAIL_PANEL_MIN_WIDTH = 420;
const DETAIL_PANEL_MAX_WIDTH = 560;
const DETAIL_PANEL_WINDOW_RATIO = 0.34;

function getDetailPanelWidth(windowWidth: number) {
  return Math.round(
    Math.min(
      DETAIL_PANEL_MAX_WIDTH,
      Math.max(DETAIL_PANEL_MIN_WIDTH, windowWidth * DETAIL_PANEL_WINDOW_RATIO),
    ),
  );
}

export { getDetailPanelWidth };
