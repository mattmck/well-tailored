import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { SavedWorkspace, SavedWorkspaceSummary, WorkspaceSnapshot } from '../types/index.js';

const TAILORED_HOME = join(homedir(), '.well-tailored');
const WORKSPACES_DIR = join(TAILORED_HOME, 'workspaces');

function ensureWorkspaceDir(): string {
  if (!existsSync(WORKSPACES_DIR)) {
    mkdirSync(WORKSPACES_DIR, { recursive: true });
  }
  return WORKSPACES_DIR;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'workspace';
}

function validateWorkspaceId(id: string): string {
  // Allow only simple filename-safe tokens like "my-workspace-123"
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`Invalid workspace id: "${id}"`);
  }
  return id;
}

function workspacePath(id: string): string {
  const safeId = validateWorkspaceId(id);
  return join(ensureWorkspaceDir(), `${safeId}.json`);
}

function readWorkspace(path: string): SavedWorkspace {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read workspace at ${path}: ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse workspace at ${path}: ${(err as Error).message}`);
  }
  const ws = parsed as Record<string, unknown>;
  if (!ws || typeof ws !== 'object' || typeof ws.id !== 'string' || typeof ws.name !== 'string') {
    throw new Error(`Invalid workspace file at ${path}: missing required fields (id, name)`);
  }
  return ws as unknown as SavedWorkspace;
}

export function listSavedWorkspaces(): SavedWorkspaceSummary[] {
  const dir = ensureWorkspaceDir();
  const workspaces: SavedWorkspace[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      workspaces.push(readWorkspace(join(dir, name)));
    } catch (err) {
      console.warn(`Skipping corrupt workspace file ${name}: ${(err as Error).message}`);
    }
  }
  return workspaces
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(({ id, name, slug, createdAt, updatedAt }) => ({
      id,
      name,
      slug,
      createdAt,
      updatedAt,
    }));
}

export function loadSavedWorkspace(id: string): SavedWorkspace {
  const path = workspacePath(id);
  if (!existsSync(path)) {
    throw new Error(`Workspace "${id}" was not found.`);
  }
  return readWorkspace(path);
}

export function saveWorkspaceSnapshot(args: {
  id?: string;
  name?: string;
  snapshot: WorkspaceSnapshot;
}): SavedWorkspace {
  const now = new Date().toISOString();
  const name = args.name?.trim()
    || [args.snapshot.company, args.snapshot.jobTitle].filter(Boolean).join(' - ')
    || 'Untitled workspace';
  const slug = slugify(name);

  let existing: SavedWorkspace | undefined;
  let resolvedId: string | undefined;
  if (args.id) {
    const path = workspacePath(args.id);
    if (existsSync(path)) {
      existing = readWorkspace(path);
      // Use the canonical id from the existing workspace record
      resolvedId = existing.id;
    }
  }

  const id = resolvedId ?? `${slug}-${Date.now()}`;
  const saved: SavedWorkspace = {
    id,
    name,
    slug,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    snapshot: args.snapshot,
  };

  writeFileSync(workspacePath(id), JSON.stringify(saved, null, 2), 'utf8');
  return saved;
}
