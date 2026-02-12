import { useState, useMemo } from 'react';
import { PageSelector } from './PageSelector';
import { PdfPreview } from './PdfPreview';
import { exportSelectedPages } from '../utils/pdfExport';

export function ProposalBuilder({ config, pdfBlobUrl, onBack }) {
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [pageCount, setPageCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [customPrices, setCustomPrices] = useState({});
  const [autoSelectState, setAutoSelectState] = useState({});
  // autoSelectState keyed by overview pageIndex: { minDesks: number, excludeRented: boolean }

  const templateUrl = pdfBlobUrl;

  const togglePage = (pageNum) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  const setCustomPrice = (pageNum, value) => {
    setCustomPrices((prev) => ({ ...prev, [pageNum]: value }));
  };

  const selectAll = () => {
    const all = new Set();
    for (let i = 1; i <= pageCount; i++) {
      all.add(i);
    }
    setSelectedPages(all);
  };

  const selectNone = () => {
    setSelectedPages(new Set());
  };

  const handleExport = async () => {
    if (selectedPages.size === 0) {
      alert('Please select at least one page');
      return;
    }

    setIsExporting(true);
    try {
      const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
      const prices = {};
      sortedPages.forEach(pageNum => {
        const pageConfig = config?.pages[pageNum - 1];
        const hasPricing = pageConfig?.type === 'suite' && !!pageConfig.suiteConfig?.priceRedaction;
        if (hasPricing && customPrices[pageNum]) {
          prices[pageNum] = customPrices[pageNum];
        }
      });
      await exportSelectedPages(templateUrl, sortedPages, prices, config);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export PDF');
    }
    setIsExporting(false);
  };

  // Derive pageData from config for legacy compatibility — memoized so
  // the reference stays stable and doesn't re-trigger PageSelector's useEffect.
  const pageData = useMemo(() =>
    config
      ? config.pages.map(p => ({
          label: p.label,
          hasPricing: p.type === 'suite' && !!p.suiteConfig?.priceRedaction,
        }))
      : [],
    [config]
  );

  // Build overview groups for auto-select: each overview page and its linked suites
  const overviewGroups = useMemo(() => {
    if (!config) return [];
    return config.pages
      .filter(p => p.type === 'overview' && p.overviewConfig?.suitePageIndices?.length > 0)
      .map(overviewPage => {
        const suites = (overviewPage.overviewConfig.suitePageIndices || [])
          .map(idx => config.pages[idx])
          .filter(Boolean)
          .filter(p => p.type === 'suite');
        return {
          overviewPageIndex: overviewPage.pageIndex,
          overviewLabel: overviewPage.label,
          suites,
        };
      });
  }, [config]);

  const getAutoState = (overviewIdx) => {
    return autoSelectState[overviewIdx] || { minDesks: '', maxDesks: '', excludeRented: true };
  };

  const updateAutoState = (overviewIdx, updates) => {
    setAutoSelectState(prev => ({
      ...prev,
      [overviewIdx]: { ...getAutoState(overviewIdx), ...updates },
    }));
  };

  const handleAutoSelect = (group) => {
    const state = getAutoState(group.overviewPageIndex);
    const minDesks = state.minDesks === '' ? 0 : Number(state.minDesks);
    const maxDesks = state.maxDesks === '' ? Infinity : Number(state.maxDesks);

    const matchingSuites = group.suites.filter(suite => {
      const deskCount = suite.suiteConfig?.deskCount || 0;
      if (deskCount < minDesks) return false;
      if (deskCount > maxDesks) return false;
      if (state.excludeRented && suite.suiteConfig?.rented) return false;
      return true;
    });

    setSelectedPages(prev => {
      const next = new Set(prev);
      // Add the overview page (1-indexed)
      next.add(group.overviewPageIndex + 1);
      // Add matching suite pages (1-indexed)
      matchingSuites.forEach(s => next.add(s.pageIndex + 1));
      return next;
    });
  };

  return (
    <div className="app">
      <div className="panel left-panel">
        <div className="tools-header">
          {onBack && (
            <button onClick={onBack} className="btn-small btn-back">
              &larr; Templates
            </button>
          )}
          <h1>Proposal Builder</h1>
          <div className="tools-actions">
            <button
              onClick={handleExport}
              className="btn-primary"
              disabled={isExporting || selectedPages.size === 0}
            >
              {isExporting ? 'Exporting...' : `Export PDF (${selectedPages.size} pages)`}
            </button>
          </div>
        </div>

        <div className="selection-controls">
          <button onClick={selectAll} className="btn-small">Select All</button>
          <button onClick={selectNone} className="btn-small">Select None</button>
          <span className="selection-count">
            {selectedPages.size} of {pageCount} pages selected
          </span>
        </div>

        {overviewGroups.length > 0 && (
          <div className="auto-select-section">
            <div className="auto-select-title">Auto-Select by Floor</div>
            {overviewGroups.map(group => {
              const state = getAutoState(group.overviewPageIndex);
              const availableCount = group.suites.filter(s =>
                !s.suiteConfig?.rented
              ).length;
              const totalCount = group.suites.length;
              return (
                <div key={group.overviewPageIndex} className="auto-select-group">
                  <div className="auto-select-group-header">
                    <span className="auto-select-group-name">{group.overviewLabel}</span>
                    <span className="auto-select-group-stats">
                      {availableCount}/{totalCount} available
                    </span>
                  </div>
                  <div className="auto-select-controls">
                    <label className="auto-select-desks">
                      <span>Min:</span>
                      <input
                        type="number"
                        min="0"
                        value={state.minDesks}
                        onChange={(e) => updateAutoState(group.overviewPageIndex, { minDesks: e.target.value })}
                        placeholder="0"
                        className="auto-select-desks-input"
                      />
                    </label>
                    <label className="auto-select-desks">
                      <span>Max:</span>
                      <input
                        type="number"
                        min="0"
                        value={state.maxDesks}
                        onChange={(e) => updateAutoState(group.overviewPageIndex, { maxDesks: e.target.value })}
                        placeholder="-"
                        className="auto-select-desks-input"
                      />
                    </label>
                    <label className="auto-select-rented">
                      <input
                        type="checkbox"
                        checked={state.excludeRented}
                        onChange={(e) => updateAutoState(group.overviewPageIndex, { excludeRented: e.target.checked })}
                      />
                      <span>Exclude rented</span>
                    </label>
                    <button
                      className="btn-small btn-auto-select"
                      onClick={() => handleAutoSelect(group)}
                    >
                      Select
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PageSelector
          templateUrl={templateUrl}
          selectedPages={selectedPages}
          onTogglePage={togglePage}
          onPageCountChange={setPageCount}
          pageData={pageData}
          customPrices={customPrices}
          onSetCustomPrice={setCustomPrice}
          config={config}
        />
      </div>

      <div className="panel right-panel">
        <PdfPreview
          templateUrl={templateUrl}
          selectedPages={selectedPages}
          config={config}
        />
      </div>
    </div>
  );
}
