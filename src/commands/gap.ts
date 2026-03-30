import { Command } from 'commander';
import { loadConfig } from '../config.js';
import { analyzeGapWithAI } from '../services/gap.js';
import { findFile, TAILORED_DIR, readFile } from '../lib/files.js';
import { GapAnalysis } from '../types/index.js';

const ANSI = {
  cyan: '\x1b[36m',
  dim: '\x1b[90m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  yellow: '\x1b[33m',
};

function fitColor(overallFit: GapAnalysis['overallFit']): string {
  if (overallFit === 'strong') return ANSI.green;
  if (overallFit === 'moderate') return ANSI.yellow;
  return ANSI.red;
}

function formatKeywordList(
  label: string,
  color: string,
  items: string[],
  limit = 10,
): string[] {
  const lines = [`${color}${label}${ANSI.reset}`];

  if (items.length === 0) {
    lines.push(`${ANSI.dim}  (none)${ANSI.reset}`);
    return lines;
  }

  for (const item of items.slice(0, limit)) {
    lines.push(`${color}  - ${item}${ANSI.reset}`);
  }

  if (items.length > limit) {
    lines.push(`${ANSI.dim}  ... ${items.length - limit} more${ANSI.reset}`);
  }

  return lines;
}

export function formatGapAnalysisSummary(analysis: GapAnalysis): string {
  const matched = analysis.matchedKeywords.map((kw) => `${kw.term} [${kw.category}]`);
  const missing = analysis.missingKeywords.map((kw) => `${kw.term} [${kw.category}]`);
  const partial = analysis.partialMatches.map((m) => `${m.jdTerm} <- ${m.resumeTerm} (${m.relationship})`);
  const implied = analysis.impliedSkills.map((s) => `${s.term} [${s.category}] — ${s.rationale}`);
  const experience = analysis.experienceRequirements.map((r) =>
    `${r.skill}: ${r.years}+ years ${r.isRequired ? 'required' : 'preferred'}`);

  return [
    `${ANSI.cyan}Match Gap Analysis${ANSI.reset}`,
    `${fitColor(analysis.overallFit)}Overall fit: ${analysis.overallFit}${ANSI.reset}`,
    ...(analysis.narrative ? [`${ANSI.cyan}Narrative${ANSI.reset}`, `  ${analysis.narrative}`] : []),
    ...formatKeywordList('Matched keywords', ANSI.green, matched),
    ...formatKeywordList('Missing keywords', ANSI.red, missing),
    ...formatKeywordList('Partial matches', ANSI.yellow, partial, 6),
    ...formatKeywordList('Implied skills', ANSI.dim, implied, 6),
    ...formatKeywordList('Experience requirements', ANSI.cyan, experience, 6),
    ...(analysis.exactPhrases.length > 0
      ? formatKeywordList('Exact ATS phrases', ANSI.cyan, analysis.exactPhrases, 10)
      : []),
    ...(analysis.tailoringHints.length > 0
      ? formatKeywordList('Tailoring hints', ANSI.cyan, analysis.tailoringHints, 6)
      : []),
  ].join('\n');
}

export function registerGapCommand(program: Command): void {
  program
    .command('gap')
    .description('Analyze how well your base resume matches a job description before tailoring.')
    .requiredOption('-j, --job <file>', 'Path to job description file (plain text or markdown)')
    .option(
      '-r, --resume <file>',
      `Path to base resume file (markdown). Auto-detected from CWD or ${TAILORED_DIR} if omitted.`,
    )
    .option(
      '-b, --bio <file>',
      `Path to personal bio/background file. Auto-detected from CWD or ${TAILORED_DIR} if omitted.`,
    )
    .option('-t, --title <title>', 'Job title (optional, included in the analysis)')
    .option('-m, --model <model>', 'Model/deployment name')
    .action(async (opts: { job: string; resume?: string; bio?: string; title?: string; model?: string }) => {
      let resumePath: string;

      try {
        resumePath = findFile({ explicit: opts.resume, prefix: 'resume', label: 'Resume' });
      } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
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

      let bio = '';
      try {
        bio = readFile(findFile({ explicit: opts.bio, prefix: 'bio', label: 'Bio' }));
      } catch {
        // bio is optional
      }

      const analysis = await analyzeGapWithAI(
        resume,
        bio,
        jobDescription,
        opts.title,
        opts.model ?? loadConfig().tailoringModel,
      );

      console.log(`\nUsing resume: ${resumePath}`);
      console.log(formatGapAnalysisSummary(analysis));
    });
}
