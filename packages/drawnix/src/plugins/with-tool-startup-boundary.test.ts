import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('with-tool startup dependency boundary', () => {
  it('keeps the iframe bridge and generation runtime outside the startup graph', () => {
    const packageRoot = process.cwd().endsWith('packages/drawnix')
      ? process.cwd()
      : resolve(process.cwd(), 'packages/drawnix');
    const withToolSource = readFileSync(
      resolve(packageRoot, 'src/plugins/with-tool.ts'),
      'utf8'
    );
    const handlerSource = readFileSync(
      resolve(packageRoot, 'src/plugins/tool-image-generation-handler.ts'),
      'utf8'
    );
    const runtimeSource = readFileSync(
      resolve(packageRoot, 'src/plugins/tool-image-generation-runtime.ts'),
      'utf8'
    );
    const bridgeRuntimeSource = readFileSync(
      resolve(packageRoot, 'src/plugins/tool-communication-runtime.ts'),
      'utf8'
    );
    const toolGeneratorSource = readFileSync(
      resolve(packageRoot, 'src/components/tool-element/tool.generator.ts'),
      'utf8'
    );
    const toolComponentSource = readFileSync(
      resolve(packageRoot, 'src/components/tool-element/tool.component.ts'),
      'utf8'
    );

    expect(withToolSource).not.toMatch(
      /from ['"]\.\.\/services\/task-queue['"]/
    );
    expect(withToolSource).not.toMatch(
      /from ['"]\.\.\/utils\/settings-manager['"]/
    );
    expect(withToolSource).not.toMatch(
      /from ['"]\.\.\/data\/image['"]/
    );
    expect(withToolSource).not.toContain('tool-communication-service');
    expect(withToolSource).not.toContain('tool-communication.types');
    expect(withToolSource).not.toContain('tool-image-generation-handler');
    expect(withToolSource).not.toContain('setupCommunicationHandlers');
    expect(bridgeRuntimeSource).toContain("import('../data/image')");
    expect(bridgeRuntimeSource).toContain('ToolCommunicationService');
    expect(bridgeRuntimeSource).toContain(
      'createToolImageGenerationMessageHandler'
    );
    expect(toolGeneratorSource).toContain(
      "from '../../plugins/tool-communication-runtime'"
    );
    expect(toolGeneratorSource).toContain(
      'acquireToolCommunicationRuntime(board)'
    );
    expect(toolGeneratorSource).toContain(
      'releaseToolCommunicationRuntime(this.board, this.communicationRuntime)'
    );
    expect(handlerSource).not.toMatch(
      /from ['"]\.\/tool-image-generation-runtime['"]/
    );
    expect(handlerSource).toContain(
      "import('./tool-image-generation-runtime')"
    );
    expect(runtimeSource).toMatch(
      /from ['"]\.\.\/services\/task-queue['"]/
    );
    expect(runtimeSource).toMatch(
      /from ['"]\.\.\/utils\/settings-manager['"]/
    );
    expect(toolComponentSource).not.toMatch(
      /import \{ ToolGenerator \} from ['"]\.\/tool\.generator['"]/
    );
    expect(toolComponentSource).toContain("import('./tool.generator')");
  });
});
