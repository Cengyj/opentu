import { describe, expect, it } from 'vitest';
import {
  artifactsToLegacyImageResult,
  ImageArtifactError,
  normalizeImageArtifacts,
  parseGeminiImageArtifacts,
  parseOpenAIImageArtifacts,
} from './artifacts';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const GIF_BASE64 = 'R0lGODlhAQABAIAAAAUEBA==';

function expectArtifactError(
  action: () => unknown,
  code: ImageArtifactError['code']
): ImageArtifactError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ImageArtifactError);
    expect((error as ImageArtifactError).code).toBe(code);
    return error as ImageArtifactError;
  }

  throw new Error(`Expected ImageArtifactError with code ${code}`);
}

describe('image artifact normalization', () => {
  it('normalizes URL, Data URL, and raw Base64 sources without changing order', () => {
    const artifacts = normalizeImageArtifacts([
      'https://cdn.example.com/first.webp?token=redacted',
      `data:image/png;base64,${PNG_BASE64}`,
      { value: GIF_BASE64, mimeType: 'image/gif', width: 1, height: 1 },
    ]);

    expect(artifacts).toEqual([
      {
        url: 'https://cdn.example.com/first.webp?token=redacted',
        source: 'url',
        mimeType: 'image/webp',
        format: 'webp',
      },
      {
        url: `data:image/png;base64,${PNG_BASE64}`,
        source: 'inline',
        mimeType: 'image/png',
        format: 'png',
      },
      {
        url: `data:image/gif;base64,${GIF_BASE64}`,
        source: 'inline',
        mimeType: 'image/gif',
        format: 'gif',
        width: 1,
        height: 1,
      },
    ]);
  });

  it('leaves a remote URL MIME unknown when the response provides no evidence', () => {
    const [artifact] = normalizeImageArtifacts([
      'https://cdn.example.com/generated/opaque-id',
    ]);

    expect(artifact).toEqual({
      url: 'https://cdn.example.com/generated/opaque-id',
      source: 'url',
    });
  });

  it('normalizes image/jpg to the canonical image/jpeg MIME', () => {
    const [artifact] = normalizeImageArtifacts([
      {
        value: 'https://cdn.example.com/image',
        mimeType: 'image/jpg',
      },
    ]);

    expect(artifact.mimeType).toBe('image/jpeg');
    expect(artifact.format).toBe('jpg');
  });

  it('rejects unsupported image MIME types before consumers see the result', () => {
    expectArtifactError(
      () =>
        normalizeImageArtifacts([`data:image/svg+xml;base64,${PNG_BASE64}`]),
      'IMAGE_ARTIFACT_UNSUPPORTED_MIME'
    );

    expectArtifactError(
      () => normalizeImageArtifacts(['https://cdn.example.com/image.avif']),
      'IMAGE_ARTIFACT_UNSUPPORTED_MIME'
    );
  });

  it('rejects MIME declarations that conflict with inline image bytes', () => {
    expectArtifactError(
      () =>
        normalizeImageArtifacts([
          { value: PNG_BASE64, mimeType: 'image/jpeg' },
        ]),
      'IMAGE_ARTIFACT_MIME_MISMATCH'
    );
  });

  it('requires a MIME for signatureless raw Base64', () => {
    expectArtifactError(
      () => normalizeImageArtifacts(['YWJjZA==']),
      'IMAGE_ARTIFACT_MIME_REQUIRED'
    );
  });

  it('rejects an empty source list', () => {
    expectArtifactError(
      () => normalizeImageArtifacts([]),
      'IMAGE_ARTIFACT_EMPTY_RESULT'
    );
  });

  it('projects artifacts to the legacy result shape without provider payloads', () => {
    const artifacts = normalizeImageArtifacts([
      'https://cdn.example.com/first.png',
      'https://cdn.example.com/second.webp',
    ]);

    expect(
      artifactsToLegacyImageResult(artifacts, { includeSingleUrl: true })
    ).toEqual({
      url: 'https://cdn.example.com/first.png',
      urls: [
        'https://cdn.example.com/first.png',
        'https://cdn.example.com/second.webp',
      ],
      format: 'png',
    });
  });
});

