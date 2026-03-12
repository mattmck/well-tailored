import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig, resolveHuntrToken } from '../config.js';
import { tailorDocuments } from '../lib/tailor.js';
import { describeProvider } from '../lib/ai.js';
import { findFile, readFile, JOB_SHIT_DIR } from '../lib/files.js';
import { renderResumeHtml, renderCoverLetterHtml, renderPdf } from '../lib/render.js';

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
  domain?: string;
}

interface HuntrJob {
  id: string;
  title: string;
  url?: string;
  rootDomain?: string;
  htmlDescription?: string;
  _list?: string;   // which list (wishlist, applied, etc.) this job belongs to
  _company?: string;
  company?: HuntrCompany | string;
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
  'greenhouse.io', 'boards.greenhouse.io', 'lever.co', 'jobs.lever.co',
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
  let name: string | undefined;
  
  if (typeof job.company === 'object') {
    name = job.company.name;
  } else if (typeof job.company === 'string') {
    // If it's a string, it might be the name or an ID.
    // If it looks like a Mongo ID (24 chars hex), it's not the name.
    if (!/^[0-9a-fA-F]{24}$/.test(job.company)) {
      name = job.company;
    }
  }

  // Detect and reject generic/placeholder names from extensions
  const placeholders = new Set(['the job', 'unknown company', 'unknown', 'job']);
  if (name && placeholders.has(name.toLowerCase())) {
    name = undefined;
  }

  if (name) return name;

  // Fallback 1: Try to extract from description
  if (job.htmlDescription) {
    const plain = stripHtml(job.htmlDescription);
    const extracted = extractCompanyFromDescription(plain);
    if (extracted) return extracted;
  }

