import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertTaskInvocationRouteAvailable,
  createTaskInvocationRouteSnapshotFromTask,
  resolveImageTaskGenerationParams,
  resolveTaskInvocationPlanFromSnapshot,
} from '../task-invocation-route';

const resolveInvocationPlanFromRoute = vi.hoisted(() => vi.fn());
const getProviderProfiles = vi.hoisted(() => vi.fn());

vi.mock('../../utils/settings-manager', () => ({
  createModelRef: (profileId?: string | null, modelId?: string | null) =>
    profileId && modelId ? { profileId, modelId } : null,
  providerProfilesSettings: { get: getProviderProfiles },
  resolveInvocationRoute: (_operation: string, routeModel?: unknown) => ({
    profileId:
      routeModel && typeof routeModel === 'object'
        ? (routeModel as { profileId?: string }).profileId || null
        : null,
    providerType: null,
    modelId:
      routeModel && typeof routeModel === 'object'
        ? (routeModel as { modelId?: string }).modelId || null
        : routeModel,
  }),
}));

vi.mock('../provider-routing', () => ({
  listSettingsProviderProfiles: () => [],
  resolveInvocationPlanFromRoute,
}));

describe('task invocation route snapshot', () => {
  beforeEach(() => {
    resolveInvocationPlanFromRoute.mockReset();
    getProviderProfiles.mockReset();
    getProviderProfiles.mockReturnValue([]);
    resolveInvocationPlanFromRoute.mockReturnValue({
      provider: {
        profileId: 'auto-profile',
        profileName: 'default',
        providerType: 'auto',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'test-key',
        authType: 'bearer',
      },
      modelRef: {
        profileId: 'auto-profile',
        modelId: 'gpt-image-2',
      },
      binding: {
        id: 'auto-gpt-edit',
        profileId: 'auto-profile',
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
    });
  });

  it('treats the legacy singular uploadedImage field as GPT edit intent', () => {
    const snapshot = createTaskInvocationRouteSnapshotFromTask({
      type: 'image',
      params: {
        prompt: 'Edit the uploaded image',
        model: 'gpt-image-2',
        modelRef: {
          profileId: 'auto-profile',
          modelId: 'gpt-image-2',
        },
        uploadedImage: {
          url: 'https://example.com/reference.png',
        },
      },
    } as never);

    expect(resolveInvocationPlanFromRoute).toHaveBeenCalledWith(
      'image',
      {
        profileId: 'auto-profile',
        modelId: 'gpt-image-2',
      },
      {
        bindingId: undefined,
        preferredRequestSchema: ['openai.image.gpt-edit-form'],
      }
    );
    expect(snapshot?.binding).toMatchObject({
      id: 'auto-gpt-edit',
      protocol: 'openai.images.edits',
      requestSchema: 'openai.image.gpt-edit-form',
      submitPath: '/images/edits',
      submitMethod: 'POST',
    });
  });

  it('plans generation snapshots with an explicit generation schema', () => {
    resolveInvocationPlanFromRoute.mockReturnValue({
      provider: {
        profileId: 'auto-profile',
        profileName: 'default',
        providerType: 'auto',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'test-key',
        authType: 'bearer',
      },
      modelRef: {
        profileId: 'auto-profile',
        modelId: 'gpt-image-2',
      },
      binding: {
        id: 'auto-gpt-generation',
        profileId: 'auto-profile',
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
    });

    const snapshot = createTaskInvocationRouteSnapshotFromTask({
      type: 'image',
      params: {
        prompt: 'Generate an image',
        model: 'gpt-image-2',
        modelRef: {
          profileId: 'auto-profile',
          modelId: 'gpt-image-2',
        },
      },
    } as never);

    expect(resolveInvocationPlanFromRoute).toHaveBeenCalledWith(
      'image',
      {
        profileId: 'auto-profile',
        modelId: 'gpt-image-2',
      },
      {
        bindingId: undefined,
        preferredRequestSchema: ['openai.image.gpt-generation-json'],
      }
    );
    expect(snapshot?.binding).toMatchObject({
      id: 'auto-gpt-generation',
      requestSchema: 'openai.image.gpt-generation-json',
      submitPath: '/images/generations',
      submitMethod: 'POST',
    });
  });

  it('rehydrates a pending image submission from the durable model and binding snapshot', () => {
    const params = resolveImageTaskGenerationParams({
      params: {
        prompt: 'Resume the original image invocation',
        model: 'stale-model',
        modelRef: {
          profileId: 'other-profile',
          modelId: 'stale-model',
        },
      },
      invocationRoute: {
        operation: 'image',
        providerProfileId: 'auto-profile',
        modelId: 'gpt-image-2',
        modelRef: {
          profileId: 'auto-profile',
          modelId: 'gpt-image-2',
        },
        binding: {
          id: 'auto-gpt-generation',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.gpt-generation-json',
          responseSchema: 'openai.image.data',
          submitPath: '/images/generations',
          priority: 320,
          confidence: 'high',
          source: 'template',
        },
      },
    } as never);

    expect(params).toMatchObject({
      model: 'gpt-image-2',
      modelRef: {
        profileId: 'auto-profile',
        modelId: 'gpt-image-2',
      },
      bindingId: 'auto-gpt-generation',
    });
  });

  it('hydrates an executable binding snapshot without consulting the mutable planner', () => {
    getProviderProfiles.mockReturnValue([
      {
        id: 'auto-profile',
        name: 'default 分组',
        providerType: 'auto',
        baseUrl: 'https://gateway.changed.example/v1',
        apiKey: 'current-key',
        authType: 'header',
        extraHeaders: { 'X-Tenant': 'stable' },
        enabled: true,
      },
    ]);

    const plan = resolveTaskInvocationPlanFromSnapshot('image', {
      invocationRoute: {
        operation: 'image',
        providerProfileId: 'auto-profile',
        modelId: 'gpt-image-2',
        modelRef: {
          profileId: 'auto-profile',
          modelId: 'gpt-image-2',
        },
        binding: {
          id: 'persisted-custom-binding',
          protocol: 'openai.images.generations',
          requestSchema: 'openai.image.gpt-generation-json',
          responseSchema: 'openai.image.data',
          submitPath: '/tenant/images/create',
          pollPathTemplate: '/tenant/images/{taskId}',
          baseUrlStrategy: 'preserve',
        },
      },
    } as never);

    expect(resolveInvocationPlanFromRoute).not.toHaveBeenCalled();
    expect(plan).toMatchObject({
      provider: {
        profileId: 'auto-profile',
        baseUrl: 'https://gateway.changed.example/v1',
        apiKey: 'current-key',
        authType: 'header',
        extraHeaders: { 'X-Tenant': 'stable' },
      },
      modelRef: { profileId: 'auto-profile', modelId: 'gpt-image-2' },
      binding: {
        id: 'persisted-custom-binding',
        submitPath: '/tenant/images/create',
        submitMethod: 'POST',
        pollPathTemplate: '/tenant/images/{taskId}',
        pollMethod: 'GET',
      },
    });
  });

  it('freezes the endpoint host and methods while refreshing current credentials', () => {
    getProviderProfiles.mockReturnValue([
      {
        id: 'auto-profile',
        name: 'default 分组',
        providerType: 'custom',
        baseUrl: 'https://changed.example.com/v1',
        apiKey: 'rotated-key',
        authType: 'query',
        extraHeaders: { 'X-Current-Tenant': 'rotated' },
        enabled: true,
      },
    ]);

    const plan = resolveTaskInvocationPlanFromSnapshot('image', {
      invocationRoute: {
        operation: 'image',
        providerProfileId: 'auto-profile',
        providerType: 'auto',
        providerBaseUrl: 'https://submitted.example.com/prefix/v1',
        modelId: 'gpt-image-2',
        binding: {
          id: 'persisted-custom-binding',
          protocol: 'openai.async.media',
          requestSchema: 'openai.async.image.form',
          responseSchema: 'openai.async.task',
          submitPath: '/tenant/images/create',
          submitMethod: 'PATCH',
          pollPathTemplate: '/tenant/images/{taskId}',
          pollMethod: 'POST',
        },
      },
    } as never);

    expect(plan).toMatchObject({
      provider: {
        providerType: 'auto',
        baseUrl: 'https://submitted.example.com/prefix/v1',
        apiKey: 'rotated-key',
        authType: 'query',
        extraHeaders: { 'X-Current-Tenant': 'rotated' },
      },
      binding: {
        submitMethod: 'PATCH',
        pollMethod: 'POST',
      },
    });
  });

  it('hydrates legacy snapshots without methods as POST submit and GET poll', () => {
    getProviderProfiles.mockReturnValue([
      {
        id: 'auto-profile',
        name: 'default 分组',
        providerType: 'auto',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'current-key',
        authType: 'bearer',
        enabled: true,
      },
    ]);

    const plan = resolveTaskInvocationPlanFromSnapshot('image', {
      invocationRoute: {
        operation: 'image',
        providerProfileId: 'auto-profile',
        modelId: 'gpt-image-2',
        binding: {
          id: 'legacy-methodless-binding',
          protocol: 'openai.async.media',
          requestSchema: 'openai.async.image.form',
          responseSchema: 'openai.async.task',
          submitPath: '/videos',
          pollPathTemplate: '/videos/{taskId}',
        },
      },
    } as never);

    expect(plan?.binding).toMatchObject({
      submitMethod: 'POST',
      pollMethod: 'GET',
    });
    expect(plan?.provider.baseUrl).toBe('https://gateway.example.com/v1');
  });

  it('rejects a provider-scoped image snapshot that cannot be executed without replanning', () => {
    getProviderProfiles.mockReturnValue([
      {
        id: 'auto-profile',
        name: 'default 分组',
        providerType: 'auto',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'current-key',
        authType: 'bearer',
        enabled: true,
      },
    ]);
    const task = {
      invocationRoute: {
        operation: 'image',
        providerProfileId: 'auto-profile',
        modelId: 'gpt-image-2',
        modelRef: {
          profileId: 'auto-profile',
          modelId: 'gpt-image-2',
        },
        binding: {
          id: 'legacy-binding-id-only',
        },
      },
    } as never;

    expect(() => resolveTaskInvocationPlanFromSnapshot('image', task)).toThrow(
      '图片任务调用快照缺少完整 binding'
    );
    expect(() => assertTaskInvocationRouteAvailable('image', task)).toThrow(
      '图片任务调用快照缺少完整 binding'
    );
    expect(resolveInvocationPlanFromRoute).not.toHaveBeenCalled();
  });
});
