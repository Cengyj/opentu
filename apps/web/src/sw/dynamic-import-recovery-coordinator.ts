import type {
  DynamicImportRecoveryRejectionReason,
  DynamicImportRecoveryRequest,
} from './release-contract';

export interface DynamicImportRecoveryExecutionResult {
  accepted: boolean;
  invalidatedEntries: number;
  reason?: DynamicImportRecoveryRejectionReason;
}

interface RecoveryAttempt {
  promise: Promise<DynamicImportRecoveryExecutionResult>;
  settledAt: number | null;
}

interface DynamicImportRecoveryCoordinatorOptions {
  resultTtlMs?: number;
  maxSettledResults?: number;
  now?: () => number;
}

const DEFAULT_RESULT_TTL_MS = 2 * 60 * 1000;
const DEFAULT_MAX_SETTLED_RESULTS = 64;

export function createCompletedDynamicImportRecoveryResult(
  invalidatedEntries: number
): DynamicImportRecoveryExecutionResult {
  return { accepted: true, invalidatedEntries };
}

export function getDynamicImportRecoveryAttemptKey(
  clientId: string,
  request: DynamicImportRecoveryRequest
): string {
  return JSON.stringify([
    clientId,
    request.releaseId,
    request.requestId,
    request.target,
  ]);
}

/**
 * Keeps one invalidation attempt authoritative for a correlated page request.
 * A page can resend the same request when its reply port is lost or times out;
 * the Service Worker replays the original result instead of invalidating twice.
 */
export class DynamicImportRecoveryCoordinator {
  private readonly attempts = new Map<string, RecoveryAttempt>();
  private readonly resultTtlMs: number;
  private readonly maxSettledResults: number;
  private readonly now: () => number;

  constructor({
    resultTtlMs = DEFAULT_RESULT_TTL_MS,
    maxSettledResults = DEFAULT_MAX_SETTLED_RESULTS,
    now = Date.now,
  }: DynamicImportRecoveryCoordinatorOptions = {}) {
    this.resultTtlMs = resultTtlMs;
    this.maxSettledResults = maxSettledResults;
    this.now = now;
  }

  execute(
    attemptKey: string,
    invalidate: () => Promise<DynamicImportRecoveryExecutionResult>
  ): Promise<DynamicImportRecoveryExecutionResult> {
    this.pruneExpiredResults();
    const existingAttempt = this.attempts.get(attemptKey);
    if (existingAttempt) {
      return existingAttempt.promise;
    }

    const attempt: RecoveryAttempt = {
      promise: Promise.resolve().then(invalidate),
      settledAt: null,
    };
    this.attempts.set(attemptKey, attempt);
    void attempt.promise.then(
      () => {
        attempt.settledAt = this.now();
        this.pruneExpiredResults();
        this.trimSettledResults();
      },
      () => {
        if (this.attempts.get(attemptKey) === attempt) {
          this.attempts.delete(attemptKey);
        }
      }
    );
    return attempt.promise;
  }

  private pruneExpiredResults(): void {
    const oldestAllowed = this.now() - this.resultTtlMs;
    for (const [attemptKey, attempt] of this.attempts) {
      if (attempt.settledAt !== null && attempt.settledAt < oldestAllowed) {
        this.attempts.delete(attemptKey);
      }
    }
  }

  private trimSettledResults(): void {
    const settledResults = [...this.attempts.entries()].filter(
      ([, attempt]) => attempt.settledAt !== null
    );
    const overflow = settledResults.length - this.maxSettledResults;
    if (overflow <= 0) {
      return;
    }
    settledResults
      .sort(
        ([, left], [, right]) => (left.settledAt || 0) - (right.settledAt || 0)
      )
      .slice(0, overflow)
      .forEach(([attemptKey]) => this.attempts.delete(attemptKey));
  }
}
