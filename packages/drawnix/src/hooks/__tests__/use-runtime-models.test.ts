// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('use-runtime-models', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it.each(['image', 'video', 'audio', 'text'] as const)(
    '非默认供应商添加 %s 模型后立即刷新全局选择器',
    async (modelType) => {
      const listeners = new Set<() => void>();
      const defaultState = {
        profileId: 'legacy-default',
        status: 'idle' as const,
        sourceBaseUrl: '',
        signature: '',
        discoveredAt: null,
        discoveredModels: [],
        selectedModelIds: [],
        models: [],
        error: null,
      };
      let selectableModels: Array<Record<string, unknown>> = [];
      let revision = 0;

      vi.doMock('../../utils/runtime-model-discovery', () => ({
        getProfilePreferredModels: () => [],
        getPreferredModels: () => [],
        getSelectableModels: () => selectableModels,
        runtimeModelDiscovery: {
          getState: () => defaultState,
          getRevision: () => revision,
          subscribe: (listener: () => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        },
      }));
      vi.doMock('../../utils/settings-manager', () => ({
        LEGACY_DEFAULT_PROVIDER_PROFILE_ID: 'legacy-default',
      }));

      const { useSelectableModels } = await import('../use-runtime-models');
      const { result } = renderHook(() => useSelectableModels(modelType));
      expect(result.current).toEqual([]);

      selectableModels = [
        {
          id: `provider-${modelType}-model`,
          label: `Provider ${modelType} model`,
          type: modelType,
          vendor: 'OTHER',
          sourceProfileId: 'provider-b',
          selectionKey: `provider-b::provider-${modelType}-model`,
        },
      ];
      act(() => {
        revision += 1;
        listeners.forEach((listener) => listener());
      });

      expect(result.current.map((model) => model.id)).toEqual([
        `provider-${modelType}-model`,
      ]);
    }
  );
});
