import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock suiteHighlights
vi.mock('../config/suiteHighlights', () => ({
  getHighlightsForOverviewPage: vi.fn(() => []),
}));

// Track drawRectangle and drawText calls per page
const drawRectangleCalls = [];
const drawTextCalls = [];
let addedPages;

// Mock fonts
const mockFontBold = {
  widthOfTextAtSize: vi.fn((text, size) => text.length * size * 0.6),
};
const mockFont = {
  widthOfTextAtSize: vi.fn((text, size) => text.length * size * 0.5),
};

// Mock pdf-lib
vi.mock('pdf-lib', () => {
  const mockRgb = (r, g, b) => ({ r, g, b, type: 'RGB' });

  return {
    rgb: mockRgb,
    StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'HelveticaBold' },
    PDFDocument: {
      load: vi.fn(async () => ({
        // Template doc
      })),
      create: vi.fn(async () => {
        addedPages = [];
        return {
          embedFont: vi.fn(async (fontName) => fontName === 'HelveticaBold' ? mockFontBold : mockFont),
          copyPages: vi.fn(async (_template, indices) => {
            return indices.map((idx) => {
              const rectCalls = [];
              const textCalls = [];
              const page = {
                drawRectangle: vi.fn((opts) => {
                  rectCalls.push(opts);
                  drawRectangleCalls.push({ pageIndex: idx, ...opts });
                }),
                drawText: vi.fn((text, opts) => {
                  const call = { text, ...opts };
                  textCalls.push(call);
                  drawTextCalls.push({ pageIndex: idx, text, ...opts });
                }),
                _drawRectCalls: rectCalls,
                _drawTextCalls: textCalls,
              };
              return page;
            });
          }),
          addPage: vi.fn((page) => addedPages.push(page)),
          save: vi.fn(async () => new Uint8Array([1, 2, 3])),
        };
      }),
    },
  };
});

// Mock fetch
global.fetch = vi.fn(async () => ({
  arrayBuffer: async () => new ArrayBuffer(10),
}));

// Mock URL and DOM APIs for download
global.URL.createObjectURL = vi.fn(() => 'blob:mock');
global.URL.revokeObjectURL = vi.fn();

import { exportSelectedPages } from './pdfExport';
import { getHighlightsForOverviewPage } from '../config/suiteHighlights';
import { rgb } from 'pdf-lib';

beforeEach(() => {
  vi.clearAllMocks();
  drawRectangleCalls.length = 0;
  drawTextCalls.length = 0;
  // Prevent actual link clicking
  vi.spyOn(document, 'createElement').mockReturnValue({
    set href(_v) {},
    set download(_v) {},
    click: vi.fn(),
  });
});

describe('pdfExport highlight drawing', () => {
  it('calls getHighlightsForOverviewPage for each exported page', async () => {
    await exportSelectedPages('/template.pdf', [1, 3, 6], {});

    expect(getHighlightsForOverviewPage).toHaveBeenCalledTimes(3);
    // Check it's called with correct page numbers and a Set of selectedPageNumbers
    expect(getHighlightsForOverviewPage).toHaveBeenCalledWith(1, new Set([1, 3, 6]), undefined);
    expect(getHighlightsForOverviewPage).toHaveBeenCalledWith(3, new Set([1, 3, 6]), undefined);
    expect(getHighlightsForOverviewPage).toHaveBeenCalledWith(6, new Set([1, 3, 6]), undefined);
  });

  it('draws red rectangles on overview pages when highlights exist', async () => {
    const testRects = [
      { x: 100, y: 200, width: 50, height: 30 },
      { x: 300, y: 400, width: 80, height: 60 },
    ];

    getHighlightsForOverviewPage.mockImplementation((pageNum) => {
      return pageNum === 1 ? testRects : [];
    });

    await exportSelectedPages('/template.pdf', [1, 3], {});

    // Filter highlight calls (red color, r=1 g=0 b=0)
    const redCalls = drawRectangleCalls.filter(
      (c) => c.borderColor && c.borderColor.r === 1 && c.borderColor.g === 0 && c.borderColor.b === 0
    );

    expect(redCalls.length).toBe(2);

    // Coordinates should be passed directly (no Y-flip — pdf-lib is bottom-left native)
    expect(redCalls[0]).toMatchObject({ x: 100, y: 200, width: 50, height: 30 });
    expect(redCalls[1]).toMatchObject({ x: 300, y: 400, width: 80, height: 60 });
  });

  it('does NOT draw red rectangles on non-overview pages', async () => {
    getHighlightsForOverviewPage.mockReturnValue([]);

    await exportSelectedPages('/template.pdf', [2, 3], {});

    const redCalls = drawRectangleCalls.filter(
      (c) => c.borderColor && c.borderColor.r === 1 && c.borderColor.g === 0 && c.borderColor.b === 0
    );
    expect(redCalls.length).toBe(0);
  });

  it('constructs a Set from the selectedPageNumbers array', async () => {
    await exportSelectedPages('/template.pdf', [1, 2, 5], {});

    const calls = getHighlightsForOverviewPage.mock.calls;
    for (const [, selectedSet] of calls) {
      expect(selectedSet).toBeInstanceOf(Set);
      expect([...selectedSet].sort()).toEqual([1, 2, 5]);
    }
  });
});

