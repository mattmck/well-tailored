import type { Job, JobListFilter, SourcePaths, WorkspaceState } from '@/types';
import { normalizeTailorResult } from '@/lib/result-normalizers';
import { normalizeStage } from '@/features/jobs/stages';

interface SavedWorkspaceRecord {
  id: string;
  name: string;
  snapshot?: unknown;
}

interface SavedWorkspaceSnapshot {
  documents?: {
    resume?: string;
    bio?: string;
    baseCoverLetter?: string;
    resumeSupplemental?: string;
  };
  documentSources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  agents?: {
    tailoringProvider?: unknown;
    tailoringModel?: unknown;
    scoringProvider?: unknown;
    scoringModel?: unknown;
  };
  activeJobId?: unknown;
  selectedJobIds?: unknown;
  savedJobs?: unknown;
  huntrJobs?: unknown;
  selectedHuntrJob?: unknown;
  result?: unknown;
  uiState?: {
    jobListFilter?: unknown;
  };
}

interface StoredJobRecord {
  id?: unknown;
  company?: unknown;
  title?: unknown;
  jd?: unknown;
  descriptionText?: unknown;
  stage?: unknown;
  listName?: unknown;
  source?: unknown;
  status?: unknown;
  checked?: unknown;
  error?: unknown;
  result?: unknown;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function getSavedJobs(snapshot?: SavedWorkspaceSnapshot): StoredJobRecord[] {
  if (Array.isArray(snapshot?.savedJobs)) {
    return snapshot.savedJobs.filter((entry): entry is StoredJobRecord => !!entry && typeof entry === 'object');
  }

  if (Array.isArray(snapshot?.huntrJobs)) {
    return snapshot.huntrJobs.filter((entry): entry is StoredJobRecord => !!entry && typeof entry === 'object');
  }

  return [];
}

function getSnapshot(workspace: SavedWorkspaceRecord): SavedWorkspaceSnapshot | undefined {
  return (workspace.snapshot && typeof workspace.snapshot === 'object'
    ? workspace.snapshot
    : undefined) as SavedWorkspaceSnapshot | undefined;
}

function getDocumentSources(snapshot?: SavedWorkspaceSnapshot): SourcePaths {
  const sources = snapshot?.documentSources ?? {};

  return {
    resume: asString(sources.resume) || asString(sources.resumePath),
    bio: asString(sources.bio) || asString(sources.bioPath),
    baseCoverLetter: asString(sources.baseCoverLetter) || asString(sources.coverLetterPath),
    resumeSupplemental: asString(sources.resumeSupplemental) || asString(sources.supplementalPath),
  };
}

function toWorkspaceJob(job: StoredJobRecord, selectedJobIds: string[]): Job | null {
  const id = asString(job.id);
  if (!id) return null;

  return {
    id,
    company: asString(job.company, 'Company'),
    title: asString(job.title, 'Job'),
    jd: asString(job.jd) || asString(job.descriptionText),
    stage:
      asString(job.stage)
      || asString(job.listName)
      || (asString((job as Record<string, unknown>).source) === 'manual' ? 'manual' : 'wishlist'),
    status:
      job.status === 'tailoring'
      || job.status === 'tailored'
      || job.status === 'reviewed'
      || job.status === 'error'
        ? job.status
        : 'loaded',
    checked:
      typeof job.checked === 'boolean'
        ? job.checked
        : selectedJobIds.includes(id),
    result: normalizeTailorResult(job.result),
    error: typeof job.error === 'string' ? job.error : null,
    _editorData: null,
  };
}

function getSelectedJob(snapshot?: SavedWorkspaceSnapshot): StoredJobRecord | null {
  if (snapshot?.selectedHuntrJob && typeof snapshot.selectedHuntrJob === 'object') {
    return snapshot.selectedHuntrJob as StoredJobRecord;
  }

  return null;
}

export function buildWorkspaceSnapshot(state: WorkspaceState): Record<string, unknown> {
  const activeJob = state.jobs.find((job) => job.id === state.activeJobId) ?? null;
  const selectedJobIds = state.jobs.filter((job) => job.checked).map((job) => job.id);

  return {
    company: activeJob?.company ?? '',
    jobTitle: activeJob?.title ?? '',
    jobDescription: activeJob?.jd ?? '',
    documents: {
      resume: state.sourceResume,
      bio: state.sourceBio,
      baseCoverLetter: state.sourceCoverLetter,
      resumeSupplemental: state.sourceSupplemental,
    },
    documentSources: {
      resume: state.sourcePaths.resume,
      bio: state.sourcePaths.bio,
      baseCoverLetter: state.sourcePaths.baseCoverLetter,
      resumeSupplemental: state.sourcePaths.resumeSupplemental,
      resumePath: state.sourcePaths.resume,
      bioPath: state.sourcePaths.bio,
      coverLetterPath: state.sourcePaths.baseCoverLetter,
      supplementalPath: state.sourcePaths.resumeSupplemental,
    },
    prompts: {
      resumeSystem: state.promptSources.resumeSystem ?? '',
      coverLetterSystem: state.promptSources.coverLetterSystem ?? '',
      scoringSystem: state.promptSources.scoringSystem ?? '',
    },
    agents: {
      tailoringProvider: state.tailorProvider,
      tailoringModel: state.tailorModel,
      scoringProvider: state.scoreProvider,
      scoringModel: state.scoreModel,
    },
    uiState: {
      openPanels: [],
      jobListFilter: state.jobListFilter,
    },
    selectedJobIds,
    activeJobId: state.activeJobId,
    selectedHuntrJob: activeJob
      ? {
          boardId: '',
          id: activeJob.id,
          title: activeJob.title,
          company: activeJob.company,
          listName: activeJob.stage,
          descriptionText: activeJob.jd,
          source: normalizeStage(activeJob.stage) === 'manual' ? 'manual' : 'huntr',
        }
      : null,
    result: activeJob?.result ?? null,
    huntrJobs: state.jobs.map((job) => ({
      boardId: '',
      id: job.id,
      title: job.title,
      company: job.company,
      listName: job.stage,
      descriptionText: job.jd,
      source: normalizeStage(job.stage) === 'manual' ? 'manual' : 'huntr',
    })),
    savedJobs: state.jobs.map((job) => ({
      id: job.id,
      company: job.company,
      title: job.title,
      jd: job.jd,
      stage: job.stage,
      source: normalizeStage(job.stage) === 'manual' ? 'manual' : 'huntr',
      status: job.status,
      checked: job.checked,
      error: job.error,
      result: job.result,
    })),
  };
}

export function getWorkspaceHuntrIdsMissingStage(workspace: SavedWorkspaceRecord): string[] {
  const snapshot = getSnapshot(workspace);

  return getSavedJobs(snapshot)
    .filter((job) => asString(job.id))
    .filter((job) => asString(job.source) === 'huntr')
    .filter((job) => !asString(job.stage) && !asString(job.listName))
    .map((job) => asString(job.id))
    .filter((id): id is string => Boolean(id));
}

export function workspaceRecordToState(workspace: SavedWorkspaceRecord): Partial<WorkspaceState> {
  const snapshot = getSnapshot(workspace);
  const selectedJobIds = asStringArray(snapshot?.selectedJobIds);
  const selectedJob = getSelectedJob(snapshot);
  const jobs = getSavedJobs(snapshot)
    .map((job) => toWorkspaceJob(job, selectedJobIds))
    .filter((job): job is Job => job !== null);

  if (jobs.length === 0 && selectedJob) {
    const fallbackJob = toWorkspaceJob(selectedJob, selectedJobIds);
    if (fallbackJob) {
      jobs.push(fallbackJob);
    }
  }

  const activeJobId = asString(snapshot?.activeJobId) || jobs[0]?.id || null;
  const filter = asString(snapshot?.uiState?.jobListFilter, 'all');
  const activeResult = normalizeTailorResult(snapshot?.result);
  const hydratedJobs = jobs.map((job) =>
    activeResult && activeJobId && job.id === activeJobId && !job.result
      ? { ...job, result: activeResult }
      : job,
  );

  return {
    workspaceName: workspace.name,
    activeWorkspaceId: workspace.id,
    sourceResume: asString(snapshot?.documents?.resume),
    sourceBio: asString(snapshot?.documents?.bio),
    sourceCoverLetter: asString(snapshot?.documents?.baseCoverLetter),
    sourceSupplemental: asString(snapshot?.documents?.resumeSupplemental),
    sourcePaths: getDocumentSources(snapshot),
    promptSources: {
      resumeSystem: asString(snapshot?.prompts?.resumeSystem),
      coverLetterSystem: asString(snapshot?.prompts?.coverLetterSystem),
      scoringSystem: asString(snapshot?.prompts?.scoringSystem),
    },
    tailorProvider: asString(snapshot?.agents?.tailoringProvider, 'auto') || 'auto',
    tailorModel: asString(snapshot?.agents?.tailoringModel, 'auto') || 'auto',
    scoreProvider: asString(snapshot?.agents?.scoringProvider, 'auto') || 'auto',
    scoreModel: asString(snapshot?.agents?.scoringModel, 'auto') || 'auto',
    jobs: hydratedJobs,
    activeJobId,
    jobListFilter: (filter || 'all') as JobListFilter,
    tailorQueue: [],
    tailorQueueTotal: 0,
    tailorRunning: null,
    tailorRunningStartedAt: 0,
    tailorLastSummary: null,
    runFeedback: null,
    scoresStale: false,
    activeDoc: 'resume',
    viewMode: 'preview',
    regeneratingSection: null,
    activeScoreDetailsId: null,
  };
}
