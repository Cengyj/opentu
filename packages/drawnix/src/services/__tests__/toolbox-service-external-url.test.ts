// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolDefinition } from '../../types/toolbox.types';

const localForageHarness = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('localforage', () => ({
  default: localForageHarness,
}));

vi.mock('../../tools/registry', () => ({
  toolRegistry: {
    getBuiltInTools: () => [],
    getManifestById: () => null,
  },
}));

const API_KEY_TEMPLATE = ['$', '{apiKey}'].join('');
const JAVASCRIPT_URL = ['java', 'script:alert(document.domain)'].join('');
const CHAT_MJ_TEMPLATE_URL =
  `https://vercel.ddaiai.com/#/?settings={"key":"${API_KEY_TEMPLATE}",` +
  '"url":"https://foropencode.com"}';

function createExternalTool(id: string, url: string): ToolDefinition {
  return {
    id,
    name: `Tool ${id}`,
    category: 'custom',
    url,
  };
}

async function loadEmptyToolboxService() {
  localForageHarness.getItem.mockResolvedValue(null);
  const { toolboxService } = await import('../toolbox-service');
  await vi.waitFor(() => {
    expect(localForageHarness.getItem).toHaveBeenCalledWith(
      'aitu:custom-tools'
    );
  });
  return toolboxService;
}

describe('toolbox service external URL persistence boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it.each([
    ['HTTP', 'http://tools.example.test/app'],
    ['HTTPS', 'https://tools.example.test/app'],
    ['relative local tool', '/tools/local-tool.html'],
  ])('accepts %s URLs', async (_label, url) => {
    const toolboxService = await loadEmptyToolboxService();
    const tool = createExternalTool('accepted-tool', url);

    await toolboxService.addCustomTool(tool);

    expect(toolboxService.getCustomTools()).toEqual([
      expect.objectContaining({
        id: tool.id,
        url,
      }),
    ]);
    expect(localForageHarness.setItem).toHaveBeenCalledTimes(1);
  });

  it('accepts the Chat-MJ API-key template without rewriting its persisted value', async () => {
    const toolboxService = await loadEmptyToolboxService();
    const tool = createExternalTool('chat-mj-template', CHAT_MJ_TEMPLATE_URL);

    await toolboxService.addCustomTool(tool);

    expect(toolboxService.getCustomTools()[0]?.url).toBe(CHAT_MJ_TEMPLATE_URL);
    expect(localForageHarness.setItem).toHaveBeenCalledWith(
      'aitu:custom-tools',
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            id: tool.id,
            url: CHAT_MJ_TEMPLATE_URL,
          }),
        ],
      })
    );
  });

  it.each([
    ['javascript', JAVASCRIPT_URL],
    ['data', 'data:text/html,<script>alert(1)</script>'],
    ['file', 'file:///etc/passwd'],
    ['blob', 'blob:https://tools.example.test/unsafe'],
    ['malformed', 'https://[invalid-host'],
  ])('rejects a %s URL before add persistence', async (_label, url) => {
    const toolboxService = await loadEmptyToolboxService();

    await expect(
      toolboxService.addCustomTool(createExternalTool('unsafe-add', url))
    ).rejects.toThrow();

    expect(toolboxService.getCustomTools()).toEqual([]);
    expect(localForageHarness.setItem).not.toHaveBeenCalled();
  });

  it.each([
    JAVASCRIPT_URL,
    'data:text/html,unsafe',
    'file:///tmp/unsafe.html',
    'blob:https://tools.example.test/unsafe',
    'http://[invalid-host',
  ])('rejects an unsafe update without changing or persisting the stored tool: %s', async (url) => {
    const toolboxService = await loadEmptyToolboxService();
    const originalUrl = 'https://tools.example.test/original';
    await toolboxService.addCustomTool(
      createExternalTool('update-target', originalUrl)
    );
    localForageHarness.setItem.mockClear();

    await expect(
      toolboxService.updateCustomTool('update-target', { url })
    ).rejects.toThrow();

    expect(toolboxService.getToolById('update-target')?.url).toBe(originalUrl);
    expect(localForageHarness.setItem).not.toHaveBeenCalled();
  });

  it('imports only valid external tools and counts rejected URLs as skipped', async () => {
    const toolboxService = await loadEmptyToolboxService();
    const tools = [
      createExternalTool('https-tool', 'https://tools.example.test/app'),
      createExternalTool('chat-mj-template', CHAT_MJ_TEMPLATE_URL),
      createExternalTool('relative-tool', '/tools/local-tool.html'),
      createExternalTool('javascript-tool', JAVASCRIPT_URL),
      createExternalTool('data-tool', 'data:text/html,unsafe'),
      createExternalTool('file-tool', 'file:///tmp/unsafe.html'),
      createExternalTool(
        'blob-tool',
        'blob:https://tools.example.test/unsafe'
      ),
      createExternalTool('malformed-tool', 'https://[invalid-host'),
    ];

    await expect(toolboxService.importTools(tools)).resolves.toEqual({
      imported: 3,
      skipped: 5,
    });

    expect(toolboxService.getCustomTools().map(({ id, url }) => ({ id, url })))
      .toEqual([
        {
          id: 'https-tool',
          url: 'https://tools.example.test/app',
        },
        {
          id: 'chat-mj-template',
          url: CHAT_MJ_TEMPLATE_URL,
        },
        {
          id: 'relative-tool',
          url: '/tools/local-tool.html',
        },
      ]);
    expect(localForageHarness.setItem).toHaveBeenCalledTimes(1);
  });
});
