/**
 * Workspace Storage Service
 *
 * Handles IndexedDB operations for workspace data persistence.
 * Manages folders, boards, and workspace state.
 */

import localforage from 'localforage';
import {
  Folder,
  Board,
  BoardMetadata,
  WorkspaceState,
  WORKSPACE_DEFAULTS,
} from '../types/workspace.types';
import { migrateElementsFillData } from '../types/fill.types';
import type { PlaitElement } from '@plait/core';

/**
 * Cache name for images (must match the one in sw/index.ts)
 */
const IMAGE_CACHE_NAME = 'drawnix-images';

/**
 * 检测 URL 是否为 Base64 data URL
 */
function isBase64ImageUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith('data:image/') && url.includes(';base64,');
}

/**
 * 将 Base64 图片缓存到 Cache API，返回虚拟路径 URL
 */
async function cacheBase64ImageToVirtualPath(dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return dataUrl;

  const [, mimeType, base64Data] = match;

  try {
    // 将 Base64 转为 Blob
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    // 生成唯一 ID
    const id = `img-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const ext = mimeType.split('/')[1] || 'png';
    const virtualPath = `/__aitu_cache__/image/${id}.${ext}`;

    // 缓存到 Cache API
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const response = new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': blob.size.toString(),
        'Cache-Control': 'max-age=31536000',
      },
    });
    await cache.put(virtualPath, response);

    return virtualPath;
  } catch (error) {
    console.error('[Migration] Failed to cache Base64 image:', error);
    return dataUrl;
  }
}

/**
 * 迁移画布元素中的 Base64 图片 URL 到虚拟路径
 * 返回是否有元素被迁移
 */
async function migrateElementsBase64Urls(elements: PlaitElement[]): Promise<boolean> {
  let migrated = false;

  for (const element of elements) {
    // 检查图片元素
    if ((element as any).url && isBase64ImageUrl((element as any).url)) {
      const originalSize = Math.round((element as any).url.length / 1024);
      const newUrl = await cacheBase64ImageToVirtualPath((element as any).url);
      if (newUrl !== (element as any).url) {
        (element as any).url = newUrl;
        migrated = true;
        // console.log(`[Migration] Element ${element.id}: Base64 (${originalSize}KB) -> ${newUrl}`);
      }
    }

    // 递归处理子元素
    if ((element as any).children && Array.isArray((element as any).children)) {
      const childMigrated = await migrateElementsBase64Urls((element as any).children);
      if (childMigrated) migrated = true;
    }
  }

  return migrated;
}

/**
 * Database configuration
 */
const WORKSPACE_DB_CONFIG = {
  DATABASE_NAME: 'aitu-workspace',
  MIN_DATABASE_VERSION: 8,
  STORES: {
    FOLDERS: 'folders',
    BOARDS: 'boards',
    STATE: 'state',
  },
} as const;

/**
 * Disposable projection of Board metadata used by workspace startup.
 *
 * Keep this in a separate database so adding or rebuilding the projection
 * never upgrades the authoritative workspace database. `boards` remains the
 * only source of truth and this database may be cleared and rebuilt at any
 * time.
 */
const WORKSPACE_METADATA_INDEX_CONFIG = {
  DATABASE_NAME: 'aitu-workspace-index',
  VERSION: 1,
  STORE_NAME: 'board_metadata',
  SCHEMA_VERSION: 1,
} as const;

const BOARD_METADATA_MANIFEST_KEY = '__board_metadata_manifest__';
const BOARD_METADATA_PENDING_KEY = '__board_metadata_pending__';
const BOARD_METADATA_INVALIDATION_KEY = '__board_metadata_invalidated__';
const BOARD_METADATA_ENTRY_PREFIX = 'board:';
const BOARD_METADATA_INDEX_LOCK = 'aitu-workspace:board-metadata-index';
const BOARD_METADATA_REBUILD_BATCH_SIZE = 50;

interface BoardMetadataIndexManifest {
  kind: 'manifest';
  schemaVersion: typeof WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION;
  sourceRecordCount: number;
  indexedBoardCount: number;
  completedAt: number;
}

interface BoardMetadataIndexEntry {
  kind: 'board';
  schemaVersion: typeof WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION;
  metadata: BoardMetadata;
}

interface BoardMetadataIndexPendingMutation {
  kind: 'pending';
  schemaVersion: typeof WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION;
  operationId: string;
  operation: 'save' | 'metadata' | 'delete' | 'rebuild';
  boardId?: string;
  startedAt: number;
}

type BoardMetadataIndexRecord =
  | BoardMetadataIndexManifest
  | BoardMetadataIndexEntry
  | BoardMetadataIndexPendingMutation;

let metadataIndexOperationQueue: Promise<void> = Promise.resolve();

const STATE_KEY = 'workspace_state';

export type BoardMetadataUpdate = Partial<
  Pick<BoardMetadata, 'name' | 'folderId' | 'order' | 'updatedAt'>
>;

/**
 * Helper to wait for browser idle time
 */
function waitForIdle(timeout = 50): Promise<void> {
  return new Promise(resolve => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as Window).requestIdleCallback(() => resolve(), { timeout });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Detect existing database version to avoid downgrade errors
 */
async function detectDatabaseVersion(dbName: string): Promise<number> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      console.warn('[WorkspaceStorage] IndexedDB not available, using min version');
      resolve(WORKSPACE_DB_CONFIG.MIN_DATABASE_VERSION);
      return;
    }
    
    // Open without version to get current version
    const request = indexedDB.open(dbName);
    
    request.onsuccess = () => {
      const db = request.result;
      const version = db.version;
      db.close();
      const targetVersion = Math.max(version, WORKSPACE_DB_CONFIG.MIN_DATABASE_VERSION);
      resolve(targetVersion);
    };
    
    request.onerror = (event) => {
      // Try to get version from error event or use a safe high version
      console.error('[WorkspaceStorage] Error detecting DB version:', event);
      // Use a higher version to avoid downgrade - version 10 should be safe
      resolve(10);
    };
    
    request.onblocked = () => {
      // Database is blocked by another connection, use a safe high version
      console.warn('[WorkspaceStorage] DB blocked, using safe version 10');
      resolve(10);
    };
  });
}

/**
 * Workspace storage service for managing data persistence
 */
export class WorkspaceStorageService {
  private foldersStore: LocalForage | null = null;
  private boardsStore: LocalForage | null = null;
  private stateStore: LocalForage | null = null;
  private boardMetadataStore: LocalForage | null = null;
  private metadataIndexAvailable = false;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private boardWriteQueues = new Map<string, Promise<void>>();

  constructor() {
    // Defer store creation until initialization to detect version first
  }

  /**
   * Create stores with the detected version
   */
  private async createStores(): Promise<void> {
    const version = await detectDatabaseVersion(WORKSPACE_DB_CONFIG.DATABASE_NAME);
    
    this.foldersStore = localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: WORKSPACE_DB_CONFIG.DATABASE_NAME,
      version: version,
      storeName: WORKSPACE_DB_CONFIG.STORES.FOLDERS,
      description: 'Workspace folders storage',
    });

    this.boardsStore = localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: WORKSPACE_DB_CONFIG.DATABASE_NAME,
      version: version,
      storeName: WORKSPACE_DB_CONFIG.STORES.BOARDS,
      description: 'Workspace boards storage',
    });

    this.stateStore = localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: WORKSPACE_DB_CONFIG.DATABASE_NAME,
      version: version,
      storeName: WORKSPACE_DB_CONFIG.STORES.STATE,
      description: 'Workspace state storage',
    });

    this.boardMetadataStore = localforage.createInstance({
      driver: localforage.INDEXEDDB,
      name: WORKSPACE_METADATA_INDEX_CONFIG.DATABASE_NAME,
      version: WORKSPACE_METADATA_INDEX_CONFIG.VERSION,
      storeName: WORKSPACE_METADATA_INDEX_CONFIG.STORE_NAME,
      description: 'Disposable workspace board metadata index',
    });
  }

  /**
   * Initialize storage service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Ensure we only initialize once even if called concurrently
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.doInitialize();
    await this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Create stores with detected version first
      await this.createStores();
      
      await Promise.all([
        this.getFoldersStore().ready(),
        this.getBoardsStore().ready(),
        this.getStateStore().ready(),
      ]);
      await this.initializeBoardMetadataIndex();
      this.initialized = true;
    } catch (error) {
      console.error('[WorkspaceStorage] Failed to initialize:', error);
      
      // Check if it's a version downgrade error
      const errorMsg = String(error);
      if (errorMsg.includes("can't be downgraded") || errorMsg.includes('version')) {
        console.warn('[WorkspaceStorage] Version conflict detected, attempting recovery...');
        
        // Try to delete the database and reinitialize
        try {
          await this.deleteDatabase();
          await this.createStores();
          await Promise.all([
            this.getFoldersStore().ready(),
            this.getBoardsStore().ready(),
            this.getStateStore().ready(),
          ]);
          await this.initializeBoardMetadataIndex();
          this.initialized = true;
          return;
        } catch (recoveryError) {
          console.error('[WorkspaceStorage] Recovery failed:', recoveryError);
        }
      }
      
      throw new Error('Workspace storage initialization failed');
    }
  }

  /**
   * Delete the database (for recovery from version conflicts)
   */
  private async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve();
        return;
      }
      
      const request = indexedDB.deleteDatabase(WORKSPACE_DB_CONFIG.DATABASE_NAME);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        console.error('[WorkspaceStorage] Failed to delete database');
        reject(new Error('Failed to delete database'));
      };
      request.onblocked = () => {
        console.warn('[WorkspaceStorage] Database deletion blocked');
        // Still resolve after a timeout
        setTimeout(resolve, 1000);
      };
    });
  }

  // ========== Private Store Getters (ensure initialized) ==========

  private getFoldersStore(): LocalForage {
    if (!this.foldersStore) {
      throw new Error('WorkspaceStorage not initialized');
    }
    return this.foldersStore;
  }

  private getBoardsStore(): LocalForage {
    if (!this.boardsStore) {
      throw new Error('WorkspaceStorage not initialized');
    }
    return this.boardsStore;
  }

  private getStateStore(): LocalForage {
    if (!this.stateStore) {
      throw new Error('WorkspaceStorage not initialized');
    }
    return this.stateStore;
  }

  private getBoardMetadataStore(): LocalForage {
    if (!this.boardMetadataStore) {
      throw new Error('WorkspaceStorage not initialized');
    }
    return this.boardMetadataStore;
  }

  /**
   * The metadata index is disposable. Its failure must never enter the legacy
   * authoritative-database recovery branch; startup can safely scan Boards
   * until a later page load recreates the index.
   */
  private async initializeBoardMetadataIndex(): Promise<void> {
    try {
      await this.getBoardMetadataStore().ready();
      this.metadataIndexAvailable = true;
    } catch (error) {
      this.metadataIndexAvailable = false;
      try {
        await this.invalidateBoardMetadataIndex();
      } catch (invalidationError) {
        console.warn(
          '[WorkspaceStorage] Failed to persist metadata index invalidation',
          invalidationError
        );
      }
      console.warn(
        '[WorkspaceStorage] Board metadata index unavailable; using Board scan',
        error
      );
    }
  }

  private async invalidateBoardMetadataIndex(): Promise<void> {
    await this.getStateStore().setItem(BOARD_METADATA_INVALIDATION_KEY, {
      schemaVersion: WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION,
      invalidatedAt: Date.now(),
    });
  }

  /**
   * Serialize index rebuilds and board mutations across tabs. The in-process
   * queue is the fallback for runtimes without the Web Locks API.
   */
  private async withMetadataIndexLock<T>(operation: () => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(
        BOARD_METADATA_INDEX_LOCK,
        { mode: 'exclusive' },
        operation
      );
    }

    const queued = metadataIndexOperationQueue
      .catch(() => undefined)
      .then(operation);
    const completion = queued.then(
      () => undefined,
      () => undefined
    );
    metadataIndexOperationQueue = completion;
    return queued;
  }

  private createMetadataMutation(
    operation: BoardMetadataIndexPendingMutation['operation'],
    boardId?: string
  ): BoardMetadataIndexPendingMutation {
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      kind: 'pending',
      schemaVersion: WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION,
      operationId: randomPart,
      operation,
      boardId,
      startedAt: Date.now(),
    };
  }

  private extractBoardMetadata(board: Board): BoardMetadata {
    return {
      id: board.id,
      name: board.name,
      folderId: board.folderId,
      order: board.order,
      viewport: board.viewport,
      theme: board.theme,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    };
  }

  private boardMetadataEntryKey(boardId: string): string {
    return `${BOARD_METADATA_ENTRY_PREFIX}${boardId}`;
  }

  private createBoardMetadataEntry(board: Board): BoardMetadataIndexEntry {
    return {
      kind: 'board',
      schemaVersion: WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION,
      metadata: this.extractBoardMetadata(board),
    };
  }

  private isValidBoardMetadata(value: unknown): value is BoardMetadata {
    if (!value || typeof value !== 'object') return false;
    const metadata = value as Partial<BoardMetadata>;
    return (
      typeof metadata.id === 'string' &&
      metadata.id.length > 0 &&
      typeof metadata.name === 'string' &&
      (metadata.folderId === null || typeof metadata.folderId === 'string') &&
      typeof metadata.order === 'number' &&
      Number.isFinite(metadata.order) &&
      typeof metadata.createdAt === 'number' &&
      Number.isFinite(metadata.createdAt) &&
      typeof metadata.updatedAt === 'number' &&
      Number.isFinite(metadata.updatedAt)
    );
  }

  private isValidManifest(value: unknown): value is BoardMetadataIndexManifest {
    if (!value || typeof value !== 'object') return false;
    const manifest = value as Partial<BoardMetadataIndexManifest>;
    return (
      manifest.kind === 'manifest' &&
      manifest.schemaVersion === WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION &&
      typeof manifest.sourceRecordCount === 'number' &&
      Number.isInteger(manifest.sourceRecordCount) &&
      manifest.sourceRecordCount >= 0 &&
      typeof manifest.indexedBoardCount === 'number' &&
      Number.isInteger(manifest.indexedBoardCount) &&
      manifest.indexedBoardCount >= 0
    );
  }

  private async readMetadataIndexHeader(
    sourceRecordCount: number
  ): Promise<BoardMetadataIndexManifest | null> {
    const store = this.getBoardMetadataStore();
    const [manifest, pending, invalidation] = await Promise.all([
      store.getItem<BoardMetadataIndexManifest>(BOARD_METADATA_MANIFEST_KEY),
      store.getItem<BoardMetadataIndexPendingMutation>(BOARD_METADATA_PENDING_KEY),
      this.getStateStore().getItem(BOARD_METADATA_INVALIDATION_KEY),
    ]);
    if (pending || invalidation || !this.isValidManifest(manifest)) return null;
    return manifest.sourceRecordCount === sourceRecordCount ? manifest : null;
  }

  private async readValidBoardMetadataIndex(
    sourceRecordCount: number
  ): Promise<{
    manifest: BoardMetadataIndexManifest;
    metadata: BoardMetadata[];
  } | null> {
    const manifest = await this.readMetadataIndexHeader(sourceRecordCount);
    if (!manifest) return null;

    const metadata: BoardMetadata[] = [];
    const ids = new Set<string>();
    let invalid = false;
    await this.getBoardMetadataStore().iterate<BoardMetadataIndexRecord, void>(
      (record, key) => {
        if (
          key === BOARD_METADATA_MANIFEST_KEY ||
          key === BOARD_METADATA_PENDING_KEY
        ) {
          return;
        }
        if (
          !key.startsWith(BOARD_METADATA_ENTRY_PREFIX) ||
          !record ||
          record.kind !== 'board' ||
          record.schemaVersion !== WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION ||
          !this.isValidBoardMetadata(record.metadata) ||
          key !== this.boardMetadataEntryKey(record.metadata.id) ||
          ids.has(record.metadata.id)
        ) {
          invalid = true;
          return;
        }
        ids.add(record.metadata.id);
        metadata.push(record.metadata);
      }
    );

    if (invalid || metadata.length !== manifest.indexedBoardCount) {
      return null;
    }
    return { manifest, metadata };
  }

  private async writeMetadataIndexManifest(
    sourceRecordCount: number,
    indexedBoardCount: number
  ): Promise<BoardMetadataIndexManifest> {
    const manifest: BoardMetadataIndexManifest = {
      kind: 'manifest',
      schemaVersion: WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION,
      sourceRecordCount,
      indexedBoardCount,
      completedAt: Date.now(),
    };
    await this.getBoardMetadataStore().setItem(
      BOARD_METADATA_MANIFEST_KEY,
      manifest
    );
    return manifest;
  }

  /**
   * Rebuild the disposable projection from authoritative Board records. A
   * persisted pending marker makes an interrupted rebuild invalid on the next
   * startup instead of exposing a partial sidebar.
   */
  private async rebuildBoardMetadataIndexLocked(): Promise<{
    manifest: BoardMetadataIndexManifest;
    metadata: BoardMetadata[];
  }> {
    const indexStore = this.getBoardMetadataStore();
    await indexStore.clear();
    await indexStore.setItem(
      BOARD_METADATA_PENDING_KEY,
      this.createMetadataMutation('rebuild')
    );

    const metadata: BoardMetadata[] = [];
    await this.getBoardsStore().iterate<Board, void>((board) => {
      if (board && typeof board.id === 'string' && board.id.length > 0) {
        metadata.push(this.extractBoardMetadata(board));
      }
    });

    for (
      let offset = 0;
      offset < metadata.length;
      offset += BOARD_METADATA_REBUILD_BATCH_SIZE
    ) {
      const batch = metadata.slice(
        offset,
        offset + BOARD_METADATA_REBUILD_BATCH_SIZE
      );
      await Promise.all(
        batch.map((boardMetadata) =>
          indexStore.setItem(this.boardMetadataEntryKey(boardMetadata.id), {
            kind: 'board',
            schemaVersion: WORKSPACE_METADATA_INDEX_CONFIG.SCHEMA_VERSION,
            metadata: boardMetadata,
          } satisfies BoardMetadataIndexEntry)
        )
      );
    }

    const sourceRecordCount = await this.getBoardsStore().length();
    const manifest = await this.writeMetadataIndexManifest(
      sourceRecordCount,
      metadata.length
    );
    await indexStore.removeItem(BOARD_METADATA_PENDING_KEY);
    await this.getStateStore().removeItem(BOARD_METADATA_INVALIDATION_KEY);
    return { manifest, metadata };
  }

  private async ensureMetadataIndexForMutationLocked(): Promise<BoardMetadataIndexManifest> {
    const sourceRecordCount = await this.getBoardsStore().length();
    const manifest = await this.readMetadataIndexHeader(sourceRecordCount);
    if (manifest) return manifest;
    return (await this.rebuildBoardMetadataIndexLocked()).manifest;
  }

  private async loadBoardMetadataFromAuthority(): Promise<BoardMetadata[]> {
    const metadata: BoardMetadata[] = [];
    await this.getBoardsStore().iterate<Board, void>((board) => {
      if (board && typeof board.id === 'string' && board.id.length > 0) {
        metadata.push(this.extractBoardMetadata(board));
      }
    });
    return metadata.sort((a, b) => a.order - b.order);
  }

  /**
   * Serialize writes for one board so a metadata read-modify-write cannot
   * overwrite a canvas save that started immediately before it.
   */
  private async enqueueBoardWrite<T>(
    boardId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const previous = this.boardWriteQueues.get(boardId) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(operation);
    const completion = queued.then(
      () => undefined,
      () => undefined
    );
    this.boardWriteQueues.set(boardId, completion);

    try {
      return await queued;
    } finally {
      if (this.boardWriteQueues.get(boardId) === completion) {
        this.boardWriteQueues.delete(boardId);
      }
    }
  }

  // ========== Folder Operations ==========

  async saveFolder(folder: Folder): Promise<void> {
    await this.ensureInitialized();
    await this.getFoldersStore().setItem(folder.id, folder);
  }

  async loadFolder(id: string): Promise<Folder | null> {
    await this.ensureInitialized();
    return this.getFoldersStore().getItem<Folder>(id);
  }

  async loadAllFolders(): Promise<Folder[]> {
    await this.ensureInitialized();
    const folders: Folder[] = [];
    await this.getFoldersStore().iterate<Folder, void>((value) => {
      if (value && value.id) folders.push(value);
    });
    // Wait for browser idle time after IndexedDB operation
    await waitForIdle();
    return folders.sort((a, b) => a.order - b.order);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.getFoldersStore().removeItem(id);
  }

  // ========== Board Operations ==========

  async saveBoard(board: Board): Promise<void> {
    await this.ensureInitialized();
    await this.enqueueBoardWrite(board.id, async () => {
      if (!this.metadataIndexAvailable) {
        await this.invalidateBoardMetadataIndex();
        await this.getBoardsStore().setItem(board.id, board);
        return;
      }
      await this.withMetadataIndexLock(async () => {
        const manifest = await this.ensureMetadataIndexForMutationLocked();
        const indexStore = this.getBoardMetadataStore();
        const entryKey = this.boardMetadataEntryKey(board.id);
        const previousEntry = await indexStore.getItem<BoardMetadataIndexEntry>(
          entryKey
        );
        await indexStore.setItem(
          BOARD_METADATA_PENDING_KEY,
          this.createMetadataMutation('save', board.id)
        );

        await this.getBoardsStore().setItem(board.id, board);
        await indexStore.setItem(entryKey, this.createBoardMetadataEntry(board));
        if (!previousEntry) {
          await this.writeMetadataIndexManifest(
            await this.getBoardsStore().length(),
            manifest.indexedBoardCount + 1
          );
        }
        await indexStore.removeItem(BOARD_METADATA_PENDING_KEY);
      });
    });
  }

  /**
   * Update sidebar metadata without replacing the persisted board elements.
   * Workspace startup intentionally loads metadata-only projections, so those
   * projections must never be written back as complete boards.
   */
  async updateBoardMetadata(
    id: string,
    updates: BoardMetadataUpdate
  ): Promise<Board> {
    await this.ensureInitialized();
    return this.enqueueBoardWrite(id, async () => {
      if (!this.metadataIndexAvailable) {
        await this.invalidateBoardMetadataIndex();
        const store = this.getBoardsStore();
        const current = await store.getItem<Board>(id);
        if (!current) {
          throw new Error(`Board ${id} not found in storage`);
        }
        const updated: Board = {
          ...current,
          ...updates,
          id: current.id,
          elements: current.elements,
        };
        await store.setItem(id, updated);
        return updated;
      }
      return this.withMetadataIndexLock(async () => {
        await this.ensureMetadataIndexForMutationLocked();
        const store = this.getBoardsStore();
        const current = await store.getItem<Board>(id);
        if (!current) {
          throw new Error(`Board ${id} not found in storage`);
        }

        const updated: Board = {
          ...current,
          ...updates,
          id: current.id,
          elements: current.elements,
        };
        const indexStore = this.getBoardMetadataStore();
        await indexStore.setItem(
          BOARD_METADATA_PENDING_KEY,
          this.createMetadataMutation('metadata', id)
        );
        await store.setItem(id, updated);
        await indexStore.setItem(
          this.boardMetadataEntryKey(id),
          this.createBoardMetadataEntry(updated)
        );
        await indexStore.removeItem(BOARD_METADATA_PENDING_KEY);
        return updated;
      });
    });
  }

  async loadBoard(id: string): Promise<Board | null> {
    await this.ensureInitialized();
    let board: Board | null;
    try {
      board = await this.getBoardsStore().getItem<Board>(id);
    } catch (error) {
      console.error(`[Storage] Failed to load board ${id} from IndexedDB:`, error);
      return null;
    }
    if (board && board.elements) {
      // 迁移 fill 数据格式，确保渐变填充不会显示为黑色
      board.elements = migrateElementsFillData(board.elements);
      
      // 迁移 Base64 图片 URL 到虚拟路径（同步等待，确保画布显示迁移后的数据）
      try {
        const migrated = await migrateElementsBase64Urls(board.elements);
        if (migrated) {
          // 保存迁移后的数据
          await this.saveBoard(board);
          // console.log(`[Migration] Board ${id}: Base64 URLs migrated and saved`);
        }
      } catch (error) {
        console.error(`[Migration] Board ${id}: Failed to migrate`, error);
      }
    }
    return board;
  }

  async loadAllBoards(): Promise<Board[]> {
    await this.ensureInitialized();
    const boards: Board[] = [];
    await this.getBoardsStore().iterate<Board, void>((value) => {
      if (value && value.id) {
        // 迁移 fill 数据格式，确保渐变填充不会显示为黑色
        if (value.elements) {
          value.elements = migrateElementsFillData(value.elements);
        }
        boards.push(value);
      }
    });
    // Wait for browser idle time after IndexedDB operation
    await waitForIdle();
    
    // 迁移 Base64 图片 URL 到虚拟路径
    for (const board of boards) {
      if (board.elements) {
        try {
          const migrated = await migrateElementsBase64Urls(board.elements);
          if (migrated) {
            await this.saveBoard(board);
            // console.log(`[Migration] Board ${board.id}: Base64 URLs migrated and saved`);
          }
        } catch (error) {
          console.error(`[Migration] Board ${board.id}: Failed to migrate`, error);
        }
      }
    }
    
    return boards.sort((a, b) => a.order - b.order);
  }

  /**
   * 加载所有画板的元数据（不含 elements）
   * 用于侧边栏显示，减少内存占用
   */
  async loadAllBoardMetadata(): Promise<BoardMetadata[]> {
    await this.ensureInitialized();
    if (!this.metadataIndexAvailable) {
      return this.loadBoardMetadataFromAuthority();
    }

    try {
      const sourceRecordCount = await this.getBoardsStore().length();
      const indexed = await this.readValidBoardMetadataIndex(sourceRecordCount);
      if (indexed) {
        return indexed.metadata.sort((a, b) => a.order - b.order);
      }

      return await this.withMetadataIndexLock(async () => {
        // Another tab may have completed the rebuild while this tab waited.
        const currentSourceRecordCount = await this.getBoardsStore().length();
        const current = await this.readValidBoardMetadataIndex(
          currentSourceRecordCount
        );
        const rebuilt =
          current ?? (await this.rebuildBoardMetadataIndexLocked());
        return rebuilt.metadata.sort((a, b) => a.order - b.order);
      });
    } catch (error) {
      this.metadataIndexAvailable = false;
      try {
        await this.invalidateBoardMetadataIndex();
      } catch (invalidationError) {
        console.warn(
          '[WorkspaceStorage] Failed to persist metadata index invalidation',
          invalidationError
        );
      }
      console.warn(
        '[WorkspaceStorage] Board metadata index read failed; using Board scan',
        error
      );
      return this.loadBoardMetadataFromAuthority();
    }
  }

  async loadFolderBoards(folderId: string | null): Promise<Board[]> {
    await this.ensureInitialized();
    const boards: Board[] = [];
    await this.getBoardsStore().iterate<Board, void>((value) => {
      if (value && value.folderId === folderId) {
        // 迁移 fill 数据格式，确保渐变填充不会显示为黑色
        if (value.elements) {
          value.elements = migrateElementsFillData(value.elements);
        }
        boards.push(value);
      }
    });
    // Wait for browser idle time after IndexedDB operation
    await waitForIdle();
    return boards.sort((a, b) => a.order - b.order);
  }

  async deleteBoard(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.enqueueBoardWrite(id, async () => {
      if (!this.metadataIndexAvailable) {
        await this.invalidateBoardMetadataIndex();
        await this.getBoardsStore().removeItem(id);
        return;
      }
      await this.withMetadataIndexLock(async () => {
        const manifest = await this.ensureMetadataIndexForMutationLocked();
        const indexStore = this.getBoardMetadataStore();
        const entryKey = this.boardMetadataEntryKey(id);
        const previousEntry = await indexStore.getItem<BoardMetadataIndexEntry>(
          entryKey
        );
        await indexStore.setItem(
          BOARD_METADATA_PENDING_KEY,
          this.createMetadataMutation('delete', id)
        );
        await this.getBoardsStore().removeItem(id);
        await indexStore.removeItem(entryKey);
        if (previousEntry) {
          await this.writeMetadataIndexManifest(
            await this.getBoardsStore().length(),
            Math.max(0, manifest.indexedBoardCount - 1)
          );
        }
        await indexStore.removeItem(BOARD_METADATA_PENDING_KEY);
      });
    });
  }

  async deleteFolderBoards(folderId: string): Promise<void> {
    await this.ensureInitialized();
    const boards = await this.loadFolderBoards(folderId);
    await Promise.all(boards.map((b) => this.deleteBoard(b.id)));
  }

  // ========== State Operations ==========

  async saveState(state: WorkspaceState): Promise<void> {
    await this.ensureInitialized();
    await this.getStateStore().setItem(STATE_KEY, state);
  }

  async loadState(): Promise<WorkspaceState> {
    await this.ensureInitialized();
    const state = await this.getStateStore().getItem<WorkspaceState>(STATE_KEY);
    return (
      state || {
        currentBoardId: null,
        expandedFolderIds: [],
        sidebarWidth: WORKSPACE_DEFAULTS.SIDEBAR_WIDTH,
        sidebarCollapsed: false,
      }
    );
  }

  // ========== Utility Operations ==========

  async getBoardCount(): Promise<number> {
    await this.ensureInitialized();
    return this.getBoardsStore().length();
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    if (!this.metadataIndexAvailable) {
      await Promise.all([
        this.getFoldersStore().clear(),
        this.getBoardsStore().clear(),
        this.getStateStore().clear(),
      ]);
      await this.invalidateBoardMetadataIndex();
      return;
    }
    await this.withMetadataIndexLock(async () => {
      await Promise.all([
        this.getFoldersStore().clear(),
        this.getBoardsStore().clear(),
        this.getStateStore().clear(),
      ]);
      await this.getBoardMetadataStore().clear();
      await this.writeMetadataIndexManifest(0, 0);
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export const workspaceStorageService = new WorkspaceStorageService();
