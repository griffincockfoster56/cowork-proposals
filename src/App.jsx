import { useState, useEffect } from 'react';
import { ProposalBuilder } from './components/ProposalBuilder';
import { TemplateManager } from './components/TemplateManager';
import { TemplateSetup } from './components/TemplateSetup';
import { loadConfig, saveConfig, listConfigs } from './storage/configStorage';
import { loadPdf } from './storage/pdfStorage';
import { migrateHardcodedConfig } from './config/templateConfig';
import './App.css';

// Seed the default template on first launch
async function ensureDefaultTemplate() {
  const configs = await listConfigs();
  if (configs.length === 0) {
    const defaultConfig = migrateHardcodedConfig();
    await saveConfig(defaultConfig);
  }
}

function App() {
  // appMode: 'manager' | 'setup' | 'builder'
  const [appMode, setAppMode] = useState('manager');
  const [activeConfigId, setActiveConfigId] = useState(null);
  const [activeConfig, setActiveConfig] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureDefaultTemplate().then(() => setReady(true));
  }, []);

  // Load config + PDF blob when activeConfigId changes
  useEffect(() => {
    if (!activeConfigId) {
      setActiveConfig(null);
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
      return;
    }

    let cancelled = false;

    async function load() {
      const config = await loadConfig(activeConfigId);
      if (cancelled) return;
      setActiveConfig(config);

      if (config) {
        if (config.id === 'default-template') {
          setPdfBlobUrl('/template.pdf');
        } else {
          const arrayBuffer = await loadPdf(config.pdfStorageKey);
          if (cancelled) return;
          if (arrayBuffer) {
            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            setPdfBlobUrl(URL.createObjectURL(blob));
          }
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [activeConfigId]);

  const handleBuild = (configId) => {
    setActiveConfigId(configId);
    setAppMode('builder');
  };

  const handleEdit = (configId) => {
    setActiveConfigId(configId);
    setAppMode('setup');
  };

  const handleSetupComplete = async (updatedConfig) => {
    await saveConfig(updatedConfig);
    setActiveConfig(updatedConfig);
    setAppMode('manager');
    setActiveConfigId(null);
  };

  const handleBackToManager = () => {
    setAppMode('manager');
    setActiveConfigId(null);
  };

  if (!ready) {
    return <div className="app-loading">Loading...</div>;
  }

  if (appMode === 'setup' && activeConfig) {
    return (
      <TemplateSetup
        config={activeConfig}
        pdfBlobUrl={pdfBlobUrl}
        onSave={handleSetupComplete}
        onCancel={handleBackToManager}
      />
    );
  }

  if (appMode === 'builder' && activeConfig && pdfBlobUrl) {
    return (
      <ProposalBuilder
        config={activeConfig}
        pdfBlobUrl={pdfBlobUrl}
        onBack={handleBackToManager}
      />
    );
  }

  return (
    <TemplateManager
      onBuild={handleBuild}
      onEdit={handleEdit}
    />
  );
}

export default App;
