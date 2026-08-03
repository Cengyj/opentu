/**
 * Creates a single-flight lazy module loader.
 *
 * Concurrent callers share the same import attempt. A rejected attempt is not
 * cached so a later user action can retry loading the chunk; a successful
 * module is retained for the rest of the page lifetime.
 */
export function createRetriableModuleLoader<T>(
  importModule: () => Promise<T>
): () => Promise<T> {
  let loadedModule: { value: T } | null = null;
  let inFlight: Promise<T> | null = null;

  return () => {
    if (loadedModule) {
      return Promise.resolve(loadedModule.value);
    }

    if (inFlight) {
      return inFlight;
    }

    const attempt = Promise.resolve().then(importModule);
    const trackedAttempt = attempt.then(
      (module) => {
        loadedModule = { value: module };
        if (inFlight === trackedAttempt) {
          inFlight = null;
        }
        return module;
      },
      (error: unknown) => {
        if (inFlight === trackedAttempt) {
          inFlight = null;
        }
        throw error;
      }
    );

    inFlight = trackedAttempt;
    return trackedAttempt;
  };
}
