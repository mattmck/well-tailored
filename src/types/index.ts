/** Inputs for tailoring both resume and cover letter. */
export interface TailorInput {
  /** Full text of the base resume (markdown). */
  resume: string;
  /** Full text of the personal bio / background blurb. */
  bio: string;
  /** Company name. */
  company: string;
  /** Job title (optional, inferred from JD if omitted). */
  jobTitle?: string;
  /** Full text of the job description. */
  jobDescription: string;
  /** Optional base cover letter to use as a style/tone reference. */
  baseCoverLetter?: string;
  /** Optional supplemental resume detail for AI reference (do not reproduce verbatim). */
  resumeSupplemental?: string;
}

/** Outputs from the tailoring workflow. */
export interface TailorOutput {
  resume: string;
  coverLetter: string;
}

/** Prompt overrides for workbench-driven experimentation. */
export interface PromptOverrides {
  resumeSystem?: string;
  coverLetterSystem?: string;
  scoringSystem?: string;
}

/** Resume and workbench appearance values. */
export interface ResumeTheme {
  background: string;
  body: string;
  accent: string;
  subheading: string;
  jobTitle: string;
  date: string;
  contact: string;
  link: string;
}

/** Supported AI backend kinds. */
export type ProviderKind = 'gemini' | 'azure' | 'openai' | 'anthropic';

/** Provider choice, including auto-select fallback. */
export type ProviderChoice = string | 'auto';

/** Configured provider profile exposed to the workbench. */
export interface ProviderOption {
  id: string;
  kind: ProviderKind;
  label: string;
  defaultModel: string;
  models: string[];
  /** Base URL for OpenAI-compatible or custom endpoints. */
  baseURL?: string;
  /** Azure-specific endpoint URL. */
  endpoint?: string;
  /** Azure API version string. */
  apiVersion?: string;
}

/** Agent/model selection for generation and evaluation. */
export interface AgentSelection {
  tailoringProvider?: ProviderChoice;
  tailoringModel: string;
  scoringProvider?: ProviderChoice;
  scoringModel?: string;
}

/** Deterministic scoring metrics derived without an evaluator model. */
export interface HeuristicScorecard {
  overall: number;
  keywordAlignment: number;
  quantifiedImpact: number;
  structure: number;
  coverLetterSpecificity: number;
  aiObviousnessRisk: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  warnings: string[];
}

/** Optional evaluator-model review. */
export interface EvaluatorScorecard {
  overall: number;
  atsCompatibility: number;
  recruiterClarity: number;
  hrClarity: number;
  aiObviousness: number;
  factualRisk: number;
  notes: string[];
  raw?: string;
}

/** Composite run scoring payload. */
export interface RunScorecard {
  heuristic: HeuristicScorecard;
  evaluator?: EvaluatorScorecard;
}

/** Rendered artifacts returned by a tailoring run. */
export interface TailorArtifacts {
  resumeHtml: string;
  coverLetterHtml: string;
}

/** Full run response shape shared by CLI, API, and future workers. */
export interface TailorRunResult {
  output: TailorOutput;
  artifacts: TailorArtifacts;
  scorecard?: RunScorecard;
}

export interface SavedHuntrJob {
  boardId: string;
  id: string;
  title: string;
  company: string;
  url?: string;
  listName?: string;
  descriptionText?: string;
  /** Where this job came from. */
  source?: 'huntr' | 'manual';
}

/** A single saved result version for a job. */
export interface ResultVersion {
  result: TailorRunResult;
  label: string;
  source: 'ai' | 'manual';
  createdAt: string;
}

/** Per-job outcome from a batch tailoring run. */
export interface BatchTailorResult {
  jobId: string;
  jobEntry: SavedHuntrJob;
  result?: TailorRunResult;
  error?: string;
}

export interface WorkspaceSnapshot {
  company: string;
  jobTitle: string;
  jobDescription: string;
  documents: {
    resume: string;
    bio: string;
    baseCoverLetter: string;
    resumeSupplemental: string;
  };
  prompts: {
    resumeSystem: string;
    coverLetterSystem: string;
    scoringSystem: string;
  };
  theme: ResumeTheme;
  agents: AgentSelection;
  selectedHuntrJob?: SavedHuntrJob | null;
  result?: TailorRunResult | null;
  /** Cached Huntr job list for offline use. */
  huntrJobs?: SavedHuntrJob[];
  /** IDs of jobs selected for batch tailoring. */
  selectedJobIds?: string[];
  /** Results from a multi-job batch run. */
  batchResults?: BatchTailorResult[];
  /** Per-job result version history (jobId → versions). */
  jobResults?: Record<string, ResultVersion[]>;
  /** Manually added jobs. */
  manualJobs?: SavedHuntrJob[];
  /** Persisted UI layout state. */
  uiState?: { openPanels: string[] };
}

export interface SavedWorkspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  snapshot: WorkspaceSnapshot;
}

export interface SavedWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

/** Config loaded from env / options. */
export interface Config {
  model: string;
  tailoringProvider: ProviderChoice;
  scoringProvider: ProviderChoice;
  tailoringModel: string;
  scoringModel: string;
  tailoringModels: string[];
  scoringModels: string[];
  providers: ProviderOption[];
}
