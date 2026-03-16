import { Command } from 'commander';
import { diffMarkdown, formatDiffAnsi } from '../lib/diff.js';
import { listSavedWorkspaces, loadSavedWorkspace } from '../services/workspace-store.js';
import { ResultVersion, SavedWorkspace } from '../types/index.js';

function parseVersionIndex(raw: string | undefined, fallback: number): number {
  const value = raw === undefined ? fallback : Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid version index: ${raw ?? fallback}`);
  }
  return value;
}

function resolveWorkspaceForJob(jobId: string, requestedWorkspaceId?: string): SavedWorkspace {
  if (requestedWorkspaceId) {
    const workspace = loadSavedWorkspace(requestedWorkspaceId);
    if (!workspace.snapshot.jobResults?.[jobId]?.length) {
      throw new Error(`Workspace "${requestedWorkspaceId}" has no saved versions for job "${jobId}".`);
    }
    return workspace;
  }

  for (const summary of listSavedWorkspaces()) {
    const workspace = loadSavedWorkspace(summary.id);
    if (workspace.snapshot.jobResults?.[jobId]?.length) {
      return workspace;
    }
  }

  throw new Error(`No saved workspace versions found for job "${jobId}".`);
}

function resolveDocument(version: ResultVersion, kind: 'resume' | 'coverLetter'): string {
  return kind === 'resume' ? version.result.output.resume : version.result.output.coverLetter;
}

export function registerDiffCommand(program: Command): void {
  program
    .command('diff <jobId>')
    .description('Compare saved result versions for a job from your persisted workspaces.')
    .option('--workspace <id>', 'Saved workspace ID to read versions from')
    .option('--v1 <index>', 'Older version index (0-based)', '0')
    .option('--v2 <index>', 'Newer version index (0-based). Defaults to the next version after --v1')
    .option('--document <kind>', 'Which document to diff: resume or coverLetter', 'resume')
    .action((jobId: string, opts: {
      workspace?: string;
      v1?: string;
      v2?: string;
      document?: 'resume' | 'coverLetter';
    }) => {
      const workspace = resolveWorkspaceForJob(jobId, opts.workspace);
      const versions = workspace.snapshot.jobResults?.[jobId] ?? [];
      const v1Index = parseVersionIndex(opts.v1, 0);
      const v2Index = parseVersionIndex(opts.v2, v1Index + 1);
      const documentKind = opts.document === 'coverLetter' ? 'coverLetter' : 'resume';

      if (!versions[v1Index] || !versions[v2Index]) {
        throw new Error(
          `Version indices out of range for job "${jobId}". Available versions: 0-${Math.max(versions.length - 1, 0)}.`,
        );
      }

      const before = resolveDocument(versions[v1Index], documentKind);
      const after = resolveDocument(versions[v2Index], documentKind);
      const diff = diffMarkdown(before, after);

      console.log(`\nWorkspace: ${workspace.name} (${workspace.id})`);
      console.log(`Job: ${jobId}`);
      console.log(`Comparing ${documentKind}: ${versions[v1Index].label} -> ${versions[v2Index].label}`);
      console.log(`Diff summary: +${diff.stats.added} / -${diff.stats.removed} / =${diff.stats.unchanged}`);
      console.log(formatDiffAnsi(diff));
    });
}
