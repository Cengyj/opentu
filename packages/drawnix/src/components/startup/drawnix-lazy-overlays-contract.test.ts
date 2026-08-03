import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Drawnix lazy overlay source boundary', () => {
  const source = readFileSync(resolve(__dirname, '../../drawnix.tsx'), 'utf8');

  it('gates optional overlays while keeping the AI input shell statically available on first paint', () => {
    expect(source.match(/<MountAfterFirstActivation\b/g)).toHaveLength(6);
    expect(source).toContain('active={popupToolbarRequested}');
    expect(source).toContain('active={Boolean(appState.linkState)}');
    expect(source).toContain(
      'active={isPencilSettingsToolbarActive(appState.pointer)}'
    );
    expect(source).toContain('active={appState.openCleanConfirm}');

    expect(source).toContain(
      "import { DeferredAIInputBar } from './components/startup/DeferredAIInputBar'"
    );
    expect(source).not.toContain(
      "import('./components/startup/DeferredAIInputBar')"
    );
    expect(source).toContain('<DeferredAIInputBar');
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

    expect(imageSource).not.toContain(
      "from '../../mcp/tools/image-generation'"
    );
    expect(imageSource).not.toContain("from '../../services/ppt'");
    expect(imageSource).not.toContain(
      "from '../../utils/frame-insertion-utils'"
    );
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
    expect(source.match(/setMinimizedToolsBarEnabled\(true\)/g)).toHaveLength(
      1
    );

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
    expect(source).toContain('enableToolWindows()');
    expect(source).not.toContain('TOOL_WINDOW_GROUPS');
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
    expect(operationalMonitorsSource).toContain('shouldShowPerformancePanel({');
    expect(operationalMonitorsSource).toContain(
      "import('../version-update/version-update-prompt')"
    );
    expect(operationalMonitorsSource).toContain(
      "import('../performance-panel/PerformancePanel')"
    );
    expect(operationalMonitorsSource).not.toContain('tool-window-service');
    expect(operationalMonitorsSource).not.toContain('toolbox-service');
  });

  it('keeps local media-library opening free of remote sync side effects', () => {
    const deferredFeaturesSource = readFileSync(
      resolve(__dirname, './DrawnixDeferredFeatures.tsx'),
      'utf8'
    );
    const deferredMediaLibrarySource = readFileSync(
      resolve(__dirname, './DeferredMediaLibraryModal.tsx'),
      'utf8'
    );
    const deferredMediaLibrarySyncSource = readFileSync(
      resolve(__dirname, './DeferredMediaLibraryGitHubSync.tsx'),
      'utf8'
    );
    const mediaLibrarySyncRuntimeSource = readFileSync(
      resolve(__dirname, './MediaLibraryGitHubSyncRuntime.tsx'),
      'utf8'
    );
    const mediaLibraryGridSource = readFileSync(
      resolve(__dirname, '../media-library/MediaLibraryGrid.tsx'),
      'utf8'
    );

    expect(deferredFeaturesSource).not.toContain('fallback={null}');
    expect(deferredFeaturesSource).toContain('RetriableDeferredFeature');
    expect(source).toContain(
      "import { DrawnixDeferredFeatures } from './components/startup/DrawnixDeferredFeatures'"
    );
    expect(source).not.toContain(
      "import('./components/startup/DrawnixDeferredFeatures')"
    );
    expect(deferredMediaLibrarySource).not.toContain('GitHubSyncProvider');
    expect(deferredMediaLibrarySource).toContain(
      'DeferredMediaLibraryGitHubSync'
    );
    expect(deferredMediaLibrarySyncSource).toContain(
      "import('./MediaLibraryGitHubSyncRuntime')"
    );
    expect(deferredMediaLibrarySyncSource).toContain(
      'usePostPaintOperability'
    );
    expect(deferredMediaLibrarySyncSource).not.toContain(
      'GitHubSyncProvider'
    );
    expect(mediaLibrarySyncRuntimeSource).toContain('GitHubSyncProvider');
    expect(mediaLibrarySyncRuntimeSource).toContain(
      'addSyncCompletedListener'
    );
    expect(mediaLibrarySyncRuntimeSource).toContain(
      'removeSyncCompletedListener'
    );
    expect(mediaLibraryGridSource).not.toContain('GitHubSyncContext');
    expect(mediaLibraryGridSource).not.toContain(
      "from '../../services/github-sync/media-sync-service'"
    );
    expect(mediaLibraryGridSource).toContain('DeferredMediaLibrarySyncAction');

    const openHandlerStart = source.indexOf(
      'const handleOpenMediaLibrary = useCallback'
    );
    const backupHandlerStart = source.indexOf(
      'const handleOpenBackupRestore = useCallback',
      openHandlerStart
    );
    const openHandlerSource = source.slice(
      openHandlerStart,
      backupHandlerStart
    );
    expect(openHandlerStart).toBeGreaterThan(0);
    expect(backupHandlerStart).toBeGreaterThan(openHandlerStart);
    expect(openHandlerSource).not.toContain('enableToolWindows');
    expect(openHandlerSource).not.toContain('requestServiceWorkerIdlePrefetch');
  });

  it('activates heavy runtimes only at their real consumer boundaries', () => {
    const deferredFeaturesSource = readFileSync(
      resolve(__dirname, './DrawnixDeferredFeatures.tsx'),
      'utf8'
    );
    const projectDrawerSource = readFileSync(
      resolve(__dirname, '../project-drawer/ProjectDrawer.tsx'),
      'utf8'
    );
    const deferredProjectPanelsSource = readFileSync(
      resolve(
        __dirname,
        '../project-drawer/DeferredProjectDrawerPanels.tsx'
      ),
      'utf8'
    );
    const toolboxDrawerSource = readFileSync(
      resolve(__dirname, '../toolbox-drawer/ToolboxDrawer.tsx'),
      'utf8'
    );
    const unifiedToolbarSource = readFileSync(
      resolve(__dirname, '../toolbar/unified-toolbar.tsx'),
      'utf8'
    );

    const getHandlerSource = (startMarker: string, endMarker: string) => {
      const start = source.indexOf(startMarker);
      const end = source.indexOf(endMarker, start);
      expect(start).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(start);
      return source.slice(start, end);
    };

    expect(source).not.toContain("from './utils/startup-prefetch'");
    expect(
      getHandlerSource(
        'const handleProjectDrawerToggle = useCallback',
        'const handleOpenPPTEditor = () =>'
      )
    ).not.toContain('enableToolWindows');
    expect(
      getHandlerSource(
        'const handleToolboxDrawerToggle = useCallback',
        'const handleTaskPanelToggle = useCallback'
      )
    ).not.toContain('enableToolWindows');
    expect(
      getHandlerSource(
        'const handleTaskPanelToggle = useCallback',
        'const handleOpenMediaLibrary = useCallback'
      )
    ).not.toContain('enableDeferredRuntime');

    expect(deferredFeaturesSource).toContain(
      'onEnableGenerationRuntime={enableGenerationRuntime}'
    );
    expect(deferredFeaturesSource).toContain(
      'onEnableToolWindows={enableToolWindows}'
    );
    expect(projectDrawerSource).toContain(
      'onRuntimeRequired={onEnableGenerationRuntime}'
    );
    expect(deferredProjectPanelsSource).toContain(
      'onRuntimeRequired?.()'
    );

    const enableWindowPosition = toolboxDrawerSource.indexOf(
      'onEnableToolWindows?.()'
    );
    const openWindowPosition = toolboxDrawerSource.indexOf(
      'toolWindowService.openTool(tool)',
      enableWindowPosition
    );
    expect(enableWindowPosition).toBeGreaterThan(0);
    expect(openWindowPosition).toBeGreaterThan(enableWindowPosition);

    expect(unifiedToolbarSource).toContain('<DeferredTaskQueuePanel');
    expect(unifiedToolbarSource).toContain(
      'onRuntimeRequired={onEnableTaskRuntime}'
    );
    expect(unifiedToolbarSource).not.toContain('<Suspense fallback={null}>');
  });
});
