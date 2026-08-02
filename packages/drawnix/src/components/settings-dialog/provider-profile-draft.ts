import {
  DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
  type InvocationPreset,
  type ProviderProfile,
} from '../../utils/settings-manager';
import type { ModelConfig, ModelType } from '../../constants/model-config';

export function createProviderProfileDraft(
  index: number,
  id: string
): ProviderProfile {
  return {
    id,
    name: `供应商 ${index}`,
    iconUrl: '',
    homepageUrl: '',
    providerType: 'auto',
    baseUrl: '',
    apiKey: '',
    authType: 'bearer',
    imageApiCompatibility: DEFAULT_PROVIDER_IMAGE_API_COMPATIBILITY,
    enabled: true,
    capabilities: {
      supportsModelsEndpoint: true,
      supportsText: true,
      supportsImage: true,
      supportsVideo: true,
      supportsAudio: true,
      supportsTools: true,
    },
  };
}

/**
 * Replace preset routes that still point at models no longer selected for a
 * provider. Routes for other providers are preserved unchanged.
 */
export function reconcileProviderPresetModels(
  presets: InvocationPreset[],
  profileId: string,
  selectedModels: ModelConfig[],
  allSelectedModels: ModelConfig[] = selectedModels
): InvocationPreset[] {
  const routeTypes: ModelType[] = ['image', 'video', 'audio', 'text'];
  const preferredModelsByType = new Map<ModelType, ModelConfig[]>(
    routeTypes.map((type) => [
      type,
      selectedModels.filter((model) => model.type === type),
    ])
  );
  const modelsByType = new Map<ModelType, ModelConfig[]>(
    routeTypes.map((type) => [
      type,
      allSelectedModels.filter((model) => model.type === type),
    ])
  );

  return presets.map((preset) => {
    let nextPreset = preset;

    routeTypes.forEach((routeType) => {
      const currentRef = nextPreset[routeType].defaultModelRef;
      if (!currentRef?.modelId) {
        return;
      }

      const availableModels = modelsByType.get(routeType) || [];
      const currentIsSelected = availableModels.some(
        (model) =>
          model.id === currentRef.modelId &&
          model.sourceProfileId === currentRef.profileId
      );
      if (currentIsSelected) {
        return;
      }

      const replacement =
        (preferredModelsByType.get(routeType) || [])[0] || availableModels[0];
      nextPreset = {
        ...nextPreset,
        [routeType]: {
          ...nextPreset[routeType],
          defaultModelRef: replacement
            ? {
                profileId: replacement.sourceProfileId || profileId,
                modelId: replacement.id,
              }
            : null,
        },
      };
    });

    return nextPreset;
  });
}
