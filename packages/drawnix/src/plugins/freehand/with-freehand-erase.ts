import {
    PlaitBoard,
    PlaitElement,
    Point,
    throttleRAF,
    toHostPoint,
    toViewBoxPoint,
} from '@plait/core';
import { isDrawingMode } from '@plait/common';
import { isHitFreehandWithRadius } from './utils';
import { Freehand, FreehandShape } from './type';
import { CoreTransforms } from '@plait/core';
import { PlaitDrawElement } from '@plait/draw';
import { getFreehandSettings } from './freehand-settings';
import { isFrameElement } from '../../types/frame.types';
import { isPlaitVideo } from '../../interfaces/video';
import { shouldDelegateToHandPointer } from '../hand-mode';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';

type PreciseEraseRuntime = typeof import('../../transforms/precise-erase');
export type PreciseEraseRuntimeLoader = () => Promise<PreciseEraseRuntime>;

const loadDefaultPreciseEraseRuntime = createRetriableModuleLoader(
    () => import('../../transforms/precise-erase')
);

export const withFreehandErase = (
    board: PlaitBoard,
    loadPreciseEraseRuntime: PreciseEraseRuntimeLoader = loadDefaultPreciseEraseRuntime
) => {
    const { pointerDown, pointerMove, pointerUp, globalPointerUp } = board;

    let isErasing = false;
    let isTemporaryHandPanning = false;
    const elementsToDelete = new Set<string>();
    let eraserPath: Point[] = [];

    const checkAndMarkFreehandElementsForDeletion = (point: Point) => {
        const viewBoxPoint = toViewBoxPoint(board, toHostPoint(board, point[0], point[1]));
        const settings = getFreehandSettings(board);
        const hitRadius = settings.eraserWidth / 2;

        const freehandElements = board.children.filter((element) =>
            Freehand.isFreehand(element)
        ) as Freehand[];

        freehandElements.forEach((element) => {
            if (!elementsToDelete.has(element.id) && isHitFreehandWithRadius(board, element, viewBoxPoint, hitRadius)) {
                PlaitElement.getElementG(element).style.opacity = '0.2';
                elementsToDelete.add(element.id);
            }
        });
    };

    const deleteMarkedElements = (elementIds: ReadonlySet<string>) => {
        if (elementIds.size > 0) {
            const elementsToRemove = board.children.filter((element) =>
                elementIds.has(element.id)
            );
            
            if (elementsToRemove.length > 0) {
                CoreTransforms.removeElements(board, elementsToRemove);
            }
        }
    };

    const complete = async () => {
        if (isErasing) {
            // 先释放当前手势状态；后续异步擦除只能读取本笔快照，不能清空下一笔。
            const completedPath = eraserPath.map(
                ([x, y]) => [x, y] as Point
            );
            const completedElementIds = new Set(elementsToDelete);
            isErasing = false;
            elementsToDelete.clear();
            eraserPath = [];

            // Freehand 笔画统一用整体删除（两种模式一致）
            deleteMarkedElements(completedElementIds);

            if (completedPath.length >= 2) {
                // Settings and elements belong to the completed gesture. A
                // delayed chunk must not read a later gesture's mutable state.
                const completedSettings = getFreehandSettings(board);
                const completedElements = [...board.children];

                let preciseEraseRuntime: PreciseEraseRuntime;
                try {
                    preciseEraseRuntime = await loadPreciseEraseRuntime();
                } catch (error) {
                    console.error('Precise erase error:', error);
                    return;
                }

                // 对非 Freehand 的支持元素使用布尔运算
                const targetElements = preciseEraseRuntime.findElementsInEraserPath(
                    completedElements,
                    completedPath,
                    completedSettings.eraserWidth
                ).filter(el => !Freehand.isFreehand(el));
                if (targetElements.length > 0) {
                    try {
                        await preciseEraseRuntime.executePreciseErase(
                            board,
                            completedPath,
                            completedSettings.eraserWidth,
                            completedSettings.eraserShape,
                            targetElements
                        );
                    } catch (error) {
                        console.error('Precise erase error:', error);
                    }
                }

                // Preserve the existing post-execute live-board lookup for
                // unsupported elements; only supported target selection is a
                // completion-time snapshot.
                const unsupportedElements = preciseEraseRuntime.findUnsupportedElementsInEraserPath(
                    board,
                    completedPath,
                    completedSettings.eraserWidth
                ).filter(el => !Freehand.isFreehand(el) && !isFrameElement(el) && !isPlaitVideo(el)
                    && !(PlaitDrawElement.isDrawElement(el) && PlaitDrawElement.isImage(el)));
                if (unsupportedElements.length > 0) {
                    CoreTransforms.removeElements(board, unsupportedElements);
                }
            }
        }
    };

    board.pointerDown = (event: PointerEvent) => {
        if (shouldDelegateToHandPointer(board, event)) {
            isTemporaryHandPanning = true;
            pointerDown(event);
            return;
        }

        const isEraserPointer = PlaitBoard.isInPointer(board, [FreehandShape.eraser]);

        if (isEraserPointer && isDrawingMode(board)) {
            isErasing = true;
            elementsToDelete.clear();
            eraserPath = []; // 重置路径
            
            const currentPoint: Point = [event.x, event.y];
            const viewBoxPoint = toViewBoxPoint(board, toHostPoint(board, currentPoint[0], currentPoint[1]));
            eraserPath.push(viewBoxPoint);
            
            checkAndMarkFreehandElementsForDeletion(currentPoint);
            return;
        }

        pointerDown(event);
    };

    board.pointerMove = (event: PointerEvent) => {
        if (isTemporaryHandPanning) {
            pointerMove(event);
            return;
        }

        if (isErasing) {
            throttleRAF(board, 'with-freehand-erase', () => {
                const currentPoint: Point = [event.x, event.y];
                const viewBoxPoint = toViewBoxPoint(board, toHostPoint(board, currentPoint[0], currentPoint[1]));
                eraserPath.push(viewBoxPoint);
                
                checkAndMarkFreehandElementsForDeletion(currentPoint);
            });
            return;
        }

        pointerMove(event);
    };

    board.pointerUp = (event: PointerEvent) => {
        if (isTemporaryHandPanning) {
            isTemporaryHandPanning = false;
            pointerUp(event);
            return;
        }

        if (isErasing) {
            complete();
            return;
        }

        pointerUp(event);
    };

    board.globalPointerUp = (event: PointerEvent) => {
        isTemporaryHandPanning = false;

        if (isErasing) {
            complete();
            return;
        }

        globalPointerUp(event);
    };

    return board;
};
