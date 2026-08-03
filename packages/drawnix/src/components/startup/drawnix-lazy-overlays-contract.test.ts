import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Drawnix lazy overlay source boundary', () => {
  const source = readFileSync(resolve(__dirname, '../../drawnix.tsx'), 'utf8');

  it('gates optional overlays while keeping the AI input shell on first paint', () => {
    expect(source.match(/<MountAfterFirstActivation\b/g)).toHaveLength(6);
    expect(source).toContain('active={popupToolbarRequested}');
    expect(source).toContain('active={Boolean(appState.linkState)}');
    expect(source).toContain(
      'active={isPencilSettingsToolbarActive(appState.pointer)}'
    );
    expect(source).toContain('active={appState.openCleanConfirm}');

    const aiInputPosition = source.indexOf('<DeferredAIInputBar');
    const precedingMount = source.lastIndexOf(
      '<MountAfterFirstActivation',
      aiInputPosition
    );
    const precedingMountClose = source.lastIndexOf(
      '</MountAfterFirstActivation>',
      aiInputPosition
    );
    expect(aiInputPosition).toBeGreaterThan(0);
    expect(precedingMountClose).toBeGreaterThan(precedingMount);
  });

  it('loads PPT frame synchronization only inside the image overwrite action', () => {
    expect(source).not.toMatch(
      /^import\s+.+from\s+['"]\.\/utils\/frame-insertion-utils['"];?$/m
    );
    expect(source).toContain("import('./utils/frame-insertion-utils')");

    const handlerStart = source.indexOf('const handleMediaEditorOverwrite');
    const handlerEnd = source.indexOf(
      '// \u5904\u7406\u56fe\u7247\u7f16\u8f91\u63d2\u5165\u5230\u753b\u5e03',
      handlerStart
    );
    const dynamicImportPosition = source.indexOf(
      "import('./utils/frame-insertion-utils')"
    );
    expect(dynamicImportPosition).toBeGreaterThan(handlerStart);
    expect(dynamicImportPosition).toBeLessThan(handlerEnd);
  });

  it('keeps PPT placeholder generation behind its click runtime', () => {
    const imageSource = readFileSync(
      resolve(__dirname, '../../plugins/components/image.tsx'),
      'utf8'
    );
    const controllerSource = readFileSync(
      resolve(
        __dirname,
        '../../plugins/components/ppt-image-placeholder-controller.ts'
      ),
      'utf8'
    );

    expect(imageSource).not.toContain("from '../../mcp/tools/image-generation'");
    expect(imageSource).not.toContain("from '../../services/ppt'");
    expect(imageSource).not.toContain("from '../../utils/frame-insertion-utils'");
    expect(controllerSource).toContain(
      "import('./ppt-image-placeholder-runtime')"
    );
  });

  it('mounts the minimized tools runtime only for explicit tool intent', () => {
    expect(source).not.toContain('SW_IDLE_PREFETCH_STATUS');
    expect(source).not.toContain('SW_IDLE_PREFETCH_STATUS_GET');
    expect(source).not.toContain('handleIdlePrefetchStatus');
    expect(source).not.toContain('minimized tools bar fallback');
    expect(source).not.toContain('}, 2200)');
    expect(source.match(/setMinimizedToolsBarEnabled\(true\)/g)).toHaveLength(1);

    const enableToolWindowsStart = source.indexOf(
      'const enableToolWindows = useCallback'
    );
    const enableGenerationRuntimeStart = source.indexOf(
      'const enableGenerationRuntime = useCallback',
      enableToolWindowsStart
    );
    const enableToolWindowsSource = source.slice(
      enableToolWindowsStart,
      enableGenerationRuntimeStart
    );
    expect(enableToolWindowsStart).toBeGreaterThan(0);
    expect(enableGenerationRuntimeStart).toBeGreaterThan(
      enableToolWindowsStart
    );
    expect(enableToolWindowsSource).toContain(
      'setMinimizedToolsBarEnabled(true)'
    );
    expect(enableToolWindowsSource).toContain(
      'setToolWindowManagerEnabled(true)'
    );

    expect(source).toContain("window.location.search\n    ).has('tool')");
    expect(source).toContain('enableToolWindows(TOOL_WINDOW_GROUPS)');
  });

  it('keeps automatic operational checks behind lightweight policy gates', () => {
    const deferredFeaturesSource = readFileSync(
      resolve(__dirname, './DrawnixDeferredFeatures.tsx'),
      'utf8'
    );
    const operationalMonitorsSource = readFileSync(
      resolve(__dirname, './DrawnixOperationalMonitors.tsx'),
      'utf8'
    );

    expect(source).toContain('setOperationalMonitorsEnabled(true)');
    expect(source).not.toContain('setVersionUpdateEnabled(true)');
    expect(source).not.toContain('setPerformancePanelEnabled(true)');
    expect(deferredFeaturesSource).not.toContain('VersionUpdatePrompt');
    expect(deferredFeaturesSource).not.toContain('PerformancePanel');
    expect(operationalMonitorsSource).toContain(
      'hasPendingVersionUpgrade(versionSnapshot)'
    );
    expect(operationalMonitorsSource).toContain(
      'shouldShowPerformancePanel({'
    );
    expect(operationalMonitorsSource).toContain(
      "import('../version-update/version-update-prompt')"
    );
    expect(operationalMonitorsSource).toContain(
      "import('../performance-panel/PerformancePanel')"
    );
    expect(operationalMonitorsSource).not.toContain('tool-window-service');
    expect(operationalMonitorsSource).not.toContain('toolbox-service');
  });
});
