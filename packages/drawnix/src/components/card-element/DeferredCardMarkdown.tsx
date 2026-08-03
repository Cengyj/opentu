import React, { useLayoutEffect } from 'react';
import MarkdownReadonly from '../MarkdownReadonly';

interface DeferredCardMarkdownProps {
  markdown: string;
  onReady?: () => void;
}

/**
 * Keeps the Markdown renderer out of the startup graph while preserving the
 * card generator's content-height measurement once the deferred renderer is
 * mounted.
 */
export function DeferredCardMarkdown({
  markdown,
  onReady,
}: DeferredCardMarkdownProps) {
  useLayoutEffect(() => {
    onReady?.();
  }, [markdown, onReady]);

  return (
    <MarkdownReadonly
      markdown={markdown}
      className="card-markdown-viewer"
    />
  );
}
