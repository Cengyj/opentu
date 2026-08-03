// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  MoreToolsButton,
  type MoreToolsPanelRuntimeLoader,
} from './more-tools-button';

vi.mock('../tool-button', () => ({
  ToolButton: ({
    'aria-label': ariaLabel,
    'data-testid': testId,
    onClick,
    selected,
  }: {
    'aria-label': string;
    'data-testid'?: string;
    onClick?: () => void;
    selected?: boolean;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      data-selected={selected ? 'true' : 'false'}
      onClick={onClick}
    />
  ),
}));

vi.mock('../icons/startup-icons', () => ({
  MoreIcon: () => <span />,
}));

vi.mock('../popover/popover', () => ({
  Popover: ({
    children,
    open,
    placement,
  }: {
    children: React.ReactNode;
    open: boolean;
    placement: string;
  }) => (
    <div
      data-testid="more-tools-popover"
      data-open={open ? 'true' : 'false'}
      data-placement={placement}
    >
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const originalTouchStartDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'ontouchstart'
);
const originalMaxTouchPointsDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  'maxTouchPoints'
);

function setTouchCapability(enabled: boolean) {
  if (enabled) {
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: null,
    });
  } else {
    Reflect.deleteProperty(window, 'ontouchstart');
  }
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: enabled ? 1 : 0,
  });
}

function restoreTouchCapability() {
  if (originalTouchStartDescriptor) {
    Object.defineProperty(
      window,
      'ontouchstart',
      originalTouchStartDescriptor
    );
  } else {
    Reflect.deleteProperty(window, 'ontouchstart');
  }
  if (originalMaxTouchPointsDescriptor) {
    Object.defineProperty(
      navigator,
      'maxTouchPoints',
      originalMaxTouchPointsDescriptor
    );
  } else {
    Reflect.deleteProperty(navigator, 'maxTouchPoints');
  }
}

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolvePromiseValue) => {
    resolvePromise = resolvePromiseValue;
  });

  return { promise, resolve: resolvePromise };
}

const LoadedPanelRuntime: React.FC<{
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({ onMouseEnter, onMouseLeave }) => (
  <div
    data-testid="loaded-more-tools-panel"
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  />
);

describe('MoreToolsButton deferred panel boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setTouchCapability(false);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  afterAll(() => {
    restoreTouchCapability();
  });

  it('keeps the panel unloaded until desktop hover reaches 200ms and single-flights opening', async () => {
    const deferred = createDeferred<
      Awaited<ReturnType<MoreToolsPanelRuntimeLoader>>
    >();
    const loader = vi.fn(() => deferred.promise);

    render(<MoreToolsButton panelRuntimeLoader={loader} />);
    const trigger = screen.getByTestId('toolbar-more');

    expect(loader).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('more-tools-popover').getAttribute('data-open')
    ).toBe('false');

    fireEvent.click(trigger);
    expect(loader).not.toHaveBeenCalled();

    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(loader).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('more-tools-popover').getAttribute('data-open')
    ).toBe('true');

    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ MoreToolsPanelRuntime: LoadedPanelRuntime });
      await deferred.promise;
    });

    expect(screen.getByTestId('loaded-more-tools-panel')).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('loads immediately on the first touch click and reuses the same attempt', async () => {
    setTouchCapability(true);
    const deferred = createDeferred<
      Awaited<ReturnType<MoreToolsPanelRuntimeLoader>>
    >();
    const loader = vi.fn(() => deferred.promise);

    render(<MoreToolsButton embedded panelRuntimeLoader={loader} />);
    const trigger = screen.getByTestId('toolbar-more');

    fireEvent.click(trigger);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('more-tools-popover').getAttribute('data-open')
    ).toBe('true');
    expect(
      screen.getByTestId('more-tools-popover').getAttribute('data-placement')
    ).toBe('right-start');

    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ MoreToolsPanelRuntime: LoadedPanelRuntime });
      await deferred.promise;
    });

    expect(screen.getByTestId('loaded-more-tools-panel')).toBeTruthy();
  });

  it('drops a failed hover import so the next real opening can retry', async () => {
    const loader = vi
      .fn<MoreToolsPanelRuntimeLoader>()
      .mockRejectedValueOnce(new Error('more tools chunk unavailable'))
      .mockResolvedValueOnce({ MoreToolsPanelRuntime: LoadedPanelRuntime });

    render(<MoreToolsButton panelRuntimeLoader={loader} />);
    const trigger = screen.getByTestId('toolbar-more');

    fireEvent.mouseEnter(trigger);
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });
    expect(loader).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.mouseEnter(trigger);
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('loaded-more-tools-panel')).toBeTruthy();
  });

  it('clears delayed opens and ignores an in-flight result after unmount', async () => {
    const delayedLoader = vi.fn<MoreToolsPanelRuntimeLoader>();
    const delayedView = render(
      <MoreToolsButton panelRuntimeLoader={delayedLoader} />
    );

    fireEvent.mouseEnter(screen.getByTestId('toolbar-more'));
    delayedView.unmount();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(delayedLoader).not.toHaveBeenCalled();

    const deferred = createDeferred<
      Awaited<ReturnType<MoreToolsPanelRuntimeLoader>>
    >();
    const runtimeRender = vi.fn(() => <div />);
    const pendingLoader = vi.fn(() => deferred.promise);
    const pendingView = render(
      <MoreToolsButton panelRuntimeLoader={pendingLoader} />
    );

    fireEvent.mouseEnter(screen.getByTestId('toolbar-more'));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(pendingLoader).toHaveBeenCalledTimes(1);
    pendingView.unmount();

    await act(async () => {
      deferred.resolve({ MoreToolsPanelRuntime: runtimeRender });
      await deferred.promise;
    });
    expect(runtimeRender).not.toHaveBeenCalled();
  });

  it('keeps every heavy dependency and established tool action inside the runtime', () => {
    const packageRoot = process.cwd().endsWith('packages/drawnix')
      ? process.cwd()
      : resolve(process.cwd(), 'packages/drawnix');
    const shellSource = readFileSync(
      resolve(
        packageRoot,
        'src/components/toolbar/more-tools-button.tsx'
      ),
      'utf8'
    );
    const runtimeSource = readFileSync(
      resolve(
        packageRoot,
        'src/components/toolbar/more-tools-panel-runtime.tsx'
      ),
      'utf8'
    );

    expect(shellSource).toContain(
      "import('./more-tools-panel-runtime')"
    );
    expect(shellSource).toContain('createRetriableModuleLoader');
    for (const heavyDependency of [
      'use-toolbar-config',
      '@plait-board/react-board',
      'image-file-actions',
      'freehand-panel',
      'shape-picker',
      'arrow-picker',
      'createPortal',
    ]) {
      expect(shellSource).not.toContain(heavyDependency);
      expect(runtimeSource).toContain(heavyDependency);
    }

    for (const actionContract of [
      'openImageFilePicker(board)',
      'DialogType.aiImageGeneration',
      'DialogType.aiVideoGeneration',
      'DialogType.mermaidToDrawnix',
      'DialogType.markdownToDrawnix',
      'board.undo()',
      'board.redo()',
      'BoardTransforms.updateThemeColor',
      'BoardTransforms.updateZoom',
      'BoardTransforms.fitViewport',
      'fitFrame(board)',
      'showButton(contextMenu.buttonId)',
      "case 'freehand'",
      "case 'shape'",
      "case 'arrow'",
      "case 'theme'",
    ]) {
      expect(runtimeSource).toContain(actionContract);
    }
  });
});
