import { describe, expect, it, vi } from 'vitest';
import {
  buildGPTImageEditFormData,
  buildGPTImageGenerationBody,
  gptImageAdapter,
  parseGPTImageResponse,
} from '../model-adapters/gpt-image-adapter';
import type { ImageGenerationRequest } from '../model-adapters/types';
import type { ProviderModelBinding } from '../provider-routing';

const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const tinyPngBase64Only =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function generationBinding(
  overrides: Partial<ProviderModelBinding> = {}
): ProviderModelBinding {
  return {
    id: 'gpt-generation-binding',
    profileId: 'openai',
    modelId: 'gpt-image-2',
    operation: 'image',
    protocol: 'openai.images.generations',
    requestSchema: 'openai.image.gpt-generation-json',
    responseSchema: 'openai.image.data',
    submitPath: '/images/generations',
    submitMethod: 'POST',
    priority: 320,
    confidence: 'high',
    source: 'template',
    ...overrides,
  };
}

describe('gpt-image-adapter', () => {
  it('builds official GPT Image generation JSON without response_format by default', () => {
    const body = buildGPTImageGenerationBody({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      size: '16x9',
      resolution: '2k',
      quality: 'high',
      outputFormat: 'webp',
      outputCompression: 80,
      count: 2,
    });

    expect(body).toEqual({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      size: '2736x1536',
      quality: 'high',
      output_format: 'webp',
      output_compression: 80,
      n: 2,
    });
  });

  it('treats legacy 1K/2K/4K quality values as resolution compatibility hints', () => {
    const body = buildGPTImageGenerationBody({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      size: '4x3',
      quality: '2k',
    });

    expect(body).toEqual({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      size: '2368x1776',
    });
  });

  it('normalizes invalid GPT Image pixel sizes back to a supported mapped size', () => {
    const body = buildGPTImageGenerationBody({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      size: '800x600',
      resolution: '2k',
    });

    expect(body).toEqual({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      size: '2368x1776',
    });
  });

  it('keeps legacy GPT Image models on official standard sizes only', () => {
    const body = buildGPTImageGenerationBody({
      model: 'gpt-image-1',
      prompt: 'Draw a clean product photo',
      size: '16x9',
      resolution: '4k',
      quality: 'high',
    });

    expect(body).toEqual({
      model: 'gpt-image-1',
      prompt: 'Draw a clean product photo',
      size: '1536x1024',
      quality: 'high',
    });
  });

  it('preserves explicit b64_json response_format for GPT Image generation', () => {
    const body = buildGPTImageGenerationBody({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      responseFormat: 'b64_json',
    });

    expect(body).toEqual({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      response_format: 'b64_json',
    });
  });

  it('builds official GPT Image edit form data with image files', async () => {
    const body = await buildGPTImageEditFormData({
      model: 'gpt-image-2',
      prompt: 'Change the style',
      size: '1x1',
      referenceImages: [tinyPngDataUrl],
      maskImage: tinyPngDataUrl,
      inputFidelity: 'high',
      background: 'transparent',
      outputFormat: 'png',
      outputCompression: 80,
      params: {},
    });

    expect(body.get('model')).toBe('gpt-image-2');
    expect(body.get('prompt')).toBe('Change the style');
    expect(body.has('response_format')).toBe(false);
    expect(body.get('input_fidelity')).toBe('high');
    expect(body.get('size')).toBe('1024x1024');
    expect(body.get('output_format')).toBe('png');
    expect(body.get('output_compression')).toBe('80');
    expect(body.get('background')).toBe('transparent');
    expect(body.getAll('image[]')).toHaveLength(1);
    expect(body.get('image[]')).toBeInstanceOf(Blob);
    expect(body.get('mask')).toBeInstanceOf(Blob);
  });

  it('does not mix generation response_format into the GPT edit schema', async () => {
    const body = await buildGPTImageEditFormData({
      model: 'gpt-image-2',
      prompt: 'Change the style',
      referenceImages: [tinyPngDataUrl],
      generationMode: 'image_edit',
      responseFormat: 'b64_json',
    });

    expect(body.has('response_format')).toBe(false);
  });

  it('does not reinterpret params.mask_image after normalization', async () => {
    const body = await buildGPTImageEditFormData({
      model: 'gpt-image-2',
      prompt: 'Change the style',
      referenceImages: [tinyPngDataUrl],
      generationMode: 'image_edit',
      params: {
        mask_image: tinyPngDataUrl,
      },
    });

    expect(body.getAll('image[]')).toHaveLength(1);
    expect(body.get('image[]')).toBeInstanceOf(Blob);
    expect(body.has('mask')).toBe(false);
  });

  it('maps GPT Image 2 edit requests through resolution tiers', async () => {
    const body = await buildGPTImageEditFormData({
      model: 'gpt-image-2',
      prompt: 'Change the style',
      size: '800x600',
      referenceImages: [tinyPngDataUrl],
      resolution: '4k',
    });

    expect(body.get('size')).toBe('3312x2480');
  });

  it('keeps legacy GPT Image edit requests on standard edit sizes', async () => {
    const body = await buildGPTImageEditFormData({
      model: 'gpt-image-1',
      prompt: 'Change the style',
      size: '16x9',
      referenceImages: [tinyPngDataUrl],
      resolution: '4k',
    });

    expect(body.get('size')).toBe('1536x1024');
  });

  it('fetches remote image and mask URLs for edit form data', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const type = url.endsWith('.webp') ? 'image/webp' : 'image/png';
      return new Response(new Blob(['ok'], { type }), { status: 200 });
    });

    const body = await buildGPTImageEditFormData(
      {
        model: 'gpt-image-2',
        prompt: 'Change the style',
        size: '16x9',
        referenceImages: ['https://example.com/source.webp'],
        maskImage: 'https://example.com/mask.png',
      },
      fetcher as unknown as typeof fetch
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'https://example.com/source.webp'
    );
    expect(fetcher).toHaveBeenNthCalledWith(2, 'https://example.com/mask.png');
    expect(body.get('size')).toBe('1360x768');
    expect(body.get('image[]')).toBeInstanceOf(Blob);
    expect(body.get('mask')).toBeInstanceOf(Blob);
  });

  it('accepts bare base64 image inputs without fetching', async () => {
    const fetcher = vi.fn();

    const body = await buildGPTImageEditFormData(
      {
        model: 'gpt-image-2',
        prompt: 'Change the style',
        referenceImages: [tinyPngBase64Only],
      },
      fetcher as unknown as typeof fetch
    );

    expect(fetcher).not.toHaveBeenCalled();
    expect(body.get('image[]')).toBeInstanceOf(Blob);
  });

  it('surfaces remote image fetch failures for edit form data', async () => {
    const fetcher = vi.fn(async () => {
      return new Response('missing', {
        status: 404,
        statusText: 'Not Found',
      });
    });

    await expect(
      buildGPTImageEditFormData(
        {
          model: 'gpt-image-2',
          prompt: 'Change the style',
          referenceImages: ['https://example.com/missing.png'],
        },
        fetcher as unknown as typeof fetch
      )
    ).rejects.toThrow('GPT Image 编辑图片读取失败: 404 Not Found');
  });

  it('requires reference images for official GPT Image edit form data', async () => {
    await expect(
      buildGPTImageEditFormData({
        model: 'gpt-image-2',
        prompt: 'Change the style',
      })
    ).rejects.toThrow('GPT Image 编辑请求缺少参考图片');
  });

  it('parses GPT Image b64_json results into data URLs', () => {
    const result = parseGPTImageResponse(
      {
        output_format: 'png',
        data: [
          {
            b64_json:
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
        ],
      },
      'png'
    );

    expect(result).toEqual({
      artifacts: [
        {
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          source: 'inline',
          mimeType: 'image/png',
          format: 'png',
        },
      ],
    });
  });

  it('accepts gateway URL results for compatibility', () => {
    const result = parseGPTImageResponse({
      data: [
        {
          url: 'https://example.com/image.webp',
        },
      ],
    });

    expect(result).toEqual({
      artifacts: [
        {
          url: 'https://example.com/image.webp',
          source: 'url',
          mimeType: 'image/webp',
          format: 'webp',
        },
      ],
    });
  });

  it('sends official GPT Image requests through provider transport', async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [
            {
              b64_json:
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    await gptImageAdapter.generateImage(
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'secret-key',
        authType: 'bearer',
        fetcher,
        binding: {
          id: 'binding',
          profileId: 'openai',
          modelId: 'gpt-image-2',
          operation: 'image',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.gpt-generation-json',
          responseSchema: 'openai.image.data',
          submitPath: '/images/generations',
          submitMethod: 'POST',
          priority: 320,
          confidence: 'high',
          source: 'template',
        },
      },
      {
        model: 'gpt-image-2',
        prompt: 'Draw a clean product photo',
        operationIntent: 'generation',
        size: '1x1',
        params: {},
      }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer secret-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'gpt-image-2',
      prompt: 'Draw a clean product photo',
      size: '1024x1024',
    });
  });

  it('uses the binding query-key contract for auto-profile GPT requests', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ url: 'https://example.com/image.png' }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
    );

    await gptImageAdapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-key',
        authType: 'query',
        fetcher,
        provider: {
          profileId: 'provider-auto',
          profileName: 'Auto Provider',
          providerType: 'auto',
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'secret-key',
          authType: 'query',
          extraHeaders: { 'X-Tenant': 'tenant-a' },
        },
        binding: {
          id: 'binding',
          profileId: 'provider-auto',
          modelId: 'gpt-image-2',
          operation: 'image',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.gpt-generation-json',
          responseSchema: 'openai.image.data',
          submitPath: '/images/generations',
          submitMethod: 'POST',
          priority: 320,
          confidence: 'high',
          source: 'template',
        },
      },
      {
        model: 'gpt-image-2',
        prompt: 'Draw a clean product photo',
        operationIntent: 'generation',
      }
    );

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(
      'https://gateway.example.com/v1/images/generations?api_key=secret-key'
    );
    expect(init?.headers).toMatchObject({ 'X-Tenant': 'tenant-a' });
  });

  it('sends official GPT Image edit requests to the edits endpoint', async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          output_format: 'png',
          data: [
            {
              b64_json:
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    await gptImageAdapter.generateImage(
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'secret-key',
        authType: 'bearer',
        fetcher,
        binding: {
          id: 'binding',
          profileId: 'openai',
          modelId: 'gpt-image-2',
          operation: 'image',
          protocol: 'openai.images.edits',
          requestSchema: 'openai.image.gpt-edit-form',
          responseSchema: 'openai.image.data',
          submitPath: '/images/edits',
          submitMethod: 'POST',
          priority: 319,
          confidence: 'high',
          source: 'template',
        },
      },
      {
        model: 'gpt-image-2',
        prompt: 'Change the style',
        operationIntent: 'edit',
        size: '1x1',
        referenceImages: [tinyPngDataUrl],
        generationMode: 'image_edit',
        maskImage: tinyPngDataUrl,
      }
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer secret-key',
    });
    expect(
      (init?.headers as Record<string, string>)['Content-Type']
    ).toBeUndefined();
    expect(init?.body).toBeInstanceOf(FormData);
    const formData = init?.body as FormData;
    expect(formData.get('model')).toBe('gpt-image-2');
    expect(formData.get('prompt')).toBe('Change the style');
    expect(formData.has('response_format')).toBe(false);
    expect(formData.get('size')).toBe('1024x1024');
    expect(formData.getAll('image[]')).toHaveLength(1);
    expect(formData.get('image[]')).toBeInstanceOf(Blob);
    expect(formData.get('mask')).toBeInstanceOf(Blob);
  });

  it('rejects a missing binding without issuing a request', async () => {
    const fetcher = vi.fn();

    await expect(
      gptImageAdapter.generateImage(
        {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'secret-key',
          authType: 'bearer',
          fetcher,
        },
        {
          model: 'gpt-image-2',
          prompt: 'Do not guess an endpoint',
          operationIntent: 'generation',
        }
      )
    ).rejects.toThrow('GPT Image adapter 缺少 InvocationPlan.binding');

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not infer edit mode from adapter payload aliases', async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({ data: [{ url: 'https://example.com/out.png' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    await gptImageAdapter.generateImage(
      {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'secret-key',
        authType: 'bearer',
        fetcher,
        binding: generationBinding(),
      },
      {
        model: 'gpt-image-2',
        prompt: 'Use the resolved operation',
        operationIntent: 'generation',
        referenceImages: [tinyPngDataUrl],
        generationMode: 'image_edit',
      }
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://api.openai.com/v1/images/generations'
    );
  });

  it('rejects a request without an upstream operation intent', async () => {
    const fetcher = vi.fn();
    const incompleteRequest = {
      model: 'gpt-image-2',
      prompt: 'Do not guess the operation',
    } as ImageGenerationRequest;

    await expect(
      gptImageAdapter.generateImage(
        {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'secret-key',
          authType: 'bearer',
          fetcher,
          binding: generationBinding(),
        },
        incompleteRequest
      )
    ).rejects.toThrow('GPT Image adapter 缺少已解析 operationIntent');

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects an empty binding submitPath without issuing a request', async () => {
    const fetcher = vi.fn();

    await expect(
      gptImageAdapter.generateImage(
        {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'secret-key',
          authType: 'bearer',
          fetcher,
          binding: generationBinding({ submitPath: '  ' }),
        },
        {
          model: 'gpt-image-2',
          prompt: 'Do not guess an endpoint',
          operationIntent: 'generation',
        }
      )
    ).rejects.toThrow('GPT Image adapter binding 缺少 submitPath');

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects a binding model mismatch without issuing a request', async () => {
    const fetcher = vi.fn();

    await expect(
      gptImageAdapter.generateImage(
        {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'secret-key',
          authType: 'bearer',
          fetcher,
          binding: generationBinding({ modelId: 'other-image-model' }),
        },
        {
          model: 'gpt-image-2',
          prompt: 'Do not cross model identities',
          operationIntent: 'generation',
        }
      )
    ).rejects.toThrow('GPT Image adapter 请求模型与 binding 不一致');

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not override an auto invocation binding inside the adapter', async () => {
    const fetcher = vi.fn();

    await expect(
      gptImageAdapter.generateImage(
        {
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'secret-key',
          authType: 'bearer',
          fetcher,
          provider: {
            profileId: 'auto-profile',
            profileName: 'default',
            providerType: 'auto',
            baseUrl: 'https://gateway.example.com/v1',
            apiKey: 'secret-key',
            authType: 'bearer',
          },
          binding: {
            id: 'generation-binding',
            profileId: 'auto-profile',
            modelId: 'gpt-image-2',
            operation: 'image',
            protocol: 'openai.images.generations',
            requestSchema: 'openai.image.gpt-generation-json',
            responseSchema: 'openai.image.data',
            submitPath: '/images/generations',
            submitMethod: 'POST',
            priority: 500,
            confidence: 'high',
            source: 'template',
          },
        },
        {
          model: 'gpt-image-2',
          prompt: 'Change the style',
          operationIntent: 'edit',
          referenceImages: [tinyPngDataUrl],
          generationMode: 'image_to_image',
        }
      )
    ).rejects.toThrow('GPT Image 请求意图与已选 binding 不一致');

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects an incoherent GPT binding protocol/schema before networking', async () => {
    const fetcher = vi.fn();

    await expect(
      gptImageAdapter.generateImage(
        {
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'secret-key',
          authType: 'bearer',
          fetcher,
          binding: {
            id: 'incoherent-binding',
            profileId: 'auto-profile',
            modelId: 'gpt-image-2',
            operation: 'image',
            protocol: 'openai.images.generations',
            requestSchema: 'openai.image.gpt-edit-form',
            responseSchema: 'openai.image.data',
            submitPath: '/must-not-submit',
            submitMethod: 'POST',
            priority: 500,
            confidence: 'high',
            source: 'template',
          },
        },
        {
          model: 'gpt-image-2',
          prompt: 'Do not submit',
          operationIntent: 'generation',
        }
      )
    ).rejects.toThrow('GPT Image adapter 不支持 binding schema');

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('uses binding submitPath and baseUrlStrategy for GPT generation', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: [{ url: 'https://example.com/out.png' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    await gptImageAdapter.generateImage(
      {
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-key',
        authType: 'bearer',
        fetcher,
        binding: {
          id: 'custom-generation-binding',
          profileId: 'custom-profile',
          modelId: 'gpt-image-2',
          operation: 'image',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.gpt-generation-json',
          responseSchema: 'openai.image.data',
          submitPath: '/tenant/images/custom-generations',
          submitMethod: 'PATCH',
          baseUrlStrategy: 'trim-v1',
          priority: 900,
          confidence: 'high',
          source: 'discovered',
        },
      },
      {
        model: 'gpt-image-2',
        prompt: 'Draw a product',
        operationIntent: 'generation',
      }
    );

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://gateway.example.com/tenant/images/custom-generations'
    );
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('PATCH');
  });

  it('forwards abort to GPT edit preprocessing', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      if (String(input) === 'https://example.com/source.png') {
        expect(controller.signal.aborted).toBe(false);
        controller.abort(new DOMException('cancel edit', 'AbortError'));
        throw controller.signal.reason;
      }
      return new Response();
    });

    await expect(
      gptImageAdapter.generateImage(
        {
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'secret-key',
          authType: 'bearer',
          fetcher: fetcher as unknown as typeof fetch,
          binding: {
            id: 'custom-edit-binding',
            profileId: 'custom-profile',
            modelId: 'gpt-image-2',
            operation: 'image',
            protocol: 'openai.images.edits',
            requestSchema: 'openai.image.gpt-edit-form',
            responseSchema: 'openai.image.data',
            submitPath: '/tenant/images/custom-edits',
            submitMethod: 'POST',
            baseUrlStrategy: 'trim-v1',
            priority: 900,
            confidence: 'high',
            source: 'discovered',
          },
        },
        {
          model: 'gpt-image-2',
          prompt: 'Change the style',
          operationIntent: 'edit',
          referenceImages: ['https://example.com/source.png'],
          generationMode: 'image_edit',
          signal: controller.signal,
        }
      )
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('https://example.com/source.png', {
      signal: controller.signal,
    });
  });
});
