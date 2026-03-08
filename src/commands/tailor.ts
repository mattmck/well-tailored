import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../config.js';
import { createOpenAIClient } from '../lib/ai.js';
import { tailorDocuments } from '../lib/tailor.js';
import { findFile, readFile, JOB_SHIT_DIR } from '../lib/files.js';
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function registerTailorCommand(program: Command): void {
  program
    .command('tailor')
    .description(
      'Tailor your resume and generate a cover letter for a specific job. ' +
        'Produces both documents in parallel via AI.',
    )
    .requiredOption('-c, --company <name>', 'Company name')
    .requiredOption('-j, --job <file>', 'Path to job description file (plain text or markdown)')
    .option(
      '-r, --resume <file>',
      `Path to base resume file (markdown). Auto-detected from CWD or ${JOB_SHIT_DIR} if omitted.`,
    )
    .option(
      '-b, --bio <file>',
      `Path to personal bio/background file. Auto-detected from CWD or ${JOB_SHIT_DIR} if omitted.`,
    )
    .option('-t, --title <title>', 'Job title (inferred from JD if omitted)')
    .option('-o, --output <dir>', 'Output directory', 'output')
    .action(async (opts: {
      company: string;
      job: string;
      resume?: string;
      bio?: string;
      title?: string;
      output: string;
    }) => {
      // Resolve input files
      let resumePath: string;
      let bioPath: string;

      try {
        resumePath = findFile({ explicit: opts.resume, prefix: 'resume', label: 'Resume' });
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      try {
        bioPath = findFile({ explicit: opts.bio, prefix: 'bio', label: 'Bio' });
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }

      let jobDescription: string;
      try {
        jobDescription = readFile(opts.job);
      } catch {
        console.error(`Error: Could not read job description file: ${opts.job}`);
        process.exit(1);
      }

      const resume = readFile(resumePath);
      const bio = readFile(bioPath);

      let baseCoverLetter: string | undefined;
      try {
        const coverLetterPath = findFile({ prefix: 'cover-letter', label: 'Cover letter' });
        baseCoverLetter = readFile(coverLetterPath);
      } catch { /* optional */ }

      const config = loadConfig();
      const client = createOpenAIClient(config.apiKey);

      console.log(`\nUsing resume: ${resumePath}`);
      console.log(`Using bio:    ${bioPath}`);
      console.log(`\nTailoring for ${opts.company}${opts.title ? ` — ${opts.title}` : ''}...`);
      console.log('Generating resume and cover letter in parallel...\n');

      const output = await tailorDocuments(client, config.model, {
        resume,
        bio,
        baseCoverLetter,
        company: opts.company,
        jobTitle: opts.title,
        jobDescription,
      });

      // Write outputs
      if (!existsSync(opts.output)) {
        mkdirSync(opts.output, { recursive: true });
      }
      const slug = slugify(opts.company);
      const resumeOut = join(opts.output, `resume-${slug}.md`);
      const coverLetterOut = join(opts.output, `cover-letter-${slug}.md`);

      writeFileSync(resumeOut, output.resume, 'utf8');
      writeFileSync(coverLetterOut, output.coverLetter, 'utf8');

      console.log(`✓ Tailored resume   → ${resumeOut}`);
      console.log(`✓ Cover letter      → ${coverLetterOut}`);
    });
}
