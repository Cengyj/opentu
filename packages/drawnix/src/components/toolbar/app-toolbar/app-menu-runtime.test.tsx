// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppMenuRuntime } from './app-menu-runtime';

vi.mock('../../popover/popover', () => ({
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-menu-content">{children}</div>
  ),
}));

vi.mock('../../menu/menu', () => ({
  default: ({
    children,
    onClose,
    onSelect,
  }: {
    children: React.ReactNode;
    onClose: () => void;
    onSelect: () => void;
  }) => (
    <div>
      <button type="button" data-testid="menu-select" onClick={onSelect} />
      <button type="button" data-testid="menu-close" onClick={onClose} />
      {children}
    </div>
  ),
}));

vi.mock('../../menu/menu-separator', () => ({
  default: () => <hr />,
}));

vi.mock('./language-switcher-menu', () => ({
  LanguageSwitcherMenu: () => <div data-testid="language-switcher" />,
}));

vi.mock('./app-menu-items', () => {
  const item = (testId: string) => () => <div data-testid={testId} />;

  return {
    BackupRestore: ({
      onOpenBackupRestore,
    }: {
      onOpenBackupRestore: () => void;
    }) => (
      <button
        type="button"
        data-testid="backup-restore"
        onClick={onOpenBackupRestore}
      />
    ),
    CleanBoard: item('clean-board'),
    CleanInvalidLinks: item('clean-invalid-links'),
    CloudSync: ({ onOpenCloudSync }: { onOpenCloudSync: () => void }) => (
      <button
        type="button"
        data-testid="cloud-sync"
        onClick={onOpenCloudSync}
      />
    ),
    DebugPanel: item('debug-panel'),
    OpenFile: item('open-file'),
    QuickCommands: item('quick-commands'),
    SaveAsImage: item('save-as-image'),
    SaveToFile: item('save-to-file'),
    Settings: item('settings'),
    UserManual: item('user-manual'),
    VersionInfo: item('version-info'),
  };
});

afterEach(cleanup);

describe('AppMenuRuntime', () => {
  it('renders the complete established menu including User Manual', () => {
    render(<AppMenuRuntime container={null} onClose={vi.fn()} />);

    for (const testId of [
      'open-file',
      'save-to-file',
      'save-as-image',
      'clean-board',
      'clean-invalid-links',
      'language-switcher',
      'backup-restore',
      'debug-panel',
      'cloud-sync',
      'settings',
      'quick-commands',
      'user-manual',
      'version-info',
    ]) {
      expect(screen.getByTestId(testId), testId).toBeTruthy();
    }
  });

  it('preserves menu select and close behavior', () => {
    const onClose = vi.fn();
    render(<AppMenuRuntime container={null} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('menu-select'));
    fireEvent.click(screen.getByTestId('menu-close'));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('closes before invoking Backup and Cloud callbacks', () => {
    const calls: string[] = [];
    render(
      <AppMenuRuntime
        container={null}
        onClose={() => calls.push('close')}
        onOpenBackupRestore={() => calls.push('backup')}
        onOpenCloudSync={() => calls.push('cloud')}
      />
    );

    fireEvent.click(screen.getByTestId('backup-restore'));
    expect(calls).toEqual(['close', 'backup']);

    calls.length = 0;
    fireEvent.click(screen.getByTestId('cloud-sync'));
    expect(calls).toEqual(['close', 'cloud']);
  });
});
