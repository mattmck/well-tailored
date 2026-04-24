export function getSourceStatusLabel({
  filePath,
  value,
  hasSavedWorkspace,
}: {
  filePath?: string;
  value: string;
  hasSavedWorkspace: boolean;
}): string {
  if (filePath) {
    return `Loaded from ${filePath}`;
  }

  if (!value) {
    return 'Not loaded';
  }

  return hasSavedWorkspace ? 'Saved in workspace' : 'Unsaved in editor';
}
