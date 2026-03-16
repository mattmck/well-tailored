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

/** Submission verdict for a scored document. */
export type ScoreVerdict =
  | 'strong_submit'
  | 'submit_after_minor_edits'
  | 'needs_revision'
  | 'do_not_submit';

/** Normalized per-document evaluator scorecard. */
export interface EvaluatorDocumentScorecard {
  document: string;
  overall: number;
  atsCompatibility?: number;
  keywordCoverage?: number;
  recruiterClarity?: number;
  hrClarity?: number;
  hiringMgrClarity?: number;
  tailoringAlignment?: number;
  completionReadiness?: number;
  evidenceStrength?: number;
  aiObviousness?: number;
  factualRisk?: number;
  confidence?: number;
  verdict?: ScoreVerdict | string;
  blockingIssues: string[];
  notes: string[];
}

/** Optional evaluator-model review. */
export interface EvaluatorScorecard {
  /** Primary/legacy summary fields mirrored from the resume or first document. */
  overall?: number;
  atsCompatibility?: number;
  keywordCoverage?: number;
  recruiterClarity?: number;
  hrClarity?: number;
  hiringMgrClarity?: number;
  tailoringAlignment?: number;
  completionReadiness?: number;
  evidenceStrength?: number;
  aiObviousness?: number;
  factualRisk?: number;
  confidence?: number;
  verdict?: ScoreVerdict | string;
  blockingIssues?: string[];
  notes: string[];
  documents: EvaluatorDocumentScorecard[];
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
  diff?: DiffResult;
  gapAnalysis?: GapAnalysis;
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
  uiState?: {
    openPanels: string[];
    jobListFilter?: string;
  };
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

// ── Diff ─────────────────────────────────────────────────────────────────

/** A contiguous block of diff lines sharing the same change type. */
export interface DiffHunk {
  type: 'added' | 'removed' | 'unchanged';
  lines: string[];
}

/** Result of diffing two documents. */
export interface DiffResult {
  hunks: DiffHunk[];
  stats: { added: number; removed: number; unchanged: number };
}

// ── Gap Analysis ─────────────────────────────────────────────────────────

/** Keyword categorization. */
export type KeywordCategory =
  | 'language'
  | 'framework'
  | 'tool'
  | 'platform'
  | 'soft-skill'
  | 'certification'
  | 'methodology'
  | 'other';

/** A categorized keyword or phrase extracted from a JD. */
export interface CategorizedKeyword {
  term: string;
  category: KeywordCategory;
}

/** A partial match between a JD term and a resume term. */
export interface PartialMatch {
  jdTerm: string;
  resumeTerm: string;
  relationship: string;
}

/** Years-of-experience requirement extracted from a JD. */
export interface ExperienceRequirement {
  skill: string;
  years: number;
  isRequired: boolean;
}

/** Heuristic gap analysis result (no AI needed). */
export interface GapAnalysis {
  matchedKeywords: CategorizedKeyword[];
  missingKeywords: CategorizedKeyword[];
  partialMatches: PartialMatch[];
  experienceRequirements: ExperienceRequirement[];
  overallFit: 'strong' | 'moderate' | 'weak';
}

/** AI-enriched gap analysis (extends heuristic). */
export interface EnrichedGapAnalysis extends GapAnalysis {
  narrative: string;
  tailoringHints: string[];
}

// ── Resume Sections ──────────────────────────────────────────────────────

/** Type of resume section detected from heading content. */
export type ResumeSectionType =
  | 'header'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'other';

/** A parsed section of a markdown resume. */
export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  heading: string;
  headingLevel: number;
  content: string;
  bullets: string[];
}
