import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock suiteHighlights before importing the component
vi.mock('../config/suiteHighlights', () => ({
  PAGE_HEIGHT: 779,
  getHighlightsForOverviewPage: vi.fn(() => []),
}));

// Mock pdfjs-dist
const mockRenderPromise = Promise.resolve();
const mockGetPage = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args) => mockGetDocument(...args),
}));

import { render, act, waitFor } from '@testing-library/react';
import { PdfPreview } from './PdfPreview';
import { getHighlightsForOverviewPage } from '../config/suiteHighlights';

// Save the real createElement ONCE at module level, before any spy wraps it
const realCreateElement = document.createElement.bind(document);

// Track canvas context calls
let strokeRectCalls;
let strokeStyleValues;
let lineWidthValues;
let mockContext;
let createElementSpy;

beforeEach(() => {
  vi.clearAllMocks();

  strokeRectCalls = [];
  strokeStyleValues = [];
  lineWidthValues = [];

  mockContext = {
    get strokeStyle() { return this._strokeStyle; },
    set strokeStyle(val) {
      this._strokeStyle = val;
      strokeStyleValues.push(val);
    },
    _strokeStyle: '',
    get lineWidth() { return this._lineWidth; },
    set lineWidth(val) {
      this._lineWidth = val;
      lineWidthValues.push(val);
    },
    _lineWidth: 1,
    strokeRect: vi.fn((...args) => strokeRectCalls.push(args)),
  };

  // Mock createElement to intercept canvas creation — use realCreateElement to avoid recursion
  createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    const el = realCreateElement(tag, options);
    if (tag === 'canvas') {
      vi.spyOn(el, 'getContext').mockReturnValue(mockContext);
      vi.spyOn(el, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    }
    return el;
  });

  // Default: getDocument returns a pdf with getPage
  mockGetPage.mockResolvedValue({
    getViewport: ({ scale }) => ({ width: 540 * scale, height: 779 * scale }),
    render: () => ({ promise: mockRenderPromise }),
  });

  mockGetDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: 11,
      getPage: mockGetPage,
    }),
  });
});

afterEach(() => {
  createElementSpy.mockRestore();
});

describe('PdfPreview highlight drawing', () => {
  it('calls getHighlightsForOverviewPage for each rendered page', async () => {
    const selectedPages = new Set([1, 3]);

    await act(async () => {
      render(
        <PdfPreview templateUrl="/template.pdf" selectedPages={selectedPages} />
      );
      await new Promise(r => setTimeout(r, 50));
    });

    // Should have been called for each page being rendered
    expect(getHighlightsForOverviewPage).toHaveBeenCalledWith(1, selectedPages, undefined);
    expect(getHighlightsForOverviewPage).toHaveBeenCalledWith(3, selectedPages, undefined);
  });

  it('draws red strokeRect when highlights are returned for an overview page', async () => {
    const testRects = [
      { x: 100, y: 200, width: 50, height: 30 },
      { x: 300, y: 400, width: 80, height: 60 },
    ];

    // Return highlights only for page 1
    getHighlightsForOverviewPage.mockImplementation((pageNum, _selected) => {
      return pageNum === 1 ? testRects : [];
    });

    const selectedPages = new Set([1]);

    await act(async () => {
      render(
        <PdfPreview templateUrl="/template.pdf" selectedPages={selectedPages} />
      );
      await new Promise(r => setTimeout(r, 50));
    });

    // strokeStyle should have been set to red
    expect(strokeStyleValues).toContain('rgb(255, 0, 0)');

    // lineWidth should be 2 * scale = 3
    const scale = 1.5;
    expect(lineWidthValues).toContain(2 * scale);

    // Should have drawn 2 rects
    expect(strokeRectCalls.length).toBe(2);

    // Verify coordinate transform: scale = 1.5, PAGE_HEIGHT = 779
    // PDF bottom-left -> canvas top-left: canvasY = (PAGE_HEIGHT - y - height) * scale
    expect(strokeRectCalls[0]).toEqual([
      100 * scale,
      (779 - 200 - 30) * scale,
      50 * scale,
      30 * scale,
    ]);
    expect(strokeRectCalls[1]).toEqual([
      300 * scale,
      (779 - 400 - 60) * scale,
      80 * scale,
      60 * scale,
    ]);
  });

  it('does NOT draw strokeRect when no highlights are returned', async () => {
    getHighlightsForOverviewPage.mockReturnValue([]);

    const selectedPages = new Set([3]); // Non-overview page

    await act(async () => {
      render(
        <PdfPreview templateUrl="/template.pdf" selectedPages={selectedPages} />
      );
      await new Promise(r => setTimeout(r, 50));
    });

    expect(strokeRectCalls.length).toBe(0);
  });

  it('passes the full selectedPages set (not just current page) to highlight helper', async () => {
    const selectedPages = new Set([1, 2, 5, 6, 7]);

    await act(async () => {
      render(
        <PdfPreview templateUrl="/template.pdf" selectedPages={selectedPages} />
      );
      await new Promise(r => setTimeout(r, 50));
    });

    // Every call should receive the full set
    for (const call of getHighlightsForOverviewPage.mock.calls) {
      expect(call[1]).toBe(selectedPages);
    }
  });

  it('still renders page images even when there are no highlights', async () => {
    getHighlightsForOverviewPage.mockReturnValue([]);

    const selectedPages = new Set([9]); // Conference Rooms, no highlights

    let container;
    await act(async () => {
      const result = render(
        <PdfPreview templateUrl="/template.pdf" selectedPages={selectedPages} />
      );
      container = result.container;
      await new Promise(r => setTimeout(r, 50));
    });

    await waitFor(() => {
      const imgs = container.querySelectorAll('img');
      expect(imgs.length).toBe(1);
    });
  });

  it('shows loading state initially', () => {
    const { getByText } = render(
      <PdfPreview templateUrl="/template.pdf" selectedPages={new Set()} />
    );

    expect(getByText('Loading preview...')).toBeInTheDocument();
  });
});
