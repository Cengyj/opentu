import {
  base64ToBlob,
  getFileExtension,
  normalizeImageDataUrl,
} from '@aitu/utils';
import {
  resolveOfficialGPTImageQuality,
  resolveOfficialGPTImageEditSize,
  resolveOfficialGPTImageSize,
} from './image-size-quality-resolver';
import { requireImageBinding, sendAdapterRequest } from './context';
import { registerModelAdapter } from './registry';
import { parseOpenAIImageArtifacts } from '../image-invocation/artifacts';
import { createImageProviderRejectionError } from '../image-invocation/errors';
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageModelAdapter,
} from './types';

const GPT_IMAGE_OUTPUT_FORMATS = new Set(['png', 'jpeg', 'webp']);
const GPT_IMAGE_BACKGROUND_VALUES = new Set(['transparent', 'opaque', 'auto']);
const GPT_IMAGE_MODERATION_VALUES = new Set(['low', 'auto']);
const GPT_IMAGE_INPUT_FIDELITY_VALUES = new Set(['high', 'low']);

type GPTImageSerializationRequest = Omit<
  ImageGenerationRequest,
  'operationIntent'
>;

function setAllowedStringValue(
  body: Record<string, unknown>,
  key: string,
  value: string | undefined,
  allowed: Set<string>
): void {
  if (value && allowed.has(value)) {
    body[key] = value;
  }
}

function applyCommonGPTImageOptions(
  body: Record<string, unknown>,
  request: GPTImageSerializationRequest,
  mode: 'generation' | 'edit' = 'generation'
): void {
  const resolutionOptions = {
    resolution: request.resolution,
    quality: request.quality,
  };
  const size =
    mode === 'edit'
      ? resolveOfficialGPTImageEditSize(
          request.model,
          request.size,
          resolutionOptions
        )
      : resolveOfficialGPTImageSize(
          request.model,
          request.size,
          resolutionOptions
        );
  const quality = resolveOfficialGPTImageQuality({ quality: request.quality });
  const n = request.count;
  const outputCompression = request.outputCompression;

  if (size) {
    body.size = size;
  }
  if (n !== undefined && n >= 1 && n <= 10) {
    body.n = n;
  }
  if (
    outputCompression !== undefined &&
    outputCompression >= 0 &&
    outputCompression <= 100
  ) {
    body.output_compression = outputCompression;
  }
  if (request.user) {
    body.user = request.user;
  }
  if (quality) {
    body.quality = quality;
  }

  setAllowedStringValue(
    body,
    'output_format',
    request.outputFormat,
    GPT_IMAGE_OUTPUT_FORMATS
  );
  setAllowedStringValue(
    body,
    'background',
    request.background,
    GPT_IMAGE_BACKGROUND_VALUES
  );
  setAllowedStringValue(
    body,
    'moderation',
    request.moderation,
    GPT_IMAGE_MODERATION_VALUES
  );
}

export function buildGPTImageGenerationBody(
  request: GPTImageSerializationRequest
): Record<string, unknown> {
  if (!request.model) {
    throw new Error('GPT Image 请求缺少模型 ID');
  }

  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
  };
  if (request.responseFormat) {
    body.response_format = request.responseFormat;
  }

  applyCommonGPTImageOptions(body, request, 'generation');

  return body;
}

function appendFormValue(
  formData: FormData,
  key: string,
  value: unknown
): void {
  if (value === undefined || value === null) {
    return;
  }
  formData.append(key, String(value));
}

function getBlobExtension(blob: Blob, source: string): string {
  const sourceExtension = getFileExtension(source, blob.type);
  if (sourceExtension && sourceExtension !== 'bin') {
    return sourceExtension;
  }

  const mimeExtension = getFileExtension('', blob.type || 'image/png');
  return mimeExtension === 'bin' ? 'png' : mimeExtension;
}

