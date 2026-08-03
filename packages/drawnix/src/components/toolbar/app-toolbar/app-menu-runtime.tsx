import React from 'react';
import { PopoverContent } from '../../popover/popover';
import Menu from '../../menu/menu';
import MenuSeparator from '../../menu/menu-separator';
import { Z_INDEX } from '../../../constants/z-index';
import {
  BackupRestore,
  CleanBoard,
  CleanInvalidLinks,
  CloudSync,
  DebugPanel,
  OpenFile,
  QuickCommands,
  SaveAsImage,
  SaveToFile,
  Settings,
  UserManual,
  VersionInfo,
} from './app-menu-items';
import { LanguageSwitcherMenu } from './language-switcher-menu';

export interface AppMenuRuntimeProps {
  container: HTMLElement | null;
  onClose: () => void;
  onOpenBackupRestore?: () => void;
  onOpenCloudSync?: () => void;
}

export const AppMenuRuntime: React.FC<AppMenuRuntimeProps> = ({
  container,
  onClose,
  onOpenBackupRestore,
  onOpenCloudSync,
}) => (
  <PopoverContent
    container={container}
    style={{ zIndex: Z_INDEX.POPOVER_APP }}
  >
    <Menu onSelect={onClose} onClose={onClose}>
      <OpenFile />
      <SaveToFile />
      <SaveAsImage />
      <CleanBoard />
      <CleanInvalidLinks />
      <MenuSeparator />
      <LanguageSwitcherMenu />
      <BackupRestore
        onOpenBackupRestore={() => {
          onClose();
          onOpenBackupRestore?.();
        }}
      />
      <DebugPanel />
      <CloudSync
        onOpenCloudSync={() => {
          onClose();
          onOpenCloudSync?.();
        }}
      />
      <Settings />
      <MenuSeparator />
      <QuickCommands />
      <UserManual />
      <VersionInfo />
    </Menu>
  </PopoverContent>
);
