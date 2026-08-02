import {
  providerTransport,
  resolveProviderBindingAuthQueryKey,
  resolveProviderBindingPollPath,
  type InvocationPlan,
  type ProviderModelBinding,
  type ResolvedProviderContext,
} from '../provider-routing';
import {
  ImageArtifactError,
  normalizeImageArtifacts,
  type ImageArtifact,
} from './artifacts';
import { ImageInvocationError } from './errors';
import type { ImageInvocationTelemetry } from './performance';

export interface ResumeImagePollingOptions {
  readonly signal?: AbortSignal;
  readonly fetcher?: typeof fetch;
  readonly interval?: number;
  readonly maxAttempts?: number;
  readonly onProgress?: (progress: number, status: string) => void;
  readonly telemetry?: ImageInvocationTelemetry;
}

export interface ImagePollingInvocation {
  readonly provider: ResolvedProviderContext;
  readonly binding: ProviderModelBinding;
}

type UnknownRecord = Record<string, unknown>;

interface ParsedPollResponse {
  readonly state: 'pending' | 'completed' | 'failed';
  readonly progress: number;
  readonly status: string;
  readonly artifacts?: readonly ImageArtifact[];
  readonly error?: string;
}

type PollResponseParser = (payload: UnknownRecord) => ParsedPollResponse;

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readProgress(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(99, Math.max(0, value))
    : fallback;
}

function readProviderError(payload: UnknownRecord): string {
  const error = payload.error;
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (isRecord(error)) {
    return (
      readString(error.message) || readString(error.code) || '图片任务失败'
    );
  }
  return (
    readString(payload.failReason) ||
    readString(payload.message) ||
    '图片任务失败'
  );
}

function readAsyncArtifactSource(
  value: unknown
): string | { value: string; mimeType?: string } | undefined {
  if (typeof value === 'string') {
    return readString(value);
  }
  if (!isRecord(value)) {
    return undefined;
  }

  const url = readString(value.url) || readString(value.video_url);
  if (url) {
    return url;
  }
  const inline = readString(value.b64_json);
  return inline
    ? {
        value: inline,
        mimeType:
          readString(value.mime_type) || readString(value.mimeType),
      }
    : undefined;
}

function collectOpenAIAsyncArtifactSources(
  payload: UnknownRecord
): Array<string | { value: string; mimeType?: string }> {
  const ordered: Array<string | { value: string; mimeType?: string }> = [];
  const seen = new Set<string>();
  const append = (value: unknown) => {
    const source = readAsyncArtifactSource(value);
    if (!source) {
      return;
    }
    const identity = typeof source === 'string' ? source : source.value;
    if (!seen.has(identity)) {
      seen.add(identity);
      ordered.push(source);
    }
  };

  if (Array.isArray(payload.urls)) {
    payload.urls.forEach(append);
  }
  if (Array.isArray(payload.data)) {
    payload.data.forEach(append);
  }

  const primary = readString(payload.url) || readString(payload.video_url);
  if (primary && !seen.has(primary)) {
    ordered.unshift(primary);
  }

  return ordered;
}

function parseOpenAIAsyncResponse(payload: UnknownRecord): ParsedPollResponse {
  const status = readString(payload.status)?.toLowerCase() || 'unknown';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
    return {
      state: 'failed',
      progress: readProgress(payload.progress, 0),
      status,
      error: readProviderError(payload),
    };
  }
  if (['completed', 'success', 'succeeded', 'done'].includes(status)) {
    return {
      state: 'completed',
      progress: 100,
      status,
      artifacts: normalizeImageArtifacts(
        collectOpenAIAsyncArtifactSources(payload)
      ),
    };
  }
  return {
    state: 'pending',
    progress: readProgress(payload.progress, 10),
    status,
  };
}