// Helper: badge blue color is rgb(43/255, 58/255, 103/255)
const isBadgeBlue = (c) => c && Math.abs(c.r - 43/255) < 0.01 && Math.abs(c.g - 58/255) < 0.01 && Math.abs(c.b - 103/255) < 0.01;
const isBadgeGray = (c) => c && Math.abs(c.r - 235/255) < 0.01 && Math.abs(c.g - 235/255) < 0.01 && Math.abs(c.b - 235/255) < 0.01;
const isCream = (c) => c && c.r === 1 && c.g > 0.99 && c.b > 0.95;

describe('pdfExport custom price badge', () => {
  it('draws cream cover, blue label section, gray price section, and both texts', async () => {
    getHighlightsForOverviewPage.mockReturnValue([]);

    await exportSelectedPages('/template.pdf', [2], { 2: '$4,500/mo' });

    // 2 cream rects (covering original rows) + 1 blue rect + 1 gray rect = 4 total
    const creamCalls = drawRectangleCalls.filter((c) => isCream(c.color));
    expect(creamCalls.length).toBe(2);
    expect(creamCalls[0]).toMatchObject({ x: 52, y: 152, width: 440, height: 32 });
    expect(creamCalls[1]).toMatchObject({ x: 52, y: 118, width: 440, height: 32 });

    const blueBgCalls = drawRectangleCalls.filter((c) => isBadgeBlue(c.color));
    expect(blueBgCalls.length).toBe(1);
    expect(blueBgCalls[0]).toMatchObject({ x: 52, width: 220, height: 24 });

    const grayBgCalls = drawRectangleCalls.filter((c) => isBadgeGray(c.color));
    expect(grayBgCalls.length).toBe(1);
    expect(grayBgCalls[0]).toMatchObject({ x: 272, width: 220, height: 24 });

    // Two text draws: "Price" label in white + custom price in blue
    expect(drawTextCalls.length).toBe(2);

    const labelCall = drawTextCalls.find((c) => c.text === 'Price');
    expect(labelCall).toBeDefined();
    expect(labelCall.font).toBe(mockFontBold);
    expect(labelCall.color).toMatchObject({ r: 1, g: 1, b: 1 });

    const priceCall = drawTextCalls.find((c) => c.text === '$4,500/mo');
    expect(priceCall).toBeDefined();
    expect(priceCall.font).toBe(mockFont);
    expect(isBadgeBlue(priceCall.color)).toBe(true);
  });

  it('does not draw any redaction or text when no custom price is set', async () => {
    getHighlightsForOverviewPage.mockReturnValue([]);

    await exportSelectedPages('/template.pdf', [2], {});

    expect(drawRectangleCalls.length).toBe(0);
    expect(drawTextCalls.length).toBe(0);
  });

  it('applies custom price badge only to pages that have a custom price', async () => {
    getHighlightsForOverviewPage.mockReturnValue([]);

    await exportSelectedPages('/template.pdf', [2, 3], { 2: '$4,500/mo' });

    // Only page 2 gets badge rects (2 cream + 1 blue + 1 gray)
    expect(drawRectangleCalls.length).toBe(4);
    expect(drawRectangleCalls.every((c) => c.pageIndex === 1)).toBe(true); // 0-indexed page 2

    // Only page 2 gets text
    expect(drawTextCalls.length).toBe(2);
    expect(drawTextCalls.find((c) => c.text === '$4,500/mo')).toBeDefined();
  });

  it('applies both custom price badge and highlights on mixed pages', async () => {
    getHighlightsForOverviewPage.mockImplementation((pageNum) => {
      return pageNum === 1 ? [{ x: 10, y: 20, width: 30, height: 40 }] : [];
    });

    await exportSelectedPages('/template.pdf', [1, 2], { 2: '$3,000/mo' });

    // Red border highlight on page 1
    const highlightCalls = drawRectangleCalls.filter(
      (c) => c.borderColor?.r === 1 && c.borderColor?.g === 0 && c.borderColor?.b === 0
    );
    expect(highlightCalls.length).toBe(1);

    // Cream redaction on page 2
    const creamCalls = drawRectangleCalls.filter((c) => isCream(c.color));
    expect(creamCalls.length).toBe(2);

    // Price badge text on page 2
    expect(drawTextCalls.find((c) => c.text === '$3,000/mo')).toBeDefined();
    expect(drawTextCalls.find((c) => c.text === 'Price')).toBeDefined();
  });
});

describe('pdfExport general behavior', () => {
  it('adds all selected pages to the output PDF', async () => {
    getHighlightsForOverviewPage.mockReturnValue([]);

    await exportSelectedPages('/template.pdf', [1, 5, 9], {});

    expect(addedPages.length).toBe(3);
  });

  it('fetches the template from the provided URL', async () => {
    getHighlightsForOverviewPage.mockReturnValue([]);

    await exportSelectedPages('/my-template.pdf', [1], {});

    expect(global.fetch).toHaveBeenCalledWith('/my-template.pdf');
  });
});
