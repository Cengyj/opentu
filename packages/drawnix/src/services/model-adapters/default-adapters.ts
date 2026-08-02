import { defaultGeminiClient } from '../../utils/gemini-api';
import { asyncImageAPIService } from '../async-image-api-service';
import {
  audioAPIService,
  extractAudioGenerationResult,
} from '../audio-api-service';
import { videoAPIService } from '../video-api-service';
import {
  DEFAULT_AUDIO_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_VIDEO_MODEL_ID,
  AUDIO_MODELS,
  IMAGE_MODEL_MORE_OPTIONS,
  IMAGE_MODEL_VIP_OPTIONS,
  VIDEO_MODELS,
  ModelVendor,
} from '../../constants/model-config';
import type { UploadedVideoImage } from '../../types/video.types';
import type {
  AudioModelAdapter,
  AudioGenerationRequest,
  AdapterContext,
  ImageModelAdapter,
  VideoModelAdapter,
  ImageGenerationRequest,
  VideoGenerationRequest,
} from './types';
import { registerModelAdapter } from './registry';
import { registerKlingAdapter } from './kling-adapter';
import { registerHappyHorseAdapter } from './happyhorse-adapter';
import { registerMJImageAdapter } from './mj-image-adapter';
import { registerFluxAdapter } from './flux-adapter';
import { registerSeedreamAdapter } from './seedream-adapter';
import { registerSeedanceAdapter } from './seedance-adapter';
import { registerGPTImageAdapter } from './gpt-image-adapter';
import { normalizeImageResolutionTier } from './image-size-quality-resolver';
import {
  parseGeminiImageArtifacts,
  parseOpenAIImageArtifacts,
} from '../image-invocation/artifacts';
import {
  buildProviderContextFromAdapterContext,
  requireImageBinding,
} from './context';

const GEMINI_IMAGE_BINDING_CONTRACTS = [
  {
    protocol: 'openai.images.generations',
    requestSchema: 'openai.image.basic-json',
  },
  {
    protocol: 'openai.async.media',
    requestSchema: 'openai.async.image.form',
  },
  {
    protocol: 'google.generateContent',
    requestSchema: 'google.generate-content.image-inline',
  },
] as const;

const imageModelIds = [...IMAGE_MODEL_VIP_OPTIONS, ...IMAGE_MODEL_MORE_OPTIONS]
  .map((model) => model.id)
  .filter(
    (modelId) =>
      !modelId.startsWith('mj-') &&
      !modelId.startsWith('bfl-flux-') &&
      !modelId.startsWith('flux-kontext-') &&
      !modelId.includes('seedream') // 所有 Seedream 统一由 seedream-adapter 处理
  );

const videoModelIds = VIDEO_MODELS.map((model) => model.id).filter(
  (modelId) =>
    !modelId.startsWith('kling') &&
    !modelId.startsWith('seedance') &&
    !modelId.includes('happyhorse')
);

const audioModelIds = AUDIO_MODELS.map((model) => model.id);

const extractImageArtifacts = (
  response: unknown,
  binding: NonNullable<AdapterContext['binding']>
) =>
  binding.protocol === 'google.generateContent'
    ? parseGeminiImageArtifacts(response)
    : parseOpenAIImageArtifacts(response);

const toUploadedVideoImages = (
  referenceImages?: string[]
): UploadedVideoImage[] | undefined => {
  if (!referenceImages || referenceImages.length === 0) {
    return undefined;
  }

  return referenceImages.map((url, index) => ({
    slot: index,
    url,
    name: `reference-${index + 1}.png`,
  }));
};

function isAsyncImageBinding(
  binding: NonNullable<AdapterContext['binding']>
): boolean {
  return (
    binding.protocol === 'openai.async.media' &&
    binding.requestSchema === 'openai.async.image.form'
  );
}

export const geminiImageAdapter: ImageModelAdapter = {
  id: 'gemini-image-adapter',
  label: 'Gemini Image',
  kind: 'image',
  docsUrl: 'https://foropencode.com',
  matchProtocols: [
    'openai.images.generations',
    'openai.async.media',
    'google.generateContent',
  ],
  matchRequestSchemas: [
    'openai.image.basic-json',
    'openai.async.image.form',
    'google.generate-content.image-inline',
  ],
  matchVendors: [ModelVendor.GEMINI],
  supportedModels: imageModelIds,
  defaultModel: DEFAULT_IMAGE_MODEL_ID,
  async generateImage(context, request: ImageGenerationRequest) {
    const binding = requireImageBinding(context, request, {
      adapterLabel: 'Gemini Image adapter',
      requirePollPath:
        context.binding?.protocol === 'openai.async.media' ||
        context.binding?.requestSchema === 'openai.async.image.form',
      supportedBindings: GEMINI_IMAGE_BINDING_CONTRACTS,
    });
    const model = binding.modelId;

    if (isAsyncImageBinding(binding)) {
      const artifacts = await asyncImageAPIService.generateWithPolling(
        {
          model,
          prompt: request.prompt,
          size: request.size,
          referenceImages: request.referenceImages
            ? [...request.referenceImages]
            : undefined,
          maskImage: request.maskImage,
        },
        {
          interval: request.pollIntervalMs ?? 5000,
          maxAttempts: request.pollMaxAttempts,
          signal: request.signal,
          onProgress: request.onProgress,
          onSubmitted: request.onSubmitted,
          telemetry: request.telemetry,
          invocation: {
            provider: buildProviderContextFromAdapterContext(context),
            binding,
            fetcher: context.fetcher,
          },
        }
      );
      return { artifacts };
    }

    const serialization = binding.metadata?.image?.serialization;
    const quality =
      normalizeImageResolutionTier(request.resolution) ||
      normalizeImageResolutionTier(request.quality) ||
      normalizeImageResolutionTier(serialization?.defaultResolution);
    const responseFormat = request.responseFormat;

    const imageOptions: NonNullable<
      Parameters<typeof defaultGeminiClient.generateImage>[1]
    > = {
      size: request.size,
      image: request.referenceImages ? [...request.referenceImages] : undefined,
      omitDefaultResponseFormat:
        serialization?.omitDefaultResponseFormat === true,
      quality,
      count: request.count,
      model,
      modelRef: request.modelRef || null,
      signal: request.signal,
      invocationConfig: {
        apiKey: context.apiKey || '',
        baseUrl: context.baseUrl,
        modelName: binding.modelId,
        authType: context.authType,
        providerType: context.provider?.providerType || 'custom',
        extraHeaders: context.extraHeaders,
        protocol: binding.protocol,
        binding,
        provider: context.provider || null,
        fetcher: context.fetcher,
      },
    };
    if (responseFormat) {
      imageOptions.response_format = responseFormat;
    }

    request.telemetry?.increment('submitRequests');
    const submit = () =>
      defaultGeminiClient.generateImage(request.prompt, imageOptions);
    const result = request.telemetry
      ? await request.telemetry.measure('submit', submit)
      : await submit();

    request.telemetry?.increment('responseParses');
    const parseResult = () => ({
      artifacts: extractImageArtifacts(result, binding),
    });
    return request.telemetry
      ? request.telemetry.measureSync('responseParsing', parseResult)
      : parseResult();
  },
};

