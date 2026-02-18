import { useState, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { PageTagger } from './PageTagger';
import { ConfigEditor } from './ConfigEditor';
import { getChatUrl } from '../utils/chatHelp';
import { savePdf, loadPdf } from '../storage/pdfStorage';

export function TemplateSetup({ config: initialConfig, pdfBlobUrl, onSave, onCancel }) {
  const [config, setConfig] = useState(initialConfig);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [localPdfBlobUrl, setLocalPdfBlobUrl] = useState(pdfBlobUrl);
  const [replacing, setReplacing] = useState(false);

  // Sync localPdfBlobUrl when the prop arrives (it may be null on first mount)
  useEffect(() => {
    if (pdfBlobUrl) {
      setLocalPdfBlobUrl(pdfBlobUrl);
    }
  }, [pdfBlobUrl]);

  const handleUpdatePage = (pageIndex, updates) => {
    setConfig(prev => {
      const pages = [...prev.pages];
      pages[pageIndex] = { ...pages[pageIndex], ...updates };
      return { ...prev, pages };
    });
  };

  const handleUpdateName = (name) => {
    setConfig(prev => ({ ...prev, name }));
  };

  const handleSave = () => {
    onSave(config);
  };

  const handleReplacePage = async (pageIndex, file) => {
    setReplacing(true);
    try {
      // Load current master PDF bytes
      let masterBytes;
      if (config.pdfStorageKey === 'default-template') {
        const resp = await fetch(localPdfBlobUrl);
        masterBytes = await resp.arrayBuffer();
      } else {
        masterBytes = await loadPdf(config.pdfStorageKey);
      }

      const masterPdf = await PDFDocument.load(masterBytes);
      const fileType = file.type;

      if (fileType === 'application/pdf') {
        // PDF upload: copy first page from uploaded file
        const uploadedBytes = await file.arrayBuffer();
        const uploadedPdf = await PDFDocument.load(uploadedBytes);
        const [copiedPage] = await masterPdf.copyPages(uploadedPdf, [0]);
        masterPdf.removePage(pageIndex);
        masterPdf.insertPage(pageIndex, copiedPage);
      } else {
        // Image upload (JPG/PNG): embed and draw scaled to fit
        const imageBytes = await file.arrayBuffer();
        let image;
        if (fileType === 'image/png') {
          image = await masterPdf.embedPng(imageBytes);
        } else {
          image = await masterPdf.embedJpg(imageBytes);
        }

        const { width: pageW, height: pageH } = config.pageDimensions;
        masterPdf.removePage(pageIndex);
        const newPage = masterPdf.insertPage(pageIndex, [pageW, pageH]);

        // Scale image to fit within page dimensions, preserving aspect ratio
        const imgAspect = image.width / image.height;
        const pageAspect = pageW / pageH;
        let drawW, drawH;
        if (imgAspect > pageAspect) {
          drawW = pageW;
          drawH = pageW / imgAspect;
        } else {
          drawH = pageH;
          drawW = pageH * imgAspect;
        }
        const x = (pageW - drawW) / 2;
        const y = (pageH - drawH) / 2;
        newPage.drawImage(image, { x, y, width: drawW, height: drawH });
      }

      const newBytes = await masterPdf.save();

      // If default template, generate a new storage key so it goes to IndexedDB
      let storageKey = config.pdfStorageKey;
      if (storageKey === 'default-template') {
        storageKey = crypto.randomUUID();
        setConfig(prev => ({ ...prev, pdfStorageKey: storageKey }));
      }

      await savePdf(storageKey, newBytes);

      // Update blob URL
      if (localPdfBlobUrl && localPdfBlobUrl !== pdfBlobUrl) {
        URL.revokeObjectURL(localPdfBlobUrl);
      }
      const blob = new Blob([newBytes], { type: 'application/pdf' });
      setLocalPdfBlobUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Failed to replace page:', err);
      alert('Failed to replace page. Please try again.');
    } finally {
      setReplacing(false);
    }
  };

  const selectedPage = config.pages[selectedPageIndex];

  return (
    <div className="template-setup">
      <div className="setup-header">
        <button onClick={onCancel} className="btn-small btn-back">
          &larr; Back
        </button>
        <div className="setup-title">
          <label className="setup-name-label">Template Name:</label>
          <input
            type="text"
            className="setup-name-input"
            value={config.name}
            onChange={(e) => handleUpdateName(e.target.value)}
          />
        </div>
        <a
          href={getChatUrl('setupTemplate')}
          target="_blank"
          rel="noopener noreferrer"
          className="ai-help-link"
        >
          Ask AI for help
        </a>
        <button onClick={handleSave} className="btn-primary">
          Save Template
        </button>
      </div>

      <div className="setup-body">
        <div className="setup-left">
          <PageTagger
            config={config}
            pdfBlobUrl={localPdfBlobUrl}
            selectedPageIndex={selectedPageIndex}
            onSelectPage={setSelectedPageIndex}
            onUpdatePage={handleUpdatePage}
          />
        </div>

        <div className="setup-right">
          {selectedPage && (
            <ConfigEditor
              config={config}
              pageIndex={selectedPageIndex}
              pageConfig={selectedPage}
              pdfBlobUrl={localPdfBlobUrl}
              onUpdatePage={handleUpdatePage}
              onReplacePage={handleReplacePage}
              replacing={replacing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
