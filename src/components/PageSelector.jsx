import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the worker using local file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export function PageSelector({
  templateUrl,
  selectedPages,
  onTogglePage,
  onPageCountChange,
  pageData,
  customPrices,
  onSetCustomPrice,
  customConferenceText,
  onSetConferenceText,
  config
}) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(templateUrl);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        onPageCountChange(pdf.numPages);

        const pageDataList = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 0.3; // Thumbnail scale
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Derive metadata from config or fall back to pageData prop
          let label, hasPricing, deskCount, rented, hasConferenceText, conferenceDefaultText;
          if (config) {
            const pageConfig = config.pages[i - 1];
            label = pageConfig?.label || `Page ${i}`;
            hasPricing = pageConfig?.type === 'suite' && !!pageConfig.suiteConfig?.priceRedaction;
            deskCount = pageConfig?.suiteConfig?.deskCount || null;
            rented = !!pageConfig?.suiteConfig?.rented;
            hasConferenceText = pageConfig?.type === 'conference' && !!pageConfig.conferenceConfig?.textRedaction;
            conferenceDefaultText = pageConfig?.conferenceConfig?.defaultText || '';
          } else {
            const meta = pageData[i - 1] || { label: `Page ${i}`, hasPricing: false };
            label = meta.label;
            hasPricing = meta.hasPricing;
            deskCount = null;
            rented = false;
            hasConferenceText = false;
            conferenceDefaultText = '';
          }

          pageDataList.push({
            pageNum: i,
            thumbnail: canvas.toDataURL(),
            label,
            hasPricing,
            deskCount,
            rented,
            hasConferenceText,
            conferenceDefaultText,
          });
        }

        if (!cancelled) {
          setPages(pageDataList);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load PDF:', err);
          setError(err.message);
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [templateUrl, onPageCountChange, pageData, config]);

  if (loading) {
    return (
      <div className="page-selector loading">
        <div className="loading-spinner">Loading template...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-selector error">
        <div className="error-message">Failed to load template: {error}</div>
      </div>
    );
  }

  return (
    <div className="page-selector">
      {pages.map((page) => {
        const isSelected = selectedPages.has(page.pageNum);

        return (
          <div
            key={page.pageNum}
            className={`page-item ${isSelected ? 'selected' : ''}`}
          >
            <div
              className="page-main"
              onClick={() => onTogglePage(page.pageNum)}
            >
              <div className="page-checkbox">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onTogglePage(page.pageNum)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="page-thumbnail">
                <img src={page.thumbnail} alt={page.label} />
              </div>
              <div className="page-label">
                <span className="page-number">Page {page.pageNum}</span>
                <span className="page-title">{page.label}</span>
                {page.deskCount != null && (
                  <span className="page-desk-count">
                    {page.deskCount} desks
                  </span>
                )}
                {page.rented && (
                  <span className="page-rented-badge">Rented</span>
                )}
              </div>
            </div>

            {page.hasPricing && isSelected && (
              <div className="custom-price-input" onClick={(e) => e.stopPropagation()}>
                <label className="custom-price-label" htmlFor={`price-${page.pageNum}`}>
                  Custom Price:
                </label>
                <input
                  id={`price-${page.pageNum}`}
                  type="text"
                  className="custom-price-field"
                  placeholder="Enter price..."
                  value={customPrices[page.pageNum] || ''}
                  onChange={(e) => onSetCustomPrice(page.pageNum, e.target.value)}
                />
              </div>
            )}

            {page.hasConferenceText && isSelected && (
              <div className="custom-price-input" onClick={(e) => e.stopPropagation()}>
                <label className="custom-price-label" htmlFor={`conf-${page.pageNum}`}>
                  Conference Hours:
                </label>
                <input
                  id={`conf-${page.pageNum}`}
                  type="text"
                  className="custom-price-field"
                  placeholder={page.conferenceDefaultText || 'Enter text...'}
                  value={customConferenceText?.[page.pageNum] || ''}
                  onChange={(e) => onSetConferenceText?.(page.pageNum, e.target.value)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