function parseMJResponse(payload: UnknownRecord): ParsedPollResponse {
  const status = readString(payload.status)?.toLowerCase() || 'unknown';
  if (['fail', 'failed', 'failure', 'error'].includes(status)) {
    return {
      state: 'failed',
      progress: readProgress(payload.progress, 0),
      status,
      error: readProviderError(payload),
    };
  }
  if (['success', 'succeed', 'completed', 'done'].includes(status)) {
    const primary = readString(payload.imageUrl);
    const providerUrls = Array.isArray(payload.imageUrls)
      ? payload.imageUrls
          .map((item) =>
            isRecord(item) ? readString(item.url) : readString(item)
          )
          .filter((url): url is string => Boolean(url))
      : [];
    const ordered = providerUrls.filter(
      (url, index, values) => values.indexOf(url) === index
    );
    if (primary && !ordered.includes(primary)) {
      ordered.unshift(primary);
    }
    return {
      state: 'completed',
      progress: 100,
      status,
      artifacts: normalizeImageArtifacts(ordered),
    };
  }
  return {
    state: 'pending',
    progress: readProgress(payload.progress, 10),
    status,
  };
}

function parseFluxResponse(payload: UnknownRecord): ParsedPollResponse {
  const rawStatus = readString(payload.status) || 'unknown';
  const status = rawStatus.toLowerCase();
  if (status === 'error' || status === 'failed') {
    return {
      state: 'failed',
      progress: 0,
      status: rawStatus,
      error: readProviderError(payload),
    };
  }
  if (status === 'ready' || status === 'completed') {
    const result = isRecord(payload.result) ? payload.result : {};
    const url = readString(result.sample) || readString(payload.url);
    return {
      state: 'completed',
      progress: 100,
      status: rawStatus,
      artifacts: normalizeImageArtifacts(url ? [url] : []),
    };
  }
  return { state: 'pending', progress: 10, status: rawStatus };
}

const POLL_RESPONSE_PARSERS: Readonly<Record<string, PollResponseParser>> = {
  'openai.async.task': parseOpenAIAsyncResponse,
  'mj.task.status': parseMJResponse,
  'flux.task.status': parseFluxResponse,
};

function resolvePollResponseParser(responseSchema: string): PollResponseParser {
  const parser = POLL_RESPONSE_PARSERS[responseSchema];
  if (!parser) {
    throw new ImageInvocationError(
      'IMAGE_RECOVERY_FAILED',
      `没有图片恢复解析器: ${responseSchema}`,
      { stage: 'recovery', details: { responseSchema } }
    );
  }
  return parser;
}

function parsePollResponse(
  parser: PollResponseParser,
  responseSchema: string,
  payload: unknown
): ParsedPollResponse {
  if (!isRecord(payload)) {
    throw new ImageInvocationError(
      'IMAGE_RESULT_INVALID',
      '图片轮询响应格式无效',
      { stage: 'result', details: { responseSchema } }
    );
  }
  return parser(payload);
}

function splitRequestTarget(resolvedPath: string): {
  path: string;
  query?: Record<string, string>;
} {
  const queryIndex = resolvedPath.indexOf('?');
  if (queryIndex < 0) {
    return { path: resolvedPath };
  }
  return {
    path: resolvedPath.slice(0, queryIndex),
    query: Object.fromEntries(
      new URLSearchParams(resolvedPath.slice(queryIndex + 1)).entries()
    ),
  };
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  throw new DOMException('Aborted', 'AbortError');
}

function waitForPoll(interval: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, interval);
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new DOMException('Aborted', 'AbortError')
      );
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * The single polling implementation used both immediately after submission
 * and after a page refresh. Parsing is selected exclusively by the persisted
 * binding response schema.
 */
