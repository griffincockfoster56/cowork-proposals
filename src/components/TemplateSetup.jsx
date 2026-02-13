import { useState } from 'react';
import { PageTagger } from './PageTagger';
import { ConfigEditor } from './ConfigEditor';
import { getChatUrl } from '../utils/chatHelp';

export function TemplateSetup({ config: initialConfig, pdfBlobUrl, onSave, onCancel }) {
  const [config, setConfig] = useState(initialConfig);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);

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
            pdfBlobUrl={pdfBlobUrl}
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
              pdfBlobUrl={pdfBlobUrl}
              onUpdatePage={handleUpdatePage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
