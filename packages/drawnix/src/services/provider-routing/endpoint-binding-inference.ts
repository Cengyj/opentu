/**
 * 从 pricing API 的 endpoints 数据推断 binding 配置。
 * 纯函数，将 endpoint path 映射到已有的 protocol/requestSchema 体系。
 */
import type { PricingEndpointInfo } from '../../utils/model-pricing-types';
import { normalizeProviderHttpMethod } from './binding-http-method';
import type { ProviderModelBinding, ProviderOperation } from './types';

export interface EndpointBindingHint {
  /** Modalities proven compatible by the matched endpoint contract. */
  supportedOperations: readonly ProviderOperation[];
  protocol: ProviderModelBinding['protocol'];
  requestSchema: string;
  responseSchema: string;
  submitPath: string;
  submitMethod: ProviderModelBinding['submitMethod'];
  pollPathTemplate?: string;
  pollMethod?: ProviderModelBinding['pollMethod'];
  baseUrlStrategy?: ProviderModelBinding['baseUrlStrategy'];
  metadata?: ProviderModelBinding['metadata'];
}

interface PathPattern {
  test: (path: string, endpoint: PricingEndpointInfo) => boolean;
  hint: (
    path: string,
    endpoint: PricingEndpointInfo
  ) => Omit<EndpointBindingHint, 'submitMethod' | 'pollMethod'>;
}

function completeEndpointBindingHint(
  hint: Omit<EndpointBindingHint, 'submitMethod' | 'pollMethod'>,
  endpoint: PricingEndpointInfo
): EndpointBindingHint {
  return {
    ...hint,
    submitMethod: normalizeProviderHttpMethod(endpoint.method, 'POST'),
    ...(hint.pollPathTemplate ? { pollMethod: 'GET' as const } : {}),
  };
}

function normalizeEndpointPath(path: string): string {
  try {
    return new URL(path).pathname.replace(/\/+$/, '');
  } catch {
    return path.split('?')[0].replace(/\/+$/, '');
  }
}

function isPostEndpoint(endpoint: PricingEndpointInfo): boolean {
  return !endpoint.method || endpoint.method.toUpperCase() === 'POST';
}

/**
 * 已知 path 模式 → binding hint。顺序重要：首个匹配生效。
 */
