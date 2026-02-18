import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pdfjs-dist
const mockRenderPromise = Promise.resolve();
const mockGetPage = vi.fn();
const mockGetDocument = vi.fn();

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args) => mockGetDocument(...args),
}));

// Mock pdf-lib
const mockCopyPages = vi.fn();
const mockRemovePage = vi.fn();
const mockInsertPage = vi.fn();
const mockSave = vi.fn();
const mockEmbedJpg = vi.fn();
const mockEmbedPng = vi.fn();
const mockDrawImage = vi.fn();
const mockLoadPdf = vi.fn();

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn(() => Promise.resolve({
      copyPages: mockCopyPages,
      removePage: mockRemovePage,
      insertPage: mockInsertPage,
      save: mockSave,
      embedJpg: mockEmbedJpg,
      embedPng: mockEmbedPng,
    })),
  },
}));

// Mock storage
vi.mock('../storage/pdfStorage', () => ({
  savePdf: vi.fn(() => Promise.resolve()),
  loadPdf: vi.fn(() => Promise.resolve(new ArrayBuffer(10))),
}));

// Mock chatHelp
vi.mock('../utils/chatHelp', () => ({
  getChatUrl: () => 'https://example.com/help',
}));

import { render, act, waitFor, fireEvent } from '@testing-library/react';
import { TemplateSetup } from './TemplateSetup';
import { PDFDocument } from 'pdf-lib';
import { savePdf, loadPdf } from '../storage/pdfStorage';

const realCreateElement = document.createElement.bind(document);

let createElementSpy;

const TEST_CONFIG = {
  id: 'test-template',
  name: 'Test Template',
  pdfStorageKey: 'test-pdf-key',
  pageDimensions: { width: 540, height: 779 },
  pages: [
    { pageIndex: 0, label: 'Overview', type: 'overview', overviewConfig: { suitePageIndices: [1] } },
    { pageIndex: 1, label: 'Suite 101', type: 'suite', suiteConfig: { overviewPageIndex: 0, highlightRects: [], priceRedaction: null, deskCount: 5, listPrice: null, foundingMemberPrice: null } },
    { pageIndex: 2, label: 'Amenities', type: 'other' },
  ],
  style: { backgroundFill: { r: 255, g: 253, b: 245 }, badgeBlue: { r: 43, g: 58, b: 103 }, badgeGray: { r: 235, g: 235, b: 235 } },
};

const DEFAULT_CONFIG = {
  ...TEST_CONFIG,
  id: 'default-template',
  pdfStorageKey: 'default-template',
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
      numPages: 3,
      getPage: mockGetPage,
    }),
  });

  mockCopyPages.mockResolvedValue([{ fake: 'page' }]);
  mockSave.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mockEmbedJpg.mockResolvedValue({ width: 800, height: 600 });
  mockEmbedPng.mockResolvedValue({ width: 800, height: 600 });
  mockInsertPage.mockReturnValue({ drawImage: mockDrawImage });

  // Mock fetch for default template loading
  global.fetch = vi.fn(() => Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
  }));

  // Mock URL.createObjectURL / revokeObjectURL
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock window.alert (not implemented in jsdom)
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  createElementSpy.mockRestore();
  delete global.fetch;
});

// Helper: create a File-like object with working .arrayBuffer()
function createMockFile(name, type) {
  const buffer = new ArrayBuffer(10);
  const file = new File([buffer], name, { type });
  // jsdom File doesn't implement arrayBuffer(), so polyfill it
  if (!file.arrayBuffer) {
    file.arrayBuffer = () => Promise.resolve(buffer);
  }
  return file;
}

