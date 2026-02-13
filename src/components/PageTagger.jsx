import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export function PageTagger({ config, pdfBlobUrl, selectedPageIndex, onSelectPage, onUpdatePage }) {
  const [thumbnails, setThumbnails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfBlobUrl) return;
    let cancelled = false;

    async function loadThumbnails() {
      try {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument(pdfBlobUrl);
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const thumbs = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 0.25;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          thumbs.push(canvas.toDataURL());
        }

        if (!cancelled) {
          setThumbnails(thumbs);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load thumbnails:', err);
        setLoading(false);
      }
    }

    loadThumbnails();
    return () => { cancelled = true; };
  }, [pdfBlobUrl]);

  const handleTypeChange = (pageIndex, type) => {
    const updates = { type };

    // Initialize sub-configs when switching type
    if (type === 'overview' && !config.pages[pageIndex].overviewConfig) {
      updates.overviewConfig = { suitePageIndices: [] };
    }
    if (type === 'suite' && !config.pages[pageIndex].suiteConfig) {
      updates.suiteConfig = {
        overviewPageIndex: null,
        highlightRects: [],
        priceRedaction: null,
        deskCount: null,
        listPrice: null,
        foundingMemberPrice: null,
      };
    }
    if (type === 'conference' && !config.pages[pageIndex].conferenceConfig) {
      updates.conferenceConfig = { textRedaction: null, defaultText: null };
    }
    // Clean up unused sub-configs
    if (type !== 'overview') {
      updates.overviewConfig = undefined;
    }
    if (type !== 'suite') {
      updates.suiteConfig = undefined;
    }
    if (type !== 'conference') {
      updates.conferenceConfig = undefined;
    }

    onUpdatePage(pageIndex, updates);
  };

  const handleLabelChange = (pageIndex, label) => {
    onUpdatePage(pageIndex, { label });
  };

  if (loading) {
    return <div className="page-tagger loading">Loading pages...</div>;
  }

  return (
    <div className="page-tagger">
      <h3>Pages</h3>
      <div className="page-tagger-list">
        {config.pages.map((page, idx) => (
          <div
            key={idx}
            className={`tagger-item ${idx === selectedPageIndex ? 'active' : ''}`}
            onClick={() => onSelectPage(idx)}
          >
            <div className="tagger-thumb">
              {thumbnails[idx] && (
                <img src={thumbnails[idx]} alt={`Page ${idx + 1}`} />
              )}
            </div>
            <div className="tagger-controls">
              <input
                type="text"
                className="tagger-label"
                value={page.label}
                onChange={(e) => handleLabelChange(idx, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <select
                className="tagger-type"
                value={page.type}
                onChange={(e) => handleTypeChange(idx, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="other">Other</option>
                <option value="overview">Overview</option>
                <option value="suite">Suite</option>
                <option value="conference">Conference</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
