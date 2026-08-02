import { describe, expect, it } from 'vitest';
import { createImageProviderRejectionError } from './errors';

describe('image provider rejection errors', () => {
  it('keeps a bounded structured provider message and HTTP identity', async () => {
    const error = await createImageProviderRejectionError(
      new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
        status: 429,
      }),
      { bindingId: 'binding-1', label: '图片提交失败' }
    );

    expect(error).toMatchObject({
      code: 'IMAGE_PROVIDER_REJECTED',
      stage: 'transport',
      message: '图片提交失败: quota exceeded',
      retryable: false,
      details: {
        bindingId: 'binding-1',
        httpStatus: 429,
      },
    });
  });

  it('never retains provider image bytes in the error', async () => {
    const imageBytes = `data:image/png;base64,${'A'.repeat(2048)}`;
    const error = await createImageProviderRejectionError(
      new Response(JSON.stringify({ error: { message: imageBytes } }), {
        status: 500,
      }),
      { bindingId: 'binding-2' }
    );

    expect(error.message).toBe('图片供应商请求失败: HTTP 500');
    expect(JSON.stringify(error)).not.toContain(imageBytes);
    expect(error.retryable).toBe(true);
  });
});
