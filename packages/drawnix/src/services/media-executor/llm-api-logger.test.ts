/**
 * @vitest-environment node
 */

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  completeLLMApiLog,
  failLLMApiLog,
  startLLMApiLog,
  type LLMApiLog,
  updateLLMApiLogMetadata,
} from './llm-api-logger';

const DB_NAME = 'llm-api-logs';
const DB_VERSION = 4;
const STORE_NAME = 'logs';

async function readLog(logId: string): Promise<LLMApiLog | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    return await new Promise<LLMApiLog | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(logId);
      request.onsuccess = () =>
        resolve(request.result as LLMApiLog | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function waitForLog(
  logId: string,
  predicate: (log: LLMApiLog) => boolean
): Promise<LLMApiLog> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const log = await readLog(logId);
    if (log && predicate(log)) {
      return log;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  throw new Error(`Timed out waiting for LLM API log ${logId}`);
}

function startTestLog(referenceImages?: LLMApiLog['referenceImages']): string {
  return startLLMApiLog({
    endpoint: '/v1/images/generations',
    model: 'image-model',
    taskType: 'image',
    referenceImages,
  });
}

describe('LLM API logger media URL redaction', () => {
  it('replaces a complete or caller-truncated data URL instead of retaining any payload fragment', async () => {
    const secretPayload = `private-image-payload-${'A'.repeat(512)}`;
    const dataUrl = `data:image/png;base64,${secretPayload}`;
    const logId = startTestLog();

    completeLLMApiLog(logId, {
      httpStatus: 200,
      duration: 20,
      resultType: 'image',
      resultUrl: dataUrl.substring(0, 200),
    });

    const stored = await waitForLog(logId, (log) => log.status === 'success');
    expect(stored.resultUrl).toBe('[REDACTED: inline media]');
    expect(JSON.stringify(stored)).not.toContain('private-image-payload');
    expect(JSON.stringify(stored)).not.toContain('data:image');
  });

  it('replaces long raw Base64 results without retaining a prefix or suffix', async () => {
    const rawPayloads = [
      Buffer.from(`private-binary-image-${'content'.repeat(100)}`).toString(
        'base64'
      ),
      `/9j/${'A'.repeat(512)}`,
    ];

    for (const rawBase64 of rawPayloads) {
      const logId = startTestLog();
      completeLLMApiLog(logId, {
        httpStatus: 200,
        duration: 20,
        resultType: 'image',
        resultUrl: rawBase64,
      });

      const stored = await waitForLog(logId, (log) => log.status === 'success');
      expect(stored.resultUrl).toBe('[REDACTED: base64 payload]');
      expect(stored.resultUrl).not.toContain(rawBase64.slice(0, 32));
      expect(stored.resultUrl).not.toContain(rawBase64.slice(-32));
    }
  });

  it('sanitizes reference image URLs without mutating their useful metadata', async () => {
    const rawBase64 = Buffer.from('reference-image'.repeat(100)).toString(
      'base64'
    );
    const remoteUrl = 'https://cdn.example.com/reference.png?variant=large';
    const virtualUrl = '/__aitu_cache__/image/content-reference.png';
    const logId = startTestLog([
      {
        url: `data:image/jpeg;base64,private-reference-${'B'.repeat(256)}`,
        size: 10,
        width: 20,
        height: 30,
        name: 'inline-reference.jpg',
      },
      { url: rawBase64, size: 40, width: 50, height: 60 },
      { url: remoteUrl, size: 70, width: 80, height: 90 },
      { url: virtualUrl, size: 100, width: 110, height: 120 },
    ]);

    const stored = await waitForLog(logId, (log) => log.status === 'pending');
    expect(stored.referenceImages).toEqual([
      {
        url: '[REDACTED: inline media]',
        size: 10,
        width: 20,
        height: 30,
        name: 'inline-reference.jpg',
      },
      {
        url: '[REDACTED: base64 payload]',
        size: 40,
        width: 50,
        height: 60,
      },
      { url: remoteUrl, size: 70, width: 80, height: 90 },
      { url: virtualUrl, size: 100, width: 110, height: 120 },
    ]);
  });

  it('keeps ordinary result URLs useful while enforcing a storage bound', async () => {
    const urlPrefix = 'https://cdn.example.com/generated.png?diagnostic=';
    const longUrl = `${urlPrefix}${'value-'.repeat(500)}`;
    const logId = startTestLog();

    completeLLMApiLog(logId, {
      httpStatus: 200,
      duration: 20,
      resultType: 'image',
      resultUrl: longUrl,
    });

    const stored = await waitForLog(logId, (log) => log.status === 'success');
    expect(stored.resultUrl).toMatch(
      /^https:\/\/cdn\.example\.com\/generated\.png/
    );
    expect(stored.resultUrl).toHaveLength(2048);
    expect(stored.resultUrl).toMatch(/\.\.\.$/);
  });

  it('redacts signed URL credentials while retaining useful URL diagnostics', async () => {
    const resultSignature = 'private-result-signature';
    const referenceSignature = 'private-reference-signature';
    const resultUrl =
      `https://cdn.example.com/generated.png?variant=large` +
      `&X-Amz-Credential=temporary-credential` +
      `&X-Amz-Signature=${resultSignature}` +
      `&X-Amz-Expires=900#preview`;
    const referenceUrl =
      `//assets.example.com/reference.png?width=1024` +
      `&Signature=${referenceSignature}&Expires=1780000000`;
    const logId = startTestLog([
      { url: referenceUrl, size: 10, width: 20, height: 30 },
    ]);

    completeLLMApiLog(logId, {
      httpStatus: 200,
      duration: 20,
      resultType: 'image',
      resultUrl,
    });

    const stored = await waitForLog(logId, (log) => log.status === 'success');
    const storedReference = stored.referenceImages?.[0];
    if (!stored.resultUrl || !storedReference) {
      throw new Error('Expected persisted result and reference URLs');
    }
    const sanitizedResult = new URL(stored.resultUrl);
    const sanitizedReference = new URL(`https:${storedReference.url}`);

    expect(sanitizedResult.pathname).toBe('/generated.png');
    expect(sanitizedResult.searchParams.get('variant')).toBe('large');
    expect(sanitizedResult.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(sanitizedResult.searchParams.get('X-Amz-Credential')).toBe(
      '[REDACTED: signed URL credential]'
    );
    expect(sanitizedResult.searchParams.get('X-Amz-Signature')).toBe(
      '[REDACTED: signed URL credential]'
    );
    expect(sanitizedResult.hash).toBe('#preview');
    expect(sanitizedReference.searchParams.get('width')).toBe('1024');
    expect(sanitizedReference.searchParams.get('Expires')).toBe('1780000000');
    expect(sanitizedReference.searchParams.get('Signature')).toBe(
      '[REDACTED: signed URL credential]'
    );
    expect(JSON.stringify(stored)).not.toContain(resultSignature);
    expect(JSON.stringify(stored)).not.toContain(referenceSignature);
    expect(JSON.stringify(stored)).not.toContain('temporary-credential');
  });
});

describe('LLM API logger response body redaction', () => {
  it('redacts GPT and Gemini inline media before applying the response size bound', async () => {
    const gptPayload = Buffer.alloc(160 * 1024, 65).toString('base64');
    const camelCasePayload = Buffer.from(
      'private-gemini-camel-case-media'.repeat(100)
    ).toString('base64');
    const snakeCasePayload = Buffer.from(
      'private-gemini-snake-case-media'.repeat(100)
    ).toString('base64');
    const signedSecret = 'private-response-signature';
    const responseBody = JSON.stringify({
      created: 1780000000,
      data: [
        {
          b64_json: gptPayload,
          revised_prompt: 'keep this diagnostic prompt',
        },
      ],
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: camelCasePayload,
                },
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: snakeCasePayload,
                },
              },
              { text: 'keep this provider diagnostic' },
            ],
          },
        },
      ],
      output_url:
        `https://cdn.example.com/output.png?trace=trace-123` +
        `&X-Goog-Signature=${signedSecret}&X-Goog-Expires=600`,
      diagnostics: {
        data: 'ordinary non-media data',
        request_id: 'request-123',
      },
    });
    expect(responseBody.length).toBeGreaterThan(128 * 1024);
    const logId = startTestLog();

    completeLLMApiLog(logId, {
      httpStatus: 200,
      duration: 20,
      resultType: 'image',
      responseBody,
    });

    const stored = await waitForLog(logId, (log) => log.status === 'success');
    if (!stored.responseBody) {
      throw new Error('Expected a persisted response body');
    }
    const sanitized = JSON.parse(stored.responseBody);
    const sanitizedOutputUrl = new URL(sanitized.output_url);

    expect(sanitized.data[0]).toEqual({
      b64_json: '[REDACTED: base64 payload]',
      revised_prompt: 'keep this diagnostic prompt',
    });
    expect(sanitized.candidates[0].content.parts).toEqual([
      {
        inlineData: {
          mimeType: 'image/png',
          data: '[REDACTED: base64 payload]',
        },
      },
      {
        inline_data: {
          mime_type: 'image/jpeg',
          data: '[REDACTED: base64 payload]',
        },
      },
      { text: 'keep this provider diagnostic' },
    ]);
    expect(sanitized.diagnostics).toEqual({
      data: 'ordinary non-media data',
      request_id: 'request-123',
    });
    expect(sanitizedOutputUrl.searchParams.get('trace')).toBe('trace-123');
    expect(sanitizedOutputUrl.searchParams.get('X-Goog-Expires')).toBe('600');
    expect(sanitizedOutputUrl.searchParams.get('X-Goog-Signature')).toBe(
      '[REDACTED: signed URL credential]'
    );

    expect(stored.responseBody).not.toContain(gptPayload.slice(0, 64));
    expect(stored.responseBody).not.toContain(camelCasePayload.slice(0, 64));
    expect(stored.responseBody).not.toContain(snakeCasePayload.slice(0, 64));
    expect(stored.responseBody).not.toContain(signedSecret);
    expect(stored.responseBody).not.toContain(
      '[response truncated for log storage]'
    );
  });

  it('uses the same response sanitizer for metadata updates and failures', async () => {
    const updateSecret = Buffer.from(
      'private-update-media'.repeat(100)
    ).toString('base64');
    const failureSecret = Buffer.from(
      'private-failure-media'.repeat(100)
    ).toString('base64');
    const updateLogId = startTestLog();
    const failureLogId = startTestLog();

    updateLLMApiLogMetadata(updateLogId, {
      httpStatus: 202,
      responseBody: JSON.stringify({
        candidate: {
          inline_data: { mime_type: 'image/png', data: updateSecret },
        },
        remote_id: 'remote-123',
      }),
    });
    failLLMApiLog(failureLogId, {
      httpStatus: 502,
      duration: 100,
      errorMessage: 'upstream failed',
      responseBody: JSON.stringify({
        data: [{ b64_json: failureSecret }],
        error: { code: 'UPSTREAM_FAILURE' },
      }),
    });

    const updated = await waitForLog(
      updateLogId,
      (log) => log.httpStatus === 202 && Boolean(log.responseBody)
    );
    const failed = await waitForLog(
      failureLogId,
      (log) => log.status === 'error'
    );
    if (!updated.responseBody || !failed.responseBody) {
      throw new Error('Expected persisted update and failure response bodies');
    }
    const updatedBody = JSON.parse(updated.responseBody);
    const failedBody = JSON.parse(failed.responseBody);

    expect(updatedBody.candidate.inline_data.data).toBe(
      '[REDACTED: base64 payload]'
    );
    expect(updatedBody.remote_id).toBe('remote-123');
    expect(failedBody.data[0].b64_json).toBe('[REDACTED: base64 payload]');
    expect(failedBody.error.code).toBe('UPSTREAM_FAILURE');
    expect(updated.responseBody).not.toContain(updateSecret.slice(0, 64));
    expect(failed.responseBody).not.toContain(failureSecret.slice(0, 64));
  });

  it('does not retain fragments from malformed sensitive responses', async () => {
    const secret = Buffer.from('private-malformed-media'.repeat(100)).toString(
      'base64'
    );
    const malformed = `{"data":[{"b64_json":"${secret}"}`;
    const logId = startTestLog();

    completeLLMApiLog(logId, {
      httpStatus: 200,
      duration: 20,
      responseBody: malformed,
    });

    const stored = await waitForLog(logId, (log) => log.status === 'success');
    expect(stored.responseBody).toBe(
      `[REDACTED: unparseable response contained sensitive payload; original length=${malformed.length}]`
    );
    expect(stored.responseBody).not.toContain(secret.slice(0, 64));
  });

  it('redacts top-level and malformed inline payloads without provider field names', async () => {
    const rawBase64 = Buffer.from(
      'top-level-private-media'.repeat(100)
    ).toString('base64');
    const dataUrl = `data:image/webp;base64,${rawBase64}`;
    const jsonLogId = startTestLog();
    const malformedLogId = startTestLog();

    completeLLMApiLog(jsonLogId, {
      httpStatus: 200,
      duration: 20,
      responseBody: JSON.stringify(dataUrl),
    });
    completeLLMApiLog(malformedLogId, {
      httpStatus: 200,
      duration: 20,
      responseBody: `provider-output=${dataUrl}`,
    });

    const jsonLog = await waitForLog(
      jsonLogId,
      (log) => log.status === 'success'
    );
    const malformedLog = await waitForLog(
      malformedLogId,
      (log) => log.status === 'success'
    );

    expect(JSON.parse(jsonLog.responseBody || 'null')).toBe(
      '[REDACTED: inline media]'
    );
    expect(malformedLog.responseBody).toMatch(
      /^\[REDACTED: unparseable response contained sensitive payload;/
    );
    expect(JSON.stringify(jsonLog)).not.toContain(rawBase64.slice(0, 64));
    expect(JSON.stringify(malformedLog)).not.toContain(rawBase64.slice(0, 64));
  });
});
