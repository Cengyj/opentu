import {
  getSelectedElements,
  type PlaitBoard,
  type PlaitElement,
} from '@plait/core';
import { isWorkZoneElement } from '../../../plugins/workzone-transforms';

export function filterPopupToolbarSelectedElements(
  elements: PlaitElement[]
): PlaitElement[] {
  return elements.filter((element) => !isWorkZoneElement(element));
}

export function getPopupToolbarSelectedElements(board: PlaitBoard) {
  return filterPopupToolbarSelectedElements(getSelectedElements(board));
}