  // Fallback 2: Try to extract from URL
  if (job.url) {
    try {
      const url = new URL(job.url);
      const hostname = url.hostname.replace(/^www\./, '');

      // Greenhouse/Lever board URLs carry the company slug in the path
      // e.g. boards.greenhouse.io/<company>/jobs/... or jobs.lever.co/<company>/...
      if (hostname === 'boards.greenhouse.io' || hostname === 'jobs.lever.co') {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) return decodeURIComponent(pathParts[0]);
      }

      // Company-specific Greenhouse/Lever subdomains (e.g. acme.greenhouse.io)
      if (hostname.endsWith('.greenhouse.io') || hostname.endsWith('.lever.co')) {
        const subdomain = hostname.split('.')[0];
        if (subdomain) return subdomain;
      }

      // If it's not a known job board, the hostname likely belongs to the company
      if (!JOB_BOARD_DOMAINS.has(hostname)) {
        return hostname;
      }
    } catch { /* fall through */ }
  }

  // Fallback 3: rootDomain if not a job board
  if (job.rootDomain && !JOB_BOARD_DOMAINS.has(job.rootDomain)) {
    return job.rootDomain;
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
    .option('-s, --supplemental <file>', 'Supplemental resume file (markdown). Auto-detected if omitted.')
    .option('-o, --output <dir>', 'Output directory', 'output')
    .option('-v, --verbose', 'Show per-call AI logging (model, prompt sizes, timing)')
    .option('-m, --model <model>', 'Model/deployment name (e.g. gpt-4o, claude-opus-4-5). Default: auto — uses provider default')
    .option('--pdf', 'Generate PDF output (requires Chrome — run `npm run setup` first)')
    .action(async (jobId: string, opts: {
      board?: string;
      resume?: string;
      bio?: string;
      supplemental?: string;
      output: string;
      verbose?: boolean;
      model?: string;
      pdf?: boolean;
    }) => {
      const token = await requireHuntrToken();
      const client = createHuntrClient(token);

      const { resume, bio, baseCoverLetter, resumeSupplemental, resumePath, bioPath, supplementalPath } = resolveBaseFiles(opts.resume, opts.bio, opts.supplemental);

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

      const config = loadConfig();
      const model = opts.model ?? config.model;

      console.log(`\nUsing resume: ${resumePath}`);
      console.log(`Using bio:    ${bioPath}`);
      if (supplementalPath) console.log(`Using supplemental: ${supplementalPath}`);
      console.log(`Using AI:     ${describeProvider(model)}`);

      await tailorAndWrite({ job, resume, bio, baseCoverLetter, resumeSupplemental, model, outputDir: opts.output, verbose: opts.verbose, pdf: opts.pdf });
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
    .option('-s, --supplemental <file>', 'Supplemental resume file (markdown). Auto-detected if omitted.')
    .option('-o, --output <dir>', 'Output directory', 'output')
    .option('-v, --verbose', 'Show per-call AI logging (model, prompt sizes, timing)')
    .option('-m, --model <model>', 'Model/deployment name (e.g. gpt-4o, claude-opus-4-5). Default: auto — uses provider default')
    .option('--pdf', 'Generate PDF output (requires Chrome — run `npm run setup` first)')
    .action(async (opts: {
      board?: string;
      resume?: string;
      bio?: string;
      supplemental?: string;
      output: string;
      verbose?: boolean;
      model?: string;
      pdf?: boolean;
    }) => {
      const token = await requireHuntrToken();
      const client = createHuntrClient(token);

      const { resume, bio, baseCoverLetter, resumeSupplemental, resumePath, bioPath, supplementalPath } = resolveBaseFiles(opts.resume, opts.bio, opts.supplemental);

      const config = loadConfig();
      const model = opts.model ?? config.model;

      console.log(`\nUsing resume: ${resumePath}`);
      console.log(`Using bio:    ${bioPath}`);
      if (supplementalPath) console.log(`Using supplemental: ${supplementalPath}`);
      console.log(`Using AI:     ${describeProvider(model)}`);
      console.log('');

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

      let done = 0;
      let failed = 0;
      for (const job of wishlistJobs) {
        try {
          await tailorAndWrite({ job, resume, bio, baseCoverLetter, resumeSupplemental, model, outputDir: opts.output, verbose: opts.verbose, pdf: opts.pdf });
          done++;
        } catch (err) {
          failed++;
          console.error(`  ❌  Failed to tailor ${job.title ?? 'unknown'} @ ${extractCompanyName(job)}: ${err instanceof Error ? err.message : String(err)}`);
        }
        const remaining = wishlistJobs.length - done - failed;
        if (remaining > 0) {
          console.log('');
          // Small pause between jobs to stay within provider rate limits
          await new Promise<void>((r) => setTimeout(r, 2_000));
        }
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
  explicitSupplemental?: string,
): { resume: string; bio: string; baseCoverLetter?: string; resumeSupplemental?: string; resumePath: string; bioPath: string; supplementalPath?: string } {
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
  let supplementalPath: string | undefined;
  try {
    supplementalPath = findFile({ explicit: explicitSupplemental, prefix: 'resume-supplemental', label: 'Resume supplemental' });
    resumeSupplemental = readFile(supplementalPath);
  } catch (err) {
    if (explicitSupplemental) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
    // optional if not explicitly provided
  }

  return { resume: readFile(resumePath), bio: readFile(bioPath), baseCoverLetter, resumeSupplemental, resumePath, bioPath, supplementalPath };
}

async function tailorAndWrite(args: {
  job: HuntrJob;
  resume: string;
  bio: string;
  baseCoverLetter?: string;
  resumeSupplemental?: string;
  model: string;
  outputDir: string;
  verbose?: boolean;
  pdf?: boolean;
}): Promise<void> {
  const { job, resume, bio, baseCoverLetter, resumeSupplemental, model, outputDir, verbose = false, pdf = false } = args;
  const companyName = extractCompanyName(job);
  const jobDescription = job.htmlDescription
    ? stripHtml(job.htmlDescription)
    : `Job title: ${job.title}`;

  if (!job.htmlDescription) {
    console.warn(`Warning: No job description for "${job.title}" — tailoring from title only.`);
  }

  console.log(`🎯  ${job.title} @ ${companyName}`);
  console.log('    Generating resume and cover letter in parallel...');

  const output = await tailorDocuments(model, {
    resume,
    bio,
    baseCoverLetter,
    resumeSupplemental,
    company: companyName,
    jobTitle: job.title,
    jobDescription,
  }, verbose);

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const slugParts = [companyName, job.title, job.id].filter(Boolean).join(' ');
  const slug = slugify(slugParts);
  const resumeOut = join(outputDir, `resume-${slug}.md`);
  const coverLetterOut = join(outputDir, `cover-letter-${slug}.md`);

  writeFileSync(resumeOut, output.resume, 'utf8');
  writeFileSync(coverLetterOut, output.coverLetter, 'utf8');

  const resumeHtmlOut = join(outputDir, `resume-${slug}.html`);
  writeFileSync(resumeHtmlOut, renderResumeHtml(output.resume, `Resume - ${companyName}`), 'utf8');

  const coverLetterHtmlOut = join(outputDir, `cover-letter-${slug}.html`);
  writeFileSync(coverLetterHtmlOut, renderCoverLetterHtml(output.coverLetter, `Cover Letter - ${companyName}`), 'utf8');

  console.log(`    ✓ resume       → ${resumeOut}`);
  console.log(`    ✓ resume (html)→ ${resumeHtmlOut}`);
  console.log(`    ✓ cover letter → ${coverLetterOut}`);
  console.log(`    ✓ cl (html)    → ${coverLetterHtmlOut}`);

  if (pdf) {
    const resumePdfOut = join(outputDir, `resume-${slug}.pdf`);
    try {
      await renderPdf(resumeHtmlOut, resumePdfOut);
      console.log(`    ✓ resume (pdf) → ${resumePdfOut}`);
    } catch (err) {
      console.warn(`    ⚠ PDF generation skipped: ${(err as Error).message}`);
    }

    const coverLetterPdfOut = join(outputDir, `cover-letter-${slug}.pdf`);
    try {
      await renderPdf(coverLetterHtmlOut, coverLetterPdfOut);
      console.log(`    ✓ cl (pdf)     → ${coverLetterPdfOut}`);
    } catch (err) {
      console.warn(`    ⚠ PDF generation skipped: ${(err as Error).message}`);
    }
  }
}
