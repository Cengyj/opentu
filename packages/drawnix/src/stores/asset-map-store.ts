/**
 * 模块级 asset map store
 *
 * 解决 CardGenerator.createRoot 创建的独立 React 树无法访问 AssetContext 的问题。
 * AssetProvider 更新时写入，CardElement 通过 useSyncExternalStore 订阅。
 */
import type { Asset } from '../types/asset.types';

type Listener = () => void;

export type AssetMapStatus = 'idle' | 'loading' | 'ready' | 'error';

let currentMap: Map<string, Asset> = new Map();
let currentStatus: AssetMapStatus = 'idle';
const listeners = new Set<Listener>();

export function setGlobalAssetMap(
  map: Map<string, Asset>,
  status: AssetMapStatus = 'ready'
): void {
  if (map === currentMap && status === currentStatus) return;
  currentMap = map;
  currentStatus = status;
  listeners.forEach((fn) => fn());
}

export function setGlobalAssetMapStatus(status: AssetMapStatus): void {
  if (status === currentStatus) return;
  currentStatus = status;
  listeners.forEach((fn) => fn());
}

export function getAssetMapSnapshot(): Map<string, Asset> {
  return currentMap;
}

export function getAssetMapStatusSnapshot(): AssetMapStatus {
  return currentStatus;
}

export function subscribeAssetMap(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