export async function pollImageInvocationBinding(
  invocation: ImagePollingInvocation,
  remoteId: string,
  options: ResumeImagePollingOptions = {}
): Promise<readonly ImageArtifact[]> {
  if (!remoteId.trim()) {
    throw new ImageInvocationError(
      'IMAGE_RECOVERY_FAILED',
      '图片恢复缺少 remoteId',
      { stage: 'recovery' }
    );
  }
  if (!invocation.binding.pollPathTemplate?.trim()) {
    throw new ImageInvocationError(
      'IMAGE_RECOVERY_FAILED',
      `图片 binding 缺少轮询路径: ${invocation.binding.id}`,
      {
        stage: 'recovery',
        details: { bindingId: invocation.binding.id },
      }
    );
  }

  const interval = Math.max(0, options.interval ?? 5000);
  const maxAttempts = Math.max(1, options.maxAttempts ?? 180);
  // Resolve the parser before the first request. Unsupported snapshots must
  // fail closed instead of probing an endpoint with an unknown contract.
  const parseResponse = resolvePollResponseParser(
    invocation.binding.responseSchema
  );
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    throwIfAborted(options.signal);
    const resolvedPath = resolveProviderBindingPollPath(
      invocation.binding,
      remoteId,
      invocation.binding.pollPathTemplate
    );
    const target = splitRequestTarget(resolvedPath);
    options.telemetry?.increment('pollRequests');
    const sendPollRequest = () =>
      providerTransport.send(invocation.provider, {
        path: target.path,
        query: target.query,
        baseUrlStrategy: invocation.binding.baseUrlStrategy,
        authQueryKey: resolveProviderBindingAuthQueryKey(invocation.binding),
        method: invocation.binding.pollMethod,
        signal: options.signal,
        fetcher: options.fetcher,
      });
    const response = options.telemetry
      ? await options.telemetry.measure('poll', sendPollRequest)
      : await sendPollRequest();
    if (!response.ok) {
      throw new ImageInvocationError(
        'IMAGE_PROVIDER_REJECTED',
        `图片任务查询失败: HTTP ${response.status}`,
        {
          stage: 'polling',
          retryable: response.status >= 500,
          details: {
            bindingId: invocation.binding.id,
            httpStatus: response.status,
          },
        }
      );
    }

    options.telemetry?.increment('responseParses');
    const parseProviderResponse = async () => {
      const payload = await response.json();
      throwIfAborted(options.signal);
      try {
        return parsePollResponse(
          parseResponse,
          invocation.binding.responseSchema,
          payload
        );
      } catch (error) {
        if (
          error instanceof ImageArtifactError &&
          error.code === 'IMAGE_ARTIFACT_EMPTY_RESULT'
        ) {
          throw new ImageInvocationError(
            'IMAGE_RESULT_INVALID',
            '图片任务完成但未返回有效结果',
            {
              stage: 'result',
              cause: error,
              details: {
                bindingId: invocation.binding.id,
                responseSchema: invocation.binding.responseSchema,
              },
            }
          );
        }
        throw error;
      }
    };
    const parsed = options.telemetry
      ? await options.telemetry.measure(
          'responseParsing',
          parseProviderResponse
        )
      : await parseProviderResponse();
    options.onProgress?.(parsed.progress, parsed.status);
    throwIfAborted(options.signal);
    if (parsed.state === 'completed') {
      if (!parsed.artifacts?.length) {
        throw new ImageInvocationError(
          'IMAGE_RESULT_INVALID',
          '图片任务完成但未返回有效结果',
          {
            stage: 'result',
            details: {
              bindingId: invocation.binding.id,
              responseSchema: invocation.binding.responseSchema,
            },
          }
        );
      }
      return parsed.artifacts;
    }
    if (parsed.state === 'failed') {
      throw new ImageInvocationError(
        'IMAGE_PROVIDER_REJECTED',
        parsed.error || '图片任务失败',
        {
          stage: 'polling',
          details: {
            bindingId: invocation.binding.id,
            status: parsed.status,
          },
        }
      );
    }

    if (attempt + 1 < maxAttempts) {
      await waitForPoll(interval, options.signal);
    }
  }

  throw new ImageInvocationError('IMAGE_TIMEOUT', '图片任务轮询超时', {
    stage: 'polling',
    retryable: true,
    details: { bindingId: invocation.binding.id },
  });
}

export function resumeImageInvocationPolling(
  plan: InvocationPlan,
  remoteId: string,
  options: ResumeImagePollingOptions = {}
): Promise<readonly ImageArtifact[]> {
  return pollImageInvocationBinding(plan, remoteId, options);
}
