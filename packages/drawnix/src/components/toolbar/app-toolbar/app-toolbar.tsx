import { useBoard } from '@plait-board/react-board';
import Stack from '../../stack';
import { ToolButton } from '../../tool-button';
import { RedoIcon, UndoIcon } from '../../icons/startup-icons';
import classNames from 'classnames';
import {
  ATTACHED_ELEMENT_CLASS_NAME,
  PlaitBoard,
} from '@plait/core';
import { Island } from '../../island';
import React from 'react';
import { useI18n } from '../../../i18n';
import { ToolbarSectionProps } from '../toolbar.types';
import { useToolbarConfig } from '../../../hooks/use-toolbar-config';
import { ToolbarContextMenu } from '../toolbar-context-menu';
import {
  DeferredAppMenu,
  type AppMenuRuntimeLoader,
} from './deferred-app-menu';

export interface AppToolbarProps extends ToolbarSectionProps {
  onOpenBackupRestore?: () => void;
  onOpenCloudSync?: () => void;
  /** 应用菜单运行时加载边界，默认使用生产动态模块。 */
  appMenuRuntimeLoader?: AppMenuRuntimeLoader;
}

export const AppToolbar: React.FC<AppToolbarProps> = ({
  embedded = false,
  iconMode = false,
  onOpenBackupRestore,
  onOpenCloudSync,
  appMenuRuntimeLoader,
}) => {
  const board = useBoard();
  const { t } = useI18n();
  const { isButtonVisible, visibleButtons } = useToolbarConfig();
  const container = PlaitBoard.getBoardContainer(board);
  const isUndoDisabled = board.history.undos.length <= 0;
  const isRedoDisabled = board.history.redos.length <= 0;

  // 检查撤销/重做按钮是否可见
  const showUndo = isButtonVisible('undo');
  const showRedo = isButtonVisible('redo');

  // 获取按钮在可见列表中的索引
  const undoVisibleIndex = visibleButtons.findIndex(btn => btn.id === 'undo');
  const redoVisibleIndex = visibleButtons.findIndex(btn => btn.id === 'redo');

  const content = (
    <Stack.Row gap={1}>
      <DeferredAppMenu
        key={0}
        embedded={embedded}
        container={container}
        onOpenBackupRestore={onOpenBackupRestore}
        onOpenCloudSync={onOpenCloudSync}
        appMenuRuntimeLoader={appMenuRuntimeLoader}
      />
      {showUndo && (
        <ToolbarContextMenu
          buttonId="undo"
          isVisible={true}
          visibleIndex={undoVisibleIndex}
        >
          <ToolButton
            key={1}
            type="icon"
            icon={<UndoIcon />}
            visible={true}
            tooltip={t('general.undo')}
            tooltipPlacement={embedded ? 'right' : 'bottom'}
            aria-label={t('general.undo')}
            data-track="toolbar_click_undo"
            onPointerUp={() => {
              board.undo();
            }}
            disabled={isUndoDisabled}
          />
        </ToolbarContextMenu>
      )}
      {showRedo && (
        <ToolbarContextMenu
          buttonId="redo"
          isVisible={true}
          visibleIndex={redoVisibleIndex}
        >
          <ToolButton
            key={2}
            type="icon"
            icon={<RedoIcon />}
            visible={true}
            tooltip={t('general.redo')}
            tooltipPlacement={embedded ? 'right' : 'bottom'}
            aria-label={t('general.redo')}
            data-track="toolbar_click_redo"
            onPointerUp={() => {
              board.redo();
            }}
            disabled={isRedoDisabled}
          />
        </ToolbarContextMenu>
      )}
    </Stack.Row>
  );
  if (embedded) {
    return (
      <div className={classNames('app-toolbar', {
        'app-toolbar--embedded': embedded,
        'app-toolbar--icon-only': iconMode,
      })}>
        {content}
      </div>
    );
  }

  return (
    <Island
      padding={1}
      className={classNames('app-toolbar', ATTACHED_ELEMENT_CLASS_NAME, {
        'app-toolbar--embedded': embedded,
        'app-toolbar--icon-only': iconMode,
      })}
    >
      {content}
    </Island>
  );
};
