import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pdfjs-dist
const mockRenderPromise = Promise.resolve();
const mockGetPage = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args) => mockGetDocument(...args),
}));

// Mock suiteHighlights
vi.mock('../config/suiteHighlights', () => ({
  PAGE_HEIGHT: 779,
  getHighlightsForOverviewPage: vi.fn(() => []),
}));

// Mock pdfExport
vi.mock('../utils/pdfExport', () => ({
  exportSelectedPages: vi.fn(),
}));

import { render, act, waitFor } from '@testing-library/react';
import { ProposalBuilder } from './ProposalBuilder';

const realCreateElement = document.createElement.bind(document);

let createElementSpy;

const TEST_CONFIG = {
  id: 'test',
  name: 'Test Template',
  pdfStorageKey: 'test',
  pageDimensions: { width: 540, height: 779 },
  pages: [
    { pageIndex: 0, label: '4th Floor Overview', type: 'overview', overviewConfig: { suitePageIndices: [1] } },
    { pageIndex: 1, label: 'Suite 404', type: 'suite', suiteConfig: { overviewPageIndex: 0, highlightRects: [], priceRedaction: { listPrice: { x: 52, y: 152, width: 440, height: 32 }, foundingPrice: { x: 52, y: 118, width: 440, height: 32 } } } },
    { pageIndex: 2, label: 'Common Areas', type: 'other' },
  ],
  style: { backgroundFill: { r: 255, g: 253, b: 245 }, badgeBlue: { r: 43, g: 58, b: 103 }, badgeGray: { r: 235, g: 235, b: 235 } },
};

beforeEach(() => {
  vi.clearAllMocks();

  createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    const el = realCreateElement(tag, options);
    if (tag === 'canvas') {
      vi.spyOn(el, 'getContext').mockReturnValue({
        strokeStyle: '',
        lineWidth: 1,
        strokeRect: vi.fn(),
      });
      vi.spyOn(el, 'toDataURL').mockReturnValue('data:image/png;base64,mock');
    }
    return el;
  });

  mockGetPage.mockResolvedValue({
    getViewport: ({ scale }) => ({ width: 540 * scale, height: 779 * scale }),
    render: () => ({ promise: mockRenderPromise }),
  });

  mockGetDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: 3,
      getPage: mockGetPage,
    }),
  });
});

afterEach(() => {
  createElementSpy.mockRestore();
});

describe('ProposalBuilder page selection stability', () => {
  it('does not re-enter loading state when toggling a page selection', async () => {
    let container;

    await act(async () => {
      const result = render(
        <ProposalBuilder config={TEST_CONFIG} pdfBlobUrl="/template.pdf" onBack={() => {}} />
      );
      container = result.container;
      // Wait for PDF pages to load
      await new Promise(r => setTimeout(r, 50));
    });

    // Pages should be loaded and visible
    await waitFor(() => {
      const items = container.querySelectorAll('.page-item');
      expect(items.length).toBe(3);
    });

    // Record how many times getDocument was called during initial load
    const initialCallCount = mockGetDocument.mock.calls.length;

    // Toggle a page by clicking the first checkbox
    const checkboxes = container.querySelectorAll('.page-checkbox input');
    expect(checkboxes.length).toBe(3);

    await act(async () => {
      checkboxes[0].click();
      // Let any effects settle
      await new Promise(r => setTimeout(r, 50));
    });

    // Page items should STILL be visible (not replaced by loading spinner)
    const itemsAfterClick = container.querySelectorAll('.page-item');
    expect(itemsAfterClick.length).toBe(3);

    // The loading text should NOT appear
    const loadingEl = container.querySelector('.page-selector.loading');
    expect(loadingEl).toBeNull();

    // getDocument should NOT have been called again — no PDF reload
    expect(mockGetDocument.mock.calls.length).toBe(initialCallCount);
  });
});
