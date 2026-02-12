// PDF page dimensions in points
export const PAGE_WIDTH = 540;
export const PAGE_HEIGHT = 779;

// Legacy hardcoded maps — used as fallback when no config is provided
export const FLOOR_OVERVIEW_PAGES = {
  1: [2, 3, 4, 5],   // 4th Floor Overview → Suites 404, 411, 416, 420
  6: [7, 8],          // 5th Floor Overview → Suites 506, 509
};

export const SUITE_HIGHLIGHT_COORDS = {
  // 4th Floor suites (shown on page 1)
  2: [{ x: 75, y: 332, width: 47, height: 85 }],   // Suite 404
  3: [{ x: 412, y: 383, width: 38, height: 47 }],   // Suite 411
  4: [{ x: 338, y: 389, width: 56, height: 41 }],   // Suite 416
  5: [{ x: 142, y: 467, width: 40, height: 44 }],   // Suite 420

  // 5th Floor suites (shown on page 6)
  7: [{ x: 322, y: 306, width: 73, height: 39 }],   // Suite 506
  8: [{ x: 393, y: 439, width: 77, height: 49 }],   // Suite 509
};

/**
 * Returns highlight rects for suites selected on a given overview page.
 *
 * When `config` is provided, derives data from the config object.
 * Page numbers are 1-indexed (matching the existing API).
 *
 * @param {number} overviewPageNum - The overview page number (1-indexed)
 * @param {Set<number>} selectedPages - Set of all currently selected page numbers (1-indexed)
 * @param {object} [config] - Optional template config object
 * @returns {Array<{x: number, y: number, width: number, height: number}>}
 */
export function getHighlightsForOverviewPage(overviewPageNum, selectedPages, config) {
  if (config) {
    return getHighlightsFromConfig(overviewPageNum, selectedPages, config);
  }
  // Legacy fallback
  return getHighlightsLegacy(overviewPageNum, selectedPages);
}

function getHighlightsFromConfig(overviewPageNum, selectedPages, config) {
  const pageIndex = overviewPageNum - 1;
  const pageConfig = config.pages[pageIndex];
  if (!pageConfig || pageConfig.type !== 'overview' || !pageConfig.overviewConfig) {
    return [];
  }

  const rects = [];
  for (const suitePageIdx of pageConfig.overviewConfig.suitePageIndices) {
    const suitePageNum = suitePageIdx + 1; // convert 0-indexed to 1-indexed
    if (selectedPages.has(suitePageNum)) {
      const suitePage = config.pages[suitePageIdx];
      if (suitePage?.suiteConfig?.highlightRects) {
        rects.push(...suitePage.suiteConfig.highlightRects);
      }
    }
  }
  return rects;
}

function getHighlightsLegacy(overviewPageNum, selectedPages) {
  const suitePages = FLOOR_OVERVIEW_PAGES[overviewPageNum];
  if (!suitePages) return [];

  const rects = [];
  for (const suitePage of suitePages) {
    if (selectedPages.has(suitePage)) {
      const coords = SUITE_HIGHLIGHT_COORDS[suitePage];
      if (coords) {
        rects.push(...coords);
      }
    }
  }
  return rects;
}