describe('TemplateSetup', () => {
  it('syncs localPdfBlobUrl when pdfBlobUrl prop arrives after mount', async () => {
    // Mount with null pdfBlobUrl, then re-render with a real one
    const onSave = vi.fn();
    const onCancel = vi.fn();

    let rerender;
    await act(async () => {
      const result = render(
        <TemplateSetup config={TEST_CONFIG} pdfBlobUrl={null} onSave={onSave} onCancel={onCancel} />
      );
      rerender = result.rerender;
      await new Promise(r => setTimeout(r, 50));
    });

    // PageTagger should show loading since pdfBlobUrl is null
    // Now re-render with a real URL
    await act(async () => {
      rerender(
        <TemplateSetup config={TEST_CONFIG} pdfBlobUrl="/template.pdf" onSave={onSave} onCancel={onCancel} />
      );
      await new Promise(r => setTimeout(r, 50));
    });

    // pdfjs should have been called with the new URL (proving localPdfBlobUrl was updated)
    expect(mockGetDocument).toHaveBeenCalledWith('/template.pdf');
  });

  it('passes onReplacePage and replacing props to ConfigEditor', async () => {
    let container;
    await act(async () => {
      const result = render(
        <TemplateSetup config={TEST_CONFIG} pdfBlobUrl="/template.pdf" onSave={vi.fn()} onCancel={vi.fn()} />
      );
      container = result.container;
      await new Promise(r => setTimeout(r, 50));
    });

    // The ConfigEditor should have the Replace Page button
    await waitFor(() => {
      const replaceBtn = container.querySelector('.replace-page-btn');
      expect(replaceBtn).not.toBeNull();
    });
  });

  it('handles PDF page replacement and saves to storage', async () => {
    let container;
    await act(async () => {
      const result = render(
        <TemplateSetup config={TEST_CONFIG} pdfBlobUrl="/template.pdf" onSave={vi.fn()} onCancel={vi.fn()} />
      );
      container = result.container;
      await new Promise(r => setTimeout(r, 100));
    });

    // Find the file input inside the Replace Page button
    const fileInput = container.querySelector('.replace-page-btn input[type="file"]');
    expect(fileInput).not.toBeNull();

    // Simulate uploading a PDF file
    const file = createMockFile('replacement.pdf', 'application/pdf');
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise(r => setTimeout(r, 200));
    });

    // pdf-lib should have been used to load and modify the PDF
    expect(PDFDocument.load).toHaveBeenCalled();
    expect(mockCopyPages).toHaveBeenCalled();
    expect(mockRemovePage).toHaveBeenCalledWith(0); // pageIndex 0 is selected by default
    expect(mockInsertPage).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();

    // Should have saved to storage
    expect(savePdf).toHaveBeenCalledWith('test-pdf-key', expect.any(Uint8Array));
  });

  it('generates new pdfStorageKey when replacing page on default template', async () => {
    // Mock crypto.randomUUID
    const mockUUID = 'new-uuid-1234';
    const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID);

    const onSave = vi.fn();
    let container;
    await act(async () => {
      const result = render(
        <TemplateSetup config={DEFAULT_CONFIG} pdfBlobUrl="/template.pdf" onSave={onSave} onCancel={vi.fn()} />
      );
      container = result.container;
      await new Promise(r => setTimeout(r, 100));
    });

    const fileInput = container.querySelector('.replace-page-btn input[type="file"]');
    const file = createMockFile('replacement.pdf', 'application/pdf');

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise(r => setTimeout(r, 200));
    });

    // Should fetch from the blob URL (default template)
    expect(global.fetch).toHaveBeenCalled();

    // Should save with the new UUID key, not 'default-template'
    expect(savePdf).toHaveBeenCalledWith(mockUUID, expect.any(Uint8Array));

    // Click Save to verify config has updated pdfStorageKey
    const saveBtn = container.querySelector('.btn-primary');
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ pdfStorageKey: mockUUID })
    );

    uuidSpy.mockRestore();
  });

  it('handles image upload (JPG) with aspect-ratio scaling', async () => {
    let container;
    await act(async () => {
      const result = render(
        <TemplateSetup config={TEST_CONFIG} pdfBlobUrl="/template.pdf" onSave={vi.fn()} onCancel={vi.fn()} />
      );
      container = result.container;
      await new Promise(r => setTimeout(r, 100));
    });

    const fileInput = container.querySelector('.replace-page-btn input[type="file"]');
    const file = createMockFile('photo.jpg', 'image/jpeg');

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise(r => setTimeout(r, 200));
    });

    // Should embed the image and draw it on a new page
    expect(mockEmbedJpg).toHaveBeenCalled();
    expect(mockRemovePage).toHaveBeenCalledWith(0);
    expect(mockInsertPage).toHaveBeenCalledWith(0, [540, 779]);
    expect(mockDrawImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) })
    );
    expect(savePdf).toHaveBeenCalled();
  });
});
