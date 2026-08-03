import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8');
}

describe('TTD dialog startup boundaries', () => {
  const shellSource = readSource('./DeferredTTDDialogs.tsx');
  const imageSource = readSource(
    '../ttd-dialog/ai-image-dialog-controller.tsx'
  );
  const imageGenerationSource = readSource(
    '../ttd-dialog/ai-image-generation.tsx'
  );
  const batchImageGenerationSource = readSource(
    '../ttd-dialog/batch-image-generation.tsx'
  );
  const videoSource = readSource(
    '../ttd-dialog/ai-video-dialog-controller.tsx'
  );
  const videoGenerationSource = readSource(
    '../ttd-dialog/ai-video-generation.tsx'
  );
  const mermaidSource = readSource(
    '../ttd-dialog/mermaid-dialog-controller.tsx'
  );
  const markdownSource = readSource(
    '../ttd-dialog/markdown-dialog-controller.tsx'
  );
  const drawnixSource = readSource('../../drawnix.tsx');

  it('maps every dialog type to an independent retriable chunk', () => {
    expect(shellSource.match(/createRetriableModuleLoader\(/g)).toHaveLength(4);
    expect(shellSource).toContain(
      "import('../ttd-dialog/ai-image-dialog-controller')"
    );
    expect(shellSource).toContain(
      "import('../ttd-dialog/ai-video-dialog-controller')"
    );
    expect(shellSource).toContain(
      "import('../ttd-dialog/mermaid-dialog-controller')"
    );
    expect(shellSource).toContain(
      "import('../ttd-dialog/markdown-dialog-controller')"
    );
    expect(existsSync(resolve(__dirname, '../ttd-dialog/ttd-dialog.tsx'))).toBe(
      false
    );
  });

  it('does not aggregate unrelated business modules in any controller', () => {
    expect(imageSource).toContain("from './ai-image-generation'");
    expect(imageSource).not.toContain('AIVideoGeneration');
    expect(imageSource).not.toContain('mermaid-to-drawnix');
    expect(imageSource).not.toContain('markdown-to-drawnix');

    expect(videoSource).toContain("from './ai-video-generation'");
    expect(videoSource).not.toContain('AIImageGeneration');
    expect(videoSource).not.toContain('batch-image-generation');
    expect(videoSource).not.toContain('mermaid-to-drawnix');
    expect(videoSource).not.toContain('markdown-to-drawnix');

    expect(mermaidSource).toContain("from './mermaid-to-drawnix'");
    expect(mermaidSource).not.toContain('ai-image-generation');
    expect(mermaidSource).not.toContain('ai-video-generation');
    expect(mermaidSource).not.toContain('markdown-to-drawnix');

    expect(markdownSource).toContain("from './markdown-to-drawnix'");
    expect(markdownSource).not.toContain('ai-image-generation');
    expect(markdownSource).not.toContain('ai-video-generation');
    expect(markdownSource).not.toContain('mermaid-to-drawnix');
  });

  it('keeps the nested batch chunk retryable after the image controller loads', () => {
    expect(imageSource).toContain('createRetriableModuleLoader');
    expect(imageSource).toContain("() => import('./batch-image-generation')");
    expect(imageSource).toContain('<RetriableDeferredFeature');
    expect(imageSource).not.toContain(
      "lazy(() => import('./batch-image-generation'))"
    );
  });

  it('keeps image and video selection processing state isolated', () => {
    expect(imageSource).toContain('const isProcessingRef = useRef(false)');
    expect(imageSource).toContain('const processingTimeoutRef = useRef');
    expect(videoSource).toContain('const isProcessingRef = useRef(false)');
    expect(videoSource).toContain('const processingTimeoutRef = useRef');
    expect(shellSource).not.toContain('isProcessingRef');
    expect(shellSource).not.toContain('processSelectedContentForAI');
  });

  it('mounts the lightweight shell statically without prefetching tool windows', () => {
    expect(drawnixSource).toContain(
      "import { DeferredTTDDialogs } from './components/startup/DeferredTTDDialogs'"
    );
    expect(drawnixSource).toContain('<DeferredTTDDialogs');
    expect(drawnixSource).toContain('container={containerRef.current}');
    expect(drawnixSource).not.toContain(
      "import('./components/ttd-dialog/ttd-dialog')"
    );

    const generationRuntimeStart = drawnixSource.indexOf(
      'const enableGenerationRuntime = useCallback'
    );
    const generationRuntimeEnd = drawnixSource.indexOf(
      '// \u5904\u7406\u77e5\u8bc6\u5e93\u5207\u6362',
      generationRuntimeStart
    );
    const generationRuntimeSource = drawnixSource.slice(
      generationRuntimeStart,
      generationRuntimeEnd
    );
    expect(generationRuntimeSource).toContain(
      'setDeferredRuntimeEnabled(true);'
    );
    expect(drawnixSource).toContain(
      'onEnableRuntime={enableGenerationRuntime}'
    );
    expect(imageSource).toContain('onEnableRuntime={onEnableRuntime}');
    expect(videoSource).toContain('onEnableRuntime={onEnableRuntime}');
    expect(
      imageGenerationSource.match(/onEnableRuntime\?\.\(\)/g)
    ).toHaveLength(1);
    expect(
      batchImageGenerationSource.match(/onEnableRuntime\?\.\(\)/g)
    ).toHaveLength(1);
    expect(
      videoGenerationSource.match(/onEnableRuntime\?\.\(\)/g)
    ).toHaveLength(1);
    expect(generationRuntimeSource).not.toContain('TOOL_WINDOW_GROUPS');
    expect(generationRuntimeSource).not.toContain(
      'requestServiceWorkerIdlePrefetch'
    );
    expect(generationRuntimeSource).not.toContain('openDialogTypes.has');
  });
});
