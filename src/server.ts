import { createServer, IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { homedir, tmpdir } from 'os';
import { loadConfig } from './config.js';
import { describeProvider } from './lib/ai.js';
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
  listAllJobs,
  listWishlistJobs,
  requireHuntrClient,
} from './services/huntr.js';
import { runTailorWorkflow } from './services/runs.js';
import { listSavedWorkspaces, loadSavedWorkspace, saveWorkspaceSnapshot } from './services/workspace-store.js';
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
  kind: 'resume' | 'coverLetter';
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

function sendPdf(res: ServerResponse, filename: string, pdf: Buffer): void {
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
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
  const dir = mkdtempSync(join(tmpdir(), 'job-shit-export-'));
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

    if (!body.html) {
      throw new Error('Cover letter PDF export requires HTML.');
    }

    writeFileSync(htmlPath, body.html, 'utf8');
    await renderPdf(htmlPath, pdfPath);
    return {
      filename: 'cover-letter.pdf',
      pdf: readFileSync(pdfPath),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function readWorkbenchHtml(): string {
  return readFileSync(join(__dirname, 'workbench', 'index.html'), 'utf8');
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
    sendJson(res, 200, loadSavedWorkspace(id));
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

  if (method === 'GET' && url.pathname === '/api/files/check') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      sendJson(res, 400, { error: 'Missing path parameter.' });
      return;
    }
    const resolved = resolve(filePath);
    const cwd = process.cwd();
    const home = join(homedir(), '.job-shit');
    if (!resolved.startsWith(cwd) && !resolved.startsWith(home)) {
      sendJson(res, 403, { error: 'Path not allowed.' });
      return;
    }
    if (!existsSync(resolved)) {
      sendJson(res, 200, { exists: false });
      return;
    }
    const stat = statSync(resolved);
    sendJson(res, 200, { exists: true, mtime: stat.mtime.toISOString(), size: stat.size });
    return;
  }

  if (method === 'GET' && url.pathname === '/api/files/read') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      sendJson(res, 400, { error: 'Missing path parameter.' });
      return;
    }
    const resolved = resolve(filePath);
    const cwd = process.cwd();
    const home = join(homedir(), '.job-shit');
    if (!resolved.startsWith(cwd) && !resolved.startsWith(home)) {
      sendJson(res, 403, { error: 'Path not allowed.' });
      return;
    }
    if (!existsSync(resolved)) {
      sendJson(res, 404, { error: 'File not found.' });
      return;
    }
    const content = readFileSync(resolved, 'utf8');
    const stat = statSync(resolved);
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

  if (method === 'POST' && url.pathname === '/api/render') {
    const body = await readJsonBody<{ markdown: string; kind: 'resume' | 'coverLetter'; title?: string; theme?: ResumeTheme }>(req);
    const html = body.kind === 'resume'
      ? renderResumeHtml(body.markdown, body.title || 'Resume', false, body.theme)
      : renderCoverLetterHtml(body.markdown, body.title || 'Cover Letter', body.theme);
    sendJson(res, 200, { html });
    return;
  }

  if (method === 'POST' && url.pathname === '/api/export/pdf') {
    const body = await readJsonBody<ExportPdfBody>(req);
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
      if (req.method === 'GET' && url.pathname === '/') {
        sendHtml(res, readWorkbenchHtml());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/resume-editor') {
        sendHtml(res, readResumeEditorHtml());
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
      console.log(`job-shit workbench listening on http://${displayHost}:${port}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
