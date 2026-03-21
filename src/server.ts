import { createServer, IncomingMessage, ServerResponse } from 'http';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, extname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { homedir, tmpdir } from 'os';
import { loadConfig } from './config.js';
import { complete as defaultComplete, describeProvider } from './lib/ai.js';
import { diffMarkdown } from './lib/diff.js';
import { normalizeProviderChoice } from './lib/providers.js';
import {
  coverLetterSystemPrompt,
  resumeSystemPrompt,
  scoringSystemPrompt,
} from './lib/prompts.js';
import { DEFAULT_RESUME_THEME, renderCoverLetterHtml, renderPdf, renderResumeHtml, renderResumePdfFit } from './lib/render.js';
import {
  buildTailorInputFromHuntrJob,
  getJob,
  listAllJobStages,
  listAllJobs,
  listWishlistJobs,
  requireHuntrClient,
} from './services/huntr.js';
import { runTailorWorkflow } from './services/runs.js';
import { analyzeGap, analyzeGapWithAI } from './services/gap.js';
import { regenerateResumeSection } from './services/review.js';
import { scoreTailoredOutput } from './services/scoring.js';
import { deleteSavedWorkspace, listSavedWorkspaces, loadSavedWorkspace, saveWorkspaceSnapshot } from './services/workspace-store.js';
import { resolveWorkspaceDocuments } from './services/workspace.js';
import {
  AgentSelection,
  PromptOverrides,
  ResumeTheme,
  TailorInput,
  WorkspaceSnapshot,
} from './types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 4312;

interface ManualRunBody {
  input: TailorInput;
  agents?: AgentSelection;
  promptOverrides?: PromptOverrides;
  theme?: Partial<ResumeTheme>;
  includeScoring?: boolean;
  verbose?: boolean;
}

interface HuntrRunBody {
  jobId: string;
  boardId?: string;
  agents?: AgentSelection;
  promptOverrides?: PromptOverrides;
  theme?: Partial<ResumeTheme>;
  includeScoring?: boolean;
  verbose?: boolean;
  workspace?: {
    resume?: string;
    bio?: string;
    baseCoverLetter?: string;
    resumeSupplemental?: string;
  };
}

interface ExportPdfBody {
  kind: 'resume' | 'coverLetter' | 'cover-letter';
  title?: string;
  markdown?: string;
  html?: string;
  theme?: Partial<ResumeTheme>;
}

interface SaveWorkspaceBody {
  id?: string;
  name?: string;
  snapshot: WorkspaceSnapshot;
}

interface DiffBody {
  before: string;
  after: string;
}

interface GapBody {
  resume: string;
  sourceResume?: string;
  sourceSupplemental?: string;
  bio?: string;
  jobDescription: string;
  jobTitle?: string;
  useAI?: boolean;
  model?: string;
  provider?: string;
}

interface ScoreBody {
  resume: string;
  sourceResume?: string;
  sourceSupplemental?: string;
  coverLetter: string;
  jobDescription: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  model?: string;
  provider?: string;
}

interface RegenerateSectionBody {
  resume: string;
  bio: string;
  jobDescription: string;
  jobTitle?: string;
  sectionId: string;
  model?: string;
  verbose?: boolean;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

function sendFile(res: ServerResponse, filePath: string): void {
  const ext = extname(filePath).toLowerCase();
  const contentType =
    ext === '.svg'
      ? 'image/svg+xml; charset=utf-8'
      : ext === '.png'
        ? 'image/png'
        : ext === '.ico'
          ? 'image/x-icon'
          : ext === '.html'
            ? 'text/html; charset=utf-8'
            : 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(readFileSync(filePath));
}

function sanitizeFilename(raw: string): string {
  // Strip path separators, CR/LF, quotes; fallback to safe default
  const safe = raw.replace(/[\r\n"/\\]/g, '').trim();
  return safe || 'download.pdf';
}

/**
 * Normalize kind variants at entry point.
 * Accepts both 'cover-letter' and 'coverLetter', normalizes to 'coverLetter' internally.
 * This ensures all downstream code only uses the canonical 'coverLetter' variant.
 */
export function normalizeExportKind(kind: unknown): 'resume' | 'coverLetter' {
  if (kind === 'cover-letter') {
    return 'coverLetter';
  }
  if (kind !== 'resume' && kind !== 'coverLetter') {
    throw new Error(`Unknown export kind: ${kind}`);
  }
  return kind;
}

function sendPdf(res: ServerResponse, filename: string, pdf: Buffer): void {
  const safe = sanitizeFilename(filename);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${safe}"`,
    'Cache-Control': 'no-store',
  });
  res.end(pdf);
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, { error: 'Not found' });
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return (raw ? JSON.parse(raw) : {}) as T;
}

