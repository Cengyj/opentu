import React from 'react';
import { Dialog, DialogContent } from '../dialog/dialog';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import MarkdownToDrawnix from './markdown-to-drawnix';

export interface MarkdownDialogControllerProps {
  container: HTMLElement | null;
}

export default function MarkdownDialogController({
  container,
}: MarkdownDialogControllerProps) {
  const { appState, openDialog, closeDialog } = useDrawnix();

  return (
    <Dialog
      open={appState.openDialogTypes.has(DialogType.markdownToDrawnix)}
      onOpenChange={(open) => {
        if (open) {
          openDialog(DialogType.markdownToDrawnix);
        } else {
          closeDialog(DialogType.markdownToDrawnix);
        }
      }}
    >
      <DialogContent className="Dialog ttd-dialog" container={container}>
        <MarkdownToDrawnix />
      </DialogContent>
    </Dialog>
  );
}
