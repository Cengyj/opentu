function resolveAbortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('Aborted', 'AbortError');
}

export function throwIfImageInvocationAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw resolveAbortReason(signal);
  }
}

/** Stable worker pool that never starts more than `concurrency` operations. */
export async function mapImageInvocationWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  if (values.length === 0) {
    return [];
  }
  const workerCount = Math.min(
    values.length,
    Math.max(1, Math.floor(concurrency))
  );
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  let failed = false;

  const worker = async () => {
    while (!failed) {
      throwIfImageInvocationAborted(signal);
      const index = nextIndex;
      if (index >= values.length) {
        return;
      }
      nextIndex += 1;
      try {
        results[index] = await mapper(values[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
