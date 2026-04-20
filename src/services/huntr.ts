import { resolveHuntrToken } from '../config.js';
import { TailorInput } from '../types/index.js';

export interface HuntrBoard {
  id: string;
  name?: string;
  isArchived: boolean;
}

export interface HuntrBoardList {
  id: string;
  name: string;
  _jobs: string[];
}

export interface HuntrCompany {
  _id?: string;
  id?: string;
  name?: string;
  domain?: string;
}

export interface HuntrJob {
  id: string;
  title: string;
  url?: string;
  rootDomain?: string;
  htmlDescription?: string;
  _list?: string;
  _company?: string;
  company?: HuntrCompany | string;
  createdAt?: string;
  updatedAt?: string;
  lastMovedAt?: string;
}

interface HuntrJobDetailAction {
  data?: {
    job?: HuntrJob;
    company?: HuntrCompany | string;
  };
}

interface HuntrJobDetailResponse {
  jobs?: Record<string, HuntrJob>;
  companies?: Record<string, HuntrCompany>;
  actions?: Record<string, HuntrJobDetailAction>;
}

export interface HuntrWishlistJob {
  boardId: string;
  job: HuntrJob;
  company: string;
  listName?: string;
  descriptionText: string;
  listAddedAt?: string;
  listPosition?: number;
}

export interface HuntrJobStageSummary {
  boardId: string;
  id: string;
  listName?: string;
}

function getListAddedAt(job: HuntrJob): string | undefined {
  return job.lastMovedAt ?? job.createdAt;
}

export interface HuntrApiClient {
  get<T>(endpoint: string): Promise<T>;
}

const COMPANY_PLACEHOLDERS = new Set(['the job', 'unknown company', 'unknown', 'job']);

const DEFAULT_TIMEOUT_MS = 10_000;

export function createHuntrClient(token: string, timeoutMs = DEFAULT_TIMEOUT_MS): HuntrApiClient {
  const baseURL = 'https://api.huntr.co/api';
  return {
    async get<T>(endpoint: string): Promise<T> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetch(baseURL + endpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`Huntr API request timed out after ${timeoutMs}ms: ${baseURL}${endpoint}`, { cause: err });
        }
        throw err;
      }
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`Huntr API error ${response.status}: ${response.statusText}`);
      }
      return response.json() as T;
    },
  };
}

export async function requireHuntrClient(): Promise<HuntrApiClient> {
  const token = await resolveHuntrToken();
  if (!token) {
    throw new Error(
      'No Huntr credentials found. Run `huntr login`, set HUNTR_API_TOKEN, or configure huntr-cli.',
    );
  }
  return createHuntrClient(token);
}

