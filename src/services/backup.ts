import { mkdir, readdir, readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { TAILORED_DIR } from '../lib/files.js';

const BACKUP_DIR = join(TAILORED_DIR, 'backups');
const MAX_BACKUPS = 20;

export type SourceKey = 'resume' | 'bio' | 'baseCoverLetter' | 'resumeSupplemental';

const SOURCE_FILENAMES: Record<SourceKey, string> = {
  resume: 'resume.md',
  bio: 'bio.md',
  baseCoverLetter: 'cover-letter.md',
  resumeSupplemental: 'supplemental.md',
};

export interface BackupEntry {
  timestamp: string;
  path: string;
}

function getBackupDir(key: SourceKey): string {
  return join(BACKUP_DIR, SOURCE_FILENAMES[key]);
}

export async function backupSourceDocument(key: SourceKey, content: string): Promise<BackupEntry> {
  const dir = getBackupDir(key);
  await mkdir(dir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(dir, `${timestamp}.md`);
  await writeFile(backupPath, content, 'utf-8');

  const entries = (await readdir(dir)).filter((entry) => entry.endsWith('.md')).sort();
  if (entries.length > MAX_BACKUPS) {
    const toDelete = entries.slice(0, entries.length - MAX_BACKUPS);
    await Promise.all(toDelete.map((entry) => unlink(join(dir, entry))));
  }

  return { timestamp, path: backupPath };
}

export async function listSourceBackups(key: SourceKey): Promise<BackupEntry[]> {
  const dir = getBackupDir(key);
  try {
    const entries = await readdir(dir);
    return entries
      .filter((entry) => entry.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, MAX_BACKUPS)
      .map((entry) => ({ timestamp: entry.replace(/\.md$/, ''), path: join(dir, entry) }));
  } catch {
    return [];
  }
}

export async function readSourceBackup(key: SourceKey, timestamp: string): Promise<string> {
  const backupPath = join(getBackupDir(key), `${timestamp}.md`);
  return readFile(backupPath, 'utf-8');
}
