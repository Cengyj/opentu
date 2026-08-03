import { describe, expect, it } from 'vitest';
import type { PlaitElement } from '@plait/core';
import { filterPopupToolbarSelectedElements } from './popup-toolbar-selection';

describe('popup toolbar selection activation', () => {
  it('activates for ordinary selections but not a WorkZone-only selection', () => {
    const shape = { id: 'shape-1', type: 'geometry' } as PlaitElement;
    const workZone = { id: 'zone-1', type: 'workzone' } as PlaitElement;

    expect(filterPopupToolbarSelectedElements([workZone])).toEqual([]);
    expect(filterPopupToolbarSelectedElements([workZone, shape])).toEqual([
      shape,
    ]);
  });
});
