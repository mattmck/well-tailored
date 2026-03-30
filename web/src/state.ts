import type {
  WorkspaceState,
  Job,
  ActiveDoc,
  ViewMode,
  JobListFilter,
  ActivePanel,
  SourcePaths,
  PromptSources,
  EditorData,
} from './types.js';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialState: WorkspaceState = {
  jobs: [],
  activeJobId: null,
  jobListFilter: 'all',
  isLoadingHuntr: false,
  workspaceName: '',
  savedWorkspaces: [],
  activeWorkspaceId: null,
  configProviders: [],
  tailorProvider: 'auto',
  tailorModel: 'auto',
  scoreProvider: 'auto',
  scoreModel: 'auto',
  sourceResume: '',
  sourceBio: '',
  sourceCoverLetter: '',
  sourceSupplemental: '',
  sourcePaths: {},
  promptSources: {},
  tailorQueue: [],
  tailorQueueTotal: 0,
  tailorRunning: null,
  tailorRunningStartedAt: 0,
  tailorLastSummary: null,
  regradeQueue: [],
  regradeQueueTotal: 0,
  regradeRunning: null,
  regradeRunningStartedAt: 0,
  activeDoc: 'resume',
  viewMode: 'preview',
  regeneratingSection: null,
  activePanel: null,
  activeScoreDetailsId: null,
  runFeedback: null,
};

