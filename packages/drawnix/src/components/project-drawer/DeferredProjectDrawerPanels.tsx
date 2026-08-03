import React from 'react';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import { RetriableDeferredFeature } from '../startup/RetriableDeferredFeature';

type FramePanelComponent = (typeof import('./FramePanel'))['FramePanel'];
type LayerPanelComponent = (typeof import('./LayerPanel'))['LayerPanel'];

export type FramePanelLoader = () => Promise<{
  FramePanel: FramePanelComponent;
}>;
export type LayerPanelLoader = () => Promise<{
  LayerPanel: LayerPanelComponent;
}>;
type FramePanelProps = React.ComponentProps<FramePanelComponent>;

const loadDefaultFramePanel = createRetriableModuleLoader(() =>
  import('./FramePanel')
);
const loadDefaultLayerPanel = createRetriableModuleLoader(() =>
  import('./LayerPanel')
);

export type DeferredFramePanelProps = FramePanelProps & {
  /** Test seam for the user-activated PPT panel boundary. */
  panelLoader?: FramePanelLoader;
  /** Starts task/canvas integration only after the PPT panel is visible. */
  onRuntimeRequired?: () => void;
};

function LoadedFramePanel({
  FramePanel,
  panelProps,
  onRuntimeRequired,
}: {
  FramePanel: FramePanelComponent;
  panelProps: FramePanelProps;
  onRuntimeRequired?: () => void;
}) {
  React.useEffect(() => {
    onRuntimeRequired?.();
  }, [onRuntimeRequired]);

  return <FramePanel {...panelProps} />;
}

export function DeferredFramePanel({
  panelLoader = loadDefaultFramePanel,
  onRuntimeRequired,
  ...panelProps
}: DeferredFramePanelProps) {
  return (
    <RetriableDeferredFeature
      loader={panelLoader}
      label="PPT 编辑器"
      variant="inline"
      renderFeature={({ FramePanel }) => (
        <LoadedFramePanel
          FramePanel={FramePanel}
          panelProps={panelProps}
          onRuntimeRequired={onRuntimeRequired}
        />
      )}
    />
  );
}

export interface DeferredLayerPanelProps {
  /** Test seam for the user-activated layer panel boundary. */
  panelLoader?: LayerPanelLoader;
}

export function DeferredLayerPanel({
  panelLoader = loadDefaultLayerPanel,
}: DeferredLayerPanelProps) {
  return (
    <RetriableDeferredFeature
      loader={panelLoader}
      label="图层面板"
      variant="inline"
      renderFeature={({ LayerPanel }) => <LayerPanel />}
    />
  );
}
