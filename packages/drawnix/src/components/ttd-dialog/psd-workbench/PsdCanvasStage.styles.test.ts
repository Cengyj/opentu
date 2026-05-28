import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const STYLE_DIR_FROM_ROOT =
  'packages/drawnix/src/components/ttd-dialog/psd-workbench';
const STYLE_DIR_FROM_PACKAGE = 'src/components/ttd-dialog/psd-workbench';

function readWorkbenchStyle(fileName: string) {
  const candidates = [
    path.join(process.cwd(), STYLE_DIR_FROM_ROOT, fileName),
    path.join(process.cwd(), STYLE_DIR_FROM_PACKAGE, fileName),
  ];
  const filePath = candidates.find((candidate) => existsSync(candidate));

  if (!filePath) {
    throw new Error(`Unable to find ${fileName} in PSD workbench styles`);
  }

  return readFileSync(filePath, 'utf8');
}

const tokenStyles = readWorkbenchStyle('_tokens.scss');
const canvasStyles = readWorkbenchStyle('_canvas.scss');

describe('PSD canvas stage style contract', () => {
  it('keeps stage color work scoped to the PSD workbench without override hacks', () => {
    expect(tokenStyles.trimStart()).toMatch(
      /^\.ai-psd-generation-container--workbench\s*\{/
    );
    expect(canvasStyles.trimStart()).toMatch(
      /^\.ai-psd-generation-container--workbench\s*\{/
    );

    expect(`${tokenStyles}\n${canvasStyles}`).not.toContain('!important');
    expect(canvasStyles).not.toMatch(/(^|\s)(html|body|:root)\b/);
    expect(canvasStyles).not.toMatch(/\.t(?:design)?-/);
  });

  it('routes center-stage colors through PSD tokens backed by TDesign surfaces', () => {
    expect(tokenStyles).toContain('--psd-bg: var(--td-bg-color-container');
    expect(tokenStyles).toContain('--psd-board: var(--td-bg-color-container');
    expect(tokenStyles).toContain(
      '--psd-surface: var(--td-bg-color-container'
    );
    expect(tokenStyles).toContain('--psd-stage-bg:');
    expect(tokenStyles).toContain('--psd-stage-bg-soft:');
    expect(tokenStyles).toContain('--psd-stage-grid:');
    expect(tokenStyles).not.toMatch(
      /--psd-stage-bg(?:-soft)?:\s*#[12][0-9a-f]{5}\b/i
    );
    expect(tokenStyles).not.toContain('#20242c');
    expect(tokenStyles).not.toContain('#2b303a');

    expect(canvasStyles).toContain(
      'linear-gradient(180deg, var(--psd-stage-bg), var(--psd-stage-bg-soft))'
    );
    expect(canvasStyles).toContain('var(--psd-stage-grid)');
    expect(canvasStyles).not.toMatch(/background(?:-color)?:\s*#[0-9a-f]{3,8}/i);
  });

  it('preserves the existing center-stage selectors used by the three-column workflow', () => {
    for (const selector of [
      '.psd-preview-toolbar',
      '.psd-stage-shell',
      '.psd-stage__content',
      '.psd-stage__artboard',
      '.psd-stage-footer',
      '.psd-preview-strip',
    ]) {
      expect(canvasStyles).toContain(selector);
    }
  });

  it('keeps the preview viewport in normal grid flow so artboard images keep visible space', () => {
    expect(canvasStyles).toMatch(
      /\.psd-stage-shell\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0,\s*1fr\) auto;/
    );
    expect(canvasStyles).toMatch(
      /\.psd-stage__content\s*\{[\s\S]*?position:\s*relative;[\s\S]*?min-height:\s*0;[\s\S]*?padding:\s*34px 26px;/
    );
    expect(canvasStyles).not.toMatch(
      /\.psd-stage__content\s*\{[\s\S]*?position:\s*absolute;/
    );
    expect(canvasStyles).not.toMatch(
      /\.psd-stage__content\s*\{[\s\S]*?inset:\s*34px 26px 118px;/
    );
    expect(canvasStyles).toMatch(
      /\.psd-stage__artboard-image,[\s\S]*?\.psd-stage__stack-layer,[\s\S]*?\.psd-stage__stack-underlay\s*\{[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*contain;/
    );
  });
});
