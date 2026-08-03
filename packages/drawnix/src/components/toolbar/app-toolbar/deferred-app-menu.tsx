import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n';
import { createRetriableModuleLoader } from '../../../utils/retriable-module-loader';
import { MenuIcon } from '../../icons/startup-icons';
import { Popover, PopoverTrigger } from '../../popover/popover';
import { ToolButton } from '../../tool-button';

type AppMenuRuntimeComponent = React.ComponentType<{
  container: HTMLElement | null;
  onClose: () => void;
  onOpenBackupRestore?: () => void;
  onOpenCloudSync?: () => void;
}>;

export type AppMenuRuntimeLoader = () => Promise<{
  AppMenuRuntime: AppMenuRuntimeComponent;
}>;

const loadDefaultAppMenuRuntime = createRetriableModuleLoader(
  () => import('./app-menu-runtime')
);

export interface DeferredAppMenuProps {
  embedded: boolean;
  container: HTMLElement | null;
  onOpenBackupRestore?: () => void;
  onOpenCloudSync?: () => void;
  /** Test seam for the production dynamic module boundary. */
  appMenuRuntimeLoader?: AppMenuRuntimeLoader;
}

/**
 * Keeps the application-menu trigger in the startup shell while loading the
 * complete menu only after the first real open action.
 */
export const DeferredAppMenu: React.FC<DeferredAppMenuProps> = ({
  embedded,
  container,
  onOpenBackupRestore,
  onOpenCloudSync,
  appMenuRuntimeLoader = loadDefaultAppMenuRuntime,
}) => {
  const { t } = useI18n();
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [LoadedAppMenuRuntime, setLoadedAppMenuRuntime] =
    useState<AppMenuRuntimeComponent | null>(null);
  const mountedRef = useRef(true);
  const runtimeLoadingRef = useRef(false);
  const loadedRuntimeRef = useRef<AppMenuRuntimeComponent | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestRuntime = useCallback(() => {
    if (
      !mountedRef.current ||
      loadedRuntimeRef.current ||
      runtimeLoadingRef.current
    ) {
      return;
    }

    runtimeLoadingRef.current = true;
    void appMenuRuntimeLoader().then(
      (module) => {
        runtimeLoadingRef.current = false;
        if (!mountedRef.current) {
          return;
        }

        loadedRuntimeRef.current = module.AppMenuRuntime;
        setLoadedAppMenuRuntime(() => module.AppMenuRuntime);
      },
      () => {
        // A rejected chunk is deliberately not cached. The trigger remains
        // interactive so a later close/open action can retry the import.
        runtimeLoadingRef.current = false;
      }
    );
  }, [appMenuRuntimeLoader]);

  const setMenuOpen = useCallback(
    (open: boolean) => {
      if (open) {
        requestRuntime();
      }
      setAppMenuOpen(open);
    },
    [requestRuntime]
  );

  return (
    <Popover
      sideOffset={12}
      open={appMenuOpen}
      onOpenChange={setMenuOpen}
      placement={embedded ? 'right-start' : 'bottom-start'}
    >
      <PopoverTrigger asChild>
        <ToolButton
          type="icon"
          visible={true}
          selected={appMenuOpen}
          icon={<MenuIcon />}
          tooltip={appMenuOpen ? undefined : t('general.menu')}
          tooltipPlacement={embedded ? 'right' : 'bottom'}
          aria-label={t('general.menu')}
          data-track="toolbar_click_menu"
          onPointerDown={() => {
            setMenuOpen(!appMenuOpen);
          }}
        />
      </PopoverTrigger>
      {LoadedAppMenuRuntime ? (
        <LoadedAppMenuRuntime
          container={container}
          onClose={() => setMenuOpen(false)}
          onOpenBackupRestore={onOpenBackupRestore}
          onOpenCloudSync={onOpenCloudSync}
        />
      ) : null}
    </Popover>
  );
};
