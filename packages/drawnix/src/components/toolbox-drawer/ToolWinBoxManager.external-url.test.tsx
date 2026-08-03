// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolDefinition, ToolWindowState } from '../../types/toolbox.types';
import { ToolWinBoxManager } from './ToolWinBoxManager';

const mocks = vi.hoisted(() => ({
  states: [] as ToolWindowState[],
  processedUrl: null as string | null,
  unsubscribe: vi.fn(),
}));

const BASE_URL_TEMPLATE = ['$', '{baseUrl}'].join('');
const JAVASCRIPT_URL = ['java', 'script:alert(document.domain)'].join('');

vi.mock('../winbox', () => ({
  WinBoxWindow: ({
    visible,
    children,
  }: {
    visible: boolean;
    children: React.ReactNode;
  }) => (visible ? <section data-testid="tool-window">{children}</section> : null),
}));

vi.mock('../../services/tool-window-service', () => ({
  toolWindowService: {
    observeToolStates: () => ({
      subscribe: (subscriber: (states: ToolWindowState[]) => void) => {
        subscriber(mocks.states);
        return { unsubscribe: mocks.unsubscribe };
      },
    }),
    closeTool: vi.fn(),
    minimizeTool: vi.fn(),
    getToolInstance: vi.fn(),
    updateToolPosition: vi.fn(),
    markToolActivated: vi.fn(),
  },
}));

vi.mock('../../i18n', () => ({
  useI18n: () => ({ language: 'zh' }),
}));

vi.mock('../../hooks/use-drawnix', () => ({
  useDrawnix: () => ({ board: null }),
}));

vi.mock('../../plugins/with-tool', () => ({
  ToolTransforms: {
    insertTool: vi.fn(),
  },
}));

vi.mock('../../utils/url-template', () => ({
  processToolUrl: (url: string) => ({
    url: mocks.processedUrl ?? url,
    missingVariables: [],
  }),
}));

vi.mock('../../hooks/useDeviceType', () => ({
  useDeviceType: () => ({
    isMobile: false,
    isTablet: false,
    viewportWidth: 1440,
    viewportHeight: 900,
  }),
}));

vi.mock('../../tools/registry', () => ({
  toolRegistry: {
    resolveInternalComponent: () => null,
    isBuiltInTool: () => false,
  },
}));

vi.mock('../../services/winbox-manager-service', () => ({
  winboxManagerService: {
    bringToFront: vi.fn(),
  },
}));

vi.mock('../../utils/posthog-analytics', () => ({
  analytics: {
    trackUIInteraction: vi.fn(),
  },
}));

function createTool(url: string): ToolDefinition {
  return {
    id: 'external-tool',
    name: 'External tool',
    category: 'custom',
    url,
  };
}

function setOpenTool(url: string): void {
  const tool = createTool(url);
  mocks.states = [
    {
      instanceId: 'external-tool-instance',
      toolId: tool.id,
      instanceIndex: 1,
      tool,
      status: 'open',
      activationOrder: 1,
      isPinned: false,
      isLauncher: false,
    },
  ];
}

describe('ToolWinBoxManager external URL render boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.states = [];
    mocks.processedUrl = null;
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    JAVASCRIPT_URL,
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'blob:https://tools.example.test/unsafe',
    'https://[invalid-host',
  ])('renders an error without creating an iframe for an unsafe URL: %s', (url) => {
    setOpenTool(url);

    const { container } = render(<ToolWinBoxManager />);

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText('工具地址无效或协议不受支持')).toBeTruthy();
  });

  it.each([
    ['https://tools.example.test/app', 'https://tools.example.test/app'],
    ['/tools/local-tool.html', `${window.location.origin}/tools/local-tool.html`],
  ])('renders only the resolved HTTP(S) URL for %s', (url, expectedUrl) => {
    setOpenTool(url);

    const { container } = render(<ToolWinBoxManager />);
    const iframe = container.querySelector('iframe');

    expect(iframe).toBeInstanceOf(HTMLIFrameElement);
    expect(iframe?.getAttribute('src')).toBe(expectedUrl);
  });

  it('blocks an unsafe effective URL produced by runtime template expansion', () => {
    setOpenTool(`${BASE_URL_TEMPLATE}/tool`);
    mocks.processedUrl = JAVASCRIPT_URL;

    const { container } = render(<ToolWinBoxManager />);

    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText('工具地址无效或协议不受支持')).toBeTruthy();
  });
});
