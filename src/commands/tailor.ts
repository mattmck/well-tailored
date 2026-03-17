import { Command } from 'commander';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../config.js';
import { formatGapAnalysisSummary } from './gap.js';
import { formatDiffAnsi, diffMarkdown } from '../lib/diff.js';
import { tailorDocuments } from '../lib/tailor.js';
import { logUsingEntries } from '../lib/logging.js';
import { describeProvider } from '../lib/ai.js';
import { withSpinner } from '../lib/spinner.js';
import { findFile, readFile, JOB_SHIT_DIR } from '../lib/files.js';
import { renderResumeHtml, renderCoverLetterHtml, renderPdf, renderResumePdfFit } from '../lib/render.js';
import { analyzeGapWithAI } from '../services/gap.js';
import { launchReviewTui } from '../tui/review.js';

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
    .option('-m, --model <model>', 'Model/deployment name (e.g. gpt-4o, claude-opus-4-5). Default: auto — uses provider default')
    .option('--pdf', 'Generate PDF output (requires Chrome — run `npm run setup` first)')
    .option('--diff', 'Show a colorized diff between the base resume and the tailored resume')
    .option('--interactive', 'Open review mode after generation before writing the final resume')
    .option('--no-gap', 'Skip the pre-tailor match gap analysis summary')
    .action(async (opts: {
      company: string;
      job: string;
      resume?: string;
      bio?: string;
      supplemental?: string;
      title?: string;
      output: string;
      verbose?: boolean;
      model?: string;
      pdf?: boolean;
      diff?: boolean;
      interactive?: boolean;
      gap?: boolean;
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
      let coverLetterPath: string | undefined;
      try {
        coverLetterPath = findFile({ prefix: 'cover-letter', label: 'Cover letter' });
        baseCoverLetter = readFile(coverLetterPath);
      } catch { /* optional */ }

      let resumeSupplemental: string | undefined;
      let supplementalPath: string | undefined;
      try {
        supplementalPath = findFile({ explicit: opts.supplemental, prefix: 'resume-supplemental', label: 'Resume supplemental' });
        resumeSupplemental = readFile(supplementalPath);
      } catch (err) {
        if (opts.supplemental) {
          console.error(`Error: ${(err as Error).message}`);
          process.exit(1);
        }
        /* optional if not explicitly provided */
      }

      const config = loadConfig();
      const model = opts.model ?? config.model;

      logUsingEntries([
        { label: 'resume:', value: resumePath },
        { label: 'bio:', value: bioPath },
        { label: 'cover letter:', value: coverLetterPath },
        { label: 'supplemental:', value: supplementalPath },
        { label: 'AI:', value: describeProvider(model) },
      ]);
      if (opts.gap !== false) {
        const gapAnalysis = await analyzeGapWithAI(
          resume,
          bio,
          jobDescription,
          opts.title,
          model,
        );
        console.log('');
        console.log(formatGapAnalysisSummary(gapAnalysis));
      }
      console.log(`\nTailoring for ${opts.company}${opts.title ? ` — ${opts.title}` : ''}...`);
      console.log('Generating resume and cover letter in parallel...\n');

      const output = await withSpinner('generating', () => tailorDocuments(model, {
        resume,
        bio,
        baseCoverLetter,
        resumeSupplemental,
        company: opts.company,
        jobTitle: opts.title,
        jobDescription,
      }, opts.verbose));

      let finalResume = output.resume;
      if (opts.interactive) {
        console.log('Launching review mode. Press q when you are ready to write the final resume.\n');
        try {
          finalResume = await launchReviewTui({
            baseResume: resume,
            resume: output.resume,
            bio,
            company: opts.company,
            jobTitle: opts.title,
            jobDescription,
            model,
          });
        } catch (err) {
          console.error(`Review TUI error: ${err instanceof Error ? err.message : String(err)}`);
          console.log('Using unreviewed resume output.');
        }
      }

      // Write outputs
      if (!existsSync(opts.output)) {
        mkdirSync(opts.output, { recursive: true });
      }
      
      const slugParts = [opts.company, opts.title].filter(Boolean);
      const slug = slugify(slugParts.join(' '));
      const resumeOut = join(opts.output, `resume-${slug}.md`);
      const coverLetterOut = join(opts.output, `cover-letter-${slug}.md`);

      writeFileSync(resumeOut, finalResume, 'utf8');
      writeFileSync(coverLetterOut, output.coverLetter, 'utf8');

      const resumeHtmlOut = join(opts.output, `resume-${slug}.html`);
      const coverLetterHtmlOut = join(opts.output, `cover-letter-${slug}.html`);
      writeFileSync(resumeHtmlOut, renderResumeHtml(finalResume, `Resume - ${opts.company}`), 'utf8');
      writeFileSync(coverLetterHtmlOut, renderCoverLetterHtml(output.coverLetter, `Cover Letter - ${opts.company}`), 'utf8');

      console.log(`✓ resume       → ${resumeOut}`);
      console.log(`✓ resume (html)→ ${resumeHtmlOut}`);
      console.log(`✓ cover letter → ${coverLetterOut}`);
      console.log(`✓ cl (html)    → ${coverLetterHtmlOut}`);

      if (opts.pdf) {
        const resumePdfOut = join(opts.output, `resume-${slug}.pdf`);
        try {
          const fit = await renderResumePdfFit(finalResume, `Resume - ${opts.company}`, resumeHtmlOut, resumePdfOut);
          console.log(`✓ resume (pdf) → ${resumePdfOut}${fit ? '' : ' (compact: still >1 page)'}`);
        } catch (err) {
          console.warn(`⚠ PDF generation skipped: ${(err as Error).message}`);
          console.warn('  Run `npm run setup` to check Chrome prerequisites.');
        }

        const coverLetterPdfOut = join(opts.output, `cover-letter-${slug}.pdf`);
        try {
          await renderPdf(coverLetterHtmlOut, coverLetterPdfOut);
          console.log(`✓ cl (pdf)     → ${coverLetterPdfOut}`);
        } catch (err) {
          console.warn(`⚠ PDF generation skipped: ${(err as Error).message}`);
        }
      }

      if (opts.diff) {
        const diff = diffMarkdown(resume, finalResume);
        console.log('');
        console.log(`Diff summary: +${diff.stats.added} / -${diff.stats.removed} / =${diff.stats.unchanged}`);
        console.log(formatDiffAnsi(diff));
      }
    });
}
