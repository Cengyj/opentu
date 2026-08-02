import type {
  AdapterContext,
  ImageGenerationRequest,
  ImageModelAdapter,
} from './types';
import { registerModelAdapter } from './registry';
import { ModelVendor } from '../../constants/model-config';
import {
  buildProviderContextFromAdapterContext,
  requireImageBinding,
  sendAdapterRequest,
} from './context';
import { IMAGE_GENERATION_TIMEOUT_MS } from '../../constants/TASK_CONSTANTS';
import type { ProviderModelBinding } from '../provider-routing';
import { pollImageInvocationBinding } from '../image-invocation/resume-polling';
import { createImageProviderRejectionError } from '../image-invocation/errors';

type FluxSubmitResponse = {
  id: string;
  polling_url?: string;
};

const FLUX_MODELS = [
  'bfl-flux-2-pro',
  'bfl-flux-2-max',
  'bfl-flux-2-flex',
  'flux-kontext-pro',
  'flux-kontext-max',
];

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_POLL_MAX_ATTEMPTS = Math.ceil(
  IMAGE_GENERATION_TIMEOUT_MS / DEFAULT_POLL_INTERVAL_MS
);
const FLUX_BINDING_CONTRACTS = [
  {
    protocol: 'flux.task',
    requestSchema: 'flux.image.polling-json',
  },
] as const;

type FluxBinding = ProviderModelBinding & {
  readonly submitPath: string;
  readonly pollPathTemplate: string;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  if (signal.reason instanceof Error) {
    throw signal.reason;
  }

  throw new DOMException('Aborted', 'AbortError');
}

function resolveFluxSubmitPath(path: string, model: string): string {
  return path.replace(/\{model\}/g, encodeURIComponent(model));
}

/**
 * 宽高比 → Flux 像素尺寸映射（均为 16 的倍数）
 */
const ASPECT_RATIO_TO_DIMENSIONS: Record<
  string,
  { width: number; height: number }
> = {
  '1:1': { width: 1024, height: 1024 },
  '1x1': { width: 1024, height: 1024 },
  '2:3': { width: 832, height: 1248 },
  '2x3': { width: 832, height: 1248 },
  '3:2': { width: 1248, height: 832 },
  '3x2': { width: 1248, height: 832 },
  '3:4': { width: 768, height: 1024 },
  '3x4': { width: 768, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '4x3': { width: 1024, height: 768 },
  '4:5': { width: 832, height: 1040 },
  '4x5': { width: 832, height: 1040 },
  '5:4': { width: 1040, height: 832 },
  '5x4': { width: 1040, height: 832 },
  '9:16': { width: 720, height: 1280 },
  '9x16': { width: 720, height: 1280 },
  '16:9': { width: 1280, height: 720 },
  '16x9': { width: 1280, height: 720 },
  '21:9': { width: 1344, height: 576 },
  '21x9': { width: 1344, height: 576 },
};

/**
 * 将 size 参数解析为 Flux 需要的 width/height
 * size 可能是比例 token（如 "16x9"）或实际像素（如 "1280x720"）
 */
const resolveFluxDimensions = (
  size?: string
): { width: number; height: number } | undefined => {
  if (!size) return undefined;

  // 先查比例映射表
  const mapped = ASPECT_RATIO_TO_DIMENSIONS[size];
  if (mapped) return mapped;

  // 尝试解析为实际像素值
  if (!size.includes('x')) return undefined;
  const [wStr, hStr] = size.split('x');
  const w = Number(wStr);
  const h = Number(hStr);
  if (!w || !h) return undefined;

  // 确保是 16 的倍数
  return {
    width: Math.round(w / 16) * 16,
    height: Math.round(h / 16) * 16,
  };
};

/**
 * 提交 Flux 图片生成任务
 */
const submitFluxImage = async (
  context: AdapterContext,
  binding: FluxBinding,
  model: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Response> => {
  throwIfAborted(signal);
  const response = await sendAdapterRequest(context, {
    path: resolveFluxSubmitPath(binding.submitPath, model),
    baseUrlStrategy: binding.baseUrlStrategy,
    method: binding.submitMethod,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw await createImageProviderRejectionError(response, {
      bindingId: binding.id,
      label: 'Flux 提交失败',
    });
  }

  return response;
};

export const fluxImageAdapter: ImageModelAdapter = {
  id: 'flux-image-adapter',
  label: 'Flux Image',
  kind: 'image',
  docsUrl: 'https://foropencode.com',
  matchProtocols: ['flux.task'],
  matchRequestSchemas: ['flux.image.polling-json'],
  matchVendors: [ModelVendor.FLUX],
  supportedModels: FLUX_MODELS,
  defaultModel: 'bfl-flux-2-flex',

  async generateImage(context, request: ImageGenerationRequest) {
    throwIfAborted(request.signal);
    const binding = requireImageBinding(context, request, {
      adapterLabel: 'Flux adapter',
      requirePollPath: true,
      supportedBindings: FLUX_BINDING_CONTRACTS,
    });
    const model = binding.modelId;
    const dimensions = resolveFluxDimensions(request.size);

    // 构建请求体
    const body: Record<string, unknown> = {
      prompt: request.prompt,
      output_format: 'png',
    };

    if (dimensions) {
      body.width = dimensions.width;
      body.height = dimensions.height;
    }

    // 参考图：input_image, input_image_2 ... input_image_8
    if (request.referenceImages && request.referenceImages.length > 0) {
      request.referenceImages.forEach((img, index) => {
        if (index === 0) {
          body.input_image = img;
        } else if (index <= 7) {
          body[`input_image_${index + 1}`] = img;
        }
      });
    }

    // 通知提交中
    const onProgress = request.onProgress;
    const onSubmitted = request.onSubmitted;

    onProgress?.(5, 'submitting');

    // 提交任务
    request.telemetry?.increment('submitRequests');
    const submit = () =>
      submitFluxImage(
        context,
        binding,
        model,
        body,
        request.signal
      );
    const submitHttpResponse = request.telemetry
      ? await request.telemetry.measure('submit', submit)
      : await submit();
    request.telemetry?.increment('responseParses');
    const parseSubmitResponse = () =>
      submitHttpResponse.json() as Promise<FluxSubmitResponse>;
    const submitResult = request.telemetry
      ? await request.telemetry.measure(
          'responseParsing',
          parseSubmitResponse
        )
      : await parseSubmitResponse();
    const remoteId = submitResult.id;

    if (!remoteId) {
      throw new Error('Flux API 未返回任务 ID');
    }

    await onSubmitted?.(remoteId);
    throwIfAborted(request.signal);
    onProgress?.(10, 'processing');

    const artifacts = await pollImageInvocationBinding(
      {
        provider: buildProviderContextFromAdapterContext(context),
        binding,
      },
      remoteId,
      {
        interval: request.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        maxAttempts:
          request.pollMaxAttempts ?? DEFAULT_POLL_MAX_ATTEMPTS,
        signal: request.signal,
        fetcher: context.fetcher,
        telemetry: request.telemetry,
        onProgress,
      }
    );
    return { artifacts };
  },
};

export const registerFluxAdapter = (): void => {
  registerModelAdapter(fluxImageAdapter);
};
