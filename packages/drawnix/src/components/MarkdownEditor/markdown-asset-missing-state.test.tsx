import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetType } from '../../types/asset.types';
import {
  setGlobalAssetMap,
  setGlobalAssetMapStatus,
} from '../../stores/asset-map-store';
import { MarkdownReadonly } from '../MarkdownReadonly';
import { assetEmbedView } from './asset-embed-plugin/view';
import { markdownImageBlockView } from './image-block-plugin/view';

vi.mock('@milkdown/kit/utils', () => ({
  $view: (_schema: unknown, factory: (ctx: { get: () => unknown }) => unknown) =>
    factory({
      get: () => ({
        onUpload: async () => '',
        uploadButton: 'Upload',
        uploadPlaceholderText: 'Upload image',
        confirmButton: 'Confirm',
      }),
    }),
}));

vi.mock('@milkdown/kit/component/image-block', () => ({
  imageBlockConfig: { key: 'image-block-config' },
}));

vi.mock('./asset-embed-plugin/schema', () => ({
  assetEmbedSchema: { node: {} },
}));

vi.mock('./image-block-plugin/schema', () => ({
  markdownImageBlockSchema: { node: {} },
}));

vi.mock('../retry-image', () => ({
  RetryImage: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));

vi.mock('../shared/VideoPosterPreview', () => ({
  VideoPosterPreview: () => <div data-testid="video-preview" />,
}));

vi.mock('./MarkdownAudioAssetCard', () => ({
  MarkdownAudioAssetCard: () => <div data-testid="audio-preview" />,
}));

type NodeViewFactory = (
  node: { attrs: Record<string, unknown>; type?: unknown },
  view: { editable: boolean; state: { tr: { setNodeMarkup: () => unknown } }; dispatch: () => void },
  getPos: () => number
) => { dom: HTMLElement; destroy: () => void };

function createView() {
  return {
    editable: false,
    state: { tr: { setNodeMarkup: () => ({}) } },
    dispatch: vi.fn(),
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('missing asset references after an empty asset map is loaded', () => {
  it('keeps the loading state before the asset projection is ready', () => {
    setGlobalAssetMap(new Map());
    setGlobalAssetMapStatus('loading');

    const { container } = render(
      <MarkdownReadonly markdown="![image|封面](asset://pending-image)" />
    );

    expect(container.querySelector('.markdown-readonly__media-loading')).toBeTruthy();
    expect(screen.queryByText('素材不存在或已删除')).toBeNull();
  });

  it('shows a visible placeholder in MarkdownReadonly', () => {
    setGlobalAssetMap(new Map());

    render(<MarkdownReadonly markdown="![image|封面](asset://missing-image)" />);

    expect(screen.getByText('素材不存在或已删除')).toBeTruthy();
  });

  it('shows a visible placeholder in the video/audio asset node view', async () => {
    await act(async () => setGlobalAssetMap(new Map()));
    const factory = assetEmbedView as unknown as NodeViewFactory;
    let nodeView!: ReturnType<NodeViewFactory>;
    await act(async () => {
      nodeView = factory(
        {
          attrs: {
            assetId: 'missing-video',
            assetType: AssetType.VIDEO,
            label: '缺失视频',
            width: null,
            height: null,
          },
        },
        createView(),
        () => 0
      );
      document.body.appendChild(nodeView.dom);
      await Promise.resolve();
    });

    expect(nodeView.dom.querySelector('.collimind-asset-embed__missing')).toBeTruthy();
    await act(async () => {
      nodeView.destroy();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('shows a visible placeholder in the image node view', async () => {
    await act(async () => setGlobalAssetMap(new Map()));
    const factory = markdownImageBlockView as unknown as NodeViewFactory;
    let nodeView!: ReturnType<NodeViewFactory>;
    await act(async () => {
      nodeView = factory(
        {
          attrs: {
            src: 'asset://missing-image',
            alt: 'image|缺失图片',
            caption: '',
            ratio: 1,
            width: null,
            height: null,
          },
        },
        createView(),
        () => 0
      );
      document.body.appendChild(nodeView.dom);
      await Promise.resolve();
    });

    expect(nodeView.dom.querySelector('.collimind-markdown-image-block__missing')).toBeTruthy();
    await act(async () => {
      nodeView.destroy();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
