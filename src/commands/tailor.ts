import { Command } from 'commander';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { loadConfig } from '../config.js';
import { createOpenAIClient } from '../lib/ai.js';
import { tailorDocuments } from '../lib/tailor.js';

function readFile(filePath: string): string {
  return readFileSync(resolve(filePath), 'utf8').trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
    .option('-r, --resume <file>', 'Path to base resume file (markdown)', 'resume.md')
    .option('-b, --bio <file>', 'Path to personal bio/background file', 'bio.md')
    .option('-t, --title <title>', 'Job title (inferred from JD if omitted)')
    .option('-o, --output <dir>', 'Output directory', 'output')
    .action(async (opts: {
      company: string;
      job: string;
      resume: string;
      bio: string;
      title?: string;
      output: string;
    }) => {
      // Load and validate inputs
      let resume: string;
      let bio: string;
      let jobDescription: string;

      try {
        resume = readFile(opts.resume);
      } catch {
        console.error(`Error: Could not read resume file: ${opts.resume}`);
        console.error('Create a resume.md in the current directory, or pass --resume <file>.');
        process.exit(1);
      }

      try {
        bio = readFile(opts.bio);
      } catch {
        console.error(`Error: Could not read bio file: ${opts.bio}`);
        console.error('Create a bio.md in the current directory, or pass --bio <file>.');
        process.exit(1);
      }

      try {
        jobDescription = readFile(opts.job);
      } catch {
        console.error(`Error: Could not read job description file: ${opts.job}`);
        process.exit(1);
      }

      const config = loadConfig();
      const client = createOpenAIClient(config.openaiApiKey);

      console.log(`\nTailoring for ${opts.company}${opts.title ? ` — ${opts.title}` : ''}...`);
      console.log('Generating resume and cover letter in parallel...\n');

      const output = await tailorDocuments(client, config.openaiModel, {
        resume,
        bio,
        company: opts.company,
        jobTitle: opts.title,
        jobDescription,
      });

      // Write outputs
      if (!existsSync(opts.output)) {
        mkdirSync(opts.output, { recursive: true });
      }
      const slug = slugify(opts.company);
      const resumePath = join(opts.output, `resume-${slug}.md`);
      const clPath = join(opts.output, `cover-letter-${slug}.md`);

      writeFileSync(resumePath, output.resume, 'utf8');
      writeFileSync(clPath, output.coverLetter, 'utf8');

      console.log(`✓ Tailored resume   → ${resumePath}`);
      console.log(`✓ Cover letter      → ${clPath}`);
    });
}
