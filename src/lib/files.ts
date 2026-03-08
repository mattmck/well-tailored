import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';

/** Default directory where job-shit looks for base files. */
export const JOB_SHIT_DIR = join(homedir(), '.job-shit');

/**
 * Find the most recently modified file matching a glob-like basename pattern.
 * Checks the given directory and returns the path of the newest match, or null.
 */
function findLatestIn(dir: string, prefix: string, ext: string): string | null {
  if (!existsSync(dir)) return null;

  let entries: { path: string; mtime: number }[];
  try {
    entries = readdirSync(dir)
      .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
      .map((f) => {
        const p = join(dir, f);
        return { path: p, mtime: statSync(p).mtimeMs };
      });
  } catch {
    return null;
  }

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.mtime - a.mtime);
  return entries[0]?.path ?? null;
}

/**
 * Resolve a file path with auto-discovery fallback.
 *
 * Resolution order (stops at first hit):
 *   1. Explicit path (if provided via CLI flag)
 *   2. Current directory — most recently modified file matching prefix+ext
 *   3. ~/.job-shit/    — most recently modified file matching prefix+ext
 *
 * Returns the resolved path string, or throws if nothing is found.
 *
 * @param cwd Override for the current working directory (used in tests).
 */
export function findFile(opts: {
  explicit?: string;
  prefix: string;
  ext?: string;
  label: string;
  cwd?: string;
}): string {
  const ext = opts.ext ?? '.md';

  // 1. Explicit path
  if (opts.explicit) {
    const p = resolve(opts.explicit);
    if (!existsSync(p)) {
      throw new Error(`${opts.label} file not found: ${opts.explicit}`);
    }
    return p;
  }

  // 2. Current directory (or injected cwd for tests)
  const cwd = opts.cwd ?? process.cwd();
  const cwdMatch = findLatestIn(cwd, opts.prefix, ext);
  if (cwdMatch) return cwdMatch;

  // 3. ~/.job-shit/
  const homeMatch = findLatestIn(JOB_SHIT_DIR, opts.prefix, ext);
  if (homeMatch) return homeMatch;

  throw new Error(
    `No ${opts.label} file found. ` +
      `Create '${opts.prefix}${ext}' in the current directory or in ${JOB_SHIT_DIR}.`,
  );
}

/** Read a file and return its trimmed contents. */
export function readFile(filePath: string): string {
  return readFileSync(resolve(filePath), 'utf8').trim();
}
