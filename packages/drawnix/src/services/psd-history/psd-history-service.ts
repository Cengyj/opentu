import { APP_DB_STORES, getAppDB } from '../app-database';
import type { PsdHistoryEntry, PsdHistoryStatus } from './psd-history-types';

const MAX_ENTRIES = 50;

/**
 * 由各图层任务态派生会话整体状态。upsert 与历史列表 live 合并共用，避免逻辑漂移。
 */
export function derivePsdHistoryStatus(
  states: Array<{ status: string }>,
  hasTasks: boolean
): PsdHistoryStatus {
  if (!hasTasks) return 'reviewing';
  const active = states.some(
    (state) => state.status === 'queued' || state.status === 'processing'
  );
  if (active) return 'generating';
  const readyCount = states.filter((state) => state.status === 'ready').length;
  const failed = states.some(
    (state) => state.status === 'failed' || state.status === 'cancelled'
  );
  if (readyCount > 0 && failed) return 'partial';
  if (readyCount > 0) return 'completed';
  if (failed) return 'failed';
  return 'generating';
}

/**
 * PSD 会话历史存储。直接读写主库 `aitu-app` 的 `psd_history` store，不经 SW。
 * 旁路化：所有失败静默，绝不影响主生成流程。
 */
class PsdHistoryService {
  private async withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await getAppDB();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(APP_DB_STORES.PSD_HISTORY, mode);
      const request = run(tx.objectStore(APP_DB_STORES.PSD_HISTORY));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async listEntries(): Promise<PsdHistoryEntry[]> {
    try {
      const entries = await this.withStore<PsdHistoryEntry[]>(
        'readonly',
        (store) => store.getAll() as IDBRequest<PsdHistoryEntry[]>
      );
      return entries.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.debug('[PsdHistory] listEntries failed:', error);
      return [];
    }
  }

  async getEntry(id: string): Promise<PsdHistoryEntry | null> {
    try {
      const entry = await this.withStore<PsdHistoryEntry | undefined>(
        'readonly',
        (store) => store.get(id) as IDBRequest<PsdHistoryEntry | undefined>
      );
      return entry ?? null;
    } catch (error) {
      console.debug('[PsdHistory] getEntry failed:', error);
      return null;
    }
  }

  /** 写入或合并更新一条会话历史，并缓存源图、淘汰超限旧记录。 */
  async upsertEntry(
    entry: Omit<PsdHistoryEntry, 'createdAt' | 'updatedAt'> &
      Partial<Pick<PsdHistoryEntry, 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    try {
      const existing = await this.getEntry(entry.id);
      const now = Date.now();
      const sourceImage = await this.ensureCachedSourceImage(entry.sourceImage);
      const next: PsdHistoryEntry = {
        ...entry,
        sourceImage,
        createdAt: existing?.createdAt ?? entry.createdAt ?? now,
        updatedAt: now,
      };
      await this.withStore('readwrite', (store) => store.put(next));
      await this.pruneToLimit();
    } catch (error) {
      console.debug('[PsdHistory] upsertEntry failed:', error);
    }
  }

  async deleteEntry(id: string): Promise<void> {
    try {
      await this.withStore('readwrite', (store) => store.delete(id));
    } catch (error) {
      console.debug('[PsdHistory] deleteEntry failed:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.withStore('readwrite', (store) => store.clear());
    } catch (error) {
      console.debug('[PsdHistory] clear failed:', error);
    }
  }

  /** 把源图缓存到 /__aitu_cache__/，保证刷新后缩略图不丢、避免签名 url 403。 */
  private async ensureCachedSourceImage(
    sourceImage: PsdHistoryEntry['sourceImage']
  ): Promise<PsdHistoryEntry['sourceImage']> {
    if (!sourceImage?.url) return sourceImage;
    try {
      // 懒加载：fallback-utils 静态依赖 provider-routing/model-pricing 等重模块，
      // 不应在历史服务模块初始化时一并拉入（也利于测试与按需加载）。
      const { cacheRemoteUrl } = await import(
        '../media-executor/fallback-utils'
      );
      const cachedUrl = await cacheRemoteUrl(
        sourceImage.url,
        `psd-history-${Date.now()}`,
        'image',
        'png',
        undefined,
        { source: 'PLAYBACK_CACHE', forceRemoteCache: true }
      );
      return { ...sourceImage, url: cachedUrl };
    } catch (error) {
      console.debug('[PsdHistory] cache source image failed:', error);
      return sourceImage;
    }
  }

  private async pruneToLimit(): Promise<void> {
    try {
      const entries = await this.listEntries();
      if (entries.length <= MAX_ENTRIES) return;
      const stale = entries.slice(MAX_ENTRIES);
      await Promise.all(stale.map((entry) => this.deleteEntry(entry.id)));
    } catch (error) {
      console.debug('[PsdHistory] pruneToLimit failed:', error);
    }
  }
}

export const psdHistoryService = new PsdHistoryService();
