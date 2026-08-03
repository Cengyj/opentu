import { describe, expect, it } from 'vitest';
import { PlaitPointerType } from '@plait/core';
import { FreehandShape } from '../../plugins/freehand/type';
import { PenShape } from '../../plugins/pen/type';
import {
  isEraserSettingsToolbarActive,
  isPenSettingsToolbarActive,
  isPencilSettingsToolbarActive,
} from './tool-settings-visibility';

describe('tool settings visibility', () => {
  it('matches the pencil toolbar pointer contract', () => {
    expect(isPencilSettingsToolbarActive(FreehandShape.feltTipPen)).toBe(true);
    expect(isPencilSettingsToolbarActive(FreehandShape.mask)).toBe(true);
    expect(isPencilSettingsToolbarActive(FreehandShape.eraser)).toBe(false);
    expect(isPencilSettingsToolbarActive(PlaitPointerType.hand)).toBe(false);
  });

  it('matches the eraser toolbar pointer contract', () => {
    expect(isEraserSettingsToolbarActive(FreehandShape.eraser)).toBe(true);
    expect(isEraserSettingsToolbarActive(FreehandShape.feltTipPen)).toBe(
      false
    );
  });

  it('requires the app and board to agree before mounting pen settings', () => {
    expect(isPenSettingsToolbarActive(PenShape.pen, PenShape.pen)).toBe(true);
    expect(
      isPenSettingsToolbarActive(PenShape.pen, PlaitPointerType.selection)
    ).toBe(false);
    expect(
      isPenSettingsToolbarActive(PlaitPointerType.selection, PenShape.pen)
    ).toBe(false);
  });
});