async function buildPdfBuffer(body: ExportPdfBody): Promise<{ filename: string; pdf: Buffer }> {
  // Validate kind before using it in filesystem paths. Should only be 'resume' or 'coverLetter'
  // after normalization at entry points (lines 677, 687). This is a defensive check.
  if (!['resume', 'coverLetter'].includes(body.kind)) {
    throw new Error(`Unknown export kind: ${body.kind}`);
  }

  const dir = mkdtempSync(join(tmpdir(), 'well-tailored-export-'));
  try {
    const htmlPath = join(dir, `${body.kind}.html`);
    const pdfPath = join(dir, `${body.kind}.pdf`);

    if (body.kind === 'resume') {
      if (!body.markdown) {
        throw new Error('Resume PDF export requires markdown.');
      }
      await renderResumePdfFit(
        body.markdown,
        body.title ?? 'Resume',
        htmlPath,
        pdfPath,
        body.theme,
      );
      return {
        filename: 'resume.pdf',
        pdf: readFileSync(pdfPath),
      };
    }

    // Only 'coverLetter' variant (normalized at entry point)
    if (body.kind === 'coverLetter') {
      if (!body.markdown && !body.html) {
        throw new Error('Cover letter PDF export requires markdown or HTML.');
      }
      const html = body.html ?? renderCoverLetterHtml(body.markdown!, body.title ?? 'Cover Letter', body.theme);
      writeFileSync(htmlPath, html, 'utf8');
      await renderPdf(htmlPath, pdfPath);
      return {
        filename: 'cover-letter.pdf',
        pdf: readFileSync(pdfPath),
      };
    }

    // This should never happen since normalization validates the kind early
    throw new Error(`Unknown export kind: ${body.kind}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function loadWorkbenchHtml(): string {
  // Try React build first
  const reactBuild = join(__dirname, '..', 'web', 'dist', 'index.html');
  if (existsSync(reactBuild)) {
    return readFileSync(reactBuild, 'utf8');
  }
  // Fall back to legacy
  const packaged = join(__dirname, 'workbench', 'index-v2.html');
  if (existsSync(packaged)) return readFileSync(packaged, 'utf8');
  return readFileSync(join(process.cwd(), 'src', 'workbench', 'index-v2.html'), 'utf8');
}

function readWorkbenchHtml(): string {
  return loadWorkbenchHtml();
}

export function resolveWorkbenchAssetPath(relativePath: string): string | null {
  const assetRoot = join(__dirname, 'workbench', 'assets');
  const candidate = resolve(assetRoot, relativePath.replace(/^\/+/, ''));
  if (candidate !== assetRoot && !candidate.startsWith(assetRoot + sep)) {
    return null;
  }
  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    return null;
  }
  return candidate;
}

function readWorkbenchV2Html(): string {
  return loadWorkbenchHtml();
}

function readResumeEditorHtml(): string {
  const packaged = join(__dirname, 'workbench', 'resume-editor.html');
  if (existsSync(packaged)) {
    return readFileSync(packaged, 'utf8');
  }
  return readFileSync(join(process.cwd(), 'docs', 'resume-editor.html'), 'utf8');
}

function resolveAgents(agents?: AgentSelection): AgentSelection {
  const config = loadConfig();
  const model = agents?.tailoringModel?.trim() || config.tailoringModel;
  const tailoringProvider = normalizeProviderChoice(agents?.tailoringProvider) ?? config.tailoringProvider;
  return {
    tailoringProvider,
    tailoringModel: model,
    scoringProvider: normalizeProviderChoice(agents?.scoringProvider) ?? config.scoringProvider ?? tailoringProvider,
    scoringModel: agents?.scoringModel?.trim() || config.scoringModel || model,
  };
}

function resolveWorkspacePayload(body?: HuntrRunBody['workspace']) {
  if (body?.resume && body?.bio) {
    return {
      resume: body.resume,
      bio: body.bio,
      baseCoverLetter: body.baseCoverLetter,
      resumeSupplemental: body.resumeSupplemental,
    };
  }

  const docs = resolveWorkspaceDocuments();
  return {
    resume: docs.resume,
    bio: docs.bio,
    baseCoverLetter: docs.baseCoverLetter,
    resumeSupplemental: docs.resumeSupplemental,
  };
}

async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { status: 'ok', now: new Date().toISOString() });
    return;
  }

  if (method === 'GET' && url.pathname === '/ready') {
    sendJson(res, 200, { status: 'ready' });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/config') {
    const config = loadConfig();
    sendJson(res, 200, {
      defaultModel: config.model,
      provider: describeProvider(config.model, config.tailoringProvider),
      defaults: {
        tailoringProvider: config.tailoringProvider,
        tailoringModel: config.tailoringModel,
        scoringProvider: config.scoringProvider,
        scoringModel: config.scoringModel,
      },
      options: {
        providers: config.providers,
        tailoringModels: config.tailoringModels,
        scoringModels: config.scoringModels,
      },
    });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/workspace/local') {
    try {
      const docs = resolveWorkspaceDocuments();
      sendJson(res, 200, {
        cwd: process.cwd(),
        documents: {
          resume: docs.resume,
          bio: docs.bio,
          baseCoverLetter: docs.baseCoverLetter ?? '',
          resumeSupplemental: docs.resumeSupplemental ?? '',
        },
        paths: docs.paths,
        prompts: {
          resumeSystem: resumeSystemPrompt(),
          coverLetterSystem: coverLetterSystemPrompt(),
          scoringSystem: scoringSystemPrompt(),
        },
        theme: DEFAULT_RESUME_THEME,
      });
    } catch (error) {
      sendJson(res, 200, {
        cwd: process.cwd(),
        documents: {
          resume: '',
          bio: '',
          baseCoverLetter: '',
          resumeSupplemental: '',
        },
        error: (error as Error).message,
        prompts: {
          resumeSystem: resumeSystemPrompt(),
          coverLetterSystem: coverLetterSystemPrompt(),
          scoringSystem: scoringSystemPrompt(),
        },
        theme: DEFAULT_RESUME_THEME,
      });
    }
    return;
  }

  if (method === 'GET' && url.pathname === '/api/workspaces') {
    sendJson(res, 200, { workspaces: listSavedWorkspaces() });
    return;
  }

  if (method === 'GET' && url.pathname.startsWith('/api/workspaces/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/workspaces/'.length));
    try {
      const workspace = loadSavedWorkspace(id);
      sendJson(res, 200, workspace);
    } catch (error) {
      const err = error as Error;
      const message = err.message || 'Workspace error';
      const lowerMessage = message.toLowerCase();

      // Heuristic mapping of expected errors to HTTP status codes
      if (lowerMessage.includes('not found') || lowerMessage.includes('no such workspace')) {
        sendJson(res, 404, { error: message });
      } else if (
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('bad request') ||
        lowerMessage.includes('malformed') ||
        err.name === 'SyntaxError' ||
        err.name === 'TypeError'
      ) {
        sendJson(res, 400, { error: message });
      } else {
        // Unexpected error: avoid leaking internals
        console.error('Error loading workspace:', err);
        sendJson(res, 500, { error: 'Internal server error' });
      }
    }
    return;
  }

  if (method === 'POST' && url.pathname === '/api/workspaces/save') {
    const body = await readJsonBody<SaveWorkspaceBody>(req);
    if (!body.snapshot) {
      throw new Error('Workspace save requires a snapshot payload.');
    }
    sendJson(res, 200, saveWorkspaceSnapshot(body));
    return;
  }

  if (method === 'DELETE' && url.pathname.startsWith('/api/workspaces/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/workspaces/'.length));
    try {
      deleteSavedWorkspace(id);
      sendJson(res, 200, { ok: true, id });
    } catch (error) {
      const message = (error as Error).message || 'Workspace error';
      const lowerMessage = message.toLowerCase();
      sendJson(res, lowerMessage.includes('not found') ? 404 : 400, { error: message });
    }
    return;
  }

  if (method === 'GET' && url.pathname === '/api/huntr/jobs') {
    const client = await requireHuntrClient();
    const stageParam = url.searchParams.get('stage');
    const jobs = await listAllJobs(client, url.searchParams.get('board') ?? undefined);
    const stageSet = stageParam
      ? new Set(stageParam.split(',').map((s) => s.trim().toLowerCase()))
      : null;
    const filtered = stageSet
      ? jobs.filter((j) => stageSet.has((j.listName ?? '').toLowerCase()))
      : jobs;
    sendJson(res, 200, {
      jobs: filtered.map((entry) => ({
        boardId: entry.boardId,
        id: entry.job.id,
        title: entry.job.title,
        company: entry.company,
        url: entry.job.url ?? '',
        listName: entry.listName ?? '',
        descriptionText: entry.descriptionText,
      })),
    });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/huntr/job-stages') {
    const client = await requireHuntrClient();
    const jobs = await listAllJobStages(client, url.searchParams.get('board') ?? undefined);
    sendJson(res, 200, {
      jobs: jobs.map((entry) => ({
        boardId: entry.boardId,
        id: entry.id,
        listName: entry.listName ?? '',
      })),
    });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/files/check') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      sendJson(res, 400, { error: 'Missing path parameter.' });
      return;
    }
    const requestedPath = resolve(filePath);

    // Reject direct symlink targets to avoid following symlinks out of allowed directories.
    let requestedLstat;
    try {
      requestedLstat = lstatSync(requestedPath);
    } catch {
      // Path does not exist.
      sendJson(res, 200, { exists: false });
      return;
    }
    if (requestedLstat.isSymbolicLink()) {
      sendJson(res, 403, { error: 'Path not allowed.' });
      return;
    }

    // Resolve the real path (resolves any intermediate symlinks) before applying allowlist checks.
    let realPath: string;
    try {
      realPath = realpathSync(requestedPath);
    } catch {
      // If we can't resolve the real path, treat it as non-existent.
      sendJson(res, 200, { exists: false });
      return;
    }

    const cwd = process.cwd();
    const home = join(homedir(), '.well-tailored');

    // Normalize allowed roots, skipping any that do not yet exist on disk.
    const allowedRoots: string[] = [];
    try {
      allowedRoots.push(realpathSync(cwd));
    } catch {
      // ignore
    }
    try {
      allowedRoots.push(realpathSync(home));
    } catch {
      // ignore
    }

    const isWithinAllowedRoot = allowedRoots.some((root) => {
      return realPath === root || realPath.startsWith(root + sep);
    });

    if (!isWithinAllowedRoot) {
      sendJson(res, 403, { error: 'Path not allowed.' });
      return;
    }

    const stat = statSync(realPath);
    sendJson(res, 200, { exists: true, mtime: stat.mtime.toISOString(), size: stat.size });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/files/read') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      sendJson(res, 400, { error: 'Missing path parameter.' });
      return;
    }
    const requestedPath = resolve(filePath);

    // Reject direct symlink targets to avoid following symlinks out of allowed directories.
    let requestedLstat;
    try {
      requestedLstat = lstatSync(requestedPath);
    } catch {
      sendJson(res, 404, { error: 'File not found.' });
      return;
    }
    if (requestedLstat.isSymbolicLink()) {
      sendJson(res, 403, { error: 'Path not allowed.' });
      return;
    }

    // Resolve real path for allowlist checks and I/O.
    let realPath: string;
    try {
      realPath = realpathSync(requestedPath);
    } catch {
      sendJson(res, 404, { error: 'File not found.' });
      return;
    }

    const cwd = process.cwd();
    const home = join(homedir(), '.well-tailored');

    const allowedRoots: string[] = [];
    try {
      allowedRoots.push(realpathSync(cwd));
    } catch {
      // ignore
    }
    try {
      allowedRoots.push(realpathSync(home));
    } catch {
      // ignore
    }

    const isWithinAllowedRoot = allowedRoots.some((root) => {
      return realPath === root || realPath.startsWith(root + sep);
    });

    if (!isWithinAllowedRoot) {
      sendJson(res, 403, { error: 'Path not allowed.' });
      return;
    }

    const content = readFileSync(realPath, 'utf8');
    const stat = statSync(realPath);
    sendJson(res, 200, { content, mtime: stat.mtime.toISOString() });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/huntr/wishlist') {
    const client = await requireHuntrClient();
    const jobs = await listWishlistJobs(client, url.searchParams.get('board') ?? undefined);
    sendJson(res, 200, {
      jobs: jobs.map((entry) => ({
        boardId: entry.boardId,
        id: entry.job.id,
        title: entry.job.title,
        company: entry.company,
        url: entry.job.url ?? '',
        listName: entry.listName ?? 'Wishlist',
        descriptionText: entry.descriptionText,
      })),
    });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/runs/manual') {
    const body = await readJsonBody<ManualRunBody>(req);
    const result = await runTailorWorkflow({
      input: body.input,
      agents: resolveAgents(body.agents),
      promptOverrides: body.promptOverrides,
      theme: body.theme,
      includeScoring: body.includeScoring ?? true,
      verbose: body.verbose ?? false,
    });
    sendJson(res, 200, result);
    return;
  }

  if (method === 'POST' && url.pathname === '/api/runs/huntr') {
    const body = await readJsonBody<HuntrRunBody>(req);
    const client = await requireHuntrClient();
    const { job } = await getJob(client, body.jobId, body.boardId);
    const docs = resolveWorkspacePayload(body.workspace);
    const input = buildTailorInputFromHuntrJob(job, docs);
    const result = await runTailorWorkflow({
      input,
      agents: resolveAgents(body.agents),
      promptOverrides: body.promptOverrides,
      theme: body.theme,
      includeScoring: body.includeScoring ?? true,
      verbose: body.verbose ?? false,
    });
    sendJson(res, 200, result);
    return;
  }

  if (method === 'POST' && url.pathname === '/api/diff') {
    const body = await readJsonBody<DiffBody>(req);
    sendJson(res, 200, diffMarkdown(body.before ?? '', body.after ?? ''));
    return;
  }

  if (method === 'POST' && url.pathname === '/api/gap') {
    const body = await readJsonBody<GapBody>(req);
    if (body.useAI) {
      const config = loadConfig();
      const preferredProvider = normalizeProviderChoice(body.provider) ?? config.scoringProvider ?? config.tailoringProvider;
      const result = await analyzeGapWithAI(
        body.sourceResume ?? body.resume ?? '',
        body.bio ?? '',
        body.jobDescription ?? '',
        body.jobTitle,
        body.model ?? config.tailoringModel,
        (model, systemPrompt, userPrompt, verbose) =>
          defaultComplete(model, systemPrompt, userPrompt, verbose, { provider: preferredProvider }),
      );
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 200, analyzeGap(body.sourceResume ?? body.resume ?? '', body.jobDescription ?? '', body.jobTitle));
    return;
  }

  if (method === 'POST' && url.pathname === '/api/score') {
    const body = await readJsonBody<ScoreBody>(req);
    const config = loadConfig();
    const preferredProvider = normalizeProviderChoice(body.provider) ?? config.scoringProvider ?? config.tailoringProvider;
    const scorecard = await scoreTailoredOutput({
      input: {
        resume: body.sourceResume ?? body.resume,
        bio: body.bio ?? '',
        jobDescription: body.jobDescription,
        company: body.company ?? '',
        jobTitle: body.jobTitle ?? '',
        resumeSupplemental: body.sourceSupplemental ?? '',
      },
      output: {
        resume: body.resume,
        coverLetter: body.coverLetter,
      },
      scoringModel: body.model ?? config.scoringModel,
      complete: (model, systemPrompt, userPrompt, verbose) =>
        defaultComplete(model, systemPrompt, userPrompt, verbose, { provider: preferredProvider }),
    });
    sendJson(res, 200, scorecard);
    return;
  }

  if (method === 'POST' && url.pathname === '/api/regenerate-section') {
    const body = await readJsonBody<RegenerateSectionBody>(req);
    if (typeof body.sectionId !== 'string' || body.sectionId.trim() === '') {
      sendJson(res, 400, { error: 'sectionId is required' });
      return;
    }
    const config = loadConfig();
    const result = await regenerateResumeSection({
      resume: body.resume ?? '',
      bio: body.bio ?? '',
      jobDescription: body.jobDescription ?? '',
      jobTitle: body.jobTitle,
      sectionId: body.sectionId,
      model: body.model ?? config.tailoringModel,
      verbose: body.verbose ?? false,
    });
    sendJson(res, 200, result);
    return;
  }

  if (method === 'POST' && url.pathname === '/api/render') {
    const rawBody = await readJsonBody<{ markdown: string; kind: unknown; title?: string; theme?: ResumeTheme }>(req);
    const kind = normalizeExportKind(rawBody.kind);
    const html = kind === 'resume'
      ? renderResumeHtml(rawBody.markdown, rawBody.title || 'Resume', false, rawBody.theme)
      : renderCoverLetterHtml(rawBody.markdown, rawBody.title || 'Cover Letter', rawBody.theme);
    sendJson(res, 200, { html });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/export/pdf') {
    const rawBody = await readJsonBody<{ kind: unknown; title?: string; markdown?: string; html?: string; theme?: Partial<ResumeTheme> }>(req);
    const kind = normalizeExportKind(rawBody.kind);
    const body: ExportPdfBody = {
      ...rawBody,
      kind,
    };
    const result = await buildPdfBuffer(body);
    sendPdf(res, result.filename, result.pdf);
    return;
  }

  sendNotFound(res);
}

export async function startWorkbenchServer(
  port = Number(process.env.PORT ?? DEFAULT_PORT),
  host = process.env.HOST || '127.0.0.1',
) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
        const assetPath = resolveWorkbenchAssetPath(decodeURIComponent(url.pathname.slice('/assets/'.length)));
        if (!assetPath) {
          sendNotFound(res);
          return;
        }
        sendFile(res, assetPath);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/') {
        sendHtml(res, readWorkbenchHtml());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v2') {
        sendHtml(res, readWorkbenchV2Html());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/resume-editor') {
        sendHtml(res, readResumeEditorHtml());
        return;
      }
      // Serve static assets from React build (web/dist/assets/)
      if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
        const assetsDir = join(__dirname, '..', 'web', 'dist', 'assets');
        const assetFile = join(assetsDir, url.pathname.slice('/assets/'.length));
        // Prevent path traversal: ensure the resolved path stays within assetsDir
        const resolvedAsset = resolve(assetFile);
        if (resolvedAsset.startsWith(assetsDir + sep) && existsSync(resolvedAsset)) {
          const ext = resolvedAsset.split('.').pop()?.toLowerCase() ?? '';
          const mimeTypes: Record<string, string> = {
            js: 'application/javascript; charset=utf-8',
            css: 'text/css; charset=utf-8',
            svg: 'image/svg+xml',
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            woff: 'font/woff',
            woff2: 'font/woff2',
          };
          const contentType = mimeTypes[ext] ?? 'application/octet-stream';
          const fileBuffer = readFileSync(resolvedAsset);
          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          res.end(fileBuffer);
          return;
        }
        sendNotFound(res);
        return;
      }
      await handleApi(req, res);
    } catch (error) {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Unexpected server error',
      });
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => resolve());
  });

  return {
    server,
    port,
    host,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const defaultHost = process.env.HOST || '127.0.0.1';
  startWorkbenchServer(undefined, defaultHost)
    .then(({ port, host }) => {
      const displayHost = host === '127.0.0.1' ? 'localhost' : host;
      console.log(`Well-Tailored workbench listening on http://${displayHost}:${port}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
