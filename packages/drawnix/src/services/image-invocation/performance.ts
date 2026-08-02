export const IMAGE_INVOCATION_PERFORMANCE_STAGES = [
  'normalization',
  'planning',
  'adapterResolution',
  'capabilityValidation',
  'referencePreparation',
  'submit',
  'poll',
  'responseParsing',
  'artifactCaching',
  'terminalPersistence',
] as const;

export type ImageInvocationPerformanceStage =
  (typeof IMAGE_INVOCATION_PERFORMANCE_STAGES)[number];

export const IMAGE_INVOCATION_PERFORMANCE_COUNTERS = [
  'normalizationCalls',
  'plannerCalls',
  'adapterResolutionCalls',
  'capabilityValidationCalls',
  'referenceMaterializations',
  'submitRequests',
  'pollRequests',
  'responseParses',
  'artifactCacheOperations',
  'terminalWrites',
] as const;

export type ImageInvocationPerformanceCounter =
  (typeof IMAGE_INVOCATION_PERFORMANCE_COUNTERS)[number];

export interface ImageInvocationPerformanceSnapshot {
  readonly durationsMs: Readonly<
    Partial<Record<ImageInvocationPerformanceStage, number>>
  >;
  readonly counters: Readonly<
    Partial<Record<ImageInvocationPerformanceCounter, number>>
  >;
}

export interface ImageInvocationTelemetry {
  increment(
    counter: ImageInvocationPerformanceCounter,
    amount?: number
  ): void;
  measureSync<T>(
    stage: ImageInvocationPerformanceStage,
    operation: () => T
  ): T;
  measure<T>(
    stage: ImageInvocationPerformanceStage,
    operation: () => Promise<T>
  ): Promise<T>;
  snapshot(): ImageInvocationPerformanceSnapshot;
}

export interface CreateImageInvocationTelemetryOptions {
  readonly now?: () => number;
}

function defaultNow(): number {
  return typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now()
    : Date.now();
}

function roundDuration(value: number): number {
  return Math.round(Math.max(0, value) * 1000) / 1000;
}

/**
 * Invocation-local observability only. The recorder cannot select a model,
 * binding, adapter, endpoint, retry, or task state.
 */
export function createImageInvocationTelemetry(
  options: CreateImageInvocationTelemetryOptions = {}
): ImageInvocationTelemetry {
  const now = options.now || defaultNow;
  const durations = new Map<ImageInvocationPerformanceStage, number>();
  const counters = new Map<ImageInvocationPerformanceCounter, number>();

  const recordDuration = (
    stage: ImageInvocationPerformanceStage,
    startedAt: number
  ) => {
    const elapsed = Math.max(0, now() - startedAt);
    durations.set(stage, (durations.get(stage) || 0) + elapsed);
  };

  return Object.freeze({
    increment(
      counter: ImageInvocationPerformanceCounter,
      amount = 1
    ): void {
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }
      counters.set(counter, (counters.get(counter) || 0) + amount);
    },
    measureSync<T>(
      stage: ImageInvocationPerformanceStage,
      operation: () => T
    ): T {
      const startedAt = now();
      try {
        return operation();
      } finally {
        recordDuration(stage, startedAt);
      }
    },
    async measure<T>(
      stage: ImageInvocationPerformanceStage,
      operation: () => Promise<T>
    ): Promise<T> {
      const startedAt = now();
      try {
        return await operation();
      } finally {
        recordDuration(stage, startedAt);
      }
    },
    snapshot(): ImageInvocationPerformanceSnapshot {
      const durationsMs = Object.freeze(
        Object.fromEntries(
          Array.from(durations, ([stage, duration]) => [
            stage,
            roundDuration(duration),
          ])
        ) as Partial<Record<ImageInvocationPerformanceStage, number>>
      );
      const counterSnapshot = Object.freeze(
        Object.fromEntries(counters) as Partial<
          Record<ImageInvocationPerformanceCounter, number>
        >
      );
      return Object.freeze({ durationsMs, counters: counterSnapshot });
    },
  });
}
