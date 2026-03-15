import { complete as defaultComplete } from '../lib/ai.js';
import { scoringSystemPrompt } from '../lib/prompts.js';
import {
  EvaluatorScorecard,
  HeuristicScorecard,
  PromptOverrides,
  RunScorecard,
  TailorInput,
  TailorOutput,
} from '../types/index.js';

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'among', 'an', 'and', 'any', 'are', 'because',
  'been', 'before', 'being', 'between', 'both', 'build', 'candidate', 'company', 'could', 'each',
  'from', 'have', 'having', 'into', 'just', 'like', 'more', 'must', 'need', 'needs', 'other',
  'role', 'their', 'there', 'these', 'they', 'this', 'those', 'through', 'using', 'with', 'your',
  'you', 'will', 'years',
]);

const AI_OBVIOUS_PATTERNS = [
  /\bresults[- ]driven\b/i,
  /\bseasoned professional\b/i,
  /\bfast-paced environment\b/i,
  /\bleverage\b/i,
  /\bsynergy\b/i,
  /\bpassionate\b/i,
  /\bthrilled\b/i,
  /\bI am writing to express\b/i,
  /\bproven track record\b/i,
  /\bdynamic team\b/i,
];

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function extractKeywords(text: string): string[] {
  const counts = new Map<string, number>();
  const words = text.toLowerCase().match(/[a-z][a-z0-9+#.-]{3,}/g) ?? [];

  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([word]) => word);
}

function countMarkdownBullets(markdown: string): number {
  return (markdown.match(/^\s*[-*]\s+/gm) ?? []).length;
}

function countQuantifiedBullets(markdown: string): number {
  const bullets = markdown.match(/^\s*[-*]\s+.*$/gm) ?? [];
  return bullets.filter((line) => /\b\d+(?:[%+,x]|(?:\.\d+)?\b)/.test(line)).length;
}

function buildHeuristicWarnings(
  input: TailorInput,
  output: TailorOutput,
  matchedKeywords: string[],
  missingKeywords: string[],
  aiObviousnessRisk: number,
): string[] {
  const warnings: string[] = [];

  if (missingKeywords.length >= 8) {
    warnings.push('The tailored resume is missing many high-signal job keywords.');
  }
  if (!output.coverLetter.toLowerCase().includes(input.company.toLowerCase())) {
    warnings.push('The cover letter does not mention the company by name.');
  }
  if (input.jobTitle && !output.coverLetter.toLowerCase().includes(input.jobTitle.toLowerCase())) {
    warnings.push('The cover letter does not mention the specific role title.');
  }
  if (matchedKeywords.length < 5) {
    warnings.push('Keyword overlap is low; ATS matching may be weaker than expected.');
  }
  if (aiObviousnessRisk >= 45) {
    warnings.push('The language includes several phrases that may read as AI-generated or templated.');
  }
  if (countQuantifiedBullets(output.resume) === 0) {
    warnings.push('The tailored resume has no quantified bullets.');
  }

  return warnings;
}

export function buildHeuristicScorecard(input: TailorInput, output: TailorOutput): HeuristicScorecard {
  const jobKeywords = extractKeywords(`${input.jobTitle ?? ''}\n${input.jobDescription}`);
  const resumeLower = output.resume.toLowerCase();
  const coverLetterLower = output.coverLetter.toLowerCase();

  const matchedKeywords = jobKeywords.filter((keyword) => resumeLower.includes(keyword));
  const missingKeywords = jobKeywords.filter((keyword) => !resumeLower.includes(keyword));

  const keywordAlignment = jobKeywords.length === 0
    ? 60
    : (matchedKeywords.length / jobKeywords.length) * 100;

  const bulletCount = countMarkdownBullets(output.resume);
  const quantifiedBullets = countQuantifiedBullets(output.resume);
  const quantifiedImpact = bulletCount === 0
    ? 35
    : (quantifiedBullets / bulletCount) * 100;

  const structureSignals = [
    /^#\s+/m.test(output.resume) ? 30 : 0,
    /^##\s+/m.test(output.resume) ? 25 : 0,
    bulletCount >= 3 ? 25 : bulletCount > 0 ? 15 : 0,
    output.coverLetter.split(/\n\s*\n/).filter(Boolean).length >= 3 ? 20 : 10,
  ];
  const structure = clamp(structureSignals.reduce((sum, value) => sum + value, 0));

  const coverLetterSignals = [
    coverLetterLower.includes(input.company.toLowerCase()) ? 35 : 0,
    input.jobTitle && coverLetterLower.includes(input.jobTitle.toLowerCase()) ? 20 : 10,
    matchedKeywords.slice(0, 5).filter((keyword) => coverLetterLower.includes(keyword)).length * 9,
  ];
  const coverLetterSpecificity = clamp(coverLetterSignals.reduce((sum, value) => sum + value, 0));

  const aiPatternHits = AI_OBVIOUS_PATTERNS.filter((pattern) =>
    pattern.test(output.resume) || pattern.test(output.coverLetter),
  ).length;
  const exclamationPenalty = (output.coverLetter.match(/!/g) ?? []).length * 6;
  const aiObviousnessRisk = clamp(aiPatternHits * 18 + exclamationPenalty);

  const warnings = buildHeuristicWarnings(
    input,
    output,
    matchedKeywords,
    missingKeywords,
    aiObviousnessRisk,
  );

  const overall = clamp(average([
    keywordAlignment,
    quantifiedImpact,
    structure,
    coverLetterSpecificity,
    100 - aiObviousnessRisk,
  ]));

  return {
    overall,
    keywordAlignment: clamp(keywordAlignment),
    quantifiedImpact: clamp(quantifiedImpact),
    structure,
    coverLetterSpecificity,
    aiObviousnessRisk,
    matchedKeywords,
    missingKeywords,
    warnings,
  };
}

function extractJsonObject(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Evaluator did not return a JSON object.');
  }
  return match[0];
}

