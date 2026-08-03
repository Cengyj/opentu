import { WorkflowProvider } from '../../contexts/WorkflowContext';
import { ModelHealthProvider } from '../../contexts/ModelHealthContext';
import { AIInputBar } from '../ai-input-bar/AIInputBar';

export interface AIInputBarRuntimeProps {
  isDataReady: boolean;
  initialPrompt: string;
  onReady: () => void;
  onEnableToolWindows?: () => void;
  onEnableRuntime?: () => void;
}

export function AIInputBarRuntime({
  isDataReady,
  initialPrompt,
  onReady,
  onEnableToolWindows,
  onEnableRuntime,
}: AIInputBarRuntimeProps) {
  return (
    <WorkflowProvider>
      <ModelHealthProvider>
        <AIInputBar
          isDataReady={isDataReady}
          initialPrompt={initialPrompt}
          onReady={onReady}
          onEnableToolWindows={onEnableToolWindows}
          onEnableRuntime={onEnableRuntime}
        />
      </ModelHealthProvider>
    </WorkflowProvider>
  );
}

export default AIInputBarRuntime;
