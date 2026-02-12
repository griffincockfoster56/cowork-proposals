import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getHighlightsForOverviewPage, PAGE_HEIGHT } from '../config/suiteHighlights';

// Set up the worker using local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export function PdfPreview({ templateUrl, selectedPages, config }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [renderedPages, setRenderedPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);

  const pageHeight = config?.pageDimensions?.height || PAGE_HEIGHT;

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const loadingTask = pdfjsLib.getDocument(templateUrl);
        const pdf = await loadingTask.promise;
        if (!cancelled) {
          setPdfDoc(pdf);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load PDF:', err);
        setLoading(false);
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [templateUrl]);

  // Render selected pages at full size
  useEffect(() => {
    if (!pdfDoc) return;

    let cancelled = false;

    async function renderPages() {
      setRendering(true);
      const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
      const rendered = [];

      for (const pageNum of sortedPages) {
        if (cancelled) break;

        try {
          const page = await pdfDoc.getPage(pageNum);
          // Use scale 1.5 for good quality full-size rendering
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Draw highlight rects for selected suites on overview pages
          const highlights = getHighlightsForOverviewPage(pageNum, selectedPages, config);
          if (highlights.length > 0) {
            context.strokeStyle = 'rgb(255, 0, 0)';
            context.lineWidth = 2 * scale;
            for (const rect of highlights) {
              // Flip y-axis: PDF bottom-left origin → canvas top-left origin
              context.strokeRect(
                rect.x * scale,
                (pageHeight - rect.y - rect.height) * scale,
                rect.width * scale,
                rect.height * scale
              );
            }
          }

          rendered.push({
            pageNum,
            dataUrl: canvas.toDataURL(),
            width: viewport.width,
            height: viewport.height,
          });
        } catch (err) {
          console.error(`Failed to render page ${pageNum}:`, err);
        }
      }

      if (!cancelled) {
        setRenderedPages(rendered);
        setRendering(false);
      }
    }

    renderPages();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, selectedPages, config, pageHeight]);

  if (loading) {
    return (
      <div className="pdf-preview loading">
        <div className="loading-spinner">Loading preview...</div>
      </div>
    );
  }

  if (selectedPages.size === 0) {
    return (
      <div className="pdf-preview empty">
        <div className="empty-message">
          <h2>No pages selected</h2>
          <p>Select pages from the left panel to preview your proposal</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-preview full">
      <div className="preview-header">
        <h2>Preview ({selectedPages.size} pages)</h2>
        {rendering && <span className="rendering-indicator">Rendering...</span>}
      </div>
      <div className="preview-scroll">
        {renderedPages.map((page, index) => (
          <div key={page.pageNum} className="preview-page-full">
            <div className="page-divider">
              <span>Page {index + 1} of {selectedPages.size}</span>
            </div>
            <img src={page.dataUrl} alt={`Page ${index + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
