import { describe, expect, it } from 'vitest';
import { resolveSafeExternalToolUrl } from '../external-tool-url';

const API_KEY_TEMPLATE = ['$', '{apiKey}'].join('');
const JAVASCRIPT_URL = ['java', 'script:alert(document.domain)'].join('');
const CHAT_MJ_TEMPLATE_URL =
  `https://vercel.ddaiai.com/#/?settings={"key":"${API_KEY_TEMPLATE}",` +
  '"url":"https://foropencode.com"}';

describe('resolveSafeExternalToolUrl', () => {
  it.each([
    'http://tools.example.test/app',
    'https://tools.example.test/app',
  ])('accepts an HTTP(S) URL: %s', (rawUrl) => {
    const result = resolveSafeExternalToolUrl(rawUrl);

    expect(result).toEqual({
      ok: true,
      url: rawUrl,
    });
  });

  it('accepts the existing Chat-MJ template without replacing the API-key placeholder', () => {
    const result = resolveSafeExternalToolUrl(CHAT_MJ_TEMPLATE_URL);

    expect(result).toEqual({
      ok: true,
      url: new URL(CHAT_MJ_TEMPLATE_URL).toString(),
    });
    expect(result.ok && result.url).toContain(API_KEY_TEMPLATE);
    expect(result.ok && result.url).not.toContain(
      'external-tool-template-value'
    );
  });

  it('accepts a relative local-tool URL when resolved from an HTTP(S) browser origin', () => {
    const result = resolveSafeExternalToolUrl('/tools/local-tool.html', {
      baseUrl: 'https://app.example.test/board',
    });

    expect(result).toEqual({
      ok: true,
      url: 'https://app.example.test/tools/local-tool.html',
    });
  });

  it.each([
    JAVASCRIPT_URL,
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'blob:https://tools.example.test/unsafe',
  ])('rejects a non-HTTP(S) protocol: %s', (rawUrl) => {
    const result = resolveSafeExternalToolUrl(rawUrl);

    expect(result).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_PROTOCOL',
    });
  });

  it.each(['https://[invalid-host', 'http://%', 'https://'])(
    'rejects a malformed URL: %s',
    (rawUrl) => {
      const result = resolveSafeExternalToolUrl(rawUrl);

      expect(result).toMatchObject({
        ok: false,
        code: 'INVALID_URL',
      });
    }
  );

  it.each(['', '   '])('rejects an empty URL: %j', (rawUrl) => {
    const result = resolveSafeExternalToolUrl(rawUrl);

    expect(result).toMatchObject({
      ok: false,
      code: 'EMPTY_URL',
    });
  });

  it('does not allow a relative URL to inherit an unsafe base protocol', () => {
    const result = resolveSafeExternalToolUrl('/tools/local-tool.html', {
      baseUrl: 'file:///tmp/index.html',
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'UNSUPPORTED_PROTOCOL',
    });
  });
});
