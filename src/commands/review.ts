import { Command } from 'commander';
import { diffMarkdown } from '../lib/diff.js';
import { renderResumeHtml } from '../lib/render.js';
import { analyzeGap } from '../services/gap.js';
import { listSavedWorkspaces, loadSavedWorkspace, saveWorkspaceSnapshot } from '../services/workspace-store.js';
import { launchReviewTui } from '../tui/review.js';
import { ResultVersion, SavedHuntrJob, SavedWorkspace, TailorRunResult } from '../types/index.js';

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

function versionLabel(nextIndex: number): string {
  return `v${nextIndex} (review)`;
}

function findJobContext(workspace: SavedWorkspace, jobId: string): SavedHuntrJob | null {
  const jobs = workspace.snapshot.huntrJobs ?? [];
  return jobs.find((job) => job.id === jobId) ?? workspace.snapshot.selectedHuntrJob ?? null;
}

function buildReviewedResult(args: {
  existing: TailorRunResult;
  reviewedResume: string;
  baseResume: string;
  company: string;
  jobDescription: string;
  jobTitle?: string;
}): TailorRunResult {
  return {
    ...args.existing,
    output: {
      ...args.existing.output,
      resume: args.reviewedResume,
    },
    artifacts: {
      ...args.existing.artifacts,
      resumeHtml: renderResumeHtml(args.reviewedResume, `Resume - ${args.company}`),
    },
    diff: diffMarkdown(args.baseResume, args.reviewedResume),
    gapAnalysis: analyzeGap(args.baseResume, args.jobDescription, args.jobTitle),
  };
}

export function registerReviewCommand(program: Command): void {
  program
    .command('review <jobId>')
    .description('Open the terminal review mode for a saved result version.')
    .option('--workspace <id>', 'Saved workspace ID to review from')
    .option('--v <index>', 'Version index to review (0-based, defaults to latest)')
    .option('-m, --model <model>', 'Model/deployment name for section regeneration', 'auto')
    .action(async (jobId: string, opts: { workspace?: string; v?: string; model?: string }) => {
      const workspace = resolveWorkspaceForJob(jobId, opts.workspace);
      const versions = workspace.snapshot.jobResults?.[jobId] ?? [];
      const versionIndex = parseVersionIndex(opts.v, Math.max(versions.length - 1, 0));
      const selectedVersion = versions[versionIndex];

      if (!selectedVersion) {
        throw new Error(
          `Version index out of range for job "${jobId}". Available versions: 0-${Math.max(versions.length - 1, 0)}.`,
        );
      }

      const baseResume = workspace.snapshot.documents.resume;
      const jobContext = findJobContext(workspace, jobId);
      const jobTitle = jobContext?.title || workspace.snapshot.jobTitle;
      const company = jobContext?.company || workspace.snapshot.company || 'Company';
      const jobDescription = jobContext?.descriptionText || workspace.snapshot.jobDescription;

      const reviewedResume = await launchReviewTui({
        baseResume,
        resume: selectedVersion.result.output.resume,
        bio: workspace.snapshot.documents.bio,
        company,
        jobTitle,
        jobDescription,
        model: opts.model || 'auto',
      });

      if (reviewedResume === selectedVersion.result.output.resume) {
        console.log('No review changes made.');
        return;
      }

      const nextResult = buildReviewedResult({
        existing: selectedVersion.result,
        reviewedResume,
        baseResume,
        company,
        jobDescription,
        jobTitle,
      });

      const nextVersions: ResultVersion[] = [
        ...versions,
        {
          result: nextResult,
          label: versionLabel(versions.length + 1),
          source: 'manual',
          createdAt: new Date().toISOString(),
        },
      ];

      const snapshot = {
        ...workspace.snapshot,
        result: nextResult,
        jobResults: {
          ...(workspace.snapshot.jobResults ?? {}),
          [jobId]: nextVersions,
        },
      };

      saveWorkspaceSnapshot({
        id: workspace.id,
        name: workspace.name,
        snapshot,
      });

      console.log(`Saved reviewed resume as ${versionLabel(nextVersions.length)} in workspace ${workspace.id}.`);
    });
}