// ---------------------------------------------------------------------------
// Action union type
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'SET_JOBS'; jobs: Job[] }
  | { type: 'MERGE_JOBS'; jobs: Job[] }
  | { type: 'SET_ACTIVE_JOB'; id: string | null }
  | { type: 'UPDATE_JOB'; id: string; patch: Partial<Job> }
  | { type: 'SET_JOBS_CHECKED'; ids: string[]; checked: boolean }
  | { type: 'MERGE_JOB_STAGES'; stages: Record<string, string> }
  | { type: 'SET_JOB_FILTER'; filter: JobListFilter }
  | { type: 'SET_LOADING_HUNTR'; loading: boolean }
  | { type: 'SET_WORKSPACE_NAME'; name: string }
  | { type: 'SET_SAVED_WORKSPACES'; workspaces: { id: string; name: string }[] }
  | { type: 'SET_ACTIVE_WORKSPACE'; id: string | null }
  | { type: 'SET_CONFIG_PROVIDERS'; providers: { id: string; name: string; models: string[] }[] }
  | {
      type: 'INITIALIZE_CONFIG';
      providers: { id: string; name: string; models: string[] }[];
      defaults: {
        tailoringProvider: string;
        tailoringModel: string;
        scoringProvider: string;
        scoringModel: string;
      };
    }
  | { type: 'SET_TAILOR_PROVIDER'; provider: string }
  | { type: 'SET_TAILOR_MODEL'; model: string }
  | { type: 'SET_SCORE_PROVIDER'; provider: string }
  | { type: 'SET_SCORE_MODEL'; model: string }
  | { type: 'SET_SOURCE'; field: 'sourceResume' | 'sourceBio' | 'sourceCoverLetter' | 'sourceSupplemental'; value: string }
  | { type: 'SET_SOURCE_PATHS'; paths: SourcePaths }
  | { type: 'SET_PROMPT_SOURCES'; sources: PromptSources }
  | { type: 'SET_JOB_DOCUMENT_STATE'; id: string; doc: ActiveDoc; editorData: EditorData; markdown: string }
  | { type: 'SET_TAILOR_QUEUE'; queue: string[]; total?: number }
  | { type: 'SET_TAILOR_RUNNING'; id: string | null; startedAt?: number }
  | { type: 'SET_TAILOR_SUMMARY'; summary: { tailored: number; failed: number } | null }
  | { type: 'SET_JOB_SCORES_STALE'; id: string; stale: boolean }
  | { type: 'SET_REGRADE_QUEUE'; queue: string[]; total?: number }
  | { type: 'SET_REGRADE_RUNNING'; id: string | null; startedAt?: number }
  | { type: 'SET_ACTIVE_DOC'; doc: ActiveDoc }
  | { type: 'SET_VIEW_MODE'; mode: ViewMode }
  | { type: 'SET_REGENERATING_SECTION'; section: string | null }
  | { type: 'SET_ACTIVE_PANEL'; panel: ActivePanel }
  | { type: 'SET_SCORE_DETAILS'; id: string | null }
  | { type: 'SET_RUN_FEEDBACK'; feedback: { text: string; type: 'working' | 'done' | 'error' } | null }
  | { type: 'LOAD_WORKSPACE'; state: Partial<WorkspaceState> };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'SET_JOBS':
      return { ...state, jobs: action.jobs };

    case 'MERGE_JOBS': {
      const existingById = new Map(state.jobs.map((j) => [j.id, j]));
      const merged = action.jobs.map((incoming) => {
        const existing = existingById.get(incoming.id);
        if (!existing) return incoming;
        // Preserve tailoring results, editor data, status, checked — refresh metadata.
        // If key metadata changed, clear derived fields so stale results aren't shown.
        const metaChanged =
          existing.company !== incoming.company ||
          existing.title !== incoming.title ||
          existing.jd !== incoming.jd;
        return {
          ...existing,
          company: incoming.company,
          title: incoming.title,
          jd: incoming.jd,
          stage: incoming.stage,
          ...(metaChanged && {
            result: undefined,
            _editorData: null,
            status: 'loaded' as const,
            error: undefined,
            scoresStale: false,
          }),
        };
      });
      return { ...state, jobs: merged };
    }

    case 'SET_ACTIVE_JOB':
      return { ...state, activeJobId: action.id };

    case 'UPDATE_JOB':
      return {
        ...state,
        jobs: state.jobs.map((job) =>
          job.id === action.id ? { ...job, ...action.patch } : job
        ),
      };

    case 'SET_JOBS_CHECKED': {
      const targetIds = new Set(action.ids);
      return {
        ...state,
        jobs: state.jobs.map((job) =>
          targetIds.has(job.id) ? { ...job, checked: action.checked } : job
        ),
      };
    }

    case 'MERGE_JOB_STAGES':
      return {
        ...state,
        jobs: state.jobs.map((job) =>
          action.stages[job.id]
            ? { ...job, stage: action.stages[job.id] }
            : job
        ),
      };

    case 'SET_JOB_FILTER':
      return { ...state, jobListFilter: action.filter };

    case 'SET_LOADING_HUNTR':
      return { ...state, isLoadingHuntr: action.loading };

    case 'SET_WORKSPACE_NAME':
      return { ...state, workspaceName: action.name };

    case 'SET_SAVED_WORKSPACES':
      return { ...state, savedWorkspaces: action.workspaces };

    case 'SET_ACTIVE_WORKSPACE':
      return { ...state, activeWorkspaceId: action.id };

    case 'SET_CONFIG_PROVIDERS':
      return { ...state, configProviders: action.providers };

    case 'INITIALIZE_CONFIG':
      return {
        ...state,
        configProviders: action.providers,
        tailorProvider:
          state.tailorProvider === 'auto'
            ? action.defaults.tailoringProvider || 'auto'
            : state.tailorProvider,
        tailorModel:
          state.tailorModel === 'auto'
            ? action.defaults.tailoringModel || 'auto'
            : state.tailorModel,
        scoreProvider:
          state.scoreProvider === 'auto'
            ? action.defaults.scoringProvider || 'auto'
            : state.scoreProvider,
        scoreModel:
          state.scoreModel === 'auto'
            ? action.defaults.scoringModel || 'auto'
            : state.scoreModel,
      };

    case 'SET_TAILOR_PROVIDER':
      return { ...state, tailorProvider: action.provider };

    case 'SET_TAILOR_MODEL':
      return { ...state, tailorModel: action.model };

    case 'SET_SCORE_PROVIDER':
      return { ...state, scoreProvider: action.provider };

    case 'SET_SCORE_MODEL':
      return { ...state, scoreModel: action.model };

    case 'SET_SOURCE':
      return { ...state, [action.field]: action.value };

    case 'SET_SOURCE_PATHS':
      return { ...state, sourcePaths: action.paths };

    case 'SET_PROMPT_SOURCES':
      return { ...state, promptSources: action.sources };

    case 'SET_JOB_DOCUMENT_STATE':
      return {
        ...state,
        jobs: state.jobs.map((job) => {
          if (job.id !== action.id) return job;
          if (!job.result) {
            return {
              ...job,
              _editorData: action.editorData,
              scoresStale: true,
            };
          }

          return {
            ...job,
            _editorData: action.editorData,
            scoresStale: true,
            result: {
              ...job.result,
              output: action.doc === 'resume'
                ? { ...job.result.output, resume: action.markdown }
                : { ...job.result.output, coverLetter: action.markdown },
            },
          };
        }),
      };

    case 'SET_TAILOR_QUEUE':
      return {
        ...state,
        tailorQueue: action.queue,
        tailorQueueTotal:
          action.queue.length === 0
            ? 0
            : action.total ?? state.tailorQueueTotal,
      };

    case 'SET_TAILOR_RUNNING':
      return {
        ...state,
        tailorRunning: action.id,
        tailorRunningStartedAt:
          action.id == null ? 0 : action.startedAt ?? Date.now(),
      };

    case 'SET_TAILOR_SUMMARY':
      return { ...state, tailorLastSummary: action.summary };

    case 'SET_JOB_SCORES_STALE':
      return {
        ...state,
        jobs: state.jobs.map((job) =>
          job.id === action.id ? { ...job, scoresStale: action.stale } : job
        ),
      };

    case 'SET_REGRADE_QUEUE':
      return {
        ...state,
        regradeQueue: action.queue,
        regradeQueueTotal:
          action.queue.length === 0
            ? 0
            : action.total ?? state.regradeQueueTotal,
      };

    case 'SET_REGRADE_RUNNING':
      return {
        ...state,
        regradeRunning: action.id,
        regradeRunningStartedAt:
          action.id == null ? 0 : action.startedAt ?? Date.now(),
      };

    case 'SET_ACTIVE_DOC':
      return { ...state, activeDoc: action.doc };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.mode };

    case 'SET_REGENERATING_SECTION':
      return { ...state, regeneratingSection: action.section };

    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.panel };

    case 'SET_SCORE_DETAILS':
      return { ...state, activeScoreDetailsId: action.id };

    case 'SET_RUN_FEEDBACK':
      return { ...state, runFeedback: action.feedback };

    case 'LOAD_WORKSPACE':
      return {
        ...state,
        ...action.state,
        tailorProvider:
          action.state.tailorProvider && action.state.tailorProvider !== 'auto'
            ? action.state.tailorProvider
            : state.tailorProvider,
        tailorModel:
          action.state.tailorModel && action.state.tailorModel !== 'auto'
            ? action.state.tailorModel
            : state.tailorModel,
        scoreProvider:
          action.state.scoreProvider && action.state.scoreProvider !== 'auto'
            ? action.state.scoreProvider
            : state.scoreProvider,
        scoreModel:
          action.state.scoreModel && action.state.scoreModel !== 'auto'
            ? action.state.scoreModel
            : state.scoreModel,
      };

    default: {
      const _exhaustive: never = action;
      return state;
    }
  }
}
