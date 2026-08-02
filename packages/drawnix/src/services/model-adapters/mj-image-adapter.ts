import type {
  AdapterContext,
  ImageGenerationRequest,
  ImageModelAdapter,
} from './types';
import { registerModelAdapter } from './registry';
import {
  buildProviderContextFromAdapterContext,
  requireImageBinding,
  sendAdapterRequest,
} from './context';
import { IMAGE_GENERATION_TIMEOUT_MS } from '../../constants/TASK_CONSTANTS';
import { ModelVendor } from '../../constants/model-config';
import type { ProviderModelBinding } from '../provider-routing';
import { pollImageInvocationBinding } from '../image-invocation/resume-polling';
import { createImageProviderRejectionError } from '../image-invocation/errors';

type MJSubmitResponse = {
  code: number;
  description: string;
  result: number | string;
};

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_POLL_MAX_ATTEMPTS = Math.ceil(
  IMAGE_GENERATION_TIMEOUT_MS / DEFAULT_POLL_INTERVAL_MS
);
const MJ_BINDING_CONTRACTS = [
  {
    protocol: 'mj.imagine',
    requestSchema: 'mj.imagine.base64-array',
  },
] as const;

const MJ_PROMPT_PARAMETER_TOKENS = Object.freeze({
  mj_ar: '--ar',
  mj_v: '--v',
  mj_style: '--style',
  mj_s: '--s',
  mj_q: '--q',
  mj_seed: '--seed',
} as const);

type MJBinding = ProviderModelBinding & {
  readonly submitPath: string;
  readonly pollPathTemplate: string;
};

const stripDataUrlPrefix = (value: string): string => {
  const match = value.match(/^data:[^;]+;base64,(.*)$/);
  return match ? match[1] : value;
};

/** Serialize MJ-only prompt switches at the binding-owned adapter boundary. */
function serializeMJPrompt(
  prompt: string,
  params: Readonly<Record<string, unknown>> | undefined
): string {
  if (!params) {
    return prompt;
  }

  const suffix = Object.entries(MJ_PROMPT_PARAMETER_TOKENS)
    .flatMap(([key, token]) => {
      const rawValue = params[key];
      const value =
        typeof rawValue === 'string'
          ? rawValue.trim()
          : typeof rawValue === 'number' && Number.isFinite(rawValue)
          ? String(rawValue)
          : '';
      return !value || value === 'default' ? [] : [`${token} ${value}`];
    })
    .join(' ');

  if (!suffix || prompt.trimEnd().endsWith(suffix)) {
    return prompt;
  }
  return [prompt.trim(), suffix].filter(Boolean).join(' ');
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

const submitMJImagine = async (
  context: AdapterContext,
  binding: MJBinding,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<Response> => {
  throwIfAborted(signal);
  const response = await sendAdapterRequest(context, {
    path: binding.submitPath,
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
      label: 'MJ 提交失败',
    });
  }

  return response;
};

export const mjImageAdapter: ImageModelAdapter = {
  id: 'mj-image-adapter',
  label: 'Midjourney Image',
  kind: 'image',
  docsUrl: 'https://foropencode.com',
  matchProtocols: ['mj.imagine'],
  matchRequestSchemas: ['mj.imagine.base64-array'],
  matchVendors: [ModelVendor.MIDJOURNEY],
  matchTags: ['mj'],
  supportedModels: ['mj-imagine'],
  defaultModel: 'mj-imagine',
  async generateImage(context, request: ImageGenerationRequest) {
    throwIfAborted(request.signal);
    const binding = requireImageBinding(context, request, {
      adapterLabel: 'MJ adapter',
      requirePollPath: true,
      supportedBindings: MJ_BINDING_CONTRACTS,
    });

    const base64Array = (request.referenceImages || []).map((img) =>
      stripDataUrlPrefix(img)
    );

    const onProgress = request.onProgress;
    const onSubmitted = request.onSubmitted;

    onProgress?.(5, 'submitting');

    request.telemetry?.increment('submitRequests');
    const submit = () =>
      submitMJImagine(
        context,
        binding,
        {
          botType: 'MID_JOURNEY',
          prompt: serializeMJPrompt(request.prompt, request.params),
          base64Array,
        },
        request.signal
      );
    const submitHttpResponse = request.telemetry
      ? await request.telemetry.measure('submit', submit)
      : await submit();
    request.telemetry?.increment('responseParses');
    const parseSubmitResponse = () =>
      submitHttpResponse.json() as Promise<MJSubmitResponse>;
    const submitResponse = request.telemetry
      ? await request.telemetry.measure(
          'responseParsing',
          parseSubmitResponse
        )
      : await parseSubmitResponse();

    const taskId = submitResponse.result?.toString();
    if (!taskId) {
      throw new Error('MJ submit missing task id');
    }

    await onSubmitted?.(taskId);
    throwIfAborted(request.signal);
    onProgress?.(10, 'processing');

    const artifacts = await pollImageInvocationBinding(
      {
        provider: buildProviderContextFromAdapterContext(context),
        binding,
      },
      taskId,
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

export const registerMJImageAdapter = (): void => {
  registerModelAdapter(mjImageAdapter);
};
