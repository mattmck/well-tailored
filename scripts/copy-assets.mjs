#!/usr/bin/env node
/**
 * Cross-platform asset copy for the build step.
 * Replaces POSIX `rm -rf ... && cp -r ...` so the build works on Windows too.
 */
import { cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const targets = [
  { src: 'src/templates', dest: 'dist/templates' },
  { src: 'src/workbench', dest: 'dist/workbench' },
];

const extraFiles = [
  { src: 'docs/resume-editor.html', dest: 'dist/workbench/resume-editor.html' },
];

// Clean
for (const { dest } of targets) {
  rmSync(resolve(root, dest), { recursive: true, force: true });
}

// Copy directories
for (const { src, dest } of targets) {
  cpSync(resolve(root, src), resolve(root, dest), { recursive: true });
}

// Copy individual files
for (const { src, dest } of extraFiles) {
  cpSync(resolve(root, src), resolve(root, dest));
}
