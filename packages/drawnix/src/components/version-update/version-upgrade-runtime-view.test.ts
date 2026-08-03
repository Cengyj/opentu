import { describe, expect, it } from 'vitest';
import { hasPendingVersionUpgrade } from '../startup/operational-monitor-policy';

describe('version upgrade monitor policy', () => {
  it('loads the prompt only for a complete pending release identity', () => {
    expect(hasPendingVersionUpgrade(null)).toBe(false);
    expect(
      hasPendingVersionUpgrade({
        pendingReleaseId: 'release-next',
        displayVersion: null,
      })
    ).toBe(false);
    expect(
      hasPendingVersionUpgrade({
        pendingReleaseId: null,
        displayVersion: '1.0.3',
      })
    ).toBe(false);
    expect(
      hasPendingVersionUpgrade({
        pendingReleaseId: 'release-next',
        displayVersion: '1.0.3',
      })
    ).toBe(true);
  });
});
