import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { ModelConfig, ModelType } from '../constants/model-config';
import {
  getProfilePreferredModels,
  getPreferredModels,
  getSelectableModels,
  runtimeModelDiscovery,
  type RuntimeModelDiscoveryState,
} from '../utils/runtime-model-discovery';
import { LEGACY_DEFAULT_PROVIDER_PROFILE_ID } from '../utils/settings-manager';

export function useRuntimeModelDiscoveryState(
  profileId = LEGACY_DEFAULT_PROVIDER_PROFILE_ID
): RuntimeModelDiscoveryState {
  const revision = useRuntimeModelDiscoveryRevision();
  return useMemo(
    () => runtimeModelDiscovery.getState(profileId),
    [profileId, revision]
  );
}

const subscribeToRuntimeModels = (listener: () => void) =>
  runtimeModelDiscovery.subscribe(listener);

const getRuntimeModelRevision = () => runtimeModelDiscovery.getRevision();

function useRuntimeModelDiscoveryRevision(): number {
  return useSyncExternalStore(
    subscribeToRuntimeModels,
    getRuntimeModelRevision,
    getRuntimeModelRevision
  );
}

/**
 * 比较两个 ModelConfig 数组是否内容相同（按 id + selectionKey）
 */
function areModelListsEqual(a: ModelConfig[], b: ModelConfig[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].selectionKey !== b[i].selectionKey)
      return false;
  }
  return true;
}

export function usePreferredModels(modelType: ModelType): ModelConfig[] {
  const revision = useRuntimeModelDiscoveryRevision();
  const prevRef = useRef<ModelConfig[]>([]);
  return useMemo(() => {
    const next = getPreferredModels(modelType);
    if (areModelListsEqual(prevRef.current, next)) return prevRef.current;
    prevRef.current = next;
    return next;
  }, [modelType, revision]);
}

export function useSelectableModels(modelType: ModelType): ModelConfig[] {
  const revision = useRuntimeModelDiscoveryRevision();
  const prevRef = useRef<ModelConfig[]>([]);
  return useMemo(() => {
    const next = getSelectableModels(modelType);
    if (areModelListsEqual(prevRef.current, next)) return prevRef.current;
    prevRef.current = next;
    return next;
  }, [modelType, revision]);
}

export function useProfilePreferredModels(
  profileId: string,
  modelType: ModelType
): ModelConfig[] {
  const revision = useRuntimeModelDiscoveryRevision();
  const prevRef = useRef<ModelConfig[]>([]);
  return useMemo(() => {
    const next = getProfilePreferredModels(profileId, modelType);
    if (areModelListsEqual(prevRef.current, next)) return prevRef.current;
    prevRef.current = next;
    return next;
  }, [profileId, modelType, revision]);
}
