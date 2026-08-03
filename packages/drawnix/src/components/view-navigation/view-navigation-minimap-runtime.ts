import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';

export type ViewNavigationMinimapComponent =
  typeof import('../minimap/Minimap')['Minimap'];

export const loadViewNavigationMinimap =
  createRetriableModuleLoader<ViewNavigationMinimapComponent>(async () => {
    const minimapModule = await import('../minimap/Minimap');
    return minimapModule.Minimap;
  });
