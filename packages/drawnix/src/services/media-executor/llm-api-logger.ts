/**
 * LLM API Logger for Main Thread (Fallback Mode)
 *
 * 主线程版本的 LLM API 日志记录器，用于降级模式。
 * 写入与 SW 相同的 IndexedDB，确保调试面板能读取。
 */

import { truncate, sanitizeRequestBody } from '@aitu/utils';

// 与 SW 端保持一致的数据库配置
const DB_NAME = 'llm-api-logs';
const DB_VERSION = 4;
const STORE_NAME = 'logs';
const MAX_DB_LOGS = 1000;
const MAX_RESPONSE_BODY_LENGTH = 128 * 1024; // 保留脱敏后的 JSON 结构，极端大响应再截断
const MAX_LOG_URL_LENGTH = 2048;
const RAW_BASE64_REDACTION_MIN_LENGTH = 128;
const REDACTED_INLINE_MEDIA = '[REDACTED: inline media]';
const REDACTED_BASE64 = '[REDACTED: base64 payload]';
const REDACTED_SIGNED_URL_CREDENTIAL = '[REDACTED: signed URL credential]';

/**
 * Credential-bearing query parameters used by common object stores and CDNs.
 *
 * Expiration, date and algorithm parameters are intentionally retained because
 * they are useful when diagnosing an expired URL and are not credentials.
 */
const SENSITIVE_SIGNED_URL_QUERY_PARAMS = new Set([
  'access_token',
  'accesskeyid',
  'apikey',
  'api_key',
  'authorization',
  'awsaccesskeyid',
  'credential',
  'googleaccessid',
  'key-pair-id',
  'ossaccesskeyid',
  'policy',
  'q-ak',
  'q-signature',
  'security-token',
  'sig',
  'signature',
  'token',
  'x-amz-credential',
  'x-amz-security-token',
  'x-amz-signature',
  'x-goog-credential',
  'x-goog-signature',
  'x-oss-credential',
  'x-oss-security-token',
  'x-oss-signature',
]);

/**
 * 参考图信息
 */
export interface LLMReferenceImage {
  url: string;
  size: number;
  width: number;
  height: number;
  name?: string;
}

/**
 * LLM API 日志条目
 */
export interface LLMApiLog {
  id: string;
  timestamp: number;
  endpoint: string;
  model: string;
  taskType: 'image' | 'video' | 'audio' | 'chat' | 'character' | 'other';
  prompt?: string;
  requestBody?: string;
  hasReferenceImages?: boolean;
  referenceImageCount?: number;
  referenceImages?: LLMReferenceImage[];
  status: 'pending' | 'success' | 'error';
  httpStatus?: number;
  duration?: number;
  resultType?: string;
  resultCount?: number;
  resultUrl?: string;
  resultText?: string;
  responseBody?: string;
  errorMessage?: string;
  remoteId?: string;
  taskId?: string;
  workflowId?: string;
}

/**
 * 内存日志缓存
 */
const memoryLogs: LLMApiLog[] = [];
const MAX_MEMORY_LOGS = 50;

/**
 * 打开 IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      let store: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('taskType', 'taskType', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('taskId', 'taskId', { unique: false });
      } else {
        const tx = (event.target as IDBOpenDBRequest).transaction;
        if (tx) {
          store = tx.objectStore(STORE_NAME);
          if (oldVersion < 4 && !store.indexNames.contains('taskId')) {
            store.createIndex('taskId', 'taskId', { unique: false });
          }
        }
      }
    };
  });
}

/**
 * 保存日志到 IndexedDB
 */
async function saveLogToDB(log: LLMApiLog): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put(log);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // 清理旧日志在独立 transaction 中执行，失败不影响写入
    try {
      const cleanTx = db.transaction(STORE_NAME, 'readwrite');
      const cleanStore = cleanTx.objectStore(STORE_NAME);
      const countReq = cleanStore.count();
      countReq.onsuccess = () => {
        if (countReq.result > MAX_DB_LOGS) {
          const idx = cleanStore.index('timestamp');
          const deleteCount = countReq.result - MAX_DB_LOGS;
          let deleted = 0;
          idx.openCursor().onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor && deleted < deleteCount) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
      };
    } catch {
      // 清理失败不影响主流程
    }
  } catch (error) {
    console.warn('[LLMApiLogger:Fallback] Failed to save log:', error);
  }
}

/**
 * 开始记录 LLM API 调用
 */
