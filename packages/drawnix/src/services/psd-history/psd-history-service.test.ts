import { describe, expect, it } from 'vitest';
import {
  derivePsdHistoryStatus,
  psdHistoryService,
} from './psd-history-service';

describe('derivePsdHistoryStatus', () => {
  it('returns reviewing before any layer task exists', () => {
    expect(derivePsdHistoryStatus([{ status: 'planned' }], false)).toBe(
      'reviewing'
    );
  });

  it('returns generating while any layer is queued or processing', () => {
    expect(
      derivePsdHistoryStatus(
        [{ status: 'ready' }, { status: 'processing' }],
        true
      )
    ).toBe('generating');
    expect(
      derivePsdHistoryStatus([{ status: 'queued' }], true)
    ).toBe('generating');
  });

  it('returns completed when all results are ready', () => {
    expect(
      derivePsdHistoryStatus([{ status: 'ready' }, { status: 'ready' }], true)
    ).toBe('completed');
  });

  it('returns partial when some ready and some failed', () => {
    expect(
      derivePsdHistoryStatus([{ status: 'ready' }, { status: 'failed' }], true)
    ).toBe('partial');
  });

  it('returns failed when there are only failures', () => {
    expect(
      derivePsdHistoryStatus(
        [{ status: 'failed' }, { status: 'cancelled' }],
        true
      )
    ).toBe('failed');
  });
});

describe('psdHistoryService resilience', () => {
  it('returns an empty list (does not throw) when IndexedDB is unavailable', async () => {
    await expect(psdHistoryService.listEntries()).resolves.toEqual([]);
  });

  it('swallows write/delete/clear failures without throwing', async () => {
    await expect(psdHistoryService.deleteEntry('missing')).resolves.toBeUndefined();
    await expect(psdHistoryService.clear()).resolves.toBeUndefined();
  });
});
