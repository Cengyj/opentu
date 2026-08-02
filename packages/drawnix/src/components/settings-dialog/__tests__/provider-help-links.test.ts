import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const join = (...parts: string[]) => parts.join('');

describe('provider settings source contracts', () => {
  it('uses the current key-management URL without third-party video links', () => {
    const source = [
      readSource('../settings-dialog.tsx'),
      readSource('../../../utils/gemini-api/auth.ts'),
    ].join('\n');

    expect(source).toContain('https://foropencode.com/keys');
    expect(source).not.toContain(join('foropencode.com/', 'token'));
    expect(source.toLowerCase()).not.toContain(join('bili', 'bili'));
    expect(source).not.toContain(join('b23', '.tv'));
  });

  it('does not expose the retired profile-wide async image preference', () => {
    const source = readSource('../settings-dialog.tsx');

    expect(source).not.toContain(join('preferAsync', 'ImageEndpoint'));
    expect(source).not.toContain(join('图片优先使用', '异步接口'));
    expect(source).not.toContain('/v1/videos 异步接口生成');
  });

  it('does not expose the retired provider pricing controls', () => {
    const pricingComponentUrl = new URL(
      '../pricing-field-group.tsx',
      import.meta.url
    );
    const dialogSource = readSource('../settings-dialog.tsx');
    const styleSource = readSource('../settings-dialog.scss');
    const pricingHookSource = readSource('../../../hooks/use-model-pricing.ts');
    const pricingServiceSource = readSource(
      '../../../utils/model-pricing-service.ts'
    );

    expect(existsSync(pricingComponentUrl)).toBe(false);
    expect(dialogSource).not.toContain('PricingFieldGroup');
    expect(dialogSource).not.toContain('模型价格 URL');
    expect(dialogSource).not.toContain('¥/1USD');
    expect(dialogSource).not.toContain('获取价格');
    expect(dialogSource).toContain('获取模型');
    expect(styleSource).not.toContain('settings-dialog__pricing-group');
    expect(styleSource).not.toContain('settings-dialog__pricing-row');
    expect(pricingHookSource).not.toContain('usePricingGroups');
    expect(pricingServiceSource).not.toContain('getGroups(profileId');
  });
});
