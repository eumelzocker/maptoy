let topDialogZIndex = 3000;
const activeDialogs = new Map<symbol, number>();

export function activateDialog(dialog: symbol): number {
  topDialogZIndex += 1;
  activeDialogs.set(dialog, topDialogZIndex);
  return topDialogZIndex;
}

export function deactivateDialog(dialog: symbol): void {
  activeDialogs.delete(dialog);
}

export function isTopDialog(dialog: symbol): boolean {
  const dialogZIndex = activeDialogs.get(dialog);
  if (dialogZIndex === undefined) {
    return false;
  }
  for (const activeZIndex of activeDialogs.values()) {
    if (activeZIndex > dialogZIndex) {
      return false;
    }
  }
  return true;
}
