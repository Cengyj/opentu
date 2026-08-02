export type ImageInvocationErrorCode =
  | 'IMAGE_REQUEST_INVALID'
  | 'IMAGE_CONFIGURATION_MISSING'
  | 'IMAGE_BINDING_UNAVAILABLE'
  | 'IMAGE_BINDING_AMBIGUOUS'
  | 'IMAGE_ADAPTER_UNAVAILABLE'
  | 'IMAGE_CAPABILITY_METADATA_INVALID'
  | 'IMAGE_PARAMETER_UNSUPPORTED'
  | 'IMAGE_NETWORK_ERROR'
  | 'IMAGE_PROVIDER_REJECTED'
  | 'IMAGE_TIMEOUT'
  | 'IMAGE_CANCELLED'
  | 'IMAGE_RECOVERY_FAILED'
  | 'IMAGE_RESULT_INVALID';

export type ImageInvocationErrorStage =
  | 'normalization'
  | 'intent'
  | 'planning'
  | 'capability-validation'
  | 'adapter'
  | 'transport'
  | 'polling'
  | 'result'
  | 'cache'
  | 'recovery';

export interface ImageInvocationErrorOptions {
  readonly stage: ImageInvocationErrorStage;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  readonly retryable?: boolean;
}

/** Structured image-only failure. Details must never contain credentials or image bytes. */
export class ImageInvocationError extends Error {
  readonly code: ImageInvocationErrorCode;
  readonly stage: ImageInvocationErrorStage;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  readonly retryable: boolean;

  constructor(
    code: ImageInvocationErrorCode,
    message: string,
    options: ImageInvocationErrorOptions
  ) {
    super(message);
    this.name = 'ImageInvocationError';
    this.code = code;
    this.stage = options.stage;
    this.details = options.details;
    this.cause = options.cause;
    this.retryable = options.retryable === true;
  }
}

export function isImageInvocationError(
  error: unknown
): error is ImageInvocationError {
  return error instanceof ImageInvocationError;
}

const PROVIDER_ERROR_PREVIEW_LIMIT = 8192;
const PROVIDER_ERROR_MESSAGE_LIMIT = 500;

function sanitizeProviderErrorValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (
    !normalized ||
    /(?:data:image\/|;base64,)/i.test(normalized) ||
    /[A-Za-z0-9+/]{256,}={0,2}/.test(normalized)
  ) {
    return undefined;
  }
  return normalized.slice(0, PROVIDER_ERROR_MESSAGE_LIMIT);
}

async function readProviderErrorPreview(response: Response): Promise<string> {
  if (!response.body) {
    return (await response.text().catch(() => '')).slice(
      0,
      PROVIDER_ERROR_PREVIEW_LIMIT
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let preview = '';
  try {
    while (preview.length < PROVIDER_ERROR_PREVIEW_LIMIT) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      preview += decoder.decode(value, { stream: true });
    }
    preview += decoder.decode();
  } finally {
    if (preview.length >= PROVIDER_ERROR_PREVIEW_LIMIT) {
      await reader.cancel().catch(() => undefined);
    } else {
      reader.releaseLock();
    }
  }
  return preview.slice(0, PROVIDER_ERROR_PREVIEW_LIMIT);
}

function extractProviderErrorSummary(preview: string): string | undefined {
  const safePlainText = () => sanitizeProviderErrorValue(preview);
  try {
    const payload = JSON.parse(preview) as {
      error?: unknown;
      message?: unknown;
      detail?: unknown;
      failReason?: unknown;
    };
    const nestedError =
      payload.error &&
      typeof payload.error === 'object' &&
      !Array.isArray(payload.error)
        ? (payload.error as { message?: unknown; detail?: unknown; code?: unknown })
        : undefined;
    return (
      sanitizeProviderErrorValue(nestedError?.message) ||
      sanitizeProviderErrorValue(nestedError?.detail) ||
      sanitizeProviderErrorValue(payload.error) ||
      sanitizeProviderErrorValue(payload.message) ||
      sanitizeProviderErrorValue(payload.detail) ||
      sanitizeProviderErrorValue(payload.failReason)
    );
  } catch {
    return safePlainText();
  }
}

export interface ImageProviderRejectionOptions {
  readonly bindingId: string;
  readonly label?: string;
  readonly stage?: 'transport' | 'polling';
}

/** Build a bounded structured provider error without retaining response bytes. */
export async function createImageProviderRejectionError(
  response: Response,
  options: ImageProviderRejectionOptions
): Promise<ImageInvocationError> {
  const preview = await readProviderErrorPreview(response);
  const summary = extractProviderErrorSummary(preview);
  const prefix = options.label?.trim() || '图片供应商请求失败';
  const message = summary
    ? `${prefix}: ${summary}`
    : `${prefix}: HTTP ${response.status}`;
  return new ImageInvocationError('IMAGE_PROVIDER_REJECTED', message, {
    stage: options.stage || 'transport',
    retryable: response.status >= 500,
    details: {
      bindingId: options.bindingId,
      httpStatus: response.status,
    },
  });
}
