import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDefaultToolbarConfig } from '../types/toolbar-config.types';
import { toolbarConfigService } from '../services/toolbar-config-service';
import { ToolbarConfigProvider, useToolbarConfig } from './use-toolbar-config';

const ToolbarConfigProbe = () => {
  const { isButtonVisible, loading } = useToolbarConfig();

  return (
    <output data-testid="toolbar-config-probe">
      {loading ? 'loading' : 'ready'}:
      {isButtonVisible('selection') ? 'visible' : 'hidden'}
    </output>
  );
};

describe('ToolbarConfigProvider', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('publishes the persisted toolbar configuration after async initialization', async () => {
    const persistedConfig = getDefaultToolbarConfig();
    persistedConfig.buttons = persistedConfig.buttons.map((button) =>
      button.id === 'selection' ? { ...button, visible: false } : button
    );

    vi.spyOn(toolbarConfigService, 'initializeAsync').mockResolvedValue(
      persistedConfig
    );

    render(
      <ToolbarConfigProvider>
        <ToolbarConfigProbe />
      </ToolbarConfigProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('toolbar-config-probe').textContent).toBe(
        'ready:hidden'
      );
    });
  });
});
