import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pdfjs-dist
const mockRenderPromise = Promise.resolve();
const mockGetPage = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args) => mockGetDocument(...args),
}));

import { render, act, waitFor, fireEvent } from '@testing-library/react';
import { ConfigEditor } from './ConfigEditor';

const realCreateElement = document.createElement.bind(document);
let createElementSpy;

const TEST_CONFIG = {
  id: 'test',
  name: 'Test Template',
  pdfStorageKey: 'test',
  pageDimensions: { width: 540, height: 779 },
  pages: [
    { pageIndex: 0, label: 'Overview', type: 'overview', overviewConfig: { suitePageIndices: [1] } },
    { pageIndex: 1, label: 'Suite 101', type: 'suite', suiteConfig: { overviewPageIndex: 0, highlightRects: [], priceRedaction: null, deskCount: 5, listPrice: null, foundingMemberPrice: null } },
    { pageIndex: 2, label: 'Amenities', type: 'other' },
    { pageIndex: 3, label: 'Conference Room', type: 'conference', conferenceConfig: { textRedaction: null, defaultText: null } },
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
    getTextContent: () => Promise.resolve({ items: [] }),
  });

  mockGetDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: 4,
      getPage: mockGetPage,
    }),
  });
});

afterEach(() => {
  createElementSpy.mockRestore();
});

describe('ConfigEditor', () => {
  describe('Replace Page UI', () => {
    it('renders Replace Page button for all page types', async () => {
      for (const page of TEST_CONFIG.pages) {
        const { container, unmount } = render(
          <ConfigEditor
            config={TEST_CONFIG}
            pageIndex={page.pageIndex}
            pageConfig={page}
            pdfBlobUrl="/template.pdf"
            onUpdatePage={vi.fn()}
            onReplacePage={vi.fn()}
            replacing={false}
          />
        );

        const replaceBtn = container.querySelector('.replace-page-btn');
        expect(replaceBtn).not.toBeNull();
        expect(replaceBtn.textContent).toContain('Replace Page');

        const fileInput = container.querySelector('.replace-page-btn input[type="file"]');
        expect(fileInput).not.toBeNull();
        expect(fileInput.accept).toBe('.pdf,.jpg,.jpeg,.png');

        unmount();
      }
    });

    it('shows "Replacing..." text when replacing is true', () => {
      const page = TEST_CONFIG.pages[2]; // 'other' page, simplest

      const { container } = render(
        <ConfigEditor
          config={TEST_CONFIG}
          pageIndex={page.pageIndex}
          pageConfig={page}
          pdfBlobUrl="/template.pdf"
          onUpdatePage={vi.fn()}
          onReplacePage={vi.fn()}
          replacing={true}
        />
      );

      const replaceBtn = container.querySelector('.replace-page-btn');
      expect(replaceBtn.textContent).toContain('Replacing...');
      expect(replaceBtn.classList.contains('disabled')).toBe(true);

      const fileInput = container.querySelector('.replace-page-btn input[type="file"]');
      expect(fileInput.disabled).toBe(true);
    });

    it('calls onReplacePage with pageIndex and file when a file is selected', () => {
      const onReplacePage = vi.fn();
      const page = TEST_CONFIG.pages[2];

      const { container } = render(
        <ConfigEditor
          config={TEST_CONFIG}
          pageIndex={page.pageIndex}
          pageConfig={page}
          pdfBlobUrl="/template.pdf"
          onUpdatePage={vi.fn()}
          onReplacePage={onReplacePage}
          replacing={false}
        />
      );

      const fileInput = container.querySelector('.replace-page-btn input[type="file"]');
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      expect(onReplacePage).toHaveBeenCalledWith(page.pageIndex, file);
    });

    it('shows hint text next to the button', () => {
      const page = TEST_CONFIG.pages[2];

      const { container } = render(
        <ConfigEditor
          config={TEST_CONFIG}
          pageIndex={page.pageIndex}
          pageConfig={page}
          pdfBlobUrl="/template.pdf"
          onUpdatePage={vi.fn()}
          onReplacePage={vi.fn()}
          replacing={false}
        />
      );

      const hint = container.querySelector('.replace-page-hint');
      expect(hint).not.toBeNull();
      expect(hint.textContent).toContain('Upload a PDF or image');
    });
  });

  describe('Suite page preview', () => {
    it('renders the suite page preview image below overview in highlight mode', async () => {
      const suitePage = TEST_CONFIG.pages[1];

      let container;
      await act(async () => {
        const result = render(
          <ConfigEditor
            config={TEST_CONFIG}
            pageIndex={1}
            pageConfig={suitePage}
            pdfBlobUrl="/template.pdf"
            onUpdatePage={vi.fn()}
            onReplacePage={vi.fn()}
            replacing={false}
          />
        );
        container = result.container;
        await new Promise(r => setTimeout(r, 100));
      });

      // Suite page preview should be rendered
      await waitFor(() => {
        const preview = container.querySelector('.suite-page-preview');
        expect(preview).not.toBeNull();
      });

      // It should have a label mentioning the suite page
      const previewHint = container.querySelector('.suite-page-preview .drawer-hint');
      expect(previewHint.textContent).toContain('Suite 101');

      // It should contain an image
      const previewImg = container.querySelector('.suite-page-preview img');
      expect(previewImg).not.toBeNull();
      expect(previewImg.src).toContain('data:image/png;base64');
    });

    it('does not show suite page preview for non-suite pages', () => {
      const overviewPage = TEST_CONFIG.pages[0];

      const { container } = render(
        <ConfigEditor
          config={TEST_CONFIG}
          pageIndex={0}
          pageConfig={overviewPage}
          pdfBlobUrl="/template.pdf"
          onUpdatePage={vi.fn()}
          onReplacePage={vi.fn()}
          replacing={false}
        />
      );

      const preview = container.querySelector('.suite-page-preview');
      expect(preview).toBeNull();
    });
  });
});
