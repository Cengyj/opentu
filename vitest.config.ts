import path from 'path';
import { defineConfig } from 'vitest/config';

const rootDir = __dirname;

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['packages/drawnix/vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'packages/drawnix/src'),
      '@aitu/utils': path.resolve(rootDir, 'packages/utils/src/index.ts'),
      '@drawnix/drawnix': path.resolve(
        rootDir,
        'packages/drawnix/src/index.ts'
      ),
      '@drawnix/drawnix/runtime': path.resolve(
        rootDir,
        'packages/drawnix/src/runtime.ts'
      ),
      '@plait-board/react-board': path.resolve(
        rootDir,
        'packages/react-board/src/index.ts'
      ),
      '@plait-board/react-text': path.resolve(
        rootDir,
        'packages/react-text/src/index.ts'
      ),
      'tdesign-react': path.resolve(
        rootDir,
        'packages/drawnix/src/utils/tdesign.ts'
      ),
      react: path.resolve(rootDir, 'node_modules/react'),
      'react-dom': path.resolve(rootDir, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(
        rootDir,
        'node_modules/react/jsx-runtime.js'
      ),
      'react/jsx-dev-runtime': path.resolve(
        rootDir,
        'node_modules/react/jsx-dev-runtime.js'
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
});
