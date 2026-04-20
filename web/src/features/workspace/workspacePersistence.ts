import type { EditorData, Job, JobListFilter, SourcePaths, WorkspaceState } from '@/types';
import { normalizeTailorResult } from '@/lib/result-normalizers';
import { normalizeEditorData } from '@/lib/markdown';
import { getDisplayStage, isStatusLikeStage, normalizeStage } from '@/features/jobs/stages';

interface DbJobRecord {
  id: string;
  company: string;
  title: string | null;
  jd: string | null;
  stage: string;
  source: string;
  huntrId?: string | null;
  listAddedAt?: string | null;
  documents?: { resume?: string; cover?: string; resumeEditorDataJson?: string | null; coverEditorDataJson?: string | null };
  scorecard?: unknown;
  gapAnalysis?: unknown;
}

interface SavedWorkspaceRecord {
  id: string;
  name: string;
  snapshot?: unknown;
  // DB workspace format (top-level fields, no snapshot)
  sourceResume?: string | null;
  sourceBio?: string | null;
  sourceCoverLetter?: string | null;
  sourceSupplemental?: string | null;
  promptResumeSystem?: string | null;
  promptCoverLetterSystem?: string | null;
  promptScoringSystem?: string | null;
  agentConfigJson?: string | null;
  jobs?: DbJobRecord[];
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
    activeDoc?: unknown;
    viewMode?: unknown;
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
  dbJobId?: unknown;
  huntrId?: unknown;
  huntr_id?: unknown;
  boardId?: unknown;
  listAddedAt?: unknown;
  listPosition?: unknown;
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
  const rawStage =
    asString(job.stage)
    || asString(job.listName)
    || (asString((job as Record<string, unknown>).source) === 'manual' ? 'manual' : 'other');
  const source = asString((job as Record<string, unknown>).source);
  const stage = isStatusLikeStage(rawStage)
    ? source === 'manual' ? 'manual' : 'other'
    : rawStage;

  return {
    id,
    company: asString(job.company, 'Company'),
    title: asString(job.title, 'Job'),
    jd: asString(job.jd) || asString(job.descriptionText),
    stage,
    source: source === 'manual' ? 'manual' : 'huntr',
    dbJobId: asString(job.dbJobId) || null,
    huntrId: asString(job.huntrId) || asString(job.huntr_id) || (source === 'manual' ? null : id),
    boardId: asString(job.boardId) || null,
    listAddedAt: asString(job.listAddedAt) ?? null,
    listPosition: typeof job.listPosition === 'number' ? job.listPosition : null,
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
    scoresStale: false,
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
      activeDoc: state.activeDoc,
      viewMode: state.viewMode,
    },
    selectedJobIds,
    activeJobId: state.activeJobId,
    selectedHuntrJob: activeJob
      ? {
          boardId: activeJob.boardId ?? '',
          id: activeJob.huntrId ?? activeJob.id,
          title: activeJob.title,
          company: activeJob.company,
          listName: activeJob.stage,
          descriptionText: activeJob.jd,
          source: activeJob.source ?? (normalizeStage(activeJob.stage) === 'manual' ? 'manual' : 'huntr'),
          listAddedAt: activeJob.listAddedAt ?? null,
          listPosition: activeJob.listPosition ?? null,
        }
      : null,
    result: activeJob?.result ?? null,
    huntrJobs: state.jobs.map((job) => ({
      boardId: job.boardId ?? '',
      id: job.huntrId ?? job.id,
      title: job.title,
      company: job.company,
      listName: job.stage,
      descriptionText: job.jd,
      source: job.source ?? (normalizeStage(job.stage) === 'manual' ? 'manual' : 'huntr'),
      listAddedAt: job.listAddedAt ?? null,
      listPosition: job.listPosition ?? null,
    })),
    savedJobs: state.jobs.map((job) => ({
      id: job.id,
      dbJobId: job.dbJobId,
      huntrId: job.huntrId,
      boardId: job.boardId,
      listAddedAt: job.listAddedAt,
      listPosition: job.listPosition,
      company: job.company,
      title: job.title,
      jd: job.jd,
      stage: job.stage,
      source: job.source ?? (normalizeStage(job.stage) === 'manual' ? 'manual' : 'huntr'),
      status: job.status,
      checked: job.checked,
      error: job.error,
      result: job.result,
    })),
  };
}

