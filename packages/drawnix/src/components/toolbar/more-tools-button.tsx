/**
 * 更多工具按钮组件
 *
 * 首屏只渲染轻量按钮；真实面板在首次 hover 打开或触摸点击后加载。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ToolButton } from '../tool-button';
import { MoreIcon } from '../icons/startup-icons';
import { Popover, PopoverTrigger } from '../popover/popover';
import { useI18n } from '../../i18n';
import { createRetriableModuleLoader } from '../../utils/retriable-module-loader';

type MoreToolsPanelRuntimeComponent = React.ComponentType<{
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}>;

export type MoreToolsPanelRuntimeLoader = () => Promise<{
  MoreToolsPanelRuntime: MoreToolsPanelRuntimeComponent;
}>;

const loadDefaultMoreToolsPanelRuntime = createRetriableModuleLoader(
  () => import('./more-tools-panel-runtime')
);

interface MoreToolsButtonProps {
  /** 是否嵌入模式 */
  embedded?: boolean;
  /** 面板运行时加载边界，默认使用生产动态模块。 */
  panelRuntimeLoader?: MoreToolsPanelRuntimeLoader;
}

const HOVER_OPEN_DELAY_MS = 200;
const HOVER_CLOSE_DELAY_MS = 150;

function isTouchDevice() {
  return (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
}

export const MoreToolsButton: React.FC<MoreToolsButtonProps> = ({
  embedded = false,
  panelRuntimeLoader = loadDefaultMoreToolsPanelRuntime,
}) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [LoadedPanelRuntime, setLoadedPanelRuntime] =
    useState<MoreToolsPanelRuntimeComponent | null>(null);
  const mountedRef = useRef(false);
  const panelRuntimeLoadingRef = useRef(false);
  const loadedPanelRuntimeRef =
    useRef<MoreToolsPanelRuntimeComponent | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const leaveTimeoutRef = useRef<number | null>(null);

  const clearAllTimeouts = useCallback(() => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (leaveTimeoutRef.current !== null) {
      window.clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  const requestPanelRuntime = useCallback(() => {
    if (
      !mountedRef.current ||
      loadedPanelRuntimeRef.current ||
      panelRuntimeLoadingRef.current
    ) {
      return;
    }

    panelRuntimeLoadingRef.current = true;
    void panelRuntimeLoader().then(
      (module) => {
        panelRuntimeLoadingRef.current = false;
        if (!mountedRef.current) {
          return;
        }

        loadedPanelRuntimeRef.current = module.MoreToolsPanelRuntime;
        setLoadedPanelRuntime(() => module.MoreToolsPanelRuntime);
      },
      () => {
        // Keep the lightweight trigger interactive so the next real opening
        // gesture can retry a failed chunk load.
        panelRuntimeLoadingRef.current = false;
      }
    );
  }, [panelRuntimeLoader]);

  const handleMouseEnter = useCallback(() => {
    if (isTouchDevice()) {
      return;
    }

    clearAllTimeouts();
    setIsHovering(true);
    hoverTimeoutRef.current = window.setTimeout(() => {
      hoverTimeoutRef.current = null;
      if (!mountedRef.current) {
        return;
      }

      requestPanelRuntime();
      setIsOpen(true);
    }, HOVER_OPEN_DELAY_MS);
  }, [clearAllTimeouts, requestPanelRuntime]);

  const handleMouseLeave = useCallback(() => {
    if (isTouchDevice()) {
      return;
    }

    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    leaveTimeoutRef.current = window.setTimeout(() => {
      leaveTimeoutRef.current = null;
      if (!mountedRef.current) {
        return;
      }
      setIsHovering(false);
      setIsOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, []);

  const handleClick = useCallback(() => {
    if (!isTouchDevice()) {
      return;
    }

    const nextOpen = !isOpen;
    clearAllTimeouts();
    setIsHovering(false);
    if (nextOpen) {
      requestPanelRuntime();
    }
    setIsOpen(nextOpen);
  }, [clearAllTimeouts, isOpen, requestPanelRuntime]);

  const handlePopoverMouseEnter = useCallback(() => {
    clearAllTimeouts();
    setIsHovering(true);
  }, [clearAllTimeouts]);

  const handlePopoverMouseLeave = useCallback(() => {
    if (leaveTimeoutRef.current !== null) {
      window.clearTimeout(leaveTimeoutRef.current);
    }
    leaveTimeoutRef.current = window.setTimeout(() => {
      leaveTimeoutRef.current = null;
      if (!mountedRef.current) {
        return;
      }
      setIsHovering(false);
      setIsOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, []);

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && (isTouchDevice() || !isHovering)) {
          setIsOpen(false);
        }
      }}
      placement={embedded ? 'right-start' : 'bottom'}
      sideOffset={12}
    >
      <PopoverTrigger asChild>
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        >
          <ToolButton
            type="icon"
            icon={<MoreIcon />}
            tooltip={isOpen ? undefined : t('toolbar.more')}
            tooltipPlacement={embedded ? 'right' : 'bottom'}
            aria-label={t('toolbar.more')}
            selected={isOpen}
            visible={true}
            data-testid="toolbar-more"
            data-track="toolbar_click_more"
          />
        </div>
      </PopoverTrigger>
      {LoadedPanelRuntime ? (
        <LoadedPanelRuntime
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        />
      ) : null}
    </Popover>
  );
};

export default MoreToolsButton;
