import { useEffect, useState } from 'react';

/**
 * Turns a semantic initialization signal into a monotonic "painted and
 * operable" signal. A browser idle callback is not sufficient for this: the
 * main thread can be idle while startup chunks are still arriving over the
 * network. Waiting for a frame and then a task guarantees that the committed
 * Drawnix shell has had an opportunity to paint before optional runtimes are
 * allowed to schedule background work.
 */
export function usePostPaintOperability(initialized: boolean): boolean {
  const [isOperable, setIsOperable] = useState(false);

  useEffect(() => {
    if (!initialized || isOperable) {
      return;
    }

    let frameId: number | null = null;
    let postPaintTimerId: number | null = null;
    let disposed = false;

    const markOperableAfterPaint = () => {
      if (disposed) {
        return;
      }
      postPaintTimerId = window.setTimeout(() => {
        postPaintTimerId = null;
        if (!disposed) {
          setIsOperable(true);
        }
      }, 0);
    };

    if (typeof window.requestAnimationFrame === 'function') {
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        markOperableAfterPaint();
      });
    } else {
      markOperableAfterPaint();
    }

    return () => {
      disposed = true;
      if (frameId !== null) {
        window.cancelAnimationFrame?.(frameId);
      }
      if (postPaintTimerId !== null) {
        window.clearTimeout(postPaintTimerId);
      }
    };
  }, [initialized, isOperable]);

  return isOperable;
}
