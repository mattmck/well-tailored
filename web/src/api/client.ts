import type { GapAnalysis, Scorecard, SourcePaths } from '../types.js';
import { normalizeGapAnalysis, normalizeScorecard } from '../lib/result-normalizers.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface ConfigResponse {
  defaultModel: string;
  provider: string;
  defaults: {
    tailoringProvider: string;
    tailoringModel: string;
    scoringProvider: string;
    scoringModel: string;
  };
  options: {
    providers: { id: string; kind: string; label: string; defaultModel: string; models: string[] }[];
    tailoringModels: string[];
    scoringModels: string[];
  };
  persistence?: {
    dbPath?: string;
  };
}

export interface LocalWorkspaceResponse {
  cwd: string;
  documents: {
    resume: string;
    bio: string;
    baseCoverLetter: string;
    resumeSupplemental: string;
  };
  paths?: SourcePaths;
  error?: string;
  prompts: Record<string, string>;
  theme?: Record<string, string>;
}

interface RawLocalWorkspaceResponse {
  cwd: string;
  documents: {
    resume: string;
    bio: string;
    baseCoverLetter: string;
    resumeSupplemental: string;
  };
  paths?: Record<string, unknown>;
  error?: string;
  prompts: Record<string, string>;
  theme?: Record<string, string>;
}

export interface HuntrJob {
  id: string;
  company: string;
  title: string;
  descriptionText: string;
  listName: string;
  url: string;
  boardId: string;
  listAddedAt?: string;
  listPosition?: number | null;
}

export interface HuntrJobsResponse {
  jobs: HuntrJob[];
}

export interface HuntrJobStage {
  id: string;
  boardId: string;
  listName: string;
}

export interface HuntrJobStagesResponse {
  jobs: HuntrJobStage[];
}

export interface ManualTailorBody {
  resume: string;
  bio: string;
  baseCoverLetter: string;
  resumeSupplemental: string;
  company: string;
  title: string;
  jd: string;
  provider?: string;
  model?: string;
  scoreProvider?: string;
  scoreModel?: string;
  prompts?: Record<string, string>;
}

export interface ManualTailorResponse {
  output: { resume: string; coverLetter: string };
  scorecard?: Scorecard;
  gapAnalysis?: GapAnalysis;
}

interface ServerRunScorecard {
  heuristic?: unknown;
  evaluator?: unknown;
}

interface ServerManualTailorResponse {
  output: { resume: string; coverLetter: string };
  scorecard?: ServerRunScorecard;
  gapAnalysis?: unknown;
}

interface ServerDiffResponse {
  hunks: Array<{
    type: 'added' | 'removed' | 'unchanged';
    lines: string[];
  }>;
}

function renderDiffHtml(diff: ServerDiffResponse): string {
  const lines = diff.hunks.flatMap((hunk) =>
    hunk.lines.map((line) => {
      const prefix = hunk.type === 'added' ? '+' : hunk.type === 'removed' ? '-' : ' ';
      return `<div class="diff-line diff-line--${hunk.type}"><span class="diff-line__prefix">${prefix}</span><span class="diff-line__content">${escapeHtml(line)}</span></div>`;
    }),
  );

  return `<div class="diff-view">${lines.join('')}</div>`;
}

export interface DiffBody {
  original: string;
  modified: string;
}

export interface DiffResponse {
  html: string;
}

export interface GapBody {
  resume: string;
  jd: string;
  useAI?: boolean;
}

export interface ScoreBody {
  resume: string;
  jd: string;
  coverLetter?: string;
  company?: string;
  jobTitle?: string;
  provider?: string;
  model?: string;
}

export interface RegenerateSectionBody {
  sectionId: string;
  sectionHeading?: string;
  fullResume: string;
  jd: string;
  bio?: string;
  jobTitle?: string;
  provider?: string;
  model?: string;
}

export interface RegenerateSectionResponse {
  section: {
    heading: string;
    headingLevel: number;
    content: string;
  };
  markdown: string;
}

export interface RenderBody {
  markdown: string;
  kind: 'resume' | 'coverLetter';
  title?: string;
  theme?: Record<string, string>;
}

export interface RenderResponse {
  html: string;
}

