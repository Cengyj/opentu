import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ProjectDrawer panel loading boundary', () => {
  const projectDrawerSource = readFileSync(
    resolve(__dirname, './ProjectDrawer.tsx'),
    'utf8'
  );
  const deferredPanelsSource = readFileSync(
    resolve(__dirname, './DeferredProjectDrawerPanels.tsx'),
    'utf8'
  );

  it('keeps PPT generation and layer code out of the default boards tab chunk', () => {
    expect(projectDrawerSource).not.toContain("from './FramePanel'");
    expect(projectDrawerSource).not.toContain("from './LayerPanel'");
    expect(projectDrawerSource).toContain(
      "from './DeferredProjectDrawerPanels'"
    );
    expect(deferredPanelsSource).toContain("import('./FramePanel')");
    expect(deferredPanelsSource).toContain("import('./LayerPanel')");
  });

  it('mounts each deferred panel only for its existing active tab', () => {
    expect(projectDrawerSource).toContain("activeTab === 'layers' ? (");
    expect(projectDrawerSource).toContain('<DeferredLayerPanel />');
    expect(projectDrawerSource).toContain("activeTab === 'frames' ? (");
    expect(projectDrawerSource).toContain('<DeferredFramePanel');
    expect(deferredPanelsSource).toContain('createRetriableModuleLoader');
    expect(deferredPanelsSource.match(/variant="inline"/g)).toHaveLength(2);
  });
});
