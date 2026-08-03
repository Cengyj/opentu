import React from 'react';
import { Dialog, DialogContent } from '../dialog/dialog';
import { DialogType, useDrawnix } from '../../hooks/use-drawnix';
import MermaidToDrawnix from './mermaid-to-drawnix';

export interface MermaidDialogControllerProps {
  container: HTMLElement | null;
}

export default function MermaidDialogController({
  container,
}: MermaidDialogControllerProps) {
  const { appState, openDialog, closeDialog } = useDrawnix();

  return (
    <Dialog
      open={appState.openDialogTypes.has(DialogType.mermaidToDrawnix)}
      onOpenChange={(open) => {
        if (open) {
          openDialog(DialogType.mermaidToDrawnix);
        } else {
          closeDialog(DialogType.mermaidToDrawnix);
        }
      }}
    >
      <DialogContent className="Dialog ttd-dialog" container={container}>
        <MermaidToDrawnix />
      </DialogContent>
    </Dialog>
  );
}
