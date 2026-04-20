export interface Job {
  id: string;
  company: string;
  title: string;
  jd: string;
  stage: string;
  source?: 'huntr' | 'manual';
  dbJobId?: string | null;
  huntrId?: string | null;
  boardId?: string | null;
  listAddedAt?: string | null;
  listPosition?: number | null;
  status: 'loaded' | 'tailoring' | 'tailored' | 'reviewed' | 'error';
  checked: boolean;
  scoresStale: boolean;
  result: TailorResult | null;
  error: string | null;
  _editorData: EditorData | null;
}

export interface TailorResult {
  output: { resume: string; coverLetter: string };
  scorecard?: Scorecard;
  gapAnalysis?: GapAnalysis;
}

export interface Scorecard {
  overall: number;
  verdict: string;
  confidence: number;
  summary: string;
  categories: ScorecardCategory[];
  documents: ScorecardDocument[];
  notes: string[];
  blockingIssues: string[];
}

export interface ScorecardCategory {
  name: string;
  score: number;
  weight: number;
  summary: string;
  issues: string[];
}

export interface ScorecardDocument {
  id: string;
  label: string;
  overall: number;
  verdict: string;
  confidence: number;
  summary: string;
  categories: ScorecardCategory[];
  notes: string[];
  blockingIssues: string[];
}

export interface GapAnalysis {
  matched: string[];
  missing: string[];
  partial: string[];
  fitRating: string;
}

export interface BulletItem {
  id: string;
  text: string;
}

export interface JobEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  date: string;
  bullets: BulletItem[];
  detailsMode?: 'bullets' | 'text';
  detailsText?: string;
}

export type SectionType = 'text' | 'bullets' | 'jobs';

export interface EditorData {
  kind: 'resume' | 'generic';
  header?: ResumeHeaderFields;
  sections: EditorSection[];
}

export interface EditorSection {
  id: string;
  heading: string;      // section title text only (no ## prefix)
  type: SectionType;
  content: string;      // for type='text'
  items: BulletItem[];  // for type='bullets'
  jobs: JobEntry[];     // for type='jobs'
  accepted: boolean;
  sortOrder?: 'relevance' | 'chronological';
}

export interface ResumeHeaderFields {
  name: string;
  role: string;
  contact: string;
  links: string;
}

export interface SourcePaths {
  resume?: string;
  bio?: string;
  baseCoverLetter?: string;
  resumeSupplemental?: string;
}

export interface PromptSources {
  resumeSystem?: string;
  coverLetterSystem?: string;
  scoringSystem?: string;
}

export type ActivePanel = 'jobs' | 'sources' | 'config' | 'prompts' | 'jd' | null;
export type ActiveDoc = 'resume' | 'cover';
export type ViewMode = 'preview' | 'diff';
export type KnownJobStage =
  | 'wishlist'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'timeout'
  | 'old wishlist'
  | 'manual'
  | 'other';
export type JobListFilter = 'all' | KnownJobStage | (string & {});

export interface WorkspaceState {
  jobs: Job[];
  activeJobId: string | null;
  jobListFilter: JobListFilter;
  isLoadingHuntr: boolean;
  workspaceName: string;
  savedWorkspaces: { id: string; name: string }[];
  activeWorkspaceId: string | null;
  configProviders: { id: string; name: string; models: string[] }[];
  tailorProvider: string;
  tailorModel: string;
  scoreProvider: string;
  scoreModel: string;
  dbPath: string;
  sourceResume: string;
  sourceBio: string;
  sourceCoverLetter: string;
  sourceSupplemental: string;
  sourcePaths: SourcePaths;
  promptSources: PromptSources;
  tailorQueue: string[];
  tailorQueueTotal: number;
  tailorRunning: string | null;
  tailorRunningStartedAt: number;
  tailorLastSummary: { tailored: number; failed: number } | null;
  regradeQueue: string[];
  regradeQueueTotal: number;
  regradeRunning: string | null;
  regradeRunningStartedAt: number;
  activeDoc: ActiveDoc;
  viewMode: ViewMode;
  regeneratingSection: string | null;
  activePanel: ActivePanel;
  activeScoreDetailsId: string | null;
  runFeedback: { text: string; type: 'working' | 'done' | 'error' } | null;
  activityLog: ActivityLogEntry[];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'working' | 'done' | 'error';
}
