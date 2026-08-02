/**
 * Media Executor Tests
 * 媒体执行器模块测试
 *
 * 测试场景：
 * 1. 执行器接口验证
 * 2. 执行器工厂基本功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  IMediaExecutor,
  ImageExecutionOutcome,
  ImageGenerationParams,
  VideoGenerationParams,
  AIAnalyzeParams,
} from '../media-executor/types';
import type {
  ImageModelAdapter,
  VideoModelAdapter,
} from '../model-adapters/types';
import {
  createImageInvocationTelemetry,
  normalizeImageRequest,
  resolveImageBindingCapabilities,
  type ResolvedImageInvocation,
} from '../image-invocation';
import type { InvocationPlan } from '../provider-routing';
import type { Task } from '../../types/task.types';

describe('Media Executor Module', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock('../media-executor/task-storage-writer');
    vi.doUnmock('../media-executor/fallback-adapter-routes');
    vi.doUnmock('../../utils/settings-manager');
    vi.doUnmock('../sw-channel/client');
    vi.doUnmock('../task-storage-reader');
    vi.doUnmock('../media-executor/llm-api-logger');
    vi.doUnmock('../unified-cache-service');
    vi.doUnmock('../../utils/api-auth-error-event');
    vi.doUnmock('../model-adapters');
    vi.doUnmock('../model-adapters/context');
    vi.doUnmock('../model-adapters/registry');
    vi.doUnmock('../provider-routing');
    vi.doUnmock('../media-executor/fallback-utils');
  });

  describe('IMediaExecutor Interface', () => {
    it('should define correct interface structure', () => {
      // 验证接口类型定义存在
      const imageParams: ImageGenerationParams = {
        taskId: 'test-1',
        request: normalizeImageRequest({ prompt: 'A cat' }),
      };

      const videoParams: VideoGenerationParams = {
        taskId: 'test-2',
        prompt: 'A dancing cat',
      };

      const analyzeParams: AIAnalyzeParams = {
        taskId: 'test-3',
        prompt: 'Analyze this image',
        images: ['http://example.com/image.png'],
      };

      expect(imageParams.taskId).toBe('test-1');
      expect(videoParams.prompt).toBe('A dancing cat');
      expect(analyzeParams.images).toHaveLength(1);
    });

    it('should support optional parameters for image generation', () => {
      const params: ImageGenerationParams = {
        taskId: 'test-1',
        request: normalizeImageRequest({
          prompt: 'A landscape',
          model: 'imagen-3.0-generate-002',
          size: '1024x1024',
          count: 4,
          referenceImages: ['http://example.com/ref.png'],
        }),
      };

      expect(params.request.model).toBe('imagen-3.0-generate-002');
      expect(params.request.size).toBe('1024x1024');
      expect(params.request.count).toBe(4);
      expect(params.request.referenceImages).toHaveLength(1);
    });

    it('should support optional parameters for video generation', () => {
      const params: VideoGenerationParams = {
        taskId: 'test-1',
        prompt: 'A video',
        model: 'veo-2.0-generate-001',
        duration: '10',
        size: '1280x720',
      };

      expect(params.model).toBe('veo-2.0-generate-001');
      expect(params.duration).toBe('10');
      expect(params.size).toBe('1280x720');
    });
  });

  // SWMediaExecutor tests removed - sw-executor.ts has been deleted
  // All task execution now happens on the main thread via FallbackMediaExecutor

  describe('FallbackMediaExecutor', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should have correct executor name', async () => {
      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          isAvailable: async () => true,
          createTask: async () => {},
          updateTaskStatus: async () => {},
          completeTask: async () => {},
          failTask: async () => {},
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(),
          isCached: vi.fn(async () => false),
          cacheMediaFromBlob: vi.fn(async () => {}),
        },
      }));

      vi.doMock('../../utils/settings-manager', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../utils/settings-manager')
        >();
        return {
          ...actual,
          geminiSettings: {
            get: () => ({
              apiKey: 'test-key',
              baseUrl: 'https://api.example.com',
            }),
          },
        };
      });

      const { FallbackMediaExecutor } = await import(
        '../media-executor/fallback-executor'
      );
      const executor = new FallbackMediaExecutor();

      expect(executor.name).toBe('FallbackMediaExecutor');
    }, 15000);

    it('should implement IMediaExecutor interface', async () => {
      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          isAvailable: async () => true,
          createTask: async () => {},
          updateTaskStatus: async () => {},
          completeTask: async () => {},
          failTask: async () => {},
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(),
          isCached: vi.fn(async () => false),
          cacheMediaFromBlob: vi.fn(async () => {}),
        },
      }));

      vi.doMock('../../utils/settings-manager', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../utils/settings-manager')
        >();
        return {
          ...actual,
          geminiSettings: {
            get: () => ({
              apiKey: 'test-key',
              baseUrl: 'https://api.example.com',
            }),
          },
        };
      });

      const { FallbackMediaExecutor } = await import(
        '../media-executor/fallback-executor'
      );
      const executor: IMediaExecutor = new FallbackMediaExecutor();

      expect(typeof executor.name).toBe('string');
      expect(typeof executor.isAvailable).toBe('function');
      expect(typeof executor.generateImage).toBe('function');
      expect(typeof executor.generateVideo).toBe('function');
      expect(typeof executor.aiAnalyze).toBe('function');
      expect(typeof executor.generateText).toBe('function');
    }, 15000);

    it('uses the resolved GPT edit invocation without replanning', async () => {
      const persistedImageUrls = new Set<string>();
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          new Response(new Blob(['generated-image'], { type: 'image/png' }), {
            status: 200,
            headers: { 'Content-Type': 'image/png' },
          })
        )
      );
      vi.doMock('../media-executor/llm-api-logger', () => ({
        startLLMApiLog: vi.fn(() => 'log-id'),
        completeLLMApiLog: vi.fn(),
        failLLMApiLog: vi.fn(),
      }));
      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          updateStatus: vi.fn(async () => {}),
          completeTask: vi.fn(async (taskId: string, result: any) => ({
            id: taskId,
            type: 'image',
            status: 'completed',
            params: { prompt: 'Edit this' },
            createdAt: 1,
            updatedAt: 2,
            completedAt: 2,
            progress: 100,
            result,
          })),
          failTask: vi.fn(),
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(async () => ({
            type: 'image',
            value: 'data:image/png;base64,abc',
          })),
          isCached: vi.fn(async (url: string) => persistedImageUrls.has(url)),
          cacheMediaFromBlob: vi.fn(async (url: string) => {
            persistedImageUrls.add(url);
            return url;
          }),
        },
      }));
      vi.doMock('../../utils/api-auth-error-event', () => ({
        isAuthError: vi.fn(() => false),
        classifyApiCredentialError: vi.fn(() => null),
        dispatchApiAuthError: vi.fn(),
      }));
      vi.doMock('../model-adapters', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../model-adapters')
        >();

        return {
          ...actual,
          getAdapterContextFromSettings: vi.fn(() => ({
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'test-key',
            authType: 'bearer',
            binding: {
              requestSchema: 'openai.image.gpt-edit-form',
              submitPath: '/images/edits',
            },
          })),
        };
      });

      const modelAdapters = await import('../model-adapters');
      const { executeImageViaAdapter } = await import(
        '../media-executor/fallback-adapter-routes'
      );
      const adapter: ImageModelAdapter = {
        id: 'gpt-image-adapter',
        label: 'GPT Image',
        kind: 'image',
        async generateImage() {
          return {
            artifacts: [
              {
                url: 'https://example.com/out.png',
                mimeType: 'image/png',
                format: 'png',
              },
            ],
          };
        },
      };
      const generateSpy = vi.spyOn(adapter, 'generateImage');
      const plan: InvocationPlan = {
        provider: {
          profileId: 'profile-edit',
          profileName: 'Edit Provider',
          providerType: 'openai-compatible',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        modelRef: {
          profileId: 'profile-edit',
          modelId: 'gpt-image-2',
        },
        binding: {
          id: 'profile-edit:gpt-image-2:image:edit',
          profileId: 'profile-edit',
          modelId: 'gpt-image-2',
          operation: 'image',
          protocol: 'openai.images.edits',
          requestSchema: 'openai.image.gpt-edit-form',
          responseSchema: 'openai.image.data',
          submitPath: '/images/edits',
          priority: 100,
          confidence: 'high',
          source: 'manual',
        },
      };
      const imageInvocation: ResolvedImageInvocation = {
        request: Object.freeze({
          prompt: 'Edit this',
          model: 'gpt-image-2',
          modelRef: {
            profileId: 'profile-edit',
            modelId: 'gpt-image-2',
          },
          generationMode: 'image_edit',
          referenceImages: Object.freeze(['data:image/png;base64,source']),
          maskImage: 'data:image/png;base64,mask',
          outputFormat: 'png',
          params: Object.freeze({}),
        }),
        intent: 'edit',
        preferredRequestSchema: ['openai.image.gpt-edit-form'],
        plan,
        modelRef: {
          profileId: 'profile-edit',
          modelId: 'gpt-image-2',
        },
        modelId: 'gpt-image-2',
        adapter,
        adapterContext: {
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
          provider: plan.provider,
          binding: plan.binding,
        },
        capabilities: resolveImageBindingCapabilities(plan.binding),
        telemetry: createImageInvocationTelemetry(),
      };

      await executeImageViaAdapter('task-1', {
        imageInvocation,
      });

      expect(
        modelAdapters.getAdapterContextFromSettings
      ).not.toHaveBeenCalled();
      expect(generateSpy).toHaveBeenCalledWith(
        imageInvocation.adapterContext,
        expect.objectContaining({
          generationMode: 'image_edit',
          referenceImages: ['data:image/png;base64,abc'],
          maskImage: 'data:image/png;base64,abc',
          outputFormat: 'png',
        })
      );
    }, 15000);

    it('routes Midjourney runtime image models through the MJ adapter', async () => {
      const adapterOutcome: ImageExecutionOutcome = {
        taskId: 'task-mj-1',
        status: 'completed',
        progress: 100,
        result: {
          url: 'https://example.com/mj.png',
          format: 'png',
          size: 1,
        },
        completedAt: 2,
        updatedAt: 2,
      };
      const executeImageViaAdapter = vi.fn(async () => adapterOutcome);
      const imageAdapter = {
        id: 'mj-image-adapter',
        kind: 'image',
      };
      const modelRef = {
        profileId: 'for',
        modelId: 'mj_fast_background_eraser',
      };
      const plan = {
        provider: {
          profileId: modelRef.profileId,
          profileName: 'default',
          providerType: 'auto',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        modelRef,
        binding: {
          id: 'for:mj_fast_background_eraser:image:mj',
          profileId: modelRef.profileId,
          modelId: modelRef.modelId,
          operation: 'image',
          protocol: 'mj.imagine',
          requestSchema: 'mj.imagine.base64-array',
          responseSchema: 'mj.task.status',
          submitPath: '/mj/submit/imagine',
          pollPathTemplate: '/mj/task/{taskId}/fetch',
          priority: 400,
          confidence: 'high',
          source: 'template',
        },
      } as const;
      const resolveInvocationPlanFromRoute = vi.fn(() => plan);
      const resolveAdapterForPlan = vi.fn(() => imageAdapter);

      vi.doMock('../media-executor/llm-api-logger', () => ({
        startLLMApiLog: vi.fn(() => 'log-id'),
        completeLLMApiLog: vi.fn(),
        failLLMApiLog: vi.fn(),
      }));
      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          updateStatus: vi.fn(async () => undefined),
          completeTask: vi.fn(async () => undefined),
          failTask: vi.fn(async () => undefined),
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(),
          isCached: vi.fn(async () => false),
          cacheMediaFromBlob: vi.fn(async () => undefined),
        },
      }));
      vi.doMock('../../utils/api-auth-error-event', () => ({
        isAuthError: vi.fn(() => false),
        classifyApiCredentialError: vi.fn(() => null),
        dispatchApiAuthError: vi.fn(),
      }));
      vi.doMock('../../utils/settings-manager', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../utils/settings-manager')
        >();
        return {
          ...actual,
          geminiSettings: {
            get: () => ({
              apiKey: 'test-key',
              baseUrl: 'https://api.example.com/v1',
            }),
          },
        };
      });
      vi.doMock('../provider-routing', () => ({
        resolveInvocationPlanFromRoute,
      }));
      vi.doMock('../model-adapters', () => ({
        resolveAdapterForInvocation: vi.fn(),
        getAdapterContextFromSettings: vi.fn(),
        GPT_IMAGE_EDIT_REQUEST_SCHEMAS: ['openai.image.gpt-edit-form'],
      }));
      vi.doMock('../model-adapters/registry', () => ({
        resolveAdapterForPlan,
      }));
      vi.doMock('../model-adapters/context', () => ({
        getAdapterContextFromPlan: vi.fn(() => ({
          baseUrl: plan.provider.baseUrl,
          apiKey: plan.provider.apiKey,
          authType: plan.provider.authType,
          binding: plan.binding,
        })),
      }));
      vi.doMock('../media-executor/fallback-adapter-routes', () => ({
        executeImageViaAdapter,
        executeVideoViaAdapter: vi.fn(async () => undefined),
      }));

      const { FallbackMediaExecutor } = await import(
        '../media-executor/fallback-executor'
      );
      const executor = new FallbackMediaExecutor();

      const outcome = await executor.generateImage({
        taskId: 'task-mj-1',
        request: normalizeImageRequest({
          prompt: '生成一个兔子',
          model: modelRef.modelId,
          modelRef,
        }),
      });

      expect(resolveInvocationPlanFromRoute).toHaveBeenCalledWith(
        'image',
        modelRef,
        {
          bindingId: undefined,
          preferredRequestSchema: ['openai.image.gpt-generation-json'],
        }
      );
      expect(resolveAdapterForPlan).toHaveBeenCalledWith(plan, 'image');
      expect(executeImageViaAdapter).toHaveBeenCalledWith(
        'task-mj-1',
        expect.objectContaining({
          imageInvocation: expect.objectContaining({
            adapter: expect.objectContaining({
              id: 'mj-image-adapter',
              kind: 'image',
            }),
            modelId: 'mj_fast_background_eraser',
            modelRef: {
              profileId: 'for',
              modelId: 'mj_fast_background_eraser',
            },
          }),
        }),
        undefined,
        expect.any(Number)
      );
      expect(outcome).toEqual(adapterOutcome);
    }, 15000);

    it('uses the authoritative replacement model throughout a stale ModelRef image invocation', async () => {
      const staleModelRef = {
        profileId: 'auto-profile',
        modelId: 'removed-image-model',
      };
      const finalModelRef = {
        profileId: 'auto-profile',
        modelId: 'gpt-image-2',
      };
      const finalPlan = {
        provider: {
          profileId: 'auto-profile',
          profileName: 'default',
          providerType: 'auto',
          baseUrl: 'https://gateway.example.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        modelRef: finalModelRef,
        binding: {
          id: 'auto-profile:gpt-image-2:image:openai.images.generations',
          profileId: 'auto-profile',
          modelId: 'gpt-image-2',
          operation: 'image',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.gpt-generation-json',
          responseSchema: 'openai.image.data',
          submitPath: '/images/generations',
          priority: 320,
          confidence: 'high',
          source: 'template',
        },
      } as const;
      const adapterOutcome: ImageExecutionOutcome = {
        taskId: 'task-replacement-1',
        status: 'completed',
        progress: 100,
        result: {
          url: 'https://example.com/replacement.png',
          format: 'png',
          size: 1,
        },
        completedAt: 2,
        updatedAt: 2,
      };
      const resolveInvocationPlanFromRoute = vi.fn((operation: string) =>
        operation === 'image' ? finalPlan : null
      );
      const resolveAdapterForPlan = vi.fn(() => ({
        id: 'gpt-image-adapter',
        kind: 'image',
      }));
      const executeImageViaAdapter = vi.fn(async () => adapterOutcome);

      vi.doMock('../media-executor/llm-api-logger', () => ({
        startLLMApiLog: vi.fn(() => 'log-id'),
        completeLLMApiLog: vi.fn(),
        failLLMApiLog: vi.fn(),
      }));
      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          updateStatus: vi.fn(async () => undefined),
          completeTask: vi.fn(async () => undefined),
          failTask: vi.fn(async () => undefined),
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(),
          isCached: vi.fn(async () => false),
          cacheMediaFromBlob: vi.fn(async () => undefined),
        },
      }));
      vi.doMock('../../utils/api-auth-error-event', () => ({
        classifyApiCredentialError: vi.fn(() => null),
        dispatchApiAuthError: vi.fn(),
      }));
      vi.doMock('../../utils/settings-manager', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../utils/settings-manager')
        >();
        return {
          ...actual,
          resolveInvocationRoute: vi.fn((operation: string) => ({
            routeType: operation,
            modelId:
              operation === 'image' ? finalModelRef.modelId : 'unused-model',
            profileId: operation === 'image' ? finalModelRef.profileId : null,
            profileName: operation === 'image' ? 'default' : null,
            providerType: operation === 'image' ? 'auto' : null,
            baseUrl: 'https://gateway.example.com/v1',
            apiKey: 'test-key',
            source: 'preset',
          })),
        };
      });
      vi.doMock('../provider-routing', () => ({
        resolveInvocationPlanFromRoute,
      }));
      vi.doMock('../model-adapters', () => ({
        resolveAdapterForInvocation: vi.fn(),
        GPT_IMAGE_EDIT_REQUEST_SCHEMAS: ['openai.image.gpt-edit-form'],
      }));
      vi.doMock('../model-adapters/registry', () => ({
        resolveAdapterForPlan,
        resolveLegacyAdapterForModel: vi.fn(),
      }));
      vi.doMock('../model-adapters/context', () => ({
        getAdapterContextFromPlan: vi.fn(() => ({
          baseUrl: finalPlan.provider.baseUrl,
          apiKey: finalPlan.provider.apiKey,
          authType: finalPlan.provider.authType,
          binding: finalPlan.binding,
        })),
        getLegacyAdapterContextFromSettings: vi.fn(),
      }));
      vi.doMock('../media-executor/fallback-adapter-routes', () => ({
        executeImageViaAdapter,
        executeVideoViaAdapter: vi.fn(async () => undefined),
      }));

      const { FallbackMediaExecutor } = await import(
        '../media-executor/fallback-executor'
      );
      const executor = new FallbackMediaExecutor();

      const outcome = await executor.generateImage({
        taskId: 'task-replacement-1',
        request: normalizeImageRequest({
          prompt: 'Use the selected catalog replacement',
          model: staleModelRef.modelId,
          modelRef: staleModelRef,
        }),
      });

      expect(resolveInvocationPlanFromRoute).toHaveBeenCalledWith(
        'image',
        staleModelRef,
        {
          bindingId: undefined,
          preferredRequestSchema: ['openai.image.gpt-generation-json'],
        }
      );
      expect(finalPlan.modelRef.modelId).toBe(finalModelRef.modelId);
      expect(finalPlan.binding.modelId).toBe(finalModelRef.modelId);
      expect(resolveAdapterForPlan).toHaveBeenCalledWith(finalPlan, 'image');
      expect(executeImageViaAdapter).toHaveBeenCalledWith(
        'task-replacement-1',
        expect.objectContaining({
          imageInvocation: expect.objectContaining({
            adapter: expect.objectContaining({
              id: 'gpt-image-adapter',
              kind: 'image',
            }),
            modelId: finalModelRef.modelId,
            modelRef: finalModelRef,
          }),
        }),
        undefined,
        expect.any(Number)
      );
      expect(outcome).toEqual(adapterOutcome);
    }, 15000);

    it('rejects a task-backed image with missing selected-profile credentials before task state or network execution', async () => {
      const modelRef = {
        profileId: 'selected-profile-without-key',
        modelId: 'gemini-image-model',
      };
      const plan: InvocationPlan = {
        provider: {
          profileId: modelRef.profileId,
          profileName: 'Selected Profile',
          providerType: 'auto',
          baseUrl: 'https://selected.example.com/v1',
          apiKey: '',
          authType: 'bearer',
        },
        modelRef,
        binding: {
          id: `${modelRef.profileId}:${modelRef.modelId}:image:google`,
          profileId: modelRef.profileId,
          modelId: modelRef.modelId,
          operation: 'image',
          protocol: 'google.generateContent',
          requestSchema: 'google.generate-content.image-inline',
          responseSchema: 'google.generate-content.parts',
          submitPath: '/v1beta/models/{model}:generateContent',
          submitMethod: 'POST',
          priority: 400,
          confidence: 'high',
          source: 'manual',
        },
      };
      const resolveInvocationPlanFromRoute = vi.fn(() => plan);
      const resolveAdapterForPlan = vi.fn();
      const executeImageViaAdapter = vi.fn();
      const updateStatus = vi.fn();
      const updateGlobalSettings = vi.fn();
      const transport = vi.fn();
      vi.stubGlobal('fetch', transport);

      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          updateStatus,
          completeTask: vi.fn(),
          failTask: vi.fn(),
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(),
          isCached: vi.fn(),
          cacheMediaFromBlob: vi.fn(),
        },
      }));
      vi.doMock('../../utils/settings-manager', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../utils/settings-manager')
        >();
        return {
          ...actual,
          geminiSettings: {
            get: () => ({
              apiKey: 'global-key-must-not-be-borrowed',
              baseUrl: 'https://global.example.com/v1',
            }),
            update: updateGlobalSettings,
          },
        };
      });
      vi.doMock('../provider-routing', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../provider-routing')
        >();
        return {
          ...actual,
          resolveInvocationPlanFromRoute,
        };
      });
      vi.doMock('../model-adapters/registry', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../model-adapters/registry')
        >();
        return {
          ...actual,
          resolveAdapterForPlan,
        };
      });
      vi.doMock('../media-executor/fallback-adapter-routes', () => ({
        executeImageViaAdapter,
        executeVideoViaAdapter: vi.fn(),
      }));

      const { FallbackMediaExecutor } = await import(
        '../media-executor/fallback-executor'
      );
      const executor = new FallbackMediaExecutor();

      await expect(
        executor.generateImage({
          taskId: 'task-selected-profile-without-key',
          request: normalizeImageRequest({
            prompt: 'must not borrow global credentials',
            model: modelRef.modelId,
            modelRef,
          }),
        })
      ).rejects.toMatchObject({
        name: 'ImageInvocationError',
        code: 'IMAGE_CONFIGURATION_MISSING',
        stage: 'planning',
        details: {
          profileId: modelRef.profileId,
          modelId: modelRef.modelId,
          operation: 'image',
          bindingId: plan.binding.id,
          missingFields: ['apiKey'],
        },
      });

      expect(resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(1);
      expect(resolveAdapterForPlan).not.toHaveBeenCalled();
      expect(updateStatus).not.toHaveBeenCalled();
      expect(executeImageViaAdapter).not.toHaveBeenCalled();
      expect(transport).not.toHaveBeenCalled();
      expect(updateGlobalSettings).not.toHaveBeenCalled();
    }, 15000);

    it('executes a planned manual image binding through its exact adapter and submitPath', async () => {
      const attemptStartedAt = 123;
      const plan = {
        provider: {
          profileId: 'manual-profile',
          profileName: 'Manual Provider',
          providerType: 'openai-compatible',
          baseUrl: 'https://manual.example.com/v1',
          apiKey: 'test-key',
          authType: 'bearer',
        },
        modelRef: {
          profileId: 'manual-profile',
          modelId: 'manual-image-model',
        },
        binding: {
          id: 'manual-profile:manual-image-model:image:basic',
          profileId: 'manual-profile',
          modelId: 'manual-image-model',
          operation: 'image',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.basic-json',
          responseSchema: 'openai.image.data',
          submitPath: '/tenant/images/create',
          submitMethod: 'POST',
          priority: 300,
          confidence: 'high',
          source: 'endpoint-metadata',
        },
      } as const;
      const resolveInvocationPlanFromRoute = vi.fn(() => plan);
      const persistedUrls = new Set<string>();
      const requestUrls: string[] = [];
      const fetchMock = vi.fn<typeof fetch>(async (input) => {
        const url = typeof input === 'string' ? input : input.url;
        requestUrls.push(url);
        if (url === 'https://manual.example.com/v1/tenant/images/create') {
          return new Response(
            JSON.stringify({
              data: [{ url: 'https://cdn.example.com/generated.png' }],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
        if (url === 'https://cdn.example.com/generated.png') {
          return new Response(
            new Blob(['generated-image'], { type: 'image/png' }),
            { status: 200, headers: { 'Content-Type': 'image/png' } }
          );
        }
        throw new Error(`Unexpected request: ${url}`);
      });
      vi.stubGlobal('fetch', fetchMock);

      const updateStatus = vi.fn(async () => true);
      const completeTask = vi.fn(
        async (taskId: string, result: NonNullable<Task['result']>) => ({
          id: taskId,
          type: 'image' as const,
          status: 'completed' as const,
          params: { prompt: 'Planned manual request' },
          createdAt: 1,
          startedAt: attemptStartedAt,
          updatedAt: 2,
          completedAt: 2,
          progress: 100,
          result,
        })
      );
      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          updateStatus,
          completeTask,
          failTask: vi.fn(),
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(),
          isCached: vi.fn(async (url: string) => persistedUrls.has(url)),
          cacheMediaFromBlob: vi.fn(async () => {
            const cachedUrl = '/__aitu_cache__/planned-manual.png';
            persistedUrls.add(cachedUrl);
            return cachedUrl;
          }),
        },
      }));
      vi.doMock('../media-executor/llm-api-logger', () => ({
        startLLMApiLog: vi.fn(() => 'log-id'),
        completeLLMApiLog: vi.fn(),
        failLLMApiLog: vi.fn(),
      }));
      vi.doMock('../../utils/api-auth-error-event', () => ({
        classifyApiCredentialError: vi.fn(() => null),
        dispatchApiAuthError: vi.fn(),
      }));
      vi.doMock('../../utils/settings-manager', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../utils/settings-manager')
        >();
        return {
          ...actual,
          settingsManager: {
            ...actual.settingsManager,
            waitForInitialization: vi.fn(async () => undefined),
          },
        };
      });
      vi.doMock('../provider-routing', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../provider-routing')
        >();
        return {
          ...actual,
          resolveInvocationPlanFromRoute,
        };
      });

      const { FallbackMediaExecutor } = await import(
        '../media-executor/fallback-executor'
      );
      const executor = new FallbackMediaExecutor();
      const outcome = await executor.generateImage(
        {
          taskId: 'task-planned-manual',
          request: normalizeImageRequest({
            prompt: 'Planned manual request',
            model: plan.modelRef.modelId,
            modelRef: plan.modelRef,
          }),
        },
        { imageAttemptStartedAt: attemptStartedAt }
      );
      expect(resolveInvocationPlanFromRoute).toHaveBeenCalledTimes(1);
      expect(resolveInvocationPlanFromRoute).toHaveBeenCalledWith(
        'image',
        plan.modelRef,
        {
          bindingId: undefined,
          preferredRequestSchema: ['openai.image.gpt-generation-json'],
        }
      );
      expect(requestUrls).toEqual([
        'https://manual.example.com/v1/tenant/images/create',
        'https://cdn.example.com/generated.png',
      ]);
      expect(
        requestUrls.some((url) => url.endsWith('/images/generations'))
      ).toBe(false);
      expect(updateStatus).toHaveBeenCalledWith(
        'task-planned-manual',
        'processing',
        { expectedStartedAt: attemptStartedAt }
      );
      expect(completeTask).toHaveBeenCalledWith(
        'task-planned-manual',
        expect.objectContaining({
          url: '/__aitu_cache__/planned-manual.png',
        }),
        { expectedStartedAt: attemptStartedAt }
      );
      expect(outcome.status).toBe('completed');
      expect(outcome.attemptStartedAt).toBe(attemptStartedAt);
    }, 15000);

    it('passes video adapter progress through fallback adapter routes', async () => {
      const updateRemoteId = vi.fn(async () => {});
      const completeTask = vi.fn(async () => {});
      const onProgress = vi.fn();

      vi.doMock('../media-executor/llm-api-logger', () => ({
        startLLMApiLog: vi.fn(() => 'log-id'),
        completeLLMApiLog: vi.fn(),
        failLLMApiLog: vi.fn(),
      }));
      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          updateRemoteId,
          completeTask,
          failTask: vi.fn(async () => {}),
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(),
          isCached: vi.fn(async () => false),
          cacheMediaFromBlob: vi.fn(async () => {}),
        },
      }));
      vi.doMock('../../utils/api-auth-error-event', () => ({
        isAuthError: vi.fn(() => false),
        dispatchApiAuthError: vi.fn(),
      }));
      vi.doMock('../model-adapters', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../model-adapters')
        >();

        return {
          ...actual,
          getAdapterContextFromSettings: vi.fn(() => ({
            baseUrl: 'https://api.example.com/v1',
            apiKey: 'test-key',
            authType: 'bearer',
          })),
        };
      });

      const { executeVideoViaAdapter } = await import(
        '../media-executor/fallback-adapter-routes'
      );
      const adapter: VideoModelAdapter = {
        id: 'happyhorse-adapter',
        label: 'HappyHorse',
        kind: 'video',
        async generateVideo(_context, request) {
          const handleProgress = request.params?.onProgress as
            | ((progress: number, status?: string) => void)
            | undefined;
          const handleSubmitted = request.params?.onSubmitted as
            | ((videoId: string) => void)
            | undefined;

          handleSubmitted?.('video-task-1');
          handleProgress?.(30, 'in_progress');

          return {
            url: 'https://example.com/out.mp4',
            format: 'mp4',
          };
        },
      };

      await executeVideoViaAdapter(
        'task-1',
        adapter,
        {
          prompt: 'A dancing cat',
          model: 'happyhorse-1.0-t2v',
        },
        { onProgress }
      );

      expect(updateRemoteId).toHaveBeenCalledWith(
        'task-1',
        'video-task-1',
        expect.objectContaining({
          operation: 'video',
          modelId: 'happyhorse-1.0-t2v',
        })
      );
      expect(onProgress).toHaveBeenCalledWith({
        progress: 30,
        phase: 'polling',
      });
      expect(completeTask).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          url: 'https://example.com/out.mp4',
          format: 'mp4',
        })
      );
    }, 15000);
  });

  describe('ExecutorFactory', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should export getExecutor function', async () => {
      vi.doMock('../sw-channel/client', () => ({
        swChannelClient: {
          isInitialized: () => false,
          ping: async () => false,
        },
      }));

      vi.doMock('../media-executor/task-storage-writer', () => ({
        taskStorageWriter: {
          isAvailable: async () => true,
        },
      }));
      vi.doMock('../unified-cache-service', () => ({
        unifiedCacheService: {
          getImageForAI: vi.fn(),
          isCached: vi.fn(async () => false),
          cacheMediaFromBlob: vi.fn(async () => {}),
        },
      }));

      vi.doMock('../../utils/settings-manager', async (importOriginal) => {
        const actual = await importOriginal<
          typeof import('../../utils/settings-manager')
        >();
        return {
          ...actual,
          geminiSettings: {
            get: () => ({
              apiKey: 'test-key',
              baseUrl: 'https://api.example.com',
            }),
          },
        };
      });

      const { executorFactory } = await import('../media-executor/factory');

      expect(typeof executorFactory.getExecutor).toBe('function');
    }, 15000);
  });

  describe('Task Polling Types', () => {
    it('should export waitForTaskCompletion function', async () => {
      vi.doMock('../task-storage-reader', () => ({
        taskStorageReader: {
          isAvailable: async () => true,
          getTask: async () => null,
        },
      }));

      const { waitForTaskCompletion } = await import(
        '../media-executor/task-polling'
      );

      expect(typeof waitForTaskCompletion).toBe('function');
    });
  });
});
