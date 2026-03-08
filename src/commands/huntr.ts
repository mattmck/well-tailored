import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { loadConfig } from '../config.js';
import { createOpenAIClient } from '../lib/ai.js';
import { tailorDocuments } from '../lib/tailor.js';

// Huntr API types (inlined to avoid a hard dependency on huntr-cli)
interface HuntrBoard {
  id: string;
  name?: string;
  isArchived: boolean;
}

interface HuntrJob {
  id: string;
  title: string;
  url?: string;
  htmlDescription?: string;
  _company?: string;
  _board?: string;
}

interface HuntrApiClient {
  get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T>;
}

function createHuntrClient(token: string): HuntrApiClient {
  const baseURL = 'https://api.huntr.co/api';

  return {
    async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
      const url = new URL(baseURL + endpoint);
      if (params) {
        for (const [key, val] of Object.entries(params)) {
          url.searchParams.set(key, String(val));
        }
      }
      const response = await fetch(url.toString(), {
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

/**
 * Convert HTML job descriptions to plain text for the AI prompt.
 * This runs in a CLI context — output is written to files, never rendered
 * in a browser, so there is no XSS exposure.
 *
 * Uses a character-level parser to strip tags so that no `<`-starting
 * sequence can survive in the output.
 */
function stripHtml(html: string): string {
  // Character-level tag stripper: never leaves any < > in the output
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
  // If inTag is still true here, the tag was never closed — just discard tagBuf

  // Decode common entities in a single lookup pass (no chained replacements)
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&nbsp;': ' ',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&lt;': '<',
    '&gt;': '>',
  };
  const text = chars
    .join('')
    .replace(/&[a-z#0-9]+;/gi, (e) => entities[e.toLowerCase()] ?? e)
    // Strip any angle brackets introduced by entity decoding (&lt;/&gt;)
    .replace(/[<>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function readFile(filePath: string): string {
  return readFileSync(resolve(filePath), 'utf8').trim();
}

export function registerHuntrCommand(program: Command): void {
  const huntr = program
    .command('huntr')
    .description('Interact with your Huntr.co job board (requires HUNTR_TOKEN in .env).');

  // huntr jobs — list all jobs
  huntr
    .command('jobs')
    .description('List all jobs in your Huntr boards.')
    .option('--board <boardId>', 'Limit to a specific board ID')
    .action(async (opts: { board?: string }) => {
      const config = loadConfig();
      if (!config.huntrToken) {
        console.error('Error: HUNTR_TOKEN is not set in .env.');
        process.exit(1);
      }
      const client = createHuntrClient(config.huntrToken);

      let boardIds: string[];
      if (opts.board) {
        boardIds = [opts.board];
      } else {
        const boards = await client.get<HuntrBoard[] | { data: HuntrBoard[] }>('/user/boards');
        const boardList = Array.isArray(boards) ? boards : boards.data;
        boardIds = boardList.filter((b) => !b.isArchived).map((b) => b.id);
      }

      for (const boardId of boardIds) {
        const res = await client.get<{ jobs: Record<string, HuntrJob> }>(`/board/${boardId}/jobs`);
        const jobs = Object.values(res.jobs ?? {});
        if (jobs.length === 0) continue;
        console.log(`\nBoard: ${boardId}`);
        for (const job of jobs) {
          console.log(`  ${job.id}  ${job.title}${job.url ? `  (${job.url})` : ''}`);
        }
      }
    });

  // huntr tailor <jobId> — fetch job from huntr and tailor
  huntr
    .command('tailor <jobId>')
    .description('Fetch a job from Huntr and generate a tailored resume + cover letter.')
    .requiredOption('--board <boardId>', 'Huntr board ID that contains the job')
    .option('-r, --resume <file>', 'Path to base resume file (markdown)', 'resume.md')
    .option('-b, --bio <file>', 'Path to personal bio/background file', 'bio.md')
    .option('-o, --output <dir>', 'Output directory', 'output')
    .action(async (jobId: string, opts: {
      board: string;
      resume: string;
      bio: string;
      output: string;
    }) => {
      const config = loadConfig();
      if (!config.huntrToken) {
        console.error('Error: HUNTR_TOKEN is not set in .env.');
        process.exit(1);
      }

      let resume: string;
      let bio: string;

      try {
        resume = readFile(opts.resume);
      } catch {
        console.error(`Error: Could not read resume file: ${opts.resume}`);
        process.exit(1);
      }

      try {
        bio = readFile(opts.bio);
      } catch {
        console.error(`Error: Could not read bio file: ${opts.bio}`);
        process.exit(1);
      }

      const huntrClient = createHuntrClient(config.huntrToken);
      const job = await huntrClient.get<HuntrJob>(`/board/${opts.board}/jobs/${jobId}`);

      const jobDescription = job.htmlDescription
        ? stripHtml(job.htmlDescription)
        : `Job title: ${job.title}`;

      const aiClient = createOpenAIClient(config.openaiApiKey);

      console.log(`\nFetched job: ${job.title}`);
      console.log('Generating resume and cover letter in parallel...\n');

      const output = await tailorDocuments(aiClient, config.openaiModel, {
        resume,
        bio,
        company: job._company ?? 'Unknown Company',
        jobTitle: job.title,
        jobDescription,
      });

      if (!existsSync(opts.output)) {
        mkdirSync(opts.output, { recursive: true });
      }
      const slug = slugify(job.title);
      const resumePath = join(opts.output, `resume-${slug}.md`);
      const clPath = join(opts.output, `cover-letter-${slug}.md`);

      writeFileSync(resumePath, output.resume, 'utf8');
      writeFileSync(clPath, output.coverLetter, 'utf8');

      console.log(`✓ Tailored resume   → ${resumePath}`);
      console.log(`✓ Cover letter      → ${clPath}`);
    });
}
