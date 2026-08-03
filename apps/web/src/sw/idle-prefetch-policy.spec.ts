import { describe, expect, it } from 'vitest';
import {
  mergeIdlePrefetchGroupRequests,
  resolveOrderedIdlePrefetchGroups,
} from './idle-prefetch-policy';

const manifest = {
  defaults: ['tool-windows', 'runtime-static-assets'],
  groups: {
    'ai-chat': [{ url: '/ai-chat.js' }],
    'tool-windows': [{ url: '/tool-windows.js' }],
    'runtime-static-assets': [{ url: '/runtime.woff2' }],
    'offline-static-assets': [{ url: '/manual.png' }],
    empty: [],
  },
};

describe('resolveOrderedIdlePrefetchGroups', () => {
  it('only returns manifest defaults for an automatic startup run', () => {
    expect(resolveOrderedIdlePrefetchGroups(manifest)).toEqual([
      'tool-windows',
      'runtime-static-assets',
    ]);
  });

  it('does no background group download when the manifest has no defaults', () => {
    expect(
      resolveOrderedIdlePrefetchGroups({ ...manifest, defaults: [] })
    ).toEqual([]);
  });

  it('does not append defaults or unrelated groups to an explicit request', () => {
    expect(resolveOrderedIdlePrefetchGroups(manifest, ['ai-chat'])).toEqual([
      'ai-chat',
    ]);
  });

  it('includes every non-empty group only for release full prewarm', () => {
    expect(resolveOrderedIdlePrefetchGroups(manifest, [], 'all')).toEqual([
      'tool-windows',
      'runtime-static-assets',
      'offline-static-assets',
      'ai-chat',
    ]);
  });
});

describe('mergeIdlePrefetchGroupRequests', () => {
  it('retains explicit groups while an earlier retry timer is pending', () => {
    expect(
      mergeIdlePrefetchGroupRequests(['ai-chat'], ['tool-windows', 'ai-chat'])
    ).toEqual(['ai-chat', 'tool-windows']);
  });
});
