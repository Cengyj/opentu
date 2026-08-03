import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DialogType,
  DrawnixContext,
  type DrawnixState,
} from '../../hooks/use-drawnix';
import {
  DeferredDialogController,
  type DeferredDialogControllerLoader,
} from './DeferredDialogController';
import {
  DeferredTTDDialogs,
  type DeferredTTDDialogLoaders,
} from './DeferredTTDDialogs';

function createControllerModule(label: string) {
  return {
    default: () => <div>{label}</div>,
  };
}

function createLoaders(): {
  loaders: DeferredTTDDialogLoaders;
  calls: Record<DialogType, ReturnType<typeof vi.fn>>;
} {
  const calls = {
    [DialogType.mermaidToDrawnix]: vi.fn(() =>
      Promise.resolve(createControllerModule('mermaid-controller'))
    ),
    [DialogType.markdownToDrawnix]: vi.fn(() =>
      Promise.resolve(createControllerModule('markdown-controller'))
    ),
    [DialogType.aiImageGeneration]: vi.fn(() =>
      Promise.resolve(createControllerModule('image-controller'))
    ),
    [DialogType.aiVideoGeneration]: vi.fn(() =>
      Promise.resolve(createControllerModule('video-controller'))
    ),
  };

  return {
    calls,
    loaders: calls,
  };
}

function DialogHarness({
  initialDialogType,
  loaders,
}: {
  initialDialogType: DialogType;
  loaders: DeferredTTDDialogLoaders;
}) {
  const [appState, setAppState] = useState<DrawnixState>({
    pointer: 'hand' as DrawnixState['pointer'],
    isMobile: false,
    isPencilMode: false,
    openDialogTypes: new Set([initialDialogType]),
    dialogInitialData: null,
    dialogInitialDataByType: {},
    openCleanConfirm: false,
    openSettings: false,
  });

  return (
    <DrawnixContext.Provider value={{ appState, setAppState, board: null }}>
      <output data-testid="open-dialog-count">
        {appState.openDialogTypes.size}
      </output>
      <DeferredTTDDialogs container={null} loaders={loaders} />
    </DrawnixContext.Provider>
  );
}

describe('DeferredTTDDialogs', () => {
  it('loads only the controller matching the active dialog type', async () => {
    const { loaders, calls } = createLoaders();
    render(
      <DialogHarness
        initialDialogType={DialogType.aiImageGeneration}
        loaders={loaders}
      />
    );

    expect(screen.getByText('AI 图片生成')).toBeTruthy();
    expect(screen.getByText('正在加载功能组件…')).toBeTruthy();
    expect(calls[DialogType.aiImageGeneration]).toHaveBeenCalledTimes(1);
    expect(calls[DialogType.aiVideoGeneration]).not.toHaveBeenCalled();
    expect(calls[DialogType.mermaidToDrawnix]).not.toHaveBeenCalled();
    expect(calls[DialogType.markdownToDrawnix]).not.toHaveBeenCalled();

    expect(await screen.findByText('image-controller')).toBeTruthy();
  });

  it('closes an active dialog from the lightweight loading fallback', () => {
    const { loaders } = createLoaders();
    loaders[DialogType.aiImageGeneration] = vi.fn(
      () => new Promise(() => undefined)
    );
    render(
      <DialogHarness
        initialDialogType={DialogType.aiImageGeneration}
        loaders={loaders}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));

    expect(screen.getByTestId('open-dialog-count').textContent).toBe('0');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('DeferredDialogController', () => {
  it('allows a rejected chunk request to be retried', async () => {
    const loader: DeferredDialogControllerLoader = vi
      .fn()
      .mockRejectedValueOnce(new Error('chunk unavailable'))
      .mockResolvedValueOnce(createControllerModule('loaded-controller'));

    render(
      <DeferredDialogController
        active
        container={null}
        dialogId="retry-dialog"
        label="Retry dialog"
        loadController={loader}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText('chunk unavailable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('loaded-controller')).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('reopens a successfully loaded controller without another request', async () => {
    const loader = vi.fn(() =>
      Promise.resolve(createControllerModule('cached-controller'))
    );
    const props = {
      container: null,
      dialogId: 'cached-dialog',
      label: 'Cached dialog',
      loadController: loader,
      onClose: vi.fn(),
    };
    const { rerender } = render(<DeferredDialogController active {...props} />);

    expect(await screen.findByText('cached-controller')).toBeTruthy();
    rerender(<DeferredDialogController active={false} {...props} />);
    expect(screen.queryByText('cached-controller')).toBeNull();
    rerender(<DeferredDialogController active {...props} />);

    expect(screen.getByText('cached-controller')).toBeTruthy();
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
  });
});
