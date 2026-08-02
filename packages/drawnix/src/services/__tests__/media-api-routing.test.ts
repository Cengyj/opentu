import { describe, expect, it, vi } from 'vitest';
import { submitVideoGeneration } from '../media-api';

describe('media-api provider routing', () => {
  it('uses bearer auth for shared video submission', async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('https://video.example.com/v1/videos');
        const headers = init?.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer video-secret');
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeInstanceOf(FormData);

        return new Response(
          JSON.stringify({
            id: 'video-task-1',
            status: 'queued',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    );

    const remoteId = await submitVideoGeneration(
      {
        prompt: 'make a video',
        model: 'veo3',
      },
      {
        apiKey: 'video-secret',
        baseUrl: 'https://video.example.com/v1',
        authType: 'bearer',
        fetchImpl,
      }
    );

    expect(remoteId).toBe('video-task-1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