export function stripHtml(html: string): string {
  const chars: string[] = [];
  let inTag = false;
  let tagBuf = '';

  for (const ch of html) {
    if (ch === '<') {
      inTag = true;
      tagBuf = ch;
    } else if (inTag) {
      tagBuf += ch;
      if (ch === '>') {
        inTag = false;
        if (/^<\/?(?:br|p|div|li|ul|ol|h[1-6])/i.test(tagBuf)) chars.push('\n');
        tagBuf = '';
      }
    } else {
      chars.push(ch);
    }
  }

  const entities: Record<string, string> = {
    '&amp;': '&',
    '&nbsp;': ' ',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
  };

  return chars
    .join('')
    .replace(/&[a-z#0-9]+;/gi, (e) => entities[e.toLowerCase()] ?? e)
    .replace(/[<>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const JOB_BOARD_DOMAINS = new Set([
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'dice.com',
  'monster.com',
  'simplyhired.com',
  'careerbuilder.com',
  'greenhouse.io',
  'boards.greenhouse.io',
  'lever.co',
  'jobs.lever.co',
]);

function extractCompanyFromDescription(text: string): string | null {
  const snippet = text.slice(0, 800);
  const NAME = '((?:The )?[A-Za-z0-9][A-Za-z0-9&\'.]*[A-Za-z0-9](?:[\\s-][A-Za-z0-9&\'.]*[A-Za-z0-9]){0,3}?)';
  const NOT_COMMON = '(?!This |Our |We |You |All |With |When |As |If )';
  const patterns = [
    new RegExp(`\\bAt ${NOT_COMMON}${NAME},`),
    new RegExp(`\\b${NOT_COMMON}${NAME} is (?:hiring|a leading|a platform|building|an )`),
    new RegExp(`^About ${NAME}\\s*$`, 'm'),
    new RegExp(`\\bJoin ${NOT_COMMON}${NAME} (?:in|and|if|to)\\b`),
    new RegExp(`\\b${NOT_COMMON}${NAME}\\b (?:is |,|\\(|-)`),
  ];
  for (const re of patterns) {
    const match = snippet.match(re);
    if (match?.[1]) {
      return match[1].trim().replace(/[,.]$/, '');
    }
  }
  return null;
}

function directCompanyName(job: HuntrJob): string | undefined {
  let name: string | undefined;

  if (typeof job.company === 'object') {
    name = job.company.name;
  } else if (typeof job.company === 'string' && !/^[0-9a-fA-F]{24}$/.test(job.company)) {
    name = job.company;
  }

  if (name && COMPANY_PLACEHOLDERS.has(name.toLowerCase())) {
    name = undefined;
  }

  return name;
}

function extractCompanyNameFromDetail(detail: HuntrJobDetailResponse, job: HuntrJob): string | undefined {
  if (job._company && detail.companies?.[job._company]?.name) {
    return detail.companies[job._company]?.name;
  }

  for (const company of Object.values(detail.companies ?? {})) {
    if (company?.name && !COMPANY_PLACEHOLDERS.has(company.name.toLowerCase())) {
      return company.name;
    }
  }

  for (const action of Object.values(detail.actions ?? {})) {
    const candidate = action.data?.company;
    if (typeof candidate === 'object' && candidate?.name && !COMPANY_PLACEHOLDERS.has(candidate.name.toLowerCase())) {
      return candidate.name;
    }
    if (typeof candidate === 'string' && candidate && !COMPANY_PLACEHOLDERS.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return undefined;
}

function normalizeJobFromDetail(job: HuntrJob, detail: HuntrJobDetailResponse): HuntrJob {
  const detailJob = detail.jobs?.[job.id] ?? detail.jobs?.[(job as HuntrJob & { _id?: string })._id ?? ''];
  const companyName = extractCompanyNameFromDetail(detail, job);

  return {
    ...job,
    ...detailJob,
    company: companyName
      ? { ...(typeof job.company === 'object' ? job.company : {}), name: companyName }
      : detailJob?.company ?? job.company,
  };
}

async function hydrateJobCompany(
  client: HuntrApiClient,
  boardId: string,
  job: HuntrJob,
): Promise<HuntrJob> {
  if (directCompanyName(job)) {
    return job;
  }

  try {
    const detail = await client.get<HuntrJobDetailResponse>(`/board/${boardId}/jobs/${job.id}`);
    return normalizeJobFromDetail(job, detail);
  } catch {
    return job;
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (nextIndex < items.length) {
        const current = nextIndex++;
        results[current] = await mapper(items[current], current);
      }
    }),
  );

  return results;
}

export function extractCompanyName(job: HuntrJob): string {
  const name = directCompanyName(job);

  if (name) return name;

  if (job.htmlDescription) {
    const plain = stripHtml(job.htmlDescription);
    const extracted = extractCompanyFromDescription(plain);
    if (extracted) return extracted;
  }

  if (job.url) {
    try {
      const url = new URL(job.url);
      const hostname = url.hostname.replace(/^www\./, '');

      if (hostname === 'boards.greenhouse.io' || hostname === 'jobs.lever.co') {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) return decodeURIComponent(pathParts[0]);
      }

      if (hostname.endsWith('.greenhouse.io') || hostname.endsWith('.lever.co')) {
        const subdomain = hostname.split('.')[0];
        if (subdomain) return subdomain;
      }

      if (!JOB_BOARD_DOMAINS.has(hostname)) {
        return hostname;
      }
    } catch {
      // Ignore malformed URLs and fall through.
    }
  }

  if (job.rootDomain && !JOB_BOARD_DOMAINS.has(job.rootDomain)) {
    return job.rootDomain;
  }

  return 'Unknown Company';
}

export async function getBoards(client: HuntrApiClient): Promise<HuntrBoard[]> {
  const response = await client.get<Record<string, { _id?: string; name?: string; isArchived: boolean }>>(
    '/user/boards',
  );
  return Object.entries(response)
    .map(([key, board]) => ({ ...board, id: board._id ?? key }))
    .filter((board) => !board.isArchived);
}

export async function getJobsForBoard(client: HuntrApiClient, boardId: string): Promise<HuntrJob[]> {
  const response = await client.get<{ jobs: Record<string, HuntrJob> }>(`/board/${boardId}/jobs`);
  return Object.values(response.jobs ?? {});
}

export async function getListsForBoard(
  client: HuntrApiClient,
  boardId: string,
): Promise<Record<string, HuntrBoardList>> {
  return client.get<Record<string, HuntrBoardList>>(`/board/${boardId}/lists`);
}

export async function findWishlistId(client: HuntrApiClient, boardId: string): Promise<string | null> {
  const lists = await getListsForBoard(client, boardId);
  const entry = Object.entries(lists).find(([, list]) => list.name.toLowerCase() === 'wishlist');
  return entry ? entry[0] : null;
}

export async function findJobAcrossBoards(
  client: HuntrApiClient,
  jobId: string,
): Promise<{ job: HuntrJob; boardId: string } | null> {
  const boards = await getBoards(client);
  for (const board of boards) {
    const jobs = await getJobsForBoard(client, board.id);
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (job) {
      return { job, boardId: board.id };
    }
  }
  return null;
}

export async function getJob(
  client: HuntrApiClient,
  jobId: string,
  boardId?: string,
): Promise<{ boardId: string; job: HuntrJob }> {
  if (boardId) {
    const jobs = await getJobsForBoard(client, boardId);
    const baseJob = jobs.find((candidate) => candidate.id === jobId);
    if (!baseJob) {
      throw new Error(`Job ${jobId} not found in board ${boardId}.`);
    }
    const job = await hydrateJobCompany(client, boardId, baseJob);
    return { boardId, job };
  }

  const found = await findJobAcrossBoards(client, jobId);
  if (!found) {
    throw new Error(`Job ${jobId} not found in any active board.`);
  }
  return {
    boardId: found.boardId,
    job: await hydrateJobCompany(client, found.boardId, found.job),
  };
}

export async function listWishlistJobs(
  client: HuntrApiClient,
  boardId?: string,
): Promise<HuntrWishlistJob[]> {
  const boards = boardId
    ? [{ id: boardId, isArchived: false }]
    : await getBoards(client);

  const jobs: HuntrWishlistJob[] = [];
  for (const board of boards) {
    const wishlistId = await findWishlistId(client, board.id);
    if (!wishlistId) continue;

    const [boardJobs, lists] = await Promise.all([
      getJobsForBoard(client, board.id),
      getListsForBoard(client, board.id),
    ]);

    const wishlistJobs = boardJobs.filter((candidate) => candidate._list === wishlistId);
    const listOrder = new Map((lists[wishlistId]?._jobs ?? []).map((jobId, index) => [jobId, index]));
    const hydratedJobs = await mapWithConcurrency(
      wishlistJobs,
      4,
      async (job) => hydrateJobCompany(client, board.id, job),
    );

    for (const job of hydratedJobs) {
      jobs.push({
        boardId: board.id,
        job,
        company: extractCompanyName(job),
        listName: job._list ? lists[job._list]?.name : undefined,
        descriptionText: job.htmlDescription ? stripHtml(job.htmlDescription) : `Job title: ${job.title}`,
        listAddedAt: getListAddedAt(job),
        listPosition: listOrder.get(job.id),
      });
    }
  }

  return jobs;
}

export async function listAllJobs(
  client: HuntrApiClient,
  boardId?: string,
): Promise<HuntrWishlistJob[]> {
  const boards = boardId
    ? [{ id: boardId, isArchived: false }]
    : await getBoards(client);

  const jobs: HuntrWishlistJob[] = [];
  for (const board of boards) {
    const [boardJobs, lists] = await Promise.all([
      getJobsForBoard(client, board.id),
      getListsForBoard(client, board.id),
    ]);

    const listIdToName = new Map(
      Object.entries(lists).map(([id, list]) => [id, list.name]),
    );

    // Build a composite rank (listIndex * 10000 + jobIndex) so jobs from different
    // lists don't collide on position index when sorting.
    const jobOrder = new Map<string, number>();
    const listValues = Object.values(lists);
    for (const [listIdx, list] of listValues.entries()) {
      for (const [jobIdx, jobId] of (list._jobs ?? []).entries()) {
        if (!jobOrder.has(jobId)) jobOrder.set(jobId, listIdx * 10000 + jobIdx);
      }
    }

    const hydratedJobs = await mapWithConcurrency(
      boardJobs,
      4,
      async (job) => hydrateJobCompany(client, board.id, job),
    );

    hydratedJobs.sort((a, b) => (jobOrder.get(a.id) ?? 999999) - (jobOrder.get(b.id) ?? 999999));

    for (const job of hydratedJobs) {
      jobs.push({
        boardId: board.id,
        job,
        company: extractCompanyName(job),
        listName: job._list ? listIdToName.get(job._list) : undefined,
        descriptionText: job.htmlDescription ? stripHtml(job.htmlDescription) : `Job title: ${job.title}`,
        listAddedAt: getListAddedAt(job),
        listPosition: jobOrder.get(job.id),
      });
    }
  }

  return jobs;
}

export async function listAllJobStages(
  client: HuntrApiClient,
  boardId?: string,
): Promise<HuntrJobStageSummary[]> {
  const boards = boardId
    ? [{ id: boardId, isArchived: false }]
    : await getBoards(client);

  const jobs: HuntrJobStageSummary[] = [];
  for (const board of boards) {
    const [boardJobs, lists] = await Promise.all([
      getJobsForBoard(client, board.id),
      getListsForBoard(client, board.id),
    ]);

    const listIdToName = new Map(
      Object.entries(lists).map(([id, list]) => [id, list.name]),
    );

    for (const job of boardJobs) {
      jobs.push({
        boardId: board.id,
        id: job.id,
        listName: job._list ? listIdToName.get(job._list) : undefined,
      });
    }
  }

  return jobs;
}

export function buildTailorInputFromHuntrJob(
  job: HuntrJob,
  docs: {
    resume: string;
    bio: string;
    baseCoverLetter?: string;
    resumeSupplemental?: string;
  },
): TailorInput {
  return {
    resume: docs.resume,
    bio: docs.bio,
    baseCoverLetter: docs.baseCoverLetter,
    resumeSupplemental: docs.resumeSupplemental,
    company: extractCompanyName(job),
    jobTitle: job.title,
    jobDescription: job.htmlDescription ? stripHtml(job.htmlDescription) : `Job title: ${job.title}`,
  };
}