async function imageInputToBlob(
  value: string,
  filenamePrefix: string,
  fetcher: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<{ blob: Blob; filename: string }> {
  throwIfAborted(signal);
  const normalized = normalizeImageDataUrl(value, 'image/png');

  if (normalized.startsWith('data:')) {
    const blob = base64ToBlob(normalized);
    return {
      blob,
      filename: `${filenamePrefix}.${getBlobExtension(blob, normalized)}`,
    };
  }

  const response = signal
    ? await fetcher(normalized, { signal })
    : await fetcher(normalized);
  if (!response.ok) {
    throw new Error(
      `GPT Image 编辑图片读取失败: ${response.status} ${response.statusText}`
    );
  }

  const blob = await response.blob();
  const formDataBlob = new Blob([await blob.arrayBuffer()], {
    type: blob.type || 'image/png',
  });
  return {
    blob: formDataBlob,
    filename: `${filenamePrefix}.${getBlobExtension(formDataBlob, normalized)}`,
  };
}

export async function buildGPTImageEditFormData(
  request: GPTImageSerializationRequest,
  fetcher?: typeof fetch,
  signal?: AbortSignal
): Promise<FormData> {
  throwIfAborted(signal);
  if (!request.model) {
    throw new Error('GPT Image 编辑请求缺少模型 ID');
  }

  const referenceImages = request.referenceImages || [];
  if (referenceImages.length === 0) {
    throw new Error('GPT Image 编辑请求缺少参考图片');
  }

  const fields: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
  };

  setAllowedStringValue(
    fields,
    'input_fidelity',
    request.inputFidelity,
    GPT_IMAGE_INPUT_FIDELITY_VALUES
  );
  applyCommonGPTImageOptions(fields, request, 'edit');

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    appendFormValue(formData, key, value);
  }

  for (let index = 0; index < referenceImages.length; index += 1) {
    const referenceImage = referenceImages[index];
    if (!referenceImage) {
      continue;
    }
    const { blob, filename } = await imageInputToBlob(
      referenceImage,
      `image-${index + 1}`,
      fetcher,
      signal
    );
    formData.append('image[]', blob, filename);
  }

  if (request.maskImage) {
    const { blob, filename } = await imageInputToBlob(
      request.maskImage,
      'mask',
      fetcher,
      signal
    );
    formData.append('mask', blob, filename);
  }

  return formData;
}

function resolveGPTImageEditMode(
  binding: { requestSchema: string; protocol: string },
  request: ImageGenerationRequest
): boolean {
  if (
    request.operationIntent !== 'generation' &&
    request.operationIntent !== 'edit'
  ) {
    throw new Error('GPT Image adapter 缺少已解析 operationIntent');
  }

  const bindingIsEdit =
    binding.protocol === 'openai.images.edits' &&
    binding.requestSchema === 'openai.image.gpt-edit-form';

  const bindingIsGeneration =
    binding.protocol === 'openai.images.generations' &&
    binding.requestSchema === 'openai.image.gpt-generation-json';

  if (!bindingIsEdit && !bindingIsGeneration) {
    throw new Error(
      `GPT Image adapter 不支持 binding schema: ${
        binding.requestSchema || 'unknown'
      }`
    );
  }

  if ((request.operationIntent === 'edit') !== bindingIsEdit) {
    throw new Error(
      `GPT Image 请求意图与已选 binding 不一致: ${
        binding.requestSchema || 'unknown'
      }`
    );
  }

  return bindingIsEdit;
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

export function parseGPTImageResponse(
  response: unknown,
  fallbackFormat?: string
): ImageGenerationResult {
  const defaultMimeType = fallbackFormat
    ? fallbackFormat.startsWith('image/')
      ? fallbackFormat
      : `image/${fallbackFormat}`
    : undefined;
  return {
    artifacts: parseOpenAIImageArtifacts(response, { defaultMimeType }),
  };
}

export const gptImageAdapter: ImageModelAdapter = {
  id: 'gpt-image-adapter',
  label: 'GPT Image',
  kind: 'image',
  docsUrl: 'https://platform.openai.com/docs/api-reference/images',
  matchRequestSchemas: [
    'openai.image.gpt-generation-json',
    'openai.image.gpt-edit-form',
  ],
  defaultModel: 'gpt-image-2',
  async generateImage(context, request) {
    throwIfAborted(request.signal);
    const binding = requireImageBinding(context, request, {
      adapterLabel: 'GPT Image adapter',
    });
    const isEditRequest = resolveGPTImageEditMode(binding, request);
    const editFormData = isEditRequest
      ? await buildGPTImageEditFormData(
          request,
          context.fetcher,
          request.signal
        )
      : null;
    const generationBody = isEditRequest
      ? null
      : buildGPTImageGenerationBody(request);
    const outputFormat = editFormData
      ? (editFormData.get('output_format') as string | null) || undefined
      : typeof generationBody?.output_format === 'string'
      ? generationBody.output_format
      : undefined;
    request.telemetry?.increment('submitRequests');
    const submit = () =>
      sendAdapterRequest(context, {
        path: binding.submitPath,
        baseUrlStrategy: binding.baseUrlStrategy,
        method: binding.submitMethod,
        headers: isEditRequest
          ? undefined
          : {
              'Content-Type': 'application/json',
            },
        body: editFormData || JSON.stringify(generationBody),
        signal: request.signal,
      });
    const response = request.telemetry
      ? await request.telemetry.measure('submit', submit)
      : await submit();

    if (!response.ok) {
      throw await createImageProviderRejectionError(response, {
        bindingId: binding.id,
        label: 'GPT Image 请求失败',
      });
    }

    request.telemetry?.increment('responseParses');
    const parseResponse = async () => {
      const result = await response.json();
      return parseGPTImageResponse(result, outputFormat);
    };
    return request.telemetry
      ? request.telemetry.measure('responseParsing', parseResponse)
      : parseResponse();
  },
};

export const registerGPTImageAdapter = (): void => {
  registerModelAdapter(gptImageAdapter);
};
