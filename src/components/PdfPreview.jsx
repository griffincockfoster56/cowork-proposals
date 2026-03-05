import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getHighlightsForOverviewPage, PAGE_HEIGHT } from '../config/suiteHighlights';

// Set up the worker using local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

function renderSummaryCanvas(suites, dims, scale, style, borderImage) {
  const s = style || {
    backgroundFill: { r: 254, g: 247, b: 237 },
    badgeBlue: { r: 15, g: 46, b: 73 },
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

  // Draw border image as background overlay
  if (borderImage) {
    ctx.drawImage(borderImage, 0, 0, canvas.width, canvas.height);
  }

  // Cover "WORKPLACE FOR BRAND BUILDERS" text from the border image
  // Use exact background color sampled from the border image PNG
  ctx.fillStyle = 'rgb(254, 247, 237)';
  ctx.fillRect(canvas.width * 0.25, canvas.height * 0.165, canvas.width * 0.5, canvas.height * 0.012);

  // Title
  const titleSize = 14 * scale;
  ctx.font = `400 ${titleSize}px 'Work Sans', Helvetica, Arial, sans-serif`;
  ctx.fillStyle = '#333333';
  const titleText = 'Proposal Summary';
  const titleWidth = ctx.measureText(titleText).width;
  ctx.fillText(titleText, (canvas.width - titleWidth) / 2, 230 * scale);

  // Suite rows — 4 columns: name (blue), price (gray), desks (blue), available (gray)
  const rowHeight = 30 * scale;
  const rowSpacing = 10 * scale;
  const margin = 50 * scale;
  const rowWidth = canvas.width - margin * 2;
  const startX = margin;
  let currentY = 280 * scale;
  const fontSize = 12 * scale;
  const colWidth = rowWidth / 4;

  // Header row
  const headerTextY = currentY + rowHeight / 2 + fontSize * 0.35;

  // Header Col 1: blue bg, white text
  ctx.fillStyle = blueColor;
  ctx.fillRect(startX, currentY, colWidth, rowHeight);
  ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = 'white';
  const hw1 = ctx.measureText('Suite Number').width;
  ctx.fillText('Suite Number', startX + (colWidth - hw1) / 2, headerTextY);

  // Header Col 2: gray bg, blue text
  ctx.fillStyle = grayColor;
  ctx.fillRect(startX + colWidth, currentY, colWidth, rowHeight);
  ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = blueColor;
  const hw2 = ctx.measureText('Price').width;
  ctx.fillText('Price', startX + colWidth + (colWidth - hw2) / 2, headerTextY);

  // Header Col 3: blue bg, white text
  ctx.fillStyle = blueColor;
  ctx.fillRect(startX + colWidth * 2, currentY, colWidth, rowHeight);
  ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = 'white';
  const hw3 = ctx.measureText('Number of Desks').width;
  ctx.fillText('Number of Desks', startX + colWidth * 2 + (colWidth - hw3) / 2, headerTextY);

  // Header Col 4: gray bg, blue text
  ctx.fillStyle = grayColor;
  ctx.fillRect(startX + colWidth * 3, currentY, colWidth, rowHeight);
  ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = blueColor;
  const hw4 = ctx.measureText('Available').width;
  ctx.fillText('Available', startX + colWidth * 3 + (colWidth - hw4) / 2, headerTextY);

  currentY += rowHeight + rowSpacing;

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

    // Col 4: gray background with available date in blue
    ctx.fillStyle = grayColor;
    ctx.fillRect(startX + colWidth * 3, currentY, colWidth, rowHeight);
    if (suite.available) {
      ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`;
      ctx.fillStyle = blueColor;
      const availWidth = ctx.measureText(suite.available).width;
      ctx.fillText(suite.available, startX + colWidth * 3 + (colWidth - availWidth) / 2, textY);
    }

    currentY += rowHeight + rowSpacing;
  }

  return canvas.toDataURL();
}

// Load an image from a URL and return an HTMLImageElement
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function PdfPreview({ templateUrl, selectedPages, config, customPrices = {}, customConferenceText = {} }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [renderedPages, setRenderedPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [borderImage, setBorderImage] = useState(null);

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

  // Load summary border image
  useEffect(() => {
    let cancelled = false;

    loadImage('/summary-border.png')
      .then(img => { if (!cancelled) setBorderImage(img); })
      .catch(e => console.warn('Could not load summary border:', e));

    return () => { cancelled = true; };
  }, []);

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
            const availability = pageConfig.suiteConfig?.availability || (pageConfig.suiteConfig?.rented ? 'rented' : 'available');
            let available = '';
            if (availability === 'available_date' && pageConfig.suiteConfig?.availableDate) {
              const d = new Date(pageConfig.suiteConfig.availableDate + 'T00:00:00');
              available = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            } else if (availability === 'available') {
              available = 'Today';
            }

            selectedSuites.push({
              label: suiteName,
              price,
              desks: deskCount,
              available,
            });
          }
        }

        if (selectedSuites.length > 0) {
          const dims = config.pageDimensions || { width: 540, height: 779 };
          const scale = 1.5;
          const summaryDataUrl = renderSummaryCanvas(selectedSuites, dims, scale, config.style, borderImage);

          rendered.splice(0, 0, {
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
  }, [pdfDoc, selectedPages, config, pageHeight, customPrices, customConferenceText, borderImage]);

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
