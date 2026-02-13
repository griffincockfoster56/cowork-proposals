import { useState, useEffect } from 'react';
import { listConfigs, saveConfig, deleteConfig } from '../storage/configStorage';
import { savePdf, deletePdf } from '../storage/pdfStorage';
import { createBlankConfig } from '../config/templateConfig';
import { TemplateCard } from './TemplateCard';
import { PDFDocument } from 'pdf-lib';
import { getChatUrl } from '../utils/chatHelp';

export function TemplateManager({ onBuild, onEdit }) {
  const [configs, setConfigs] = useState([]);

  const refreshConfigs = async () => {
    setConfigs(await listConfigs());
  };

  useEffect(() => {
    refreshConfigs();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();

      // Use pdf-lib to get page count and dimensions
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const numPages = pdfDoc.getPageCount();
      const firstPage = pdfDoc.getPage(0);
      const { width, height } = firstPage.getSize();

      const id = crypto.randomUUID();
      const name = file.name.replace(/\.pdf$/i, '');

      // Store the PDF blob
      await savePdf(id, arrayBuffer);

      // Create and save a blank config
      const config = createBlankConfig(id, name, numPages, { width, height });
      await saveConfig(config);

      await refreshConfigs();

      // Go straight to setup for the new template
      onEdit(id);
    } catch (err) {
      console.error('Failed to upload PDF:', err);
      alert('Failed to read PDF file. Please try another file.');
    }

    // Reset file input
    e.target.value = '';
  };

  const handleDelete = async (configId) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;

    const config = configs.find(c => c.id === configId);
    if (config) {
      await deleteConfig(configId);
      if (config.id !== 'default-template') {
        await deletePdf(config.pdfStorageKey);
      }
      await refreshConfigs();
    }
  };

  return (
    <div className="template-manager">
      <div className="manager-header">
        <h1>Proposal Templates</h1>
        <label className="btn-primary upload-btn">
          Create New Proposal Template
          <input
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="walkthrough-buttons">
        <a
          href={getChatUrl('buildProposal')}
          target="_blank"
          rel="noopener noreferrer"
          className="walkthrough-btn"
        >
          How do I create a proposal?
        </a>
        <a
          href={getChatUrl('createTemplate')}
          target="_blank"
          rel="noopener noreferrer"
          className="walkthrough-btn"
        >
          How do I create a new template?
        </a>
        <a
          href={getChatUrl('general')}
          target="_blank"
          rel="noopener noreferrer"
          className="ai-help-link"
        >
          Ask AI for help
        </a>
      </div>

      <div className="template-grid">
        {configs.length === 0 && (
          <div className="empty-templates">
            <p>No templates yet. Upload a PDF to get started.</p>
          </div>
        )}
        {configs.map(config => (
          <TemplateCard
            key={config.id}
            config={config}
            onBuild={() => onBuild(config.id)}
            onEdit={() => onEdit(config.id)}
            onDelete={() => handleDelete(config.id)}
          />
        ))}
      </div>
    </div>
  );
}
