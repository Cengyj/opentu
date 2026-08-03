import type { DrawnixPointerType } from '../../hooks/use-drawnix';
import { getFreehandPointers } from '../../plugins/freehand/utils';
import { FreehandShape } from '../../plugins/freehand/type';
import { PenShape } from '../../plugins/pen/type';

export function isPencilSettingsToolbarActive(
  pointer: DrawnixPointerType
): boolean {
  return (
    getFreehandPointers().includes(pointer as FreehandShape) &&
    pointer !== FreehandShape.eraser
  );
}

export function isEraserSettingsToolbarActive(
  pointer: DrawnixPointerType
): boolean {
  return pointer === FreehandShape.eraser;
}

export function isPenSettingsToolbarActive(
  appPointer: DrawnixPointerType,
  boardPointer: unknown
): boolean {
  return appPointer === PenShape.pen && boardPointer === PenShape.pen;
}
