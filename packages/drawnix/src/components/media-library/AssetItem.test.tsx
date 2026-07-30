import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  AssetCategory,
  AssetSource,
  AssetType,
  type Asset,
} from '../../types/asset.types';
import { AssetItem } from './AssetItem';

vi.mock('tdesign-react', () => ({
  Checkbox: ({ checked }: { checked: boolean }) => (
    <input type="checkbox" checked={checked} readOnly />
  ),
}));

vi.mock('../../hooks/useAssetSize', () => ({
  useAssetSize: (_id: string, _url: string, size?: number) => size,
}));

vi.mock('../../hooks/useThumbnailUrl', () => ({
  useThumbnailUrl: (url: string) => url,
}));

vi.mock('../../hooks/useUnifiedCache', () => ({
  useUnifiedCache: () => ({ isCached: true, cacheWarning: undefined }),
}));

vi.mock('../lazy-image', () => ({
  LazyImage: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock('../shared/VideoPosterPreview', () => ({
  VideoPosterPreview: ({ alt }: { alt: string }) => <div>{alt}</div>,
}));

vi.mock('../shared/hover', () => ({
  HoverTip: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: React.ReactNode;
  }) => (
    <div data-hover-content={String(content)}>{children}</div>
  ),
}));

const generalAsset: Asset = {
  id: 'asset-1',
  type: AssetType.IMAGE,
  source: AssetSource.LOCAL,
  url: '/asset-library/subject.png',
  name: '素材标题',
  mimeType: 'image/png',
  createdAt: 1,
  size: 1024,
  category: AssetCategory.GENERAL,
};

describe('AssetItem subject metadata projection', () => {
  it('rerenders the subject badge when the same asset is marked as a subject', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <AssetItem
        asset={generalAsset}
        viewMode="grid"
        isSelected={false}
        onSelect={onSelect}
      />
    );

    expect(screen.queryByText('主体')).toBeNull();

    rerender(
      <AssetItem
        asset={{
          ...generalAsset,
          category: AssetCategory.CHARACTER,
          characterMeta: { name: '红色跑车' },
        }}
        viewMode="grid"
        isSelected={false}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('主体')).not.toBeNull();
    expect(
      document.querySelector('[data-hover-content="红色跑车"]')
    ).not.toBeNull();
  });

  it('rerenders the subject tooltip when its subject name changes', () => {
    const onSelect = vi.fn();
    const subjectAsset: Asset = {
      ...generalAsset,
      category: AssetCategory.CHARACTER,
      characterMeta: { name: '主体 A' },
    };
    const { rerender } = render(
      <AssetItem
        asset={subjectAsset}
        viewMode="grid"
        isSelected={false}
        onSelect={onSelect}
      />
    );

    expect(
      document.querySelector('[data-hover-content="主体 A"]')
    ).not.toBeNull();

    rerender(
      <AssetItem
        asset={{ ...subjectAsset, characterMeta: { name: '主体 B' } }}
        viewMode="grid"
        isSelected={false}
        onSelect={onSelect}
      />
    );

    expect(
      document.querySelector('[data-hover-content="主体 B"]')
    ).not.toBeNull();
    expect(
      document.querySelector('[data-hover-content="主体 A"]')
    ).toBeNull();
  });
});
