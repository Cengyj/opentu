/**
 * Async Image API Service
 *
 * Handles async image generation for nano-banana-pro models (异步香蕉格式)。
 * 提交任务后通过轮询查询结果，返回图片下载链接。
 */

import { normalizeImageDataUrl } from '@aitu/utils';
import {
  providerTransport,
  resolveProviderBindingAuthQueryKey,
  type ProviderModelBinding,
  type ResolvedProviderContext,
} from './provider-routing';
import { IMAGE_GENERATION_TIMEOUT_MS } from '../constants/TASK_CONSTANTS';
import { pollImageInvocationBinding } from './image-invocation/resume-polling';
import type { ImageArtifact } from './image-invocation/artifacts';
import type { ImageInvocationTelemetry } from './image-invocation/performance';
import { createImageProviderRejectionError } from './image-invocation/errors';

export interface AsyncImageGenerationParams {
  model: string;
  prompt: string;
  size?: string; // 接口的尺寸/比例字段（枚举 1:1、4:5 等）
  referenceImages?: string[];
  maskImage?: string;
}

export interface AsyncImageSubmitResponse {
  id: string;
  object: string;
  model: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  created_at: number;
  error?: string | { code: string; message: string };
}

interface PollingOptions {
  interval?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number, status: string) => void;
  onSubmitted?: (taskId: string) => void | Promise<void>;
  telemetry?: ImageInvocationTelemetry;
  invocation: ResolvedAsyncImageInvocation;
}

export interface ResolvedAsyncImageInvocation {
  provider: ResolvedProviderContext;
  binding: ProviderModelBinding;
  fetcher?: typeof fetch;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  if (signal.reason instanceof Error) {
    throw signal.reason;
  }

  const error = new Error('Async image generation cancelled');
  error.name = 'AbortError';
  throw error;
}

function assertAsyncBindingContract(binding: ProviderModelBinding): void {
  if (!binding.submitPath?.trim()) {
    throw new Error(`异步图片 binding 缺少 submitPath: ${binding.id}`);
  }
  if (!binding.pollPathTemplate?.trim()) {
    throw new Error(`异步图片 binding 缺少 pollPathTemplate: ${binding.id}`);
  }
}

function readSubmitErrorMessage(
  error: AsyncImageSubmitResponse['error']
): string {
  if (typeof error === 'string') {
    return error.trim() || '图片生成失败';
  }
  if (error) {
    return error.message.trim() || error.code.trim() || '图片生成失败';
  }
  return '图片生成失败';
}

function splitRequestTarget(resolvedPath: string): {
  path: string;
  query?: Record<string, string>;
} {
  const queryIndex = resolvedPath.indexOf('?');
  if (queryIndex < 0) {
    return { path: resolvedPath };
  }

  const path = resolvedPath.slice(0, queryIndex);
  const query = Object.fromEntries(
    new URLSearchParams(resolvedPath.slice(queryIndex + 1)).entries()
  );
  return { path, query };
}

async function appendReferenceImage(
  formData: FormData,
  field: 'input_reference' | 'mask',
  value: string,
  index: number,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  const normalized = normalizeImageDataUrl(value);
  try {
    const match = normalized.match(/^data:([^;,]+)?;base64,(.*)$/);
    if (match) {
      const mimeType = match[1] || 'image/png';
      const binary = atob(match[2]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      formData.append(
        field,
        new Blob([bytes], { type: mimeType }),
        field === 'mask' ? 'mask.png' : `reference-${index + 1}.png`
      );
      return;
    }
  } catch {
    // Fall back to raw value below; provider gateway can still resolve URLs.
  }

  formData.append(field, normalized);
}

class AsyncImageAPIService {
  private async submit(
    params: AsyncImageGenerationParams,
    invocation: ResolvedAsyncImageInvocation,
    signal?: AbortSignal,
    telemetry?: ImageInvocationTelemetry
  ): Promise<AsyncImageSubmitResponse> {
    throwIfAborted(signal);
    assertAsyncBindingContract(invocation.binding);
    const providerContext = invocation.provider;

    if (!providerContext.apiKey) {
      throw new Error('API Key 未配置');
    }

    const formData = new FormData();
    formData.append('model', invocation.binding.modelId || params.model);
    formData.append('prompt', params.prompt);
    if (params.size) {
      formData.append('size', params.size);
    }
    if (params.referenceImages?.length) {
      for (const [index, referenceImage] of params.referenceImages.entries()) {
        await appendReferenceImage(
          formData,
          'input_reference',
          referenceImage,
          index,
          signal
        );
      }
    }
    if (params.maskImage) {
      await appendReferenceImage(formData, 'mask', params.maskImage, 0, signal);
    }

    throwIfAborted(signal);

    const submitTarget = splitRequestTarget(invocation.binding.submitPath);
    telemetry?.increment('submitRequests');
    const submit = () =>
      providerTransport.send(providerContext, {
        path: submitTarget.path,
        query: submitTarget.query,
        baseUrlStrategy: invocation.binding.baseUrlStrategy,
        authQueryKey: resolveProviderBindingAuthQueryKey(invocation.binding),
        method: invocation.binding.submitMethod,
        body: formData,
        signal,
        fetcher: invocation.fetcher,
        timeoutMs: IMAGE_GENERATION_TIMEOUT_MS,
      });
    const response = telemetry
      ? await telemetry.measure('submit', submit)
      : await submit();

    if (!response.ok) {
      throw await createImageProviderRejectionError(response, {
        bindingId: invocation.binding.id,
        label: '异步图片任务提交失败',
      });
    }

    telemetry?.increment('responseParses');
    const parseResponse = () => response.json();
    return telemetry
      ? telemetry.measure('responseParsing', parseResponse)
      : parseResponse();
  }

  async generateWithPolling(
    params: AsyncImageGenerationParams,
    options: PollingOptions
  ): Promise<readonly ImageArtifact[]> {
    if (!options?.invocation) {
      throw new Error('异步图片执行缺少已规划 binding');
    }
    const {
      interval = 5000,
      maxAttempts,
      signal,
      onProgress,
      onSubmitted,
    } = options;
    const invocation = options.invocation;
    assertAsyncBindingContract(invocation.binding);
    const submitResp = await this.submit(
      params,
      invocation,
      signal,
      options.telemetry
    );

    await onSubmitted?.(submitResp.id);
    throwIfAborted(signal);

    if (onProgress) {
      onProgress(submitResp.progress ?? 0, submitResp.status);
    }

    if (submitResp.status === 'failed') {
      throw new Error(readSubmitErrorMessage(submitResp.error));
    }

    return pollImageInvocationBinding(invocation, submitResp.id, {
      interval,
      maxAttempts,
      signal,
      fetcher: invocation.fetcher,
      onProgress,
      telemetry: options.telemetry,
    });
  }
}

export const asyncImageAPIService = new AsyncImageAPIService();
