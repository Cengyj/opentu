import React from 'react';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';
import { RetriableDeferredFeature } from '../startup/RetriableDeferredFeature';

type TaskQueuePanelComponent =
  (typeof import('../task-queue/TaskQueuePanel'))['TaskQueuePanel'];
type TaskQueuePanelProps = React.ComponentProps<TaskQueuePanelComponent>;

export type TaskQueuePanelLoader = () => Promise<{
  TaskQueuePanel: TaskQueuePanelComponent;
}>;

const loadDefaultTaskQueuePanel = createRetriableModuleLoader(() =>
  import('../task-queue/TaskQueuePanel')
);

export interface DeferredTaskQueuePanelProps extends TaskQueuePanelProps {
  panelLoader?: TaskQueuePanelLoader;
  /** Starts recovery/background execution after the visible panel commits. */
  onRuntimeRequired?: () => void;
}

function LoadedTaskQueuePanel({
  TaskQueuePanel,
  panelProps,
  onRuntimeRequired,
}: {
  TaskQueuePanel: TaskQueuePanelComponent;
  panelProps: TaskQueuePanelProps;
  onRuntimeRequired?: () => void;
}) {
  React.useEffect(() => {
    onRuntimeRequired?.();
  }, [onRuntimeRequired]);

  return <TaskQueuePanel {...panelProps} />;
}

/**
 * Keeps the first task-panel click visible and retryable. The task recovery
 * runtime starts only after this foreground chunk has loaded and committed.
 */
export function DeferredTaskQueuePanel({
  panelLoader = loadDefaultTaskQueuePanel,
  onRuntimeRequired,
  ...panelProps
}: DeferredTaskQueuePanelProps) {
  return (
    <RetriableDeferredFeature
      loader={panelLoader}
      label="任务队列"
      onCancel={panelProps.onClose}
      renderFeature={({ TaskQueuePanel }) => (
        <LoadedTaskQueuePanel
          TaskQueuePanel={TaskQueuePanel}
          panelProps={panelProps}
          onRuntimeRequired={onRuntimeRequired}
        />
      )}
    />
  );
}

export default DeferredTaskQueuePanel;
