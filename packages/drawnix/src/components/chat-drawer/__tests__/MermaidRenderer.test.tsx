// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MermaidRenderer } from '../MermaidRenderer';

const { initialize, renderDiagram } = vi.hoisted(() => ({
  initialize: vi.fn(),
  renderDiagram: vi.fn(async () => ({
    svg: '<svg role="img"><text>safe diagram</text></svg>',
  })),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize,
    render: renderDiagram,
  },
}));

vi.mock('tdesign-react', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../shared', () => ({
  HoverTip: ({ children }: { children: React.ReactNode }) => children,
}));

afterEach(() => {
  cleanup();
  initialize.mockClear();
  renderDiagram.mockClear();
});

describe('MermaidRenderer security contract', () => {
  it('uses Mermaid strict mode for untrusted chat diagrams', async () => {
    render(<MermaidRenderer code={'graph TD\nA[hello] --> B[world]'} />);

    await waitFor(() => expect(renderDiagram).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict' })
    );
  });
});
