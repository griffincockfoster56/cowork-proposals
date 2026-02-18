import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all dependencies
vi.mock('./storage/configStorage', () => ({
  listConfigs: vi.fn(() => Promise.resolve([{ id: 'existing' }])),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(() => Promise.resolve()),
}));

vi.mock('./storage/pdfStorage', () => ({
  loadPdf: vi.fn(() => Promise.resolve(new ArrayBuffer(10))),
}));

vi.mock('./config/templateConfig', () => ({
  migrateHardcodedConfig: vi.fn(),
}));

vi.mock('./components/TemplateManager', () => ({
  TemplateManager: ({ onBuild, onEdit }) => (
    <div data-testid="manager">
      <button data-testid="build" onClick={() => onBuild('test-id')}>Build</button>
      <button data-testid="edit" onClick={() => onEdit('test-id')}>Edit</button>
    </div>
  ),
}));

vi.mock('./components/TemplateSetup', () => ({
  TemplateSetup: () => <div data-testid="setup">Setup</div>,
}));

vi.mock('./components/ProposalBuilder', () => ({
  ProposalBuilder: () => <div data-testid="builder">Builder</div>,
}));

import { render, act, waitFor, fireEvent } from '@testing-library/react';
import App from './App';
import { loadConfig } from './storage/configStorage';
import { loadPdf } from './storage/pdfStorage';

beforeEach(() => {
  vi.clearAllMocks();
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = vi.fn();
});

describe('App default template detection', () => {
  it('uses static URL when pdfStorageKey is "default-template"', async () => {
    loadConfig.mockResolvedValue({
      id: 'default-template',
      pdfStorageKey: 'default-template',
      pages: [],
    });

    let container;
    await act(async () => {
      const result = render(<App />);
      container = result.container;
      await new Promise(r => setTimeout(r, 50));
    });

    // Click Edit to trigger config loading
    const editBtn = container.querySelector('[data-testid="edit"]');
    await act(async () => {
      fireEvent.click(editBtn);
      await new Promise(r => setTimeout(r, 50));
    });

    // Should NOT have called loadPdf — uses static URL instead
    expect(loadPdf).not.toHaveBeenCalled();
  });

  it('loads from IndexedDB when pdfStorageKey differs from "default-template"', async () => {
    loadConfig.mockResolvedValue({
      id: 'default-template',
      pdfStorageKey: 'custom-uuid-key',
      pages: [],
    });

    let container;
    await act(async () => {
      const result = render(<App />);
      container = result.container;
      await new Promise(r => setTimeout(r, 50));
    });

    const editBtn = container.querySelector('[data-testid="edit"]');
    await act(async () => {
      fireEvent.click(editBtn);
      await new Promise(r => setTimeout(r, 50));
    });

    // Should call loadPdf with the custom key since pdfStorageKey !== 'default-template'
    expect(loadPdf).toHaveBeenCalledWith('custom-uuid-key');
  });
});
