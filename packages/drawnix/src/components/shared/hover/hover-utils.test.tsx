import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  composeHoverHandler,
  hasUsableHoverContent,
  stripNativeHoverProps,
} from './hover-utils';

describe('hasUsableHoverContent', () => {
  it('filters empty hover content', () => {
    expect(hasUsableHoverContent('')).toBe(false);
    expect(hasUsableHoverContent('   ')).toBe(false);
    expect(hasUsableHoverContent(null)).toBe(false);
    expect(hasUsableHoverContent(undefined)).toBe(false);
    expect(hasUsableHoverContent(false)).toBe(false);
  });

  it('accepts text and elements', () => {
    expect(hasUsableHoverContent('提示')).toBe(true);
    expect(hasUsableHoverContent(<span>提示</span>)).toBe(true);
  });
});

describe('stripNativeHoverProps', () => {
  it('removes native title and data-tooltip props', () => {
    const element = (
      <button title="浏览器提示" data-tooltip="自定义提示">
        按钮
      </button>
    );
    const stripped = stripNativeHoverProps(element) as React.ReactElement<{
      title?: string;
      'data-tooltip'?: string;
    }>;

    expect(stripped.props.title).toBeUndefined();
    expect(stripped.props['data-tooltip']).toBeUndefined();
  });
});

describe('composeHoverHandler', () => {
  it('calls original and next handlers in order', () => {
    const order: string[] = [];
    const original = vi.fn(() => order.push('original'));
    const next = vi.fn(() => order.push('next'));
    const handler = composeHoverHandler(original, next);

    handler('event');

    expect(original).toHaveBeenCalledWith('event');
    expect(next).toHaveBeenCalledWith('event');
    expect(order).toEqual(['original', 'next']);
  });
});
