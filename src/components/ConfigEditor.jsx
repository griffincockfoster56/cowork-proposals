import { useState } from 'react';
import { RectangleDrawer } from './RectangleDrawer';

const DRAW_MODES = [
  { id: 'highlight', label: 'Suite Highlight', color: 'rgba(0, 100, 255, 0.3)', border: 'rgba(0, 100, 255, 0.8)' },
  { id: 'listPrice', label: 'List Price Row', color: 'rgba(255, 150, 0, 0.3)', border: 'rgba(255, 150, 0, 0.8)' },
  { id: 'foundingPrice', label: 'Founding Price Row', color: 'rgba(0, 200, 100, 0.3)', border: 'rgba(0, 200, 100, 0.8)' },
];

export function ConfigEditor({ config, pageIndex, pageConfig, pdfBlobUrl, onUpdatePage }) {
  const [drawMode, setDrawMode] = useState('highlight');

  const isSuite = pageConfig.type === 'suite';
  const isOverview = pageConfig.type === 'overview';

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
      onUpdatePage(pageIndex, {
        suiteConfig: {
          ...sc,
          priceRedaction: {
            ...(sc.priceRedaction || {}),
            listPrice: rect,
          },
        },
      });
    } else if (drawMode === 'foundingPrice') {
      onUpdatePage(pageIndex, {
        suiteConfig: {
          ...sc,
          priceRedaction: {
            ...(sc.priceRedaction || {}),
            foundingPrice: rect,
          },
        },
      });
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

      {pageConfig.type === 'other' && (
        <div className="other-page-info">
          <p>This page has no special configuration. Tag it as "Suite" or "Overview" to configure coordinates.</p>
        </div>
      )}
    </div>
  );
}
