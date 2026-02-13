import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { RectangleDrawer } from './RectangleDrawer';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Format a value as "$1,234" — strips non-numeric chars, adds $ and commas
function formatDollar(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  if (!digits) return null;
  return '$' + Number(digits).toLocaleString('en-US');
}

const DRAW_MODES = [
  { id: 'highlight', label: 'Suite Highlight', color: 'rgba(0, 100, 255, 0.3)', border: 'rgba(0, 100, 255, 0.8)' },
  { id: 'listPrice', label: 'List Price Row', color: 'rgba(255, 150, 0, 0.3)', border: 'rgba(255, 150, 0, 0.8)' },
  { id: 'foundingPrice', label: 'Founding Price Row', color: 'rgba(0, 200, 100, 0.3)', border: 'rgba(0, 200, 100, 0.8)' },
];

const CONFERENCE_DRAW_MODE = { id: 'conferenceText', label: 'Text Redaction', color: 'rgba(200, 50, 200, 0.3)', border: 'rgba(200, 50, 200, 0.8)' };

export function ConfigEditor({ config, pageIndex, pageConfig, pdfBlobUrl, onUpdatePage }) {
  const [drawMode, setDrawMode] = useState('highlight');

  const isSuite = pageConfig.type === 'suite';
  const isOverview = pageConfig.type === 'overview';
  const isConference = pageConfig.type === 'conference';

  // Get the active draw mode config
  const activeMode = DRAW_MODES.find(m => m.id === drawMode) || DRAW_MODES[0];

  // Get rects for current draw mode
  const getRects = () => {
    if (!isSuite) return [];
    const sc = pageConfig.suiteConfig;
    if (!sc) return [];

    if (drawMode === 'highlight') {
      return sc.highlightRects || [];
    }
    if (drawMode === 'listPrice') {
      return sc.priceRedaction?.listPrice ? [sc.priceRedaction.listPrice] : [];
    }
    if (drawMode === 'foundingPrice') {
      return sc.priceRedaction?.foundingPrice ? [sc.priceRedaction.foundingPrice] : [];
    }
    return [];
  };

  // Extract price text from PDF within a given rect region
  const extractPriceFromRect = async (rect, pageIdx) => {
    if (!pdfBlobUrl || !rect) return null;
    try {
      const pdf = await pdfjsLib.getDocument(pdfBlobUrl).promise;
      const page = await pdf.getPage(pageIdx + 1);
      const textContent = await page.getTextContent();
      const pad = 5;
      const match = textContent.items.find(item => {
        const x = item.transform[4];
        const y = item.transform[5];
        return x >= rect.x - pad && x <= rect.x + rect.width + pad &&
               y >= rect.y - pad && y <= rect.y + rect.height + pad &&
               /\$/.test(item.str);
      });
      return match ? match.str.trim() : null;
    } catch {
      return null;
    }
  };

  // Extract any text from PDF within a given rect region
  const extractTextFromRect = async (rect, pageIdx) => {
    if (!pdfBlobUrl || !rect) return null;
    try {
      const pdf = await pdfjsLib.getDocument(pdfBlobUrl).promise;
      const page = await pdf.getPage(pageIdx + 1);
      const textContent = await page.getTextContent();
      const pad = 5;
      const matches = textContent.items.filter(item => {
        const x = item.transform[4];
        const y = item.transform[5];
        return x >= rect.x - pad && x <= rect.x + rect.width + pad &&
               y >= rect.y - pad && y <= rect.y + rect.height + pad;
      });
      return matches.length > 0 ? matches.map(m => m.str).join(' ').trim() : null;
    } catch {
      return null;
    }
  };

  const handleConferenceAddRect = (rect) => {
    const cc = pageConfig.conferenceConfig || { textRedaction: null, defaultText: null };
    const updated = { ...cc, textRedaction: rect };
    onUpdatePage(pageIndex, { conferenceConfig: updated });
    // Auto-extract text from the rect area
    extractTextFromRect(rect, pageIndex).then(text => {
      if (text) {
        onUpdatePage(pageIndex, {
          conferenceConfig: { ...updated, defaultText: text },
        });
      }
    });
  };

  const handleConferenceDeleteRect = () => {
    const cc = pageConfig.conferenceConfig || { textRedaction: null, defaultText: null };
    onUpdatePage(pageIndex, {
      conferenceConfig: { ...cc, textRedaction: null },
    });
  };

  const handleAddRect = (rect) => {
    if (!isSuite) return;
    const sc = pageConfig.suiteConfig || { highlightRects: [], priceRedaction: null, overviewPageIndex: null };

    if (drawMode === 'highlight') {
      onUpdatePage(pageIndex, {
        suiteConfig: {
          ...sc,
          highlightRects: [...(sc.highlightRects || []), rect],
        },
      });
    } else if (drawMode === 'listPrice') {
      const updated = {
        ...sc,
        priceRedaction: {
          ...(sc.priceRedaction || {}),
          listPrice: rect,
        },
      };
      onUpdatePage(pageIndex, { suiteConfig: updated });
      // Auto-extract list price if not already set
      if (!sc.listPrice) {
        extractPriceFromRect(rect, pageIndex).then(price => {
          if (price) {
            onUpdatePage(pageIndex, {
              suiteConfig: { ...updated, listPrice: formatDollar(price) },
            });
          }
        });
      }
    } else if (drawMode === 'foundingPrice') {
      const updated = {
        ...sc,
        priceRedaction: {
          ...(sc.priceRedaction || {}),
          foundingPrice: rect,
        },
      };
      onUpdatePage(pageIndex, { suiteConfig: updated });
      // Auto-extract founding price if not already set
      if (!sc.foundingMemberPrice) {
        extractPriceFromRect(rect, pageIndex).then(price => {
          if (price) {
            onUpdatePage(pageIndex, {
              suiteConfig: { ...updated, foundingMemberPrice: formatDollar(price) },
            });
          }
        });
      }
    }
  };

  const handleDeleteRect = (rectIndex) => {
    if (!isSuite) return;
    const sc = pageConfig.suiteConfig;
    if (!sc) return;

    if (drawMode === 'highlight') {
      const rects = [...(sc.highlightRects || [])];
      rects.splice(rectIndex, 1);
      onUpdatePage(pageIndex, {
        suiteConfig: { ...sc, highlightRects: rects },
      });
    } else if (drawMode === 'listPrice') {
      onUpdatePage(pageIndex, {
        suiteConfig: {
          ...sc,
          priceRedaction: { ...(sc.priceRedaction || {}), listPrice: null },
        },
      });
    } else if (drawMode === 'foundingPrice') {
      onUpdatePage(pageIndex, {
        suiteConfig: {
          ...sc,
          priceRedaction: { ...(sc.priceRedaction || {}), foundingPrice: null },
        },
      });
    }
  };

  // Overview page: manage suite page indices
  const handleToggleSuiteLink = (suitePageIdx) => {
    const oc = pageConfig.overviewConfig || { suitePageIndices: [] };
    const indices = [...oc.suitePageIndices];
    const pos = indices.indexOf(suitePageIdx);
    if (pos >= 0) {
      indices.splice(pos, 1);
    } else {
      indices.push(suitePageIdx);
      indices.sort((a, b) => a - b);
    }
    onUpdatePage(pageIndex, {
      overviewConfig: { ...oc, suitePageIndices: indices },
    });
  };

  // Also update the suite's overviewPageIndex when linking
  const handleSetOverviewForSuite = (overviewIdx) => {
    const sc = pageConfig.suiteConfig || { highlightRects: [], priceRedaction: null, overviewPageIndex: null };
    onUpdatePage(pageIndex, {
      suiteConfig: { ...sc, overviewPageIndex: overviewIdx },
    });
  };

  return (
    <div className="config-editor">
      <h3>Page {pageIndex + 1}: {pageConfig.label}</h3>
      <div className="editor-type-badge">Type: <strong>{pageConfig.type}</strong></div>

      {isSuite && (
        <>
          {/* Draw mode toolbar */}
          <div className="draw-toolbar">
            <span className="toolbar-label">Draw:</span>
            {DRAW_MODES.map(mode => (
              <button
                key={mode.id}
                className={`btn-small draw-mode-btn ${drawMode === mode.id ? 'active' : ''}`}
                onClick={() => setDrawMode(mode.id)}
                style={drawMode === mode.id ? { borderColor: mode.border, background: mode.color } : {}}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Overview page selector */}
          <div className="suite-overview-link">
            <label>Overview Page:</label>
            <select
              value={pageConfig.suiteConfig?.overviewPageIndex ?? ''}
              onChange={(e) => handleSetOverviewForSuite(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">None</option>
              {config.pages
                .filter(p => p.type === 'overview')
                .map(p => (
                  <option key={p.pageIndex} value={p.pageIndex}>
                    {p.label} (Page {p.pageIndex + 1})
                  </option>
                ))}
            </select>
          </div>

          {/* Rented toggle */}
          <div className="suite-rented">
            <label>
              <input
                type="checkbox"
                checked={!!pageConfig.suiteConfig?.rented}
                onChange={(e) => {
                  const sc = pageConfig.suiteConfig || { highlightRects: [], priceRedaction: null, overviewPageIndex: null, deskCount: null, rented: false };
                  onUpdatePage(pageIndex, { suiteConfig: { ...sc, rented: e.target.checked } });
                }}
              />
              Rented
            </label>
          </div>

          {/* Desk count */}
          <div className="suite-desk-count">
            <label>Desks:</label>
            <input
              type="number"
              min="0"
              className="desk-count-input"
              value={pageConfig.suiteConfig?.deskCount ?? ''}
              onChange={(e) => {
                const sc = pageConfig.suiteConfig || { highlightRects: [], priceRedaction: null, overviewPageIndex: null, deskCount: null };
                const val = e.target.value === '' ? null : Number(e.target.value);
                onUpdatePage(pageIndex, { suiteConfig: { ...sc, deskCount: val } });
              }}
              placeholder="# of desks"
            />
          </div>

          {/* Price fields */}
          <div className="suite-price-fields">
            <div className="suite-price-input">
              <label>List Price:</label>
              <input
                type="text"
                value={pageConfig.suiteConfig?.listPrice ?? ''}
                onChange={(e) => {
                  const sc = pageConfig.suiteConfig || { highlightRects: [], priceRedaction: null, overviewPageIndex: null, deskCount: null, listPrice: null, foundingMemberPrice: null };
                  onUpdatePage(pageIndex, { suiteConfig: { ...sc, listPrice: e.target.value || null } });
                }}
                onBlur={(e) => {
                  const formatted = formatDollar(e.target.value);
                  if (formatted !== (pageConfig.suiteConfig?.listPrice ?? null)) {
                    const sc = pageConfig.suiteConfig || { highlightRects: [], priceRedaction: null, overviewPageIndex: null, deskCount: null, listPrice: null, foundingMemberPrice: null };
                    onUpdatePage(pageIndex, { suiteConfig: { ...sc, listPrice: formatted } });
                  }
                }}
                placeholder="$0,000"
              />
            </div>
            <div className="suite-price-input">
              <label>Founding Price:</label>
              <input
                type="text"
                value={pageConfig.suiteConfig?.foundingMemberPrice ?? ''}
                onChange={(e) => {
                  const sc = pageConfig.suiteConfig || { highlightRects: [], priceRedaction: null, overviewPageIndex: null, deskCount: null, listPrice: null, foundingMemberPrice: null };
                  onUpdatePage(pageIndex, { suiteConfig: { ...sc, foundingMemberPrice: e.target.value || null } });
                }}
                onBlur={(e) => {
                  const formatted = formatDollar(e.target.value);
                  if (formatted !== (pageConfig.suiteConfig?.foundingMemberPrice ?? null)) {
                    const sc = pageConfig.suiteConfig || { highlightRects: [], priceRedaction: null, overviewPageIndex: null, deskCount: null, listPrice: null, foundingMemberPrice: null };
                    onUpdatePage(pageIndex, { suiteConfig: { ...sc, foundingMemberPrice: formatted } });
                  }
                }}
                placeholder="$0,000"
              />
            </div>
          </div>

          {/* Rectangle drawer — show the overview page when drawing highlights,
              since highlight rects mark the suite's location on the floor plan */}
          {drawMode === 'highlight' && pageConfig.suiteConfig?.overviewPageIndex == null ? (
            <div className="drawer-placeholder">
              Select an Overview Page above before drawing suite highlights.
            </div>
          ) : (
            <>
              {drawMode === 'highlight' && (
                <div className="drawer-hint">
                  Drawing on: <strong>{config.pages[pageConfig.suiteConfig.overviewPageIndex]?.label || 'Overview'}</strong> — mark where this suite is on the floor plan
                </div>
              )}
              {drawMode !== 'highlight' && (
                <div className="drawer-hint">
                  Drawing on: <strong>{pageConfig.label}</strong>
                </div>
              )}
              <RectangleDrawer
                pdfBlobUrl={pdfBlobUrl}
                pageIndex={drawMode === 'highlight' ? pageConfig.suiteConfig.overviewPageIndex : pageIndex}
                pageDimensions={config.pageDimensions}
                rects={getRects()}
                onAddRect={handleAddRect}
                onDeleteRect={handleDeleteRect}
                rectColor={activeMode.color}
                rectBorder={activeMode.border}
              />
            </>
          )}

          {/* Rect list */}
          <div className="rect-list">
            <h4>Highlight Rects ({(pageConfig.suiteConfig?.highlightRects || []).length})</h4>
            {(pageConfig.suiteConfig?.highlightRects || []).map((r, i) => (
              <div key={i} className="rect-item">
                <span>x:{r.x} y:{r.y} w:{r.width} h:{r.height}</span>
                <button className="btn-small btn-danger" onClick={() => {
                  setDrawMode('highlight');
                  handleDeleteRect(i);
                }}>x</button>
              </div>
            ))}
            <h4>Price Redaction</h4>
            {pageConfig.suiteConfig?.priceRedaction?.listPrice && (
              <div className="rect-item">
                <span>List: x:{pageConfig.suiteConfig.priceRedaction.listPrice.x} y:{pageConfig.suiteConfig.priceRedaction.listPrice.y} w:{pageConfig.suiteConfig.priceRedaction.listPrice.width} h:{pageConfig.suiteConfig.priceRedaction.listPrice.height}</span>
              </div>
            )}
            {pageConfig.suiteConfig?.priceRedaction?.foundingPrice && (
              <div className="rect-item">
                <span>Founding: x:{pageConfig.suiteConfig.priceRedaction.foundingPrice.x} y:{pageConfig.suiteConfig.priceRedaction.foundingPrice.y} w:{pageConfig.suiteConfig.priceRedaction.foundingPrice.width} h:{pageConfig.suiteConfig.priceRedaction.foundingPrice.height}</span>
              </div>
            )}
          </div>
        </>
      )}

      {isOverview && (
        <>
          <h4>Linked Suite Pages</h4>
          <div className="overview-suite-links">
            {config.pages
              .filter(p => p.type === 'suite')
              .map(p => {
                const isLinked = (pageConfig.overviewConfig?.suitePageIndices || []).includes(p.pageIndex);
                return (
                  <label key={p.pageIndex} className="suite-link-item">
                    <input
                      type="checkbox"
                      checked={isLinked}
                      onChange={() => handleToggleSuiteLink(p.pageIndex)}
                    />
                    {p.label} (Page {p.pageIndex + 1})
                  </label>
                );
              })}
            {config.pages.filter(p => p.type === 'suite').length === 0 && (
              <p className="no-suites-msg">No pages tagged as "Suite" yet. Tag pages in the left panel first.</p>
            )}
          </div>
        </>
      )}

      {isConference && (
        <>
          <div className="draw-toolbar">
            <span className="toolbar-label">Draw:</span>
            <button
              className="btn-small draw-mode-btn active"
              style={{ borderColor: CONFERENCE_DRAW_MODE.border, background: CONFERENCE_DRAW_MODE.color }}
            >
              {CONFERENCE_DRAW_MODE.label}
            </button>
          </div>

          <div className="drawer-hint">
            Drawing on: <strong>{pageConfig.label}</strong>
          </div>
          <RectangleDrawer
            pdfBlobUrl={pdfBlobUrl}
            pageIndex={pageIndex}
            pageDimensions={config.pageDimensions}
            rects={pageConfig.conferenceConfig?.textRedaction ? [pageConfig.conferenceConfig.textRedaction] : []}
            onAddRect={handleConferenceAddRect}
            onDeleteRect={handleConferenceDeleteRect}
            rectColor={CONFERENCE_DRAW_MODE.color}
            rectBorder={CONFERENCE_DRAW_MODE.border}
          />

          <div className="conference-default-text">
            <label>Default Text:</label>
            <input
              type="text"
              value={pageConfig.conferenceConfig?.defaultText ?? ''}
              onChange={(e) => {
                const cc = pageConfig.conferenceConfig || { textRedaction: null, defaultText: null };
                onUpdatePage(pageIndex, { conferenceConfig: { ...cc, defaultText: e.target.value || null } });
              }}
              placeholder="e.g. Includes 30 hours/month"
            />
          </div>

          <div className="rect-list">
            <h4>Text Redaction</h4>
            {pageConfig.conferenceConfig?.textRedaction && (
              <div className="rect-item">
                <span>x:{pageConfig.conferenceConfig.textRedaction.x} y:{pageConfig.conferenceConfig.textRedaction.y} w:{pageConfig.conferenceConfig.textRedaction.width} h:{pageConfig.conferenceConfig.textRedaction.height}</span>
              </div>
            )}
          </div>
        </>
      )}

      {pageConfig.type === 'other' && (
        <div className="other-page-info">
          <p>This page has no special configuration. Tag it as "Suite", "Overview", or "Conference" to configure coordinates.</p>
        </div>
      )}
    </div>
  );
}