describe('OpenAI image artifact parsing', () => {
  it('parses URL and b64_json items without losing multi-image order', () => {
    const artifacts = parseOpenAIImageArtifacts({
      data: [
        { url: 'https://cdn.example.com/first.webp' },
        { b64_json: PNG_BASE64, mime_type: 'image/png' },
        { url: `data:image/gif;base64,${GIF_BASE64}` },
      ],
    });

    expect(artifacts.map((artifact) => artifact.url)).toEqual([
      'https://cdn.example.com/first.webp',
      `data:image/png;base64,${PNG_BASE64}`,
      `data:image/gif;base64,${GIF_BASE64}`,
    ]);
    expect(artifacts.map((artifact) => artifact.mimeType)).toEqual([
      'image/webp',
      'image/png',
      'image/gif',
    ]);
  });

  it('uses the documented OpenAI PNG default for b64_json', () => {
    const [artifact] = parseOpenAIImageArtifacts({
      data: [{ b64_json: PNG_BASE64 }],
    });

    expect(artifact.mimeType).toBe('image/png');
    expect(artifact.format).toBe('png');
  });

  it('honors the response output_format for signatureless gateway Base64', () => {
    const [artifact] = parseOpenAIImageArtifacts({
      output_format: 'webp',
      data: [{ b64_json: 'YWJjZA==' }],
    });

    expect(artifact.mimeType).toBe('image/webp');
    expect(artifact.url).toBe('data:image/webp;base64,YWJjZA==');
  });

  it('fails explicitly for empty and malformed OpenAI result arrays', () => {
    expectArtifactError(
      () => parseOpenAIImageArtifacts({ data: [] }),
      'IMAGE_ARTIFACT_EMPTY_RESULT'
    );
    expectArtifactError(
      () => parseOpenAIImageArtifacts({ data: [{ revised_prompt: 'none' }] }),
      'IMAGE_ARTIFACT_INVALID_SOURCE'
    );
  });
});

describe('Gemini image artifact parsing', () => {
  it('parses inlineData, inline_data, and fileData in candidate/part order', () => {
    const artifacts = parseGeminiImageArtifacts({
      candidates: [
        {
          content: {
            parts: [
              { text: 'Generated images follow.' },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: PNG_BASE64,
                },
              },
              {
                file_data: {
                  mime_type: 'image/jpeg',
                  file_uri: 'https://cdn.example.com/second.jpg',
                },
              },
            ],
          },
        },
        {
          content: {
            parts: [
              {
                inline_data: {
                  mime_type: 'image/gif',
                  data: GIF_BASE64,
                },
              },
            ],
          },
        },
      ],
    });

    expect(artifacts.map((artifact) => artifact.url)).toEqual([
      `data:image/png;base64,${PNG_BASE64}`,
      'https://cdn.example.com/second.jpg',
      `data:image/gif;base64,${GIF_BASE64}`,
    ]);
    expect(artifacts.map((artifact) => artifact.mimeType)).toEqual([
      'image/png',
      'image/jpeg',
      'image/gif',
    ]);
  });

  it('supports the structured inlineMedia form without duplicating choices', () => {
    const artifacts = parseGeminiImageArtifacts({
      choices: [
        {
          message: {
            content: `data:image/png;base64,${PNG_BASE64}`,
          },
        },
      ],
      inlineMedia: [
        { data: PNG_BASE64, mimeType: 'image/png' },
        { url: 'https://cdn.example.com/second.webp' },
      ],
    });

    expect(artifacts).toHaveLength(2);
    expect(artifacts.map((artifact) => artifact.mimeType)).toEqual([
      'image/png',
      'image/webp',
    ]);
  });

  it('ignores text-only parts but fails for an empty image response', () => {
    expectArtifactError(
      () =>
        parseGeminiImageArtifacts({
          candidates: [{ content: { parts: [{ text: 'No image' }] } }],
        }),
      'IMAGE_ARTIFACT_EMPTY_RESULT'
    );
  });

  it('does not include malformed provider payload bytes in errors', () => {
    const secretPayload = 'provider-secret-base64!!!';
    const error = expectArtifactError(
      () =>
        parseGeminiImageArtifacts({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: secretPayload,
                    },
                  },
                ],
              },
            },
          ],
        }),
      'IMAGE_ARTIFACT_INVALID_BASE64'
    );

    expect(error.message).not.toContain(secretPayload);
    expect(JSON.stringify(error)).not.toContain(secretPayload);
  });

  it('rejects malformed Gemini media parts instead of silently filtering them', () => {
    expectArtifactError(
      () =>
        parseGeminiImageArtifacts({
          candidates: [
            {
              content: { parts: [{ inline_data: { mime_type: 'image/png' } }] },
            },
          ],
        }),
      'IMAGE_ARTIFACT_INVALID_BASE64'
    );
  });
});