export function startLLMApiLog(params: {
  endpoint: string;
  model: string;
  taskType: LLMApiLog['taskType'];
  prompt?: string;
  requestBody?: string;
  hasReferenceImages?: boolean;
  referenceImageCount?: number;
  referenceImages?: LLMReferenceImage[];
  taskId?: string;
  workflowId?: string;
}): string {
  const id = `llm-fallback-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)}`;

  const log: LLMApiLog = {
    id,
    timestamp: Date.now(),
    endpoint: params.endpoint,
    model: params.model,
    taskType: params.taskType,
    prompt: params.prompt ? truncate(params.prompt, 2000) : undefined,
    requestBody: params.requestBody
      ? sanitizeRequestBody(params.requestBody)
      : undefined,
    hasReferenceImages: params.hasReferenceImages,
    referenceImageCount: params.referenceImageCount,
    referenceImages: params.referenceImages?.map((image) => ({
      ...image,
      url: sanitizeLogUrl(image.url),
    })),
    status: 'pending',
    taskId: params.taskId,
    workflowId: params.workflowId,
  };

  // 添加到内存缓存
  memoryLogs.unshift(log);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs.pop();
  }

  // 保存到 IndexedDB
  saveLogToDB(log);

  return id;
}

/**
 * 更新 LLM API 日志为成功状态
 */
export function completeLLMApiLog(
  logId: string,
  params: {
    httpStatus: number;
    duration: number;
    resultType?: string;
    resultCount?: number;
    resultUrl?: string;
    resultText?: string;
    responseBody?: string;
    remoteId?: string;
  }
): void {
  const log = memoryLogs.find((l) => l.id === logId);
  if (log) {
    log.status = 'success';
    log.httpStatus = params.httpStatus;
    log.duration = params.duration;
    log.resultType = params.resultType;
    log.resultCount = params.resultCount;
    log.resultUrl = params.resultUrl
      ? sanitizeLogUrl(params.resultUrl)
      : params.resultUrl;
    log.resultText = params.resultText
      ? truncate(params.resultText, 1000)
      : undefined;
    log.responseBody = params.responseBody
      ? sanitizeResponseBody(params.responseBody)
      : undefined;
    log.remoteId = params.remoteId;

    // 更新 IndexedDB
    saveLogToDB(log);
  }
}

/**
 * 更新 LLM API 日志元数据（如 remoteId）
 */
export function updateLLMApiLogMetadata(
  logId: string,
  params: {
    remoteId?: string;
    responseBody?: string;
    httpStatus?: number;
  }
): void {
  const log = memoryLogs.find((l) => l.id === logId);
  if (log) {
    if (params.remoteId) log.remoteId = params.remoteId;
    if (params.responseBody) {
      log.responseBody = sanitizeResponseBody(params.responseBody);
    }
    if (params.httpStatus) log.httpStatus = params.httpStatus;

    // 更新 IndexedDB
    saveLogToDB(log);
  }
}

/**
 * 更新 LLM API 日志为失败状态
 */
export function failLLMApiLog(
  logId: string,
  params: {
    httpStatus?: number;
    duration: number;
    errorMessage: string;
    responseBody?: string;
  }
): void {
  const log = memoryLogs.find((l) => l.id === logId);
  if (log) {
    log.status = 'error';
    log.httpStatus = params.httpStatus;
    log.duration = params.duration;
    log.errorMessage = truncate(params.errorMessage, 500);
    log.responseBody = params.responseBody
      ? sanitizeResponseBody(params.responseBody)
      : undefined;

    // 更新 IndexedDB
    saveLogToDB(log);
  }
}

/**
 * 带日志记录的 fetch 包装器
 */
