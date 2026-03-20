import type { GapAnalysis, Scorecard } from '../types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
}

export interface LocalWorkspaceResponse {
  cwd: string;
  documents: {
    resume: string;
    bio: string;
    baseCoverLetter: string;
    resumeSupplemental: string;
  };
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
}

export interface HuntrJobsResponse {
  jobs: HuntrJob[];
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
}

export interface ScoreBody {
  resume: string;
  jd: string;
  provider?: string;
  model?: string;
}

export interface RegenerateSectionBody {
  section: string;
  sectionId: string;
  fullResume: string;
  jd: string;
  provider?: string;
  model?: string;
}

export interface RegenerateSectionResponse {
  section: string;
}

export interface RenderBody {
  markdown: string;
}

export interface RenderResponse {
  html: string;
}

export interface ExportPdfBody {
  markdown: string;
}

export interface ListWorkspacesResponse {
  workspaces: { id: string; name: string }[];
}

export interface LoadWorkspaceResponse {
  snapshot: unknown;
}

export interface SaveWorkspaceBody {
  name: string;
  snapshot: unknown;
}

export interface SaveWorkspaceResponse {
  id: string;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

/** GET /api/config — Get available providers and models */
export function getConfig(): Promise<ConfigResponse> {
  return request<ConfigResponse>('/api/config');
}

/** GET /api/workspace/local — Load source docs from local filesystem */
export function getLocalWorkspace(): Promise<LocalWorkspaceResponse> {
  return request<LocalWorkspaceResponse>('/api/workspace/local');
}

/** GET /api/huntr/jobs — List all Huntr jobs */
export function getHuntrJobs(): Promise<HuntrJobsResponse> {
  return request<HuntrJobsResponse>('/api/huntr/jobs');
}

/** POST /api/runs/manual — Run manual tailor */
export function runManualTailor(body: ManualTailorBody): Promise<ManualTailorResponse> {
  return post<ManualTailorResponse>('/api/runs/manual', body);
}

/** POST /api/diff — Get HTML diff */
export function getDiff(body: DiffBody): Promise<DiffResponse> {
  return post<DiffResponse>('/api/diff', body);
}

/** POST /api/gap — Run gap analysis */
export function getGapAnalysis(body: GapBody): Promise<GapAnalysis> {
  return post<GapAnalysis>('/api/gap', body);
}

/** POST /api/score — Run scoring */
export function getScore(body: ScoreBody): Promise<unknown> {
  return post<unknown>('/api/score', body);
}

/** POST /api/regenerate-section — Regenerate a resume section */
export function regenerateSection(body: RegenerateSectionBody): Promise<RegenerateSectionResponse> {
  return post<RegenerateSectionResponse>('/api/regenerate-section', body);
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
export function loadWorkspace(id: string): Promise<LoadWorkspaceResponse> {
  return request<LoadWorkspaceResponse>(`/api/workspaces/${encodeURIComponent(id)}`);
}

/** POST /api/workspaces/save — Save workspace snapshot */
export function saveWorkspace(body: SaveWorkspaceBody): Promise<SaveWorkspaceResponse> {
  return post<SaveWorkspaceResponse>('/api/workspaces/save', body);
}

/** DELETE /api/workspaces/:id — Delete a workspace */
export function deleteWorkspace(id: string): Promise<void> {
  return request<void>(`/api/workspaces/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
