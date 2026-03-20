import { Command } from 'commander';
import { loadConfig } from '../config.js';
import { analyzeGap, analyzeGapWithAI } from '../services/gap.js';
import { findFile, TAILORED_DIR, readFile } from '../lib/files.js';
import { EnrichedGapAnalysis, GapAnalysis } from '../types/index.js';

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

export function formatGapAnalysisSummary(
  analysis: GapAnalysis | EnrichedGapAnalysis,
): string {
  const matched = analysis.matchedKeywords.map((keyword) => `${keyword.term} [${keyword.category}]`);
  const missing = analysis.missingKeywords.map((keyword) => `${keyword.term} [${keyword.category}]`);
  const partial = analysis.partialMatches.map((match) =>
    `${match.jdTerm} <- ${match.resumeTerm} (${match.relationship})`);
  const experience = analysis.experienceRequirements.map((requirement) =>
    `${requirement.skill}: ${requirement.years}+ years ${requirement.isRequired ? 'required' : 'preferred'}`);
  const narrative = 'narrative' in analysis && analysis.narrative
    ? [`${ANSI.cyan}Narrative${ANSI.reset}`, `  ${analysis.narrative}`]
    : [];
  const hints = 'tailoringHints' in analysis && analysis.tailoringHints.length > 0
    ? formatKeywordList('Tailoring hints', ANSI.cyan, analysis.tailoringHints, 6)
    : [];

  return [
    `${ANSI.cyan}Match Gap Analysis${ANSI.reset}`,
    `${fitColor(analysis.overallFit)}Overall fit: ${analysis.overallFit}${ANSI.reset}`,
    ...narrative,
    ...formatKeywordList('Matched keywords', ANSI.green, matched),
    ...formatKeywordList('Missing keywords', ANSI.red, missing),
    ...formatKeywordList('Partial matches', ANSI.yellow, partial, 6),
    ...formatKeywordList('Experience requirements', ANSI.cyan, experience, 6),
    ...hints,
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
      `Path to personal bio/background file. Auto-detected from CWD or ${TAILORED_DIR} if omitted when --ai is used.`,
    )
    .option('-t, --title <title>', 'Job title (optional, included in the analysis)')
    .option('--ai', 'Use AI to add a narrative summary and tailoring hints')
    .option('-m, --model <model>', 'Model/deployment name for AI-enriched gap analysis')
    .action(async (opts: { job: string; resume?: string; bio?: string; title?: string; ai?: boolean; model?: string }) => {
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
      if (opts.ai) {
        try {
          bio = readFile(findFile({ explicit: opts.bio, prefix: 'bio', label: 'Bio' }));
        } catch (error) {
          console.error(`Error: ${(error as Error).message}`);
          process.exit(1);
        }
      }

      const analysis = opts.ai
        ? await analyzeGapWithAI(
          resume,
          bio,
          jobDescription,
          opts.title,
          opts.model ?? loadConfig().tailoringModel,
        )
        : analyzeGap(resume, jobDescription, opts.title);

      console.log(`\nUsing resume: ${resumePath}`);
      console.log(formatGapAnalysisSummary(analysis));
    });
}
