/**
 * Central URL boundary for iframe-based external tools.
 *
 * Tool URLs may contain runtime template variables and may be relative to the
 * current application origin. Validation substitutes templates only while
 * parsing; the original value is never rewritten or persisted.
 */

const DEFAULT_EXTERNAL_TOOL_BASE_URL = 'https://external-tool.invalid/';
const TEMPLATE_VARIABLE_PATTERN = /\$\{[A-Za-z_][A-Za-z0-9_]*\}/g;
const ALLOWED_EXTERNAL_TOOL_PROTOCOLS = new Set(['http:', 'https:']);

export type ExternalToolUrlErrorCode =
  | 'EMPTY_URL'
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL';

export type SafeExternalToolUrlResult =
  | {
      ok: true;
      url: string;
    }
  | {
      ok: false;
      code: ExternalToolUrlErrorCode;
      message: string;
    };

export interface ResolveSafeExternalToolUrlOptions {
  /** Base used to resolve application-local relative tool URLs. */
  baseUrl?: string;
}

const invalidUrlResult = (): SafeExternalToolUrlResult => ({
  ok: false,
  code: 'INVALID_URL',
  message: 'Invalid external tool URL',
});

/**
 * Resolve an external tool URL and enforce its final protocol.
 *
 * Callers that expand runtime variables must call this function after
 * expansion as well. This ensures a setting-backed template cannot change the
 * effective URL to a non-HTTP(S) protocol.
 */
export function resolveSafeExternalToolUrl(
  rawUrl: string,
  options: ResolveSafeExternalToolUrlOptions = {}
): SafeExternalToolUrlResult {
  if (typeof rawUrl !== 'string') {
    return invalidUrlResult();
  }
  const trimmedUrl = rawUrl.trim();
  if (!trimmedUrl) {
    return {
      ok: false,
      code: 'EMPTY_URL',
      message: 'External tool URL is required',
    };
  }

  const baseUrl = options.baseUrl || DEFAULT_EXTERNAL_TOOL_BASE_URL;
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    return invalidUrlResult();
  }

  if (!ALLOWED_EXTERNAL_TOOL_PROTOCOLS.has(parsedBaseUrl.protocol)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_PROTOCOL',
      message: 'Only HTTP/HTTPS external tool URLs are allowed',
    };
  }

  const validationUrl = trimmedUrl.replace(
    TEMPLATE_VARIABLE_PATTERN,
    'external-tool-template-value'
  );

  let parsedValidationUrl: URL;
  try {
    parsedValidationUrl = new URL(validationUrl, parsedBaseUrl);
  } catch {
    return invalidUrlResult();
  }

  if (!ALLOWED_EXTERNAL_TOOL_PROTOCOLS.has(parsedValidationUrl.protocol)) {
    return {
      ok: false,
      code: 'UNSUPPORTED_PROTOCOL',
      message: 'Only HTTP/HTTPS external tool URLs are allowed',
    };
  }

  try {
    const resolvedUrl = new URL(trimmedUrl, parsedBaseUrl);
    if (!ALLOWED_EXTERNAL_TOOL_PROTOCOLS.has(resolvedUrl.protocol)) {
      return {
        ok: false,
        code: 'UNSUPPORTED_PROTOCOL',
        message: 'Only HTTP/HTTPS external tool URLs are allowed',
      };
    }
    return { ok: true, url: resolvedUrl.toString() };
  } catch {
    return invalidUrlResult();
  }
}
