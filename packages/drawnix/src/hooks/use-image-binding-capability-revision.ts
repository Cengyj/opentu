import { useSyncExternalStore } from 'react';
import {
  getImageBindingCapabilityRevision,
  subscribeImageBindingCapabilityRevision,
} from '../services/image-binding-parameter-capabilities';

/**
 * Recomputes image parameter presentation only when an input capable of
 * changing the selected binding/capabilities changes.
 */
export function useImageBindingCapabilityRevision(): string {
  return useSyncExternalStore(
    subscribeImageBindingCapabilityRevision,
    getImageBindingCapabilityRevision,
    getImageBindingCapabilityRevision
  );
}