export async function llmFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  meta: {
    model: string;
    taskType: LLMApiLog['taskType'];
    prompt?: string;
    hasReferenceImages?: boolean;
    referenceImageCount?: number;
    taskId?: string;
    workflowId?: string;
  }
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
  const endpoint = new URL(url).pathname;
  const startTime = Date.now();

  // 开始记录
  const logId = startLLMApiLog({
    endpoint,
    model: meta.model,
    taskType: meta.taskType,
    prompt: meta.prompt,
    hasReferenceImages: meta.hasReferenceImages,
    referenceImageCount: meta.referenceImageCount,
    taskId: meta.taskId,
    workflowId: meta.workflowId,
  });

  try {
    const response = await fetch(input, init);
    const duration = Date.now() - startTime;

    if (response.ok) {
      completeLLMApiLog(logId, {
        httpStatus: response.status,
        duration,
        resultType:
          meta.taskType === 'image'
            ? 'image'
            : meta.taskType === 'video'
            ? 'video'
            : 'text',
        resultCount: 1,
      });
    } else {
      const errorText = await response
        .clone()
        .text()
        .catch(() => 'Unknown error');
      failLLMApiLog(logId, {
        httpStatus: response.status,
        duration,
        errorMessage: errorText,
      });
    }

    return response;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    failLLMApiLog(logId, {
      duration,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 获取日志 ID（用于后续更新）
 */
export function getLogId(taskId: string): string | undefined {
  const log = memoryLogs.find((l) => l.taskId === taskId);
  return log?.id;
}

function sanitizeResponseBody(text: string): string {
  const sanitized = sanitizeJsonResponseBody(text);
  if (sanitized.length <= MAX_RESPONSE_BODY_LENGTH) return sanitized;
  return `${sanitized.substring(
    0,
    MAX_RESPONSE_BODY_LENGTH
  )}\n... [response truncated for log storage]`;
}

/**
 * Redact media payloads and signed URL credentials while preserving the
 * provider's response shape and ordinary diagnostic fields.
 *
 * Provider responses are expected to be JSON. If a malformed response still
 * advertises a sensitive media field or signed credential, retain only a safe
 * diagnostic marker and its original length rather than persisting a fragment.
 */
function sanitizeJsonResponseBody(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return JSON.stringify(sanitizeJsonValue(parsed));
  } catch {
    if (containsSensitiveResponseMarker(text)) {
      return `[REDACTED: unparseable response contained sensitive payload; original length=${text.length}]`;
    }
    return text;
  }
}

function sanitizeJsonValue(value: unknown, parentKey?: string): unknown {
  if (typeof value === 'string') {
    if (/^\s*data:/i.test(value)) {
      return REDACTED_INLINE_MEDIA;
    }
    if (!isStructuredUrl(value) && isLongRawBase64(value)) {
      return REDACTED_BASE64;
    }
    return sanitizeSignedUrlQuery(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item, parentKey));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const [key, nestedValue] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase();
    const normalizedParentKey = parentKey?.toLowerCase();
    const isInlineMediaData =
      normalizedKey === 'data' &&
      (normalizedParentKey === 'inlinedata' ||
        normalizedParentKey === 'inline_data');

    if (
      typeof nestedValue === 'string' &&
      (normalizedKey === 'b64_json' || isInlineMediaData)
    ) {
      record[key] = REDACTED_BASE64;
      continue;
    }

    record[key] = sanitizeJsonValue(nestedValue, key);
  }

  return record;
}

function containsSensitiveResponseMarker(text: string): boolean {
  return (
    /["']?(?:b64_json|inlineData|inline_data)["']?\s*[:=]/i.test(text) ||
    /data:[^,\s"']{1,256};base64,/i.test(text) ||
    /[a-z\d+/_-]{128,}={0,2}/i.test(text) ||
    containsSignedUrlCredentialMarker(text)
  );
}

/**
 * Keep diagnostic URLs useful without retaining inline media payloads.
 *
 * Redaction happens before truncation so a data URL or raw Base64 value can
 * never be persisted as a payload fragment. Recognizable network, object and
 * virtual-path URLs remain available to the debug UI, subject to a hard bound.
 */
function sanitizeLogUrl(url: string): string {
  // Classify before trimming so large inline payloads are not copied just to
  // decide that they must be redacted.
  if (/^\s*(?:["']\s*)?data:/i.test(url)) {
    return REDACTED_INLINE_MEDIA;
  }

  if (!isStructuredUrl(url) && isLongRawBase64(url)) {
    return REDACTED_BASE64;
  }

  return truncate(sanitizeSignedUrlQuery(url.trim()), MAX_LOG_URL_LENGTH);
}

function sanitizeSignedUrlQuery(value: string): string {
  const queryStart = value.indexOf('?');
  if (queryStart < 1) {
    return value;
  }

  const fragmentStart = value.indexOf('#', queryStart);
  const queryEnd = fragmentStart === -1 ? value.length : fragmentStart;
  const queryEntries = Array.from(
    new URLSearchParams(value.slice(queryStart + 1, queryEnd)).entries()
  );
  if (!queryEntries.some(([key]) => isSignedUrlCredentialKey(key))) {
    return value;
  }

  const sanitizedQuery = new URLSearchParams();
  for (const [key, queryValue] of queryEntries) {
    sanitizedQuery.append(
      key,
      isSignedUrlCredentialKey(key)
        ? REDACTED_SIGNED_URL_CREDENTIAL
        : queryValue
    );
  }

  return `${value.slice(
    0,
    queryStart + 1
  )}${sanitizedQuery.toString()}${value.slice(queryEnd)}`;
}

function containsSignedUrlCredentialMarker(text: string): boolean {
  const queryKeyPattern = /(?:[?&]|\\u0026)([^=&#\s"'\\]+)=/gi;
  let match: RegExpExecArray | null;
  while ((match = queryKeyPattern.exec(text))) {
    if (isSignedUrlCredentialKey(decodeQueryKey(match[1]))) {
      return true;
    }
  }
  return false;
}

function decodeQueryKey(key: string): string {
  try {
    return decodeURIComponent(key.replace(/\+/g, ' '));
  } catch {
    return key;
  }
}

function isSignedUrlCredentialKey(key: string): boolean {
  return SENSITIVE_SIGNED_URL_QUERY_PARAMS.has(key.toLowerCase());
}

function isStructuredUrl(value: string): boolean {
  return /^\s*(?:[a-z][a-z\d+.-]*:|\.{1,2}\/|\/(?:__aitu_cache__|asset-library)\/)/i.test(
    value
  );
}

function isLongRawBase64(value: string): boolean {
  return (
    value.length >= RAW_BASE64_REDACTION_MIN_LENGTH &&
    /^[a-z\d+/_=\s-]+$/i.test(value)
  );
}
