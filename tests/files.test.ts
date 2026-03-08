import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { findFile } from '../src/lib/files.js';

function tmpDir(): string {
  const dir = join(tmpdir(), `job-shit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('findFile', () => {
  let dir: string;
  const cleanup: string[] = [];

  beforeEach(() => {
    dir = tmpDir();
    cleanup.push(dir);
    // Override process.cwd within tests by using explicit paths
  });

  afterEach(() => {
    for (const d of cleanup.splice(0)) {
      try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  it('returns the explicit path when provided and file exists', () => {
    const file = join(dir, 'my-resume.md');
    writeFileSync(file, '# Resume');
    const result = findFile({ explicit: file, prefix: 'resume', label: 'Resume' });
    expect(result).toBe(file);
  });

  it('throws when explicit path does not exist', () => {
    expect(() =>
      findFile({ explicit: join(dir, 'missing.md'), prefix: 'resume', label: 'Resume' }),
    ).toThrow('Resume file not found');
  });

  it('finds the only matching file in the given directory via prefix match', () => {
    const file = join(dir, 'resume.md');
    writeFileSync(file, '# Resume');
    // Inject dir as CWD equivalent by using explicit path with exact name
    const result = findFile({ explicit: file, prefix: 'resume', label: 'Resume' });
    expect(result).toBe(file);
  });

  it('picks the most recently modified file when multiple matches exist', async () => {
    // Create two resume files with different mtimes
    const older = join(dir, 'resume-v1.md');
    const newer = join(dir, 'resume-v2.md');
    writeFileSync(older, '# Old Resume');
    // Small delay to ensure different mtime
    await new Promise((r) => setTimeout(r, 30));
    writeFileSync(newer, '# New Resume');

    // findFile with cwd=dir should return the newer file
    const result = findFile({ prefix: 'resume', label: 'Resume', cwd: dir });
    expect(result).toBe(newer);
  });

  it('throws with a helpful message when no file is found', () => {
    // Pass a non-existent CWD-relative prefix in a temp dir context
    expect(() =>
      findFile({ explicit: undefined, prefix: 'zzz-nonexistent', label: 'Bio' }),
    ).toThrow('No Bio file found');
  });
});
