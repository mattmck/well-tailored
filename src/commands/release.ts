import { Command } from 'commander';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { loadConfig } from '../config.js';
import { createOpenAIClient } from '../lib/ai.js';
import { tailorDocuments, tailorResume } from '../lib/tailor.js';
import { findFile, readFile, JOB_SHIT_DIR } from '../lib/files.js';
import type {
  JobConfig,
  StackProfile,
  TailoredResult,
  ReleaseReport,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function readYaml<T>(filePath: string): T | null {
  try {
    return yaml.load(readFile(filePath)) as T;
  } catch {
    return null;
  }
}

function isJobConfig(raw: unknown): raw is JobConfig {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return typeof r.company === 'string' && typeof r.title === 'string' && typeof r.description === 'string';
}

function isStackProfile(raw: unknown): raw is StackProfile {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.name === 'string' &&
    Array.isArray(r.technologies) &&
    (r.technologies as unknown[]).every((t) => typeof t === 'string')
  );
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export function registerReleaseCommand(program: Command): void {
  program
    .command('release')
    .description(
      'Batch-generate tailored resumes (+ cover letters) for all jobs in jobs/. ' +
        'Stack profiles in stacks/ get resume-only tailoring.',
    )
    .option('--dry-run', 'Show what would be generated without calling the AI')
    .option('--job <slug>', 'Only process this one job slug')
    .option('--stack <slug>', 'Only process this one stack slug')
    .option(
      '-r, --resume <file>',
      `Base resume file. Auto-detected from CWD or ${JOB_SHIT_DIR} if omitted.`,
    )
    .option(
      '-b, --bio <file>',
      `Personal bio file (used for cover letters). Auto-detected from CWD or ${JOB_SHIT_DIR} if omitted.`,
    )
    .option('--jobs-dir <path>', 'Directory containing job config folders', 'jobs')
    .option('--stacks-dir <path>', 'Directory containing stack YAML files', 'stacks')
    .option('--output <dir>', 'Output directory', 'output')
    .action(async (opts: {
      dryRun?: boolean;
      job?: string;
      stack?: string;
      resume?: string;
      bio?: string;
      jobsDir: string;
      stacksDir: string;
      output: string;
    }) => {
      const dryRun = opts.dryRun ?? false;
      const startedAt = new Date().toISOString();

      // Resolve resume (always needed)
      let resumePath: string;

      try {
        resumePath = findFile({ explicit: opts.resume, prefix: 'resume', label: 'Resume' });
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      const resume = readFile(resumePath);
      console.log(`\nUsing resume: ${resumePath}`);

      // Bio is only needed when job cover letters will actually be generated:
      // not in dry-run mode, and not when only stacks are being processed.
      const willProcessJobs = !dryRun && (opts.job !== undefined || opts.stack === undefined);
      let bio = '';

      if (willProcessJobs) {
        let bioPath: string;
        try {
          bioPath = findFile({ explicit: opts.bio, prefix: 'bio', label: 'Bio' });
        } catch (err) {
          console.error(`Error: ${(err as Error).message}`);
          process.exit(1);
        }
        bio = readFile(bioPath);
        console.log(`Using bio:    ${bioPath}`);
      }

      console.log('');

      // Only load OpenAI config / create client when AI calls will actually be made.
      let client: ReturnType<typeof createOpenAIClient> | undefined;
      let model = '';

      if (!dryRun) {
        const config = loadConfig();
        client = createOpenAIClient(config.openaiApiKey);
        model = config.openaiModel;
      }

      const jobResults = await processJobs({
        client,
        model,
        resume,
        bio,
        jobsDir: opts.jobsDir,
        outputDir: opts.output,
        dryRun,
        onlySlug: opts.job,
      });

      const stackResults = await processStacks({
        client,
        model,
        resume,
        stacksDir: opts.stacksDir,
        outputDir: opts.output,
        dryRun,
        onlySlug: opts.stack,
      });

      const finishedAt = new Date().toISOString();

      const report: ReleaseReport = {
        jobs: jobResults,
        stacks: stackResults,
        dryRun,
        startedAt,
        finishedAt,
      };

      if (!dryRun) {
        mkdirSync(opts.output, { recursive: true });
        writeFileSync(
          join(opts.output, 'release-report.json'),
          JSON.stringify(report, null, 2),
          'utf8',
        );
        console.log(`\n📊  Report → ${join(opts.output, 'release-report.json')}`);
      }

      console.log(
        `\n✅  Done — ${jobResults.filter((r) => !r.skipped).length} job(s), ` +
          `${stackResults.filter((r) => !r.skipped).length} stack(s) generated.`,
      );
    });
}

// ---------------------------------------------------------------------------
// Job processing
// ---------------------------------------------------------------------------

async function processJobs(args: {
  client: ReturnType<typeof createOpenAIClient> | undefined;
  model: string;
  resume: string;
  bio: string;
  jobsDir: string;
  outputDir: string;
  dryRun: boolean;
  onlySlug?: string;
}): Promise<TailoredResult[]> {
  const { client, model, resume, bio, jobsDir, outputDir, dryRun, onlySlug } = args;

  if (!existsSync(jobsDir)) {
    console.log(`ℹ️   No jobs directory found (${jobsDir}) — skipping job tailoring.`);
    return [];
  }

  let slugs = readdirSync(jobsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (onlySlug) slugs = slugs.filter((s) => s === onlySlug);

  if (slugs.length === 0) {
    console.log('ℹ️   No job configs found — skipping job tailoring.');
    return [];
  }

  const results: TailoredResult[] = [];

  for (const slug of slugs) {
    const configPath = join(jobsDir, slug, 'config.yml');
    const raw = readYaml<unknown>(configPath);

    if (!isJobConfig(raw)) {
      console.warn(`⚠️   Skipping ${slug}: invalid or missing config.yml`);
      results.push({ type: 'job', slug, generatedAt: new Date().toISOString(), skipped: true });
      continue;
    }

    console.log(`🎯  [job] ${raw.company} — ${raw.title}`);

    if (dryRun) {
      console.log('     (dry-run, skipping AI call)');
      results.push({ type: 'job', slug, generatedAt: new Date().toISOString(), skipped: true });
      continue;
    }

    if (!client) throw new Error('OpenAI client not initialized');

    const output = await tailorDocuments(client, model, {
      resume,
      bio,
      company: raw.company,
      jobTitle: raw.title,
      jobDescription: raw.description + (raw.notes ? `\n\nNotes: ${raw.notes}` : ''),
    });

    const outDir = join(outputDir, 'jobs', slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'resume.md'), output.resume, 'utf8');
    writeFileSync(join(outDir, 'cover-letter.md'), output.coverLetter, 'utf8');

    console.log(`     ✏️   ${join(outDir, 'resume.md')}`);
    console.log(`     ✏️   ${join(outDir, 'cover-letter.md')}`);

    results.push({ type: 'job', slug, generatedAt: new Date().toISOString() });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Stack processing (resume only — no cover letter, no company to address)
// ---------------------------------------------------------------------------

async function processStacks(args: {
  client: ReturnType<typeof createOpenAIClient> | undefined;
  model: string;
  resume: string;
  stacksDir: string;
  outputDir: string;
  dryRun: boolean;
  onlySlug?: string;
}): Promise<TailoredResult[]> {
  const { client, model, resume, stacksDir, outputDir, dryRun, onlySlug } = args;

  if (!existsSync(stacksDir)) {
    console.log(`ℹ️   No stacks directory found (${stacksDir}) — skipping stack tailoring.`);
    return [];
  }

  let files = readdirSync(stacksDir)
    .filter((f) => f.endsWith('.yml'))
    .sort();

  if (onlySlug) files = files.filter((f) => f.replace(/\.yml$/, '') === onlySlug);

  if (files.length === 0) {
    console.log('ℹ️   No stack configs found — skipping stack tailoring.');
    return [];
  }

  const results: TailoredResult[] = [];

  for (const file of files) {
    const slug = file.replace(/\.yml$/, '');
    const raw = readYaml<unknown>(join(stacksDir, file));

    if (!isStackProfile(raw)) {
      console.warn(`⚠️   Skipping ${slug}: invalid stack profile`);
      results.push({ type: 'stack', slug, generatedAt: new Date().toISOString(), skipped: true });
      continue;
    }

    console.log(`🔧  [stack] ${raw.name}`);

    if (dryRun) {
      console.log('     (dry-run, skipping AI call)');
      results.push({ type: 'stack', slug, generatedAt: new Date().toISOString(), skipped: true });
      continue;
    }

    // Stack tailoring uses resume-only (no cover letter, single AI call)
    const stackJd =
      `Target stack: ${raw.name}\n` +
      `Technologies: ${raw.technologies.join(', ')}\n` +
      (raw.emphasis ? `\nEmphasis: ${raw.emphasis}` : '');

    if (!client) throw new Error('OpenAI client not initialized');

    const tailoredResume = await tailorResume(client, model, {
      resume,
      bio: '',
      company: raw.name,
      jobDescription: stackJd,
    });

    const outDir = join(outputDir, 'stacks', slug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'resume.md'), tailoredResume, 'utf8');

    console.log(`     ✏️   ${join(outDir, 'resume.md')}`);

    results.push({ type: 'stack', slug, generatedAt: new Date().toISOString() });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Slug-based output name (used externally, e.g. huntr command)
// ---------------------------------------------------------------------------

export { slugify };
