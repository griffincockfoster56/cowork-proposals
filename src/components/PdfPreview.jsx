import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getHighlightsForOverviewPage, PAGE_HEIGHT } from '../config/suiteHighlights';

// Set up the worker using local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function renderSummaryCanvas(suites, dims, scale, style) {
  const s = style || {
    backgroundFill: { r: 255, g: 253, b: 245 },
    badgeBlue: { r: 43, g: 58, b: 103 },
    badgeGray: { r: 235, g: 235, b: 235 },
  };

  const blueColor = `rgb(${s.badgeBlue.r}, ${s.badgeBlue.g}, ${s.badgeBlue.b})`;
  const grayColor = `rgb(${s.badgeGray.r}, ${s.badgeGray.g}, ${s.badgeGray.b})`;

  const canvas = document.createElement('canvas');
  canvas.width = dims.width * scale;
  canvas.height = dims.height * scale;
  const ctx = canvas.getContext('2d');

  // Cream background
  ctx.fillStyle = `rgb(${s.backgroundFill.r}, ${s.backgroundFill.g}, ${s.backgroundFill.b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  const titleSize = 22 * scale;
  ctx.font = `bold ${titleSize}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = blueColor;
  const titleText = 'Proposal Summary';
  const titleWidth = ctx.measureText(titleText).width;
  ctx.fillText(titleText, (canvas.width - titleWidth) / 2, 80 * scale);

  // Suite rows — 3 columns: name (blue), price (gray), desks (blue)
  const rowHeight = 30 * scale;
  const rowSpacing = 10 * scale;
  const margin = 50 * scale;
  const rowWidth = canvas.width - margin * 2;
  const startX = margin;
  let currentY = 130 * scale;
  const fontSize = 12 * scale;
  const colWidth = rowWidth / 3;

  for (const suite of suites) {
    const textY = currentY + rowHeight / 2 + fontSize * 0.35;

    // Col 1: blue background with suite name in white
    ctx.fillStyle = blueColor;
    ctx.fillRect(startX, currentY, colWidth, rowHeight);
    ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'white';
    const labelWidth = ctx.measureText(suite.label).width;
    ctx.fillText(suite.label, startX + (colWidth - labelWidth) / 2, textY);

    // Col 2: gray background with price in blue
    ctx.fillStyle = grayColor;
    ctx.fillRect(startX + colWidth, currentY, colWidth, rowHeight);
    const priceText = suite.price || '';
    ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`;
    ctx.fillStyle = blueColor;
    const priceWidth = ctx.measureText(priceText).width;
    ctx.fillText(priceText, startX + colWidth + (colWidth - priceWidth) / 2, textY);

    // Col 3: blue background with desk count in white
    ctx.fillStyle = blueColor;
    ctx.fillRect(startX + colWidth * 2, currentY, colWidth, rowHeight);
    if (suite.desks) {
      const desksText = `up to ${suite.desks} desks`;
      ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = 'white';
      const desksWidth = ctx.measureText(desksText).width;
      ctx.fillText(desksText, startX + colWidth * 2 + (colWidth - desksWidth) / 2, textY);
    }

    currentY += rowHeight + rowSpacing;
  }

  return canvas.toDataURL();
}

export function PdfPreview({ templateUrl, selectedPages, config, customPrices = {}, customConferenceText = {} }) {
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
            isSummary: false,
            dataUrl: canvas.toDataURL(),
            width: viewport.width,
            height: viewport.height,
          });
        } catch (err) {
          console.error(`Failed to render page ${pageNum}:`, err);
        }
      }

      // Generate summary page if there are selected suites
      if (config && !cancelled) {
        const selectedSuites = [];
        for (const pageNum of sortedPages) {
          const pageConfig = config.pages[pageNum - 1];
          if (pageConfig?.type === 'suite') {
            const suiteName = pageConfig.label.split(' - ')[0] || pageConfig.label;
            const deskCount = pageConfig.suiteConfig?.deskCount || null;
            const price = customPrices[pageNum] || pageConfig.suiteConfig?.foundingMemberPrice || pageConfig.suiteConfig?.listPrice || '';

            selectedSuites.push({
              label: suiteName,
              price,
              desks: deskCount,
            });
          }
        }

        if (selectedSuites.length > 0) {
          const dims = config.pageDimensions || { width: 540, height: 779 };
          const scale = 1.5;
          const summaryDataUrl = renderSummaryCanvas(selectedSuites, dims, scale, config.style);

          // Insert after first overview page
          let insertIndex = 0;
          for (let i = 0; i < rendered.length; i++) {
            const pageConfig = config.pages[rendered[i].pageNum - 1];
            if (pageConfig?.type === 'overview') {
              insertIndex = i + 1;
              break;
            }
          }

          rendered.splice(insertIndex, 0, {
            pageNum: 'summary',
            isSummary: true,
            dataUrl: summaryDataUrl,
            width: dims.width * scale,
            height: dims.height * scale,
          });
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
  }, [pdfDoc, selectedPages, config, pageHeight, customPrices, customConferenceText]);

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
          <div key={page.isSummary ? 'summary' : page.pageNum} className="preview-page-full">
            <div className="page-divider">
              <span>{page.isSummary ? 'Summary' : `Page ${index + 1} of ${renderedPages.length}`}</span>
            </div>
            <img src={page.dataUrl} alt={page.isSummary ? 'Proposal Summary' : `Page ${index + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
