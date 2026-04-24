import { describe, expect, it } from 'vitest';
import { getSourceStatusLabel } from '../web/src/features/sources/sourceStatus.js';

describe('getSourceStatusLabel', () => {
  it('shows the filesystem path when a local source file is loaded', () => {
    expect(getSourceStatusLabel({
      filePath: '/Users/matt/resume.md',
      value: 'Resume content',
      hasSavedWorkspace: true,
    })).toBe('Loaded from /Users/matt/resume.md');
  });

  it('shows that source text is saved when it belongs to a saved workspace', () => {
    expect(getSourceStatusLabel({
      value: 'Saved source content',
      hasSavedWorkspace: true,
    })).toBe('Saved in workspace');
  });

  it('shows that source text is still unsaved when no workspace exists yet', () => {
    expect(getSourceStatusLabel({
      value: 'Scratch source content',
      hasSavedWorkspace: false,
    })).toBe('Unsaved in editor');
  });

  it('shows not loaded when the source is empty', () => {
    expect(getSourceStatusLabel({
      value: '',
      hasSavedWorkspace: false,
    })).toBe('Not loaded');
  });
});