function parseEvaluatorScorecard(raw: string): EvaluatorScorecard {
  const parsed = JSON.parse(extractJsonObject(raw)) as Partial<EvaluatorScorecard>;
  return {
    overall: clamp(parsed.overall ?? 0),
    atsCompatibility: clamp(parsed.atsCompatibility ?? 0),
    recruiterClarity: clamp(parsed.recruiterClarity ?? 0),
    hrClarity: clamp(parsed.hrClarity ?? 0),
    aiObviousness: clamp(parsed.aiObviousness ?? 0),
    factualRisk: clamp(parsed.factualRisk ?? 0),
    notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
    raw,
  };
}

function scoringUserPrompt(input: TailorInput, output: TailorOutput): string {
  return `## Company
${input.company}

## Job Title
${input.jobTitle ?? '(see job description)'}

## Job Description
${input.jobDescription}

## Candidate Bio
${input.bio}

## Base Resume
${input.resume}

## Supplemental Facts
${input.resumeSupplemental ?? '(none)'}

## Tailored Resume
${output.resume}

## Tailored Cover Letter
${output.coverLetter}`;
}

export async function evaluateScorecard(
  input: TailorInput,
  output: TailorOutput,
  model: string,
  promptOverrides?: PromptOverrides,
  verbose = false,
  complete = defaultComplete,
): Promise<EvaluatorScorecard> {
  const raw = await complete(
    model,
    scoringSystemPrompt(promptOverrides),
    scoringUserPrompt(input, output),
    verbose,
  );
  return parseEvaluatorScorecard(raw);
}

export async function scoreTailoredOutput(args: {
  input: TailorInput;
  output: TailorOutput;
  scoringModel?: string;
  promptOverrides?: PromptOverrides;
  verbose?: boolean;
  complete?: typeof defaultComplete;
}): Promise<RunScorecard> {
  const heuristic = buildHeuristicScorecard(args.input, args.output);

  if (!args.scoringModel) {
    return { heuristic };
  }

  try {
    const evaluator = await evaluateScorecard(
      args.input,
      args.output,
      args.scoringModel,
      args.promptOverrides,
      args.verbose ?? false,
      args.complete ?? defaultComplete,
    );
    return { heuristic, evaluator };
  } catch (error) {
    return {
      heuristic: {
        ...heuristic,
        warnings: [
          ...heuristic.warnings,
          `Evaluator scoring failed: ${(error as Error).message}`,
        ],
      },
    };
  }
}
