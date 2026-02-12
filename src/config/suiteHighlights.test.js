import { describe, it, expect } from 'vitest';
import {
  PAGE_WIDTH,
  PAGE_HEIGHT,
  FLOOR_OVERVIEW_PAGES,
  SUITE_HIGHLIGHT_COORDS,
  getHighlightsForOverviewPage,
} from './suiteHighlights';

// --- Config structure validation ---

describe('suiteHighlights config', () => {
  it('exports correct page dimensions', () => {
    expect(PAGE_WIDTH).toBe(540);
    expect(PAGE_HEIGHT).toBe(779);
  });

  it('maps page 1 (4th floor) to suites 404, 411, 416, 420', () => {
    expect(FLOOR_OVERVIEW_PAGES[1]).toEqual([2, 3, 4, 5]);
  });

  it('maps page 6 (5th floor) to suites 506, 509', () => {
    expect(FLOOR_OVERVIEW_PAGES[6]).toEqual([7, 8]);
  });

  it('has no other overview pages', () => {
    const keys = Object.keys(FLOOR_OVERVIEW_PAGES).map(Number);
    expect(keys).toEqual([1, 6]);
  });

  it('has coordinate entries for every suite referenced in FLOOR_OVERVIEW_PAGES', () => {
    for (const suitePages of Object.values(FLOOR_OVERVIEW_PAGES)) {
      for (const suitePage of suitePages) {
        expect(SUITE_HIGHLIGHT_COORDS[suitePage]).toBeDefined();
        expect(Array.isArray(SUITE_HIGHLIGHT_COORDS[suitePage])).toBe(true);
        expect(SUITE_HIGHLIGHT_COORDS[suitePage].length).toBeGreaterThan(0);
      }
    }
  });

  it('each coordinate rect has x, y, width, height number fields', () => {
    for (const rects of Object.values(SUITE_HIGHLIGHT_COORDS)) {
      for (const rect of rects) {
        expect(typeof rect.x).toBe('number');
        expect(typeof rect.y).toBe('number');
        expect(typeof rect.width).toBe('number');
        expect(typeof rect.height).toBe('number');
      }
    }
  });
});

// --- getHighlightsForOverviewPage ---

describe('getHighlightsForOverviewPage', () => {
  // -- Returns highlights for selected suites --

  it('returns rects for a single selected suite on page 1', () => {
    const selected = new Set([2]); // Suite 404
    const result = getHighlightsForOverviewPage(1, selected);
    expect(result).toEqual(SUITE_HIGHLIGHT_COORDS[2]);
  });

  it('returns rects for multiple selected suites on page 1', () => {
    const selected = new Set([2, 4]); // Suite 404 + 416
    const result = getHighlightsForOverviewPage(1, selected);
    expect(result).toEqual([
      ...SUITE_HIGHLIGHT_COORDS[2],
      ...SUITE_HIGHLIGHT_COORDS[4],
    ]);
  });

  it('returns rects for all 4th floor suites when all selected', () => {
    const selected = new Set([2, 3, 4, 5]);
    const result = getHighlightsForOverviewPage(1, selected);
    expect(result).toEqual([
      ...SUITE_HIGHLIGHT_COORDS[2],
      ...SUITE_HIGHLIGHT_COORDS[3],
      ...SUITE_HIGHLIGHT_COORDS[4],
      ...SUITE_HIGHLIGHT_COORDS[5],
    ]);
  });

  it('returns rects for a selected suite on page 6 (5th floor)', () => {
    const selected = new Set([7]); // Suite 506
    const result = getHighlightsForOverviewPage(6, selected);
    expect(result).toEqual(SUITE_HIGHLIGHT_COORDS[7]);
  });

  it('returns rects for both 5th floor suites when both selected', () => {
    const selected = new Set([7, 8]);
    const result = getHighlightsForOverviewPage(6, selected);
    expect(result).toEqual([
      ...SUITE_HIGHLIGHT_COORDS[7],
      ...SUITE_HIGHLIGHT_COORDS[8],
    ]);
  });

  // -- Does NOT return highlights for non-matching pages --

  it('returns empty array for non-overview page', () => {
    const selected = new Set([2, 3, 4, 5, 7, 8]);
    expect(getHighlightsForOverviewPage(2, selected)).toEqual([]);
    expect(getHighlightsForOverviewPage(3, selected)).toEqual([]);
    expect(getHighlightsForOverviewPage(9, selected)).toEqual([]);
  });

  it('returns empty array when no suites for that floor are selected', () => {
    // Only 5th floor suites selected, querying 4th floor overview
    const selected = new Set([7, 8]);
    expect(getHighlightsForOverviewPage(1, selected)).toEqual([]);
  });

  it('returns empty array when selectedPages is empty', () => {
    expect(getHighlightsForOverviewPage(1, new Set())).toEqual([]);
    expect(getHighlightsForOverviewPage(6, new Set())).toEqual([]);
  });

  // -- Only includes suites belonging to that floor --

  it('does not include 5th floor suites on 4th floor overview', () => {
    const selected = new Set([2, 7]); // Suite 404 (4th) + Suite 506 (5th)
    const result = getHighlightsForOverviewPage(1, selected);
    // Should only have Suite 404 rects, not Suite 506
    expect(result).toEqual(SUITE_HIGHLIGHT_COORDS[2]);
  });

  it('does not include 4th floor suites on 5th floor overview', () => {
    const selected = new Set([2, 7]);
    const result = getHighlightsForOverviewPage(6, selected);
    expect(result).toEqual(SUITE_HIGHLIGHT_COORDS[7]);
  });

  // -- Handles mixed selections (overview + suite pages) --

  it('ignores overview page numbers in selection set', () => {
    // selectedPages includes the overview page itself — should not affect highlights
    const selected = new Set([1, 3, 6]); // Overviews + Suite 411
    const page1Result = getHighlightsForOverviewPage(1, selected);
    expect(page1Result).toEqual(SUITE_HIGHLIGHT_COORDS[3]);

    const page6Result = getHighlightsForOverviewPage(6, selected);
    expect(page6Result).toEqual([]);
  });

  // -- Handles non-suite pages in selection --

  it('ignores non-suite, non-overview pages like Conference Rooms (pg 9)', () => {
    const selected = new Set([9, 10, 11]);
    expect(getHighlightsForOverviewPage(1, selected)).toEqual([]);
    expect(getHighlightsForOverviewPage(6, selected)).toEqual([]);
  });

  // -- Order consistency --

  it('returns rects in suite page order regardless of Set insertion order', () => {
    const selected1 = new Set([5, 2, 4, 3]);
    const selected2 = new Set([2, 3, 4, 5]);
    const result1 = getHighlightsForOverviewPage(1, selected1);
    const result2 = getHighlightsForOverviewPage(1, selected2);
    // Both should follow FLOOR_OVERVIEW_PAGES order: [2, 3, 4, 5]
    expect(result1).toEqual(result2);
  });
});