export interface ExportPdfBody {
  markdown: string;
  kind: 'resume' | 'coverLetter';
  title?: string;
  theme?: Record<string, string>;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListWorkspacesResponse {
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceRecord extends WorkspaceSummary {
  snapshot: unknown;
}

export interface SaveWorkspaceBody {
  id?: string;
  name: string;
  snapshot: unknown;
}

export interface DeleteWorkspaceResponse {
  ok: boolean;
  id: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeSourcePaths(value: unknown): SourcePaths {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const paths = value as Record<string, unknown>;
  return {
    resume: asString(paths.resume) ?? asString(paths.resumePath),
    bio: asString(paths.bio) ?? asString(paths.bioPath),
    baseCoverLetter: asString(paths.baseCoverLetter) ?? asString(paths.coverLetterPath),
    resumeSupplemental: asString(paths.resumeSupplemental) ?? asString(paths.supplementalPath),
  };
}

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

/** GET /api/config — Get available providers and models */
export function getConfig(): Promise<ConfigResponse> {
  return request<ConfigResponse>('/api/config');
}

/** GET /api/workspace/local — Load source docs from local filesystem */
export async function getLocalWorkspace(): Promise<LocalWorkspaceResponse> {
  const response = await request<RawLocalWorkspaceResponse>('/api/workspace/local');
  return {
    ...response,
    paths: normalizeSourcePaths(response.paths),
  };
}

/** GET /api/huntr/jobs — List all Huntr jobs */
export function getHuntrJobs(): Promise<HuntrJobsResponse> {
  return request<HuntrJobsResponse>('/api/huntr/jobs');
}

/** GET /api/huntr/job-stages — List Huntr job IDs and stage names */
export function getHuntrJobStages(): Promise<HuntrJobStagesResponse> {
  return request<HuntrJobStagesResponse>('/api/huntr/job-stages');
}

/** POST /api/runs/manual — Run manual tailor */
export async function runManualTailor(body: ManualTailorBody): Promise<ManualTailorResponse> {
  const response = await post<ServerManualTailorResponse>('/api/runs/manual', {
    input: {
      resume: body.resume,
      bio: body.bio,
      company: body.company,
      jobTitle: body.title,
      jobDescription: body.jd,
      baseCoverLetter: body.baseCoverLetter,
      resumeSupplemental: body.resumeSupplemental,
    },
    agents: {
      tailoringProvider: body.provider,
      tailoringModel: body.model,
      scoringProvider: body.scoreProvider,
      scoringModel: body.scoreModel,
    },
    promptOverrides: body.prompts,
    includeScoring: true,
  });

  return {
    output: response.output,
    scorecard: normalizeScorecard(response.scorecard),
    gapAnalysis: normalizeGapAnalysis(response.gapAnalysis),
  };
}

/** POST /api/diff — Get HTML diff */
export async function getDiff(body: DiffBody): Promise<DiffResponse> {
  const response = await post<ServerDiffResponse>('/api/diff', {
    before: body.original,
    after: body.modified,
  });

  return {
    html: renderDiffHtml(response),
  };
}

/** POST /api/gap — Run gap analysis */
export async function getGapAnalysis(body: GapBody): Promise<GapAnalysis> {
  const response = await post<unknown>('/api/gap', {
    resume: body.resume,
    jobDescription: body.jd,
    ...(body.useAI !== undefined && { useAI: body.useAI }),
  });

  return normalizeGapAnalysis(response) ?? {
    matched: [],
    missing: [],
    partial: [],
    fitRating: 'weak',
  };
}

/** POST /api/score — Run scoring */
export async function getScore(body: ScoreBody): Promise<Scorecard> {
  const response = await post<ServerRunScorecard>('/api/score', {
    resume: body.resume,
    coverLetter: body.coverLetter ?? '',
    jobDescription: body.jd,
    company: body.company,
    jobTitle: body.jobTitle,
    provider: body.provider,
    model: body.model,
  });

  return normalizeScorecard(response) ?? {
    overall: 0,
    verdict: 'needs_revision',
    confidence: 0,
    summary: 'Scoring response did not match the expected format.',
    categories: [],
    documents: [],
    notes: [],
    blockingIssues: [],
  };
}

/** POST /api/regenerate-section — Regenerate a resume section */
export function regenerateSection(body: RegenerateSectionBody): Promise<RegenerateSectionResponse> {
  return post<RegenerateSectionResponse>('/api/regenerate-section', {
    resume: body.fullResume,
    bio: body.bio ?? '',
    jobDescription: body.jd,
    jobTitle: body.jobTitle,
    sectionId: body.sectionId,
    sectionHeading: body.sectionHeading,
    provider: body.provider,
    model: body.model,
  });
}

/** POST /api/render — Render markdown to HTML */
export function renderHtml(body: RenderBody): Promise<RenderResponse> {
  return post<RenderResponse>('/api/render', body);
}

/** POST /api/export/pdf — Export PDF (returns blob) */
export async function exportPdf(body: ExportPdfBody): Promise<Blob> {
  const res = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.blob();
}

/** GET /api/workspaces — List saved workspaces */
export function listWorkspaces(): Promise<ListWorkspacesResponse> {
  return request<ListWorkspacesResponse>('/api/workspaces');
}

/** GET /api/workspaces/:id — Load a saved workspace */
export function loadWorkspace(id: string): Promise<WorkspaceRecord> {
  return request<WorkspaceRecord>(`/api/workspaces/${encodeURIComponent(id)}`);
}

/** POST /api/workspaces/save — Save workspace snapshot */
export function saveWorkspace(body: SaveWorkspaceBody): Promise<WorkspaceRecord> {
  return post<WorkspaceRecord>('/api/workspaces/save', body);
}

/** DELETE /api/workspaces/:id — Delete a workspace */
export function deleteWorkspace(id: string): Promise<DeleteWorkspaceResponse> {
  return request<DeleteWorkspaceResponse>(`/api/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// New DB-backed workspace / job / document / task endpoints
// ---------------------------------------------------------------------------

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  sourceResume: string | null;
  sourceBio: string | null;
  sourceCoverLetter: string | null;
  sourceSupplemental: string | null;
  agentConfigJson: string | null;
  themeJson: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: JobRecord[];
}

export interface WorkspaceUpsertInput {
  name?: string;
  sourceResume?: string;
  sourceBio?: string;
  sourceCoverLetter?: string;
  sourceSupplemental?: string;
  promptResumeSystem?: string;
  promptCoverLetterSystem?: string;
  promptScoringSystem?: string;
  agentConfigJson?: string;
  themeJson?: string;
}

export interface JobRecord {
  id: string;
  workspaceId: string;
  company: string;
  title: string | null;
  jd: string | null;
  stage: string;
  source: string;
  huntrId: string | null;
  listAddedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  jobId: string;
  docType: 'resume' | 'cover';
  markdown: string;
  editorDataJson: string | null;
  version: number;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  workspaceId: string;
  jobId: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputJson: string;
  resultJson: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listWorkspacesV2(): Promise<{ workspaces: WorkspaceSummary[] }> {
  return request<{ workspaces: WorkspaceSummary[] }>('/api/workspaces');
}

export function getWorkspace(id: string): Promise<WorkspaceDetail> {
  return request<WorkspaceDetail>(`/api/workspaces/${encodeURIComponent(id)}`);
}

export function createWorkspace(input: WorkspaceUpsertInput & { name: string }): Promise<WorkspaceDetail> {
  return request<WorkspaceDetail>('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateWorkspace(id: string, patch: WorkspaceUpsertInput): Promise<WorkspaceDetail> {
  return request<WorkspaceDetail>(`/api/workspaces/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function createJob(workspaceId: string, input: { company: string; title?: string; jd?: string; stage?: string; source?: string; huntrId?: string; listAddedAt?: string | null }): Promise<JobRecord> {
  return request<JobRecord>(`/api/workspaces/${encodeURIComponent(workspaceId)}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateJob(workspaceId: string, jobId: string, patch: Partial<JobRecord>): Promise<JobRecord> {
  return request<JobRecord>(`/api/workspaces/${encodeURIComponent(workspaceId)}/jobs/${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function getDocument(jobId: string, docType: 'resume' | 'cover'): Promise<DocumentRecord> {
  return request<DocumentRecord>(`/api/jobs/${encodeURIComponent(jobId)}/documents/${docType}`);
}

export function saveDocument(jobId: string, docType: 'resume' | 'cover', markdown: string, editorDataJson?: string): Promise<DocumentRecord> {
  return request<DocumentRecord>(`/api/jobs/${encodeURIComponent(jobId)}/documents/${docType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown, editorDataJson }),
  });
}

export function listTasks(workspaceId: string): Promise<{ tasks: TaskRecord[] }> {
  return request<{ tasks: TaskRecord[] }>(`/api/tasks?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export function enqueueTask(input: {
  workspaceId: string;
  jobId: string;
  type: string;
  input: unknown;
  agents?: unknown;
  promptOverrides?: Record<string, string>;
  includeScoring?: boolean;
}): Promise<TaskRecord> {
  return request<TaskRecord>('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getTask(id: string): Promise<TaskRecord> {
  return request<TaskRecord>(`/api/tasks/${encodeURIComponent(id)}`);
}