export function getWorkspaceHuntrIdsMissingStage(workspace: SavedWorkspaceRecord): string[] {
  if (!workspace.snapshot && Array.isArray(workspace.jobs)) {
    return workspace.jobs
      .filter((job) => job.source !== 'manual')
      .map((job) => job.huntrId ?? null)
      .filter((id): id is string => Boolean(id));
  }

  const snapshot = getSnapshot(workspace);

  return getSavedJobs(snapshot)
    .filter((job) => asString(job.id))
    .filter((job) => asString(job.source) !== 'manual')
    .map((job) => asString(job.huntrId) || asString(job.id))
    .filter((id): id is string => Boolean(id));
}

function tryParseEditorData(json: string | null | undefined): EditorData | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sections)) {
      return normalizeEditorData(parsed as EditorData);
    }
  } catch { /* ignore */ }
  return null;
}

function dbWorkspaceToState(workspace: SavedWorkspaceRecord): Partial<WorkspaceState> {
  const jobs: Job[] = (workspace.jobs ?? []).map((job) => {
    const resume = job.documents?.resume ?? '';
    const cover = job.documents?.cover ?? '';
    const hasDocs = Boolean(resume || cover);
    const stage = getDisplayStage({ stage: job.stage, source: job.source });
    // Hydrate _editorData from the resume editor JSON if available
    const resumeEditorData = tryParseEditorData(job.documents?.resumeEditorDataJson);
    const rehydrated = hasDocs
      ? normalizeTailorResult({
          output: { resume, coverLetter: cover },
          scorecard: job.scorecard,
          gapAnalysis: job.gapAnalysis,
        })
      : null;
    return {
      id: job.id,
      company: job.company,
      title: job.title ?? '',
      jd: job.jd ?? '',
      stage,
      source: job.source === 'manual' ? 'manual' : 'huntr',
      dbJobId: job.id,
      huntrId: job.huntrId ?? null,
      listAddedAt: job.listAddedAt ?? null,
      boardId: null,
      status: hasDocs ? ('tailored' as const) : ('loaded' as const),
      checked: false,
      scoresStale: false,
      result: rehydrated,
      error: null,
      _editorData: resumeEditorData,
    };
  });

  let agentConfig: Record<string, unknown> = {};
  if (workspace.agentConfigJson) {
    try { agentConfig = JSON.parse(workspace.agentConfigJson); } catch { /* ignore */ }
  }

  return {
    workspaceName: workspace.name,
    activeWorkspaceId: workspace.id,
    sourceResume: workspace.sourceResume ?? '',
    sourceBio: workspace.sourceBio ?? '',
    sourceCoverLetter: workspace.sourceCoverLetter ?? '',
    sourceSupplemental: workspace.sourceSupplemental ?? '',
    sourcePaths: {},
    promptSources: {
      resumeSystem: workspace.promptResumeSystem ?? '',
      coverLetterSystem: workspace.promptCoverLetterSystem ?? '',
      scoringSystem: workspace.promptScoringSystem ?? '',
    },
    tailorProvider: asString(agentConfig.tailoringProvider, 'auto') || 'auto',
    tailorModel: asString(agentConfig.tailoringModel, 'auto') || 'auto',
    scoreProvider: asString(agentConfig.scoringProvider, 'auto') || 'auto',
    scoreModel: asString(agentConfig.scoringModel, 'auto') || 'auto',
    jobs,
    activeJobId: jobs[0]?.id ?? null,
    jobListFilter: 'all',
    activeDoc: 'resume',
    viewMode: 'preview',
    tailorQueue: [],
    tailorQueueTotal: 0,
    tailorRunning: null,
    tailorRunningStartedAt: 0,
    tailorLastSummary: null,
    regradeQueue: [],
    regradeQueueTotal: 0,
    regradeRunning: null,
    regradeRunningStartedAt: 0,
    runFeedback: null,
    activityLog: [],
    regeneratingSection: null,
    activeScoreDetailsId: null,
  };
}

export function workspaceRecordToState(workspace: SavedWorkspaceRecord): Partial<WorkspaceState> {
  // DB format: has top-level source fields instead of a snapshot blob
  if (!workspace.snapshot && workspace.sourceResume !== undefined) {
    return dbWorkspaceToState(workspace);
  }

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
  const activeDoc = snapshot?.uiState?.activeDoc === 'cover' ? 'cover' : 'resume';
  const viewMode = snapshot?.uiState?.viewMode === 'diff' ? 'diff' : 'preview';
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
    activeDoc,
    viewMode,
    tailorQueue: [],
    tailorQueueTotal: 0,
    tailorRunning: null,
    tailorRunningStartedAt: 0,
    tailorLastSummary: null,
    regradeQueue: [],
    regradeQueueTotal: 0,
    regradeRunning: null,
    regradeRunningStartedAt: 0,
    runFeedback: null,
    activityLog: [],
    regeneratingSection: null,
    activeScoreDetailsId: null,
  };
}