const PATH_PATTERNS: PathPattern[] = [
  // Google generateContent（图片/文本）
  {
    test: (p) => /:generateContent$/i.test(p),
    hint: (p) => ({
      supportedOperations: ['text', 'image'],
      protocol: 'google.generateContent',
      requestSchema: 'google.generate-content.image-inline',
      responseSchema: 'google.generate-content.parts',
      submitPath: p,
      baseUrlStrategy: 'trim-v1',
    }),
  },
  // Midjourney
  {
    test: (p) => p.includes('/mj/submit/imagine'),
    hint: (p) => ({
      supportedOperations: ['image'],
      protocol: 'mj.imagine',
      requestSchema: 'mj.imagine.base64-array',
      responseSchema: 'mj.task.status',
      submitPath: p,
      pollPathTemplate: '/mj/task/{taskId}/fetch',
    }),
  },
  // Flux
  {
    test: (p) => /\/flux\/v\d+\//i.test(p),
    hint: (p) => ({
      supportedOperations: ['image'],
      protocol: 'flux.task',
      requestSchema: 'flux.image.polling-json',
      responseSchema: 'flux.task.status',
      submitPath: p,
      pollPathTemplate: '/flux/v1/get_result?id={taskId}',
    }),
  },
  // Kling video
  {
    test: (p) => /\/kling\/.*\/videos\//i.test(p),
    hint: () => ({
      supportedOperations: ['video'],
      protocol: 'kling.video',
      requestSchema: 'kling.video.auto-action-json',
      responseSchema: 'kling.video.task',
      submitPath: '/kling/v1/videos/{action}',
      pollPathTemplate: '/kling/v1/videos/{action}/{taskId}',
    }),
  },
  // Suno audio
  {
    test: (p) => /\/suno\//i.test(p),
    hint: () => ({
      supportedOperations: ['audio'],
      protocol: 'for.suno.music',
      requestSchema: 'for.suno.music.submit',
      responseSchema: 'for.suno.task',
      submitPath: '/suno/submit/music',
      pollPathTemplate: '/suno/fetch/{taskId}',
      baseUrlStrategy: 'trim-v1',
      metadata: {
        audio: {
          action: 'music',
          defaultAction: 'music',
          submitPathByAction: {
            music: '/suno/submit/music',
            lyrics: '/suno/submit/lyrics',
          },
        },
      },
    }),
  },
  // OpenAI images/edits
  {
    test: (p) => /\/images\/edits/i.test(p),
    hint: (p) => ({
      supportedOperations: ['image'],
      protocol: 'openai.images.edits',
      requestSchema: 'openai.image.gpt-edit-form',
      responseSchema: 'openai.image.data',
      submitPath: p,
    }),
  },
  // OpenAI images/generations
  {
    test: (p) => /\/images\/generations/i.test(p),
    hint: (p) => ({
      supportedOperations: ['image'],
      protocol: 'openai.images.generations',
      requestSchema: 'openai.image.basic-json',
      responseSchema: 'openai.image.data',
      submitPath: p,
    }),
  },
  // OpenAI async image task via unified /v1/videos endpoint
  {
    test: (p, ep) =>
      normalizeEndpointPath(p) === '/v1/videos' &&
      isPostEndpoint(ep) &&
      ep.scenario === 'async-image',
    hint: () => ({
      supportedOperations: ['image'],
      protocol: 'openai.async.media',
      requestSchema: 'openai.async.image.form',
      responseSchema: 'openai.async.task',
      submitPath: '/videos',
      pollPathTemplate: '/videos/{taskId}',
      metadata: {
        image: {
          action: 'generation',
        },
      },
    }),
  },
  // OpenAI async video（排除 kling 路径）
  {
    test: (p) => /\/videos/i.test(p) && !/\/kling\//i.test(p),
    hint: () => ({
      supportedOperations: ['video'],
      protocol: 'openai.async.video',
      requestSchema: 'openai.video.form-input-reference',
      responseSchema: 'openai.async.task',
      submitPath: '/videos',
      pollPathTemplate: '/videos/{taskId}',
    }),
  },
  // OpenAI chat completions
  {
    test: (p) => /\/chat\/completions/i.test(p),
    hint: () => ({
      supportedOperations: ['text'],
      protocol: 'openai.chat.completions',
      requestSchema: 'openai.chat.messages',
      responseSchema: 'openai.chat.choices',
      submitPath: '/chat/completions',
    }),
  },
];

/**
 * 从 pricing endpoints 数据中推断 binding hint。
 * 遍历所有 endpoint，返回首个匹配的 hint，无匹配返回 null。
 */
export function inferBindingHintFromEndpoints(
  endpoints: Record<string, PricingEndpointInfo>
): EndpointBindingHint | null {
  for (const ep of Object.values(endpoints)) {
    if (!ep.path) continue;
    const path = ep.path.trim();
    for (const pattern of PATH_PATTERNS) {
      if (pattern.test(path, ep)) {
        return completeEndpointBindingHint(pattern.hint(path, ep), ep);
      }
    }
  }
  return null;
}

/**
 * 从 pricing endpoints 数据中推断所有匹配的 binding hints。
 *
 * 同一协议可能由供应商暴露在多个实际路径上。仅按 protocol 去重会在
 * InvocationPlanner 检查歧义前静默丢失候选，因此按完整执行身份去重。
 */
export function inferAllBindingHintsFromEndpoints(
  endpoints: Record<string, PricingEndpointInfo>
): EndpointBindingHint[] {
  const seen = new Set<string>();
  const hints: EndpointBindingHint[] = [];
  for (const ep of Object.values(endpoints)) {
    if (!ep.path) continue;
    const path = ep.path.trim();
    for (const pattern of PATH_PATTERNS) {
      if (pattern.test(path, ep)) {
        const hint = completeEndpointBindingHint(pattern.hint(path, ep), ep);
        const identity = JSON.stringify([
          hint.protocol,
          hint.requestSchema,
          hint.responseSchema,
          hint.submitPath,
          hint.submitMethod,
          hint.pollPathTemplate || null,
          hint.pollMethod || null,
          hint.baseUrlStrategy || 'preserve',
        ]);
        if (!seen.has(identity)) {
          seen.add(identity);
          hints.push(hint);
        }
        break;
      }
    }
  }
  return hints;
}
