import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig, resolveHuntrToken } from '../config.js';
import { createAnthropicClient } from '../lib/ai.js';
import { tailorDocuments } from '../lib/tailor.js';
import { findFile, readFile, JOB_SHIT_DIR } from '../lib/files.js';
import { renderResumeHtml } from '../lib/render.js';

// ---------------------------------------------------------------------------
// Huntr API types (inlined — huntr-cli has no library exports)
// ---------------------------------------------------------------------------

interface HuntrBoard {
  id: string;
  name?: string;
  isArchived: boolean;
}

interface HuntrBoardList {
  id: string;
  name: string;
  _jobs: string[];
}

interface HuntrCompany {
  _id?: string;
  id?: string;
  name?: string;
}

interface HuntrJob {
  id: string;
  title: string;
  url?: string;
  rootDomain?: string;
  htmlDescription?: string;
  _list?: string;   // which list (wishlist, applied, etc.) this job belongs to
  _company?: string;
  company?: HuntrCompany;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

interface HuntrApiClient {
  get<T>(endpoint: string): Promise<T>;
}

function createHuntrClient(token: string): HuntrApiClient {
  const baseURL = 'https://api.huntr.co/api';
  return {
    async get<T>(endpoint: string): Promise<T> {
      const response = await fetch(baseURL + endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Huntr API error ${response.status}: ${response.statusText}`);
      }
      return response.json() as T;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert HTML job descriptions to plain text for the AI prompt.
 * CLI context only — output is written to files, never rendered in a browser.
 * Uses a character-level parser so no < sequence survives in the output.
 */
function stripHtml(html: string): string {
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
    '&amp;': '&', '&nbsp;': ' ', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>',
  };

  return chars
    .join('')
    .replace(/&[a-z#0-9]+;/gi, (e) => entities[e.toLowerCase()] ?? e)
    .replace(/[<>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const JOB_BOARD_DOMAINS = new Set([
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com',
  'dice.com', 'monster.com', 'simplyhired.com', 'careerbuilder.com',
]);

/**
 * Try to extract the hiring company name from a plain-text job description.
 * Matches patterns like "At Acme," / "Acme is hiring" / "About Acme\n".
 */
function extractCompanyFromDescription(text: string): string | null {
  const snippet = text.slice(0, 800);
  // Company name: 1-4 words, may start with digit (1Password), lowercase (eBay),
  // or capital; allow apostrophes (O'Reilly) and periods (e.g. Inc.) in words;
  // each word must end on an alphanumeric to avoid trailing punctuation;
  // optionally preceded by "The " (The New York Times).
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
    const m = snippet.match(re);
    if (m?.[1]) return m[1].trim().replace(/[,.]$/, '');
  }
  return null;
}

function extractCompanyName(job: HuntrJob): string {
  if (job.company?.name) return job.company.name;

  // If the URL is from a job board, the rootDomain is useless — dig into the description
  const isJobBoard = job.rootDomain && JOB_BOARD_DOMAINS.has(job.rootDomain);
  if (isJobBoard && job.htmlDescription) {
    const plain = stripHtml(job.htmlDescription);
    const extracted = extractCompanyFromDescription(plain);
    if (extracted) return extracted;
  }

  if (job.rootDomain && !isJobBoard) return job.rootDomain;
  if (job.url) {
    try { return new URL(job.url).hostname.replace(/^www\./, ''); } catch { /* fall through */ }
  }
  return 'Unknown Company';
}

async function requireHuntrToken(): Promise<string> {
  const token = await resolveHuntrToken();
  if (!token) {
    console.error(
      'Error: No Huntr credentials found.\n' +
      'Run `huntr login` in huntr-cli, or set HUNTR_API_TOKEN in your environment.',
    );
    process.exit(1);
  }
  return token;
}

/** Fetch all active boards. */
async function getBoards(client: HuntrApiClient): Promise<HuntrBoard[]> {
  // API returns a keyed object: { boardId: { _id?, isArchived, ... } }
  const res = await client.get<Record<string, { _id?: string; name?: string; isArchived: boolean }>>('/user/boards');
  return Object.entries(res)
    .map(([key, board]) => ({ ...board, id: board._id ?? key }))
    .filter((b) => !b.isArchived);
}

/** Fetch all jobs for a board as a flat array. */
async function getJobsForBoard(client: HuntrApiClient, boardId: string): Promise<HuntrJob[]> {
  const res = await client.get<{ jobs: Record<string, HuntrJob> }>(`/board/${boardId}/jobs`);
  return Object.values(res.jobs ?? {});
}

/** Fetch lists for a board, keyed by list ID. */
async function getListsForBoard(
  client: HuntrApiClient,
  boardId: string,
): Promise<Record<string, HuntrBoardList>> {
  return client.get<Record<string, HuntrBoardList>>(`/board/${boardId}/lists`);
}

/**
 * Find the wishlist list ID for a board.
 * Huntr's built-in "Wishlist" list has no fixed ID, so we match by name.
 */
async function findWishlistId(
  client: HuntrApiClient,
  boardId: string,
): Promise<string | null> {
  const lists = await getListsForBoard(client, boardId);
  const entry = Object.entries(lists).find(
    ([, list]) => list.name.toLowerCase() === 'wishlist',
  );
  return entry ? entry[0] : null;
}

/**
 * Find a specific job by ID across all active boards.
 * Returns the job and the board ID it was found in, or null.
 */
async function findJobAcrossBoards(
  client: HuntrApiClient,
  jobId: string,
): Promise<{ job: HuntrJob; boardId: string } | null> {
  const boards = await getBoards(client);
  for (const board of boards) {
    const jobs = await getJobsForBoard(client, board.id);
    const job = jobs.find((j) => j.id === jobId);
    if (job) return { job, boardId: board.id };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export function registerHuntrCommand(program: Command): void {
  const huntr = program
    .command('huntr')
    .description(
      'Interact with your Huntr.co job board. ' +
      'Uses credentials from huntr-cli (`huntr login`) or HUNTR_API_TOKEN env var.',
    );

  // huntr wishlist — jobs you haven't applied to yet
  huntr
    .command('wishlist')
    .description('List jobs in your Huntr Wishlist (not yet applied to).')
    .option('--board <boardId>', 'Limit to a specific board ID')
    .action(async (opts: { board?: string }) => {
      const token = await requireHuntrToken();
      const client = createHuntrClient(token);

      const boards = opts.board
        ? [{ id: opts.board, isArchived: false }]
        : await getBoards(client);

      let found = 0;
      for (const board of boards) {
        const wishlistId = await findWishlistId(client, board.id);
        if (!wishlistId) continue;

        const jobs = await getJobsForBoard(client, board.id);
        const wishlistJobs = jobs.filter((j) => j._list === wishlistId);
        if (wishlistJobs.length === 0) continue;

        found += wishlistJobs.length;
        for (const job of wishlistJobs) {
          const company = extractCompanyName(job);
          const url = job.url ? `  ${job.url}` : '';
          console.log(`${job.id}  ${job.title}  @ ${company}${url}`);
        }
      }

      if (found === 0) console.log('No wishlist jobs found.');
    });

  // huntr jobs — all jobs across boards (with list name)
  huntr
    .command('jobs')
    .description('List all jobs in your Huntr boards.')
    .option('--board <boardId>', 'Limit to a specific board ID')
    .action(async (opts: { board?: string }) => {
      const token = await requireHuntrToken();
      const client = createHuntrClient(token);

      const boards = opts.board
        ? [{ id: opts.board, isArchived: false }]
        : await getBoards(client);

      for (const board of boards) {
        const [jobs, lists] = await Promise.all([
          getJobsForBoard(client, board.id),
          getListsForBoard(client, board.id),
        ]);
        if (jobs.length === 0) continue;

        console.log(`\nBoard: ${board.id}`);
        for (const job of jobs) {
          const company = extractCompanyName(job);
          const listName = job._list ? (lists[job._list]?.name ?? '?') : '?';
          const url = job.url ? `  ${job.url}` : '';
          console.log(`  ${job.id}  [${listName}]  ${job.title}  @ ${company}${url}`);
        }
      }
    });

  // huntr tailor <jobId> — fetch job and generate tailored docs
  huntr
    .command('tailor <jobId>')
    .description(
      'Fetch a job from Huntr and generate a tailored resume + cover letter. ' +
      'Board is auto-detected if --board is omitted.',
    )
    .option('--board <boardId>', 'Huntr board ID (auto-detected if omitted)')
    .option(
      '-r, --resume <file>',
      `Base resume file (markdown). Auto-detected from CWD or ${JOB_SHIT_DIR} if omitted.`,
    )
    .option(
      '-b, --bio <file>',
      `Personal bio file. Auto-detected from CWD or ${JOB_SHIT_DIR} if omitted.`,
    )
    .option('-o, --output <dir>', 'Output directory', 'output')
    .action(async (jobId: string, opts: {
      board?: string;
      resume?: string;
      bio?: string;
      output: string;
    }) => {
      const token = await requireHuntrToken();
      const client = createHuntrClient(token);

      const { resume, bio, baseCoverLetter, resumeSupplemental, resumePath, bioPath } = resolveBaseFiles(opts.resume, opts.bio);

      // Resolve job — use explicit board or search all boards
      let job: HuntrJob;
      let boardId: string;

      if (opts.board) {
        boardId = opts.board;
        job = await client.get<HuntrJob>(`/board/${boardId}/jobs/${jobId}`);
      } else {
        console.log('Board not specified — searching all boards...');
        const found = await findJobAcrossBoards(client, jobId);
        if (!found) {
          console.error(`Error: Job ${jobId} not found in any active board.`);
          process.exit(1);
        }
        ({ job, boardId } = found);
      }

      console.log(`\nUsing resume: ${resumePath}`);
      console.log(`Using bio:    ${bioPath}`);

      const config = loadConfig();
      const aiClient = createAnthropicClient(config.apiKey);

      await tailorAndWrite({ job, resume, bio, baseCoverLetter, resumeSupplemental, aiClient, model: config.model, outputDir: opts.output });
    });

  // huntr tailor-all — tailor every wishlist job at once
  huntr
    .command('tailor-all')
    .description('Generate tailored resume + cover letter for every job in your Wishlist.')
    .option('--board <boardId>', 'Limit to a specific board ID')
    .option(
      '-r, --resume <file>',
      `Base resume file (markdown). Auto-detected from CWD or ${JOB_SHIT_DIR} if omitted.`,
    )
    .option(
      '-b, --bio <file>',
      `Personal bio file. Auto-detected from CWD or ${JOB_SHIT_DIR} if omitted.`,
    )
    .option('-o, --output <dir>', 'Output directory', 'output')
    .action(async (opts: {
      board?: string;
      resume?: string;
      bio?: string;
      output: string;
    }) => {
      const token = await requireHuntrToken();
      const client = createHuntrClient(token);

      const { resume, bio, baseCoverLetter, resumeSupplemental, resumePath, bioPath } = resolveBaseFiles(opts.resume, opts.bio);
      console.log(`\nUsing resume: ${resumePath}`);
      console.log(`Using bio:    ${bioPath}\n`);

      const boards = opts.board
        ? [{ id: opts.board, isArchived: false }]
        : await getBoards(client);

      // Collect all wishlist jobs across boards
      const wishlistJobs: HuntrJob[] = [];
      for (const board of boards) {
        const wishlistId = await findWishlistId(client, board.id);
        if (!wishlistId) continue;
        const jobs = await getJobsForBoard(client, board.id);
        wishlistJobs.push(...jobs.filter((j) => j._list === wishlistId));
      }

      if (wishlistJobs.length === 0) {
        console.log('No wishlist jobs found.');
        return;
      }

      console.log(`Found ${wishlistJobs.length} wishlist job(s). Tailoring...\n`);

      const config = loadConfig();
      const aiClient = createAnthropicClient(config.apiKey);

      let done = 0;
      let failed = 0;
      for (const job of wishlistJobs) {
        try {
          await tailorAndWrite({ job, resume, bio, baseCoverLetter, resumeSupplemental, aiClient, model: config.model, outputDir: opts.output });
          done++;
        } catch (err) {
          failed++;
          console.error(`  ❌  Failed to tailor ${job.title ?? 'unknown'} @ ${extractCompanyName(job)}: ${err instanceof Error ? err.message : String(err)}`);
        }
        if (done + failed < wishlistJobs.length) console.log('');
      }

      const summary = failed > 0
        ? `${done} job(s) tailored, ${failed} failed.`
        : `${done} job(s) tailored.`;
      console.log(`\n✅  Done — ${summary}`);
    });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function resolveBaseFiles(
  explicitResume?: string,
  explicitBio?: string,
): { resume: string; bio: string; baseCoverLetter?: string; resumeSupplemental?: string; resumePath: string; bioPath: string } {
  let resumePath: string;
  let bioPath: string;
  try {
    resumePath = findFile({ explicit: explicitResume, prefix: 'resume', label: 'Resume' });
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
  try {
    bioPath = findFile({ explicit: explicitBio, prefix: 'bio', label: 'Bio' });
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }

  let baseCoverLetter: string | undefined;
  try {
    const coverLetterPath = findFile({ prefix: 'cover-letter', label: 'Cover letter' });
    baseCoverLetter = readFile(coverLetterPath);
  } catch { /* optional */ }

  let resumeSupplemental: string | undefined;
  try {
    const supplementalPath = findFile({ prefix: 'resume-supplemental', label: 'Resume supplemental' });
    resumeSupplemental = readFile(supplementalPath);
  } catch { /* optional */ }

  return { resume: readFile(resumePath), bio: readFile(bioPath), baseCoverLetter, resumeSupplemental, resumePath, bioPath };
}

async function tailorAndWrite(args: {
  job: HuntrJob;
  resume: string;
  bio: string;
  baseCoverLetter?: string;
  resumeSupplemental?: string;
  aiClient: ReturnType<typeof createAnthropicClient>;
  model: string;
  outputDir: string;
}): Promise<void> {
  const { job, resume, bio, baseCoverLetter, resumeSupplemental, aiClient, model, outputDir } = args;
  const companyName = extractCompanyName(job);
  const jobDescription = job.htmlDescription
    ? stripHtml(job.htmlDescription)
    : `Job title: ${job.title}`;

  if (!job.htmlDescription) {
    console.warn(`Warning: No job description for "${job.title}" — tailoring from title only.`);
  }

  console.log(`🎯  ${job.title} @ ${companyName}`);
  console.log('    Generating resume and cover letter in parallel...');

  const output = await tailorDocuments(aiClient, model, {
    resume,
    bio,
    baseCoverLetter,
    resumeSupplemental,
    company: companyName,
    jobTitle: job.title,
    jobDescription,
  });

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const slugParts = [companyName, job.title, job.id].filter(Boolean).join(' ');
  const slug = slugify(slugParts);
  const resumeOut = join(outputDir, `resume-${slug}.md`);
  const coverLetterOut = join(outputDir, `cover-letter-${slug}.md`);

  writeFileSync(resumeOut, output.resume, 'utf8');
  writeFileSync(coverLetterOut, output.coverLetter, 'utf8');

  const resumeHtmlOut = join(outputDir, `resume-${slug}.html`);
  writeFileSync(resumeHtmlOut, renderResumeHtml(output.resume, `Resume — ${companyName}`), 'utf8');

  console.log(`    ✓ resume       → ${resumeOut}`);
  console.log(`    ✓ resume (html)→ ${resumeHtmlOut}`);
  console.log(`    ✓ cover letter → ${coverLetterOut}`);
}
