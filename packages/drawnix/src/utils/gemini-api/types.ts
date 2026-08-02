/**
 * Gemini API 类型定义
 */

import type {
  ProviderAuthStrategy,
  ProviderModelBinding,
  ResolvedProviderContext,
} from '../../services/provider-routing/types';

export interface GeminiConfig {
  apiKey: string;
  baseUrl: string;
  modelName?: string;
  timeout?: number;
  authType?: ProviderAuthStrategy;
  providerType?: string;
  extraHeaders?: Record<string, string>;
  protocol?: string | null;
  binding?: ProviderModelBinding | null;
  provider?: ResolvedProviderContext | null;
  /** Optional transport injection used by image execution and tests. */
  fetcher?: typeof fetch;
}

export interface ImageInput {
  file?: File;
  base64?: string;
  url?: string;
}

export type GeminiMessagePart =
  | {
      type: 'text';
      text?: string;
    }
  | {
      type: 'image_url';
      image_url?: {
        url: string;
      };
    }
  | {
      /** base64 内联数据（视频/音频/PDF 等） */
      type: 'inline_data';
      mimeType: string;
      data: string;
    }
  | {
      /** 远程文件 URI（如 YouTube URL） */
      type: 'file_uri';
      fileUri: string;
    };

export interface GeminiMessage {
  role: 'user' | 'assistant' | 'system';
  content: GeminiMessagePart[];
}

export interface VideoGenerationOptions {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export interface GeminiResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  /**
   * Structured media returned by Google generateContent.
   *
   * Keep inline payloads structured so image callers do not have to build a
   * multi-megabyte data URL and then parse it again. `choices` remains for
   * chat/backward compatibility.
   */
  inlineMedia?: Array<{
    data?: string;
    url?: string;
    mimeType?: string;
  }>;
}

export interface ProcessedContent {
  textContent: string;
  images: Array<{
    type: 'base64' | 'url';
    data: string;
    index: number;
  }>;
  videos?: Array<{
    type: 'url';
    data: string;
    index: number;
  }>;
  originalContent: string;
}
