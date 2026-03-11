import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../config.js';
import { tailorDocuments } from '../lib/tailor.js';
import { findFile, readFile, JOB_SHIT_DIR } from '../lib/files.js';
import { renderResumeHtml, renderCoverLetterHtml, renderPdf } from '../lib/render.js';

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
    .option('-s, --supplemental <file>', 'Supplemental resume file (markdown). Auto-detected if omitted.')
    .option('-t, --title <title>', 'Job title (inferred from JD if omitted)')
    .option('-o, --output <dir>', 'Output directory', 'output')
    .option('-v, --verbose', 'Show per-call AI logging (model, prompt sizes, timing)')
    .action(async (opts: {
      company: string;
      job: string;
      resume?: string;
      bio?: string;
      supplemental?: string;
      title?: string;
      output: string;
      verbose?: boolean;
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

      let resumeSupplemental: string | undefined;
      try {
        const supplementalPath = findFile({ explicit: opts.supplemental, prefix: 'resume-supplemental', label: 'Resume supplemental' });
        resumeSupplemental = readFile(supplementalPath);
      } catch (err) {
        if (opts.supplemental) {
          console.error(`Error: ${(err as Error).message}`);
          process.exit(1);
        }
        /* optional if not explicitly provided */
      }

      const config = loadConfig();

      console.log(`\nUsing resume: ${resumePath}`);
      console.log(`Using bio:    ${bioPath}`);
      console.log(`\nTailoring for ${opts.company}${opts.title ? ` — ${opts.title}` : ''}...`);
      console.log('Generating resume and cover letter in parallel...\n');

      const output = await tailorDocuments(config.model, {
        resume,
        bio,
        baseCoverLetter,
        resumeSupplemental,
        company: opts.company,
        jobTitle: opts.title,
        jobDescription,
      }, opts.verbose);

      // Write outputs
      if (!existsSync(opts.output)) {
        mkdirSync(opts.output, { recursive: true });
      }
      
      const datePrefix = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const slugParts = [opts.company, opts.title].filter(Boolean);
      const slug = `${datePrefix}-${slugify(slugParts.join(' '))}`;
      const resumeOut = join(opts.output, `resume-${slug}.md`);
      const coverLetterOut = join(opts.output, `cover-letter-${slug}.md`);

      writeFileSync(resumeOut, output.resume, 'utf8');
      writeFileSync(coverLetterOut, output.coverLetter, 'utf8');

      const resumeHtmlOut = join(opts.output, `resume-${slug}.html`);
      writeFileSync(resumeHtmlOut, renderResumeHtml(output.resume, `Matthew McKnight - Resume - ${opts.company}`), 'utf8');

      const resumePdfOut = join(opts.output, `resume-${slug}.pdf`);
      await renderPdf(resumeHtmlOut, resumePdfOut);

      const coverLetterHtmlOut = join(opts.output, `cover-letter-${slug}.html`);
      writeFileSync(coverLetterHtmlOut, renderCoverLetterHtml(output.coverLetter, `Matthew McKnight - Cover Letter - ${opts.company}`), 'utf8');

      const coverLetterPdfOut = join(opts.output, `cover-letter-${slug}.pdf`);
      await renderPdf(coverLetterHtmlOut, coverLetterPdfOut);

      console.log(`✓ resume       → ${resumeOut}`);
      console.log(`✓ resume (html)→ ${resumeHtmlOut}`);
      console.log(`✓ resume (pdf) → ${resumePdfOut}`);
      console.log(`✓ cover letter → ${coverLetterOut}`);
      console.log(`✓ cl (html)    → ${coverLetterHtmlOut}`);
      console.log(`✓ cl (pdf)     → ${coverLetterPdfOut}`);
    });
}
