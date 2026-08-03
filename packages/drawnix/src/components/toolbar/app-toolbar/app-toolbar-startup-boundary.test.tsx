// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DeferredAppMenu,
  type AppMenuRuntimeLoader,
} from './deferred-app-menu';

vi.mock('../../tool-button', () => ({
  ToolButton: ({
    'aria-label': ariaLabel,
    onPointerDown,
    selected,
  }: {
    'aria-label': string;
    onPointerDown?: () => void;
    selected?: boolean;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      data-selected={selected ? 'true' : 'false'}
      onPointerDown={onPointerDown}
    />
  ),
}));

vi.mock('../../icons/startup-icons', () => ({
  MenuIcon: () => <span />,
}));

vi.mock('../../popover/popover', () => ({
  Popover: ({
    children,
    onOpenChange,
    open,
  }: {
    children: React.ReactNode;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  }) => (
    <div data-testid="app-menu-popover" data-open={open ? 'true' : 'false'}>
      {children}
      <button
        type="button"
        data-testid="dismiss-app-menu"
        onClick={() => onOpenChange(false)}
      />
    </div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

function createDeferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolvePromiseValue) => {
    resolvePromise = resolvePromiseValue;
  });
  return { promise, resolve: resolvePromise };
}

const LoadedAppMenuRuntime: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => (
  <button
    type="button"
    data-testid="loaded-app-menu-runtime"
    onClick={onClose}
  />
);

afterEach(cleanup);

describe('AppToolbar deferred menu boundary', () => {
  it('loads once on the first real opening and stays open while loading', async () => {
    const deferred = createDeferred<
      Awaited<ReturnType<AppMenuRuntimeLoader>>
    >();
    const loader = vi.fn(() => deferred.promise);

    render(
      <DeferredAppMenu
        embedded={false}
        container={null}
        appMenuRuntimeLoader={loader}
      />
    );
    const menuTrigger = screen.getByLabelText('general.menu');

    expect(loader).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('app-menu-popover').getAttribute('data-open')
    ).toBe('false');

    fireEvent.pointerDown(menuTrigger);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('app-menu-popover').getAttribute('data-open')
    ).toBe('true');

    fireEvent.click(screen.getByTestId('dismiss-app-menu'));
    fireEvent.pointerDown(menuTrigger);
    expect(loader).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ AppMenuRuntime: LoadedAppMenuRuntime });
      await deferred.promise;
    });

    fireEvent.click(screen.getByTestId('loaded-app-menu-runtime'));
    expect(
      screen.getByTestId('app-menu-popover').getAttribute('data-open')
    ).toBe('false');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('drops a failed import so closing and reopening can retry', async () => {
    const loader = vi
      .fn<AppMenuRuntimeLoader>()
      .mockRejectedValueOnce(new Error('app menu chunk unavailable'))
      .mockResolvedValueOnce({ AppMenuRuntime: LoadedAppMenuRuntime });

    render(
      <DeferredAppMenu
        embedded={false}
        container={null}
        appMenuRuntimeLoader={loader}
      />
    );

    await act(async () => {
      fireEvent.pointerDown(screen.getByLabelText('general.menu'));
      await Promise.resolve();
    });
    expect(loader).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('dismiss-app-menu'));
    await act(async () => {
      fireEvent.pointerDown(screen.getByLabelText('general.menu'));
      await Promise.resolve();
    });

    expect(loader).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('loaded-app-menu-runtime')).toBeTruthy();
  });

  it('does not render a late runtime result after unmount', async () => {
    const deferred = createDeferred<
      Awaited<ReturnType<AppMenuRuntimeLoader>>
    >();
    const runtimeRender = vi.fn(() => <div />);
    const loader = vi.fn(() => deferred.promise);
    const view = render(
      <DeferredAppMenu
        embedded={false}
        container={null}
        appMenuRuntimeLoader={loader}
      />
    );

    fireEvent.pointerDown(screen.getByLabelText('general.menu'));
    expect(loader).toHaveBeenCalledTimes(1);
    view.unmount();

    await act(async () => {
      deferred.resolve({ AppMenuRuntime: runtimeRender });
      await deferred.promise;
    });
    expect(runtimeRender).not.toHaveBeenCalled();
  });

  it('keeps menu implementations deferred and Undo/Redo in the shell', () => {
    const packageRoot = process.cwd().endsWith('packages/drawnix')
      ? process.cwd()
      : resolve(process.cwd(), 'packages/drawnix');
    const toolbarSource = readFileSync(
      resolve(packageRoot, 'src/components/toolbar/app-toolbar/app-toolbar.tsx'),
      'utf8'
    );
    const deferredSource = readFileSync(
      resolve(
        packageRoot,
        'src/components/toolbar/app-toolbar/deferred-app-menu.tsx'
      ),
      'utf8'
    );
    const runtimeSource = readFileSync(
      resolve(
        packageRoot,
        'src/components/toolbar/app-toolbar/app-menu-runtime.tsx'
      ),
      'utf8'
    );

    expect(deferredSource).toContain("import('./app-menu-runtime')");
    expect(deferredSource).toContain('createRetriableModuleLoader');
    expect(toolbarSource).not.toContain("from './app-menu-items'");
    expect(toolbarSource).not.toContain("from './language-switcher-menu'");
    expect(deferredSource).not.toContain("from './app-menu-items'");
    expect(deferredSource).not.toContain("from './language-switcher-menu'");
    expect(runtimeSource).toContain("from './app-menu-items'");
    expect(runtimeSource).toContain("from './language-switcher-menu'");
    expect(runtimeSource).toContain('<UserManual />');
    expect(toolbarSource).toContain('board.undo()');
    expect(toolbarSource).toContain('board.redo()');
    expect(toolbarSource).toContain('disabled={isUndoDisabled}');
    expect(toolbarSource).toContain('disabled={isRedoDisabled}');
  });
});
