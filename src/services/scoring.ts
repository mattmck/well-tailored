import { complete as defaultComplete } from '../lib/ai.js';
import { scoringSystemPrompt } from '../lib/prompts.js';
import {
  EvaluatorDocumentScorecard,
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

function asOptionalScore(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? clamp(num) : undefined;
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

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return trimmed;
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  throw new Error('Evaluator did not return JSON.');
}

function normalizeDocumentName(value: unknown, fallback: string): string {
  const raw = String(value ?? fallback).trim();
  const normalized = raw.toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'resume') return 'resume';
  if (normalized === 'cover letter' || normalized === 'coverletter') return 'cover letter';
  return raw || fallback;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function parseDocumentScorecard(
  parsed: Record<string, unknown>,
  index: number,
): EvaluatorDocumentScorecard {
  const fallbackDocument = index === 0 ? 'resume' : index === 1 ? 'cover letter' : `document ${index + 1}`;
  return {
    document: normalizeDocumentName(parsed.document, fallbackDocument),
    overall: clamp(Number(parsed.overall ?? 0)),
    atsCompatibility: asOptionalScore(parsed.atsCompatibility),
    keywordCoverage: asOptionalScore(parsed.keywordCoverage),
    recruiterClarity: asOptionalScore(parsed.recruiterClarity),
    hrClarity: asOptionalScore(parsed.hrClarity),
    hiringMgrClarity: asOptionalScore(parsed.hiringMgrClarity),
    tailoringAlignment: asOptionalScore(parsed.tailoringAlignment),
    completionReadiness: asOptionalScore(parsed.completionReadiness),
    evidenceStrength: asOptionalScore(parsed.evidenceStrength),
    aiObviousness: asOptionalScore(parsed.aiObviousness),
    factualRisk: asOptionalScore(parsed.factualRisk),
    confidence: asOptionalScore(parsed.confidence),
    verdict: parsed.verdict ? String(parsed.verdict) : undefined,
    blockingIssues: coerceStringArray(parsed.blockingIssues),
    notes: coerceStringArray(parsed.notes),
  };
}

function primaryDocumentSummary(documents: EvaluatorDocumentScorecard[]): EvaluatorDocumentScorecard | undefined {
  return documents.find((doc) => doc.document.toLowerCase() === 'resume') ?? documents[0];
}

function legacyDocumentFromObject(parsed: Record<string, unknown>): EvaluatorDocumentScorecard {
  return parseDocumentScorecard({
    document: 'review',
    ...parsed,
  }, 0);
}

function parseEvaluatorScorecard(raw: string): EvaluatorScorecard {
  const payload = JSON.parse(extractJsonPayload(raw)) as unknown;
  const documents = Array.isArray(payload)
    ? payload
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .map((entry, index) => parseDocumentScorecard(entry, index))
    : (typeof payload === 'object' && payload !== null
      ? [legacyDocumentFromObject(payload as Record<string, unknown>)]
      : []);

  if (documents.length === 0) {
    throw new Error('Evaluator returned no score documents.');
  }

  const primary = primaryDocumentSummary(documents);

  // Merge notes and blockingIssues from all documents
  const allNotes: string[] = [];
  const allBlockingIssues: string[] = [];
  for (const doc of documents) {
    if (doc.notes) allNotes.push(...doc.notes);
    if (doc.blockingIssues) allBlockingIssues.push(...doc.blockingIssues);
  }
  // Deduplicate by converting to Set and back
  const uniqueNotes = Array.from(new Set(allNotes));
  const uniqueBlockingIssues = Array.from(new Set(allBlockingIssues));

  return {
    overall: primary?.overall,
    atsCompatibility: primary?.atsCompatibility,
    keywordCoverage: primary?.keywordCoverage,
    recruiterClarity: primary?.recruiterClarity,
    hrClarity: primary?.hrClarity,
    hiringMgrClarity: primary?.hiringMgrClarity,
    tailoringAlignment: primary?.tailoringAlignment,
    completionReadiness: primary?.completionReadiness,
    evidenceStrength: primary?.evidenceStrength,
    aiObviousness: primary?.aiObviousness,
    factualRisk: primary?.factualRisk,
    confidence: primary?.confidence,
    verdict: primary?.verdict,
    blockingIssues: uniqueBlockingIssues,
    notes: uniqueNotes,
    documents,
    raw,
  };
}

function stripHtmlComments(text: string): string {
  let previous: string;
  do {
    previous = text;
    text = text.replace(/<!--[\s\S]*?-->/g, '');
  } while (text !== previous);
  return text.replace(/\n{3,}/g, '\n\n').trim();
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
${stripHtmlComments(input.resume)}

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