export const geminiVideoAdapter: VideoModelAdapter = {
  id: 'gemini-video-adapter',
  label: 'Gemini Video',
  kind: 'video',
  docsUrl: 'https://foropencode.com',
  matchProtocols: ['openai.async.video'],
  matchRequestSchemas: ['openai.video.form-input-reference'],
  matchPredicate(modelConfig) {
    if (modelConfig.type !== 'video') {
      return false;
    }
    const lowerId = modelConfig.id.toLowerCase();
    return (
      !lowerId.includes('kling') &&
      !lowerId.includes('seedance') &&
      !lowerId.includes('happyhorse')
    );
  },
  supportedModels: videoModelIds,
  defaultModel: DEFAULT_VIDEO_MODEL_ID,
  async generateVideo(_context, request: VideoGenerationRequest) {
    const model = (request.model || DEFAULT_VIDEO_MODEL_ID) as any;
    const durationEncoded =
      model && model.startsWith('sora-2-') && /\d+s$/.test(model);
    const adapterParams = request.params
      ? Object.fromEntries(
          Object.entries(request.params).filter(
            ([key]) => key !== 'onProgress' && key !== 'onSubmitted'
          )
        )
      : undefined;
    const seconds = durationEncoded
      ? undefined
      : request.duration
      ? String(request.duration)
      : model?.toString().startsWith('sora')
      ? undefined
      : '8';
    const size = request.size || '1280x720';
    const inputReferences = toUploadedVideoImages(request.referenceImages);

    const result = await videoAPIService.generateVideoWithPolling(
      {
        model,
        modelRef: request.modelRef || null,
        prompt: request.prompt,
        seconds,
        size,
        inputReferences,
        params: adapterParams,
      },
      {
        interval: 5000,
        onProgress: request.params?.onProgress as
          | ((progress: number, status?: string) => void)
          | undefined,
        onSubmitted: request.params?.onSubmitted as
          | ((videoId: string) => void)
          | undefined,
      }
    );

    const url = result.video_url || result.url;
    if (!url) {
      throw new Error('API 未返回有效的视频 URL');
    }

    return {
      url,
      format: 'mp4',
      duration: parseInt(result.seconds || seconds || '0', 10),
      raw: result,
    };
  },
};

export const sunoAudioAdapter: AudioModelAdapter = {
  id: 'suno-audio-adapter',
  label: 'Suno Audio',
  kind: 'audio',
  docsUrl: 'https://foropencode.com',
  matchProtocols: ['for.suno.music'],
  matchRequestSchemas: ['for.suno.music.submit'],
  matchModels: ['suno_music'],
  matchTags: ['suno', 'audio', 'music'],
  supportedModels: audioModelIds,
  defaultModel: DEFAULT_AUDIO_MODEL_ID,
  async generateAudio(_context, request: AudioGenerationRequest) {
    const result = await audioAPIService.generateAudioWithPolling(
      {
        model: request.model || DEFAULT_AUDIO_MODEL_ID,
        modelRef: request.modelRef || null,
        prompt: request.prompt,
        title: request.title,
        tags: request.tags,
        mv: request.mv,
        sunoAction: request.sunoAction,
        notifyHook: request.notifyHook,
        continueClipId: request.continueClipId,
        continueTaskId: request.continueTaskId,
        continueAt: request.continueAt,
        infillStartS: request.infillStartS,
        infillEndS: request.infillEndS,
        params: request.params,
      },
      {
        interval: 5000,
        onProgress: request.params?.onProgress as
          | ((progress: number, status?: string) => void)
          | undefined,
        onSubmitted: request.params?.onSubmitted as
          | ((taskId: string) => void)
          | undefined,
      }
    );

    return extractAudioGenerationResult(result);
  },
};

export function registerDefaultModelAdapters(): void {
  registerGPTImageAdapter();
  registerModelAdapter(geminiImageAdapter);
  registerHappyHorseAdapter();
  registerModelAdapter(geminiVideoAdapter);
  registerModelAdapter(sunoAudioAdapter);
  registerKlingAdapter();
  registerMJImageAdapter();
  registerFluxAdapter();
  registerSeedreamAdapter();
  registerSeedanceAdapter();
}
