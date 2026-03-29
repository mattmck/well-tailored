import { complete as defaultComplete } from '../lib/ai.js';
import { gapAnalysisSystemPrompt, gapAnalysisUserPrompt } from '../lib/prompts.js';
import {
  CategorizedKeyword,
  GapAnalysis,
  ImpliedSkill,
  KeywordCategory,
  PartialMatch,
  ExperienceRequirement,
} from '../types/index.js';

// ── JD noise stripping ────────────────────────────────────────────────────

const JD_NOISE_SECTION_HEADINGS = [
  /^equal opportunity\b/i,
  /^eeo\b/i,
  /^benefits\b/i,
  /^compensation\b/i,
  /^pay range\b/i,
  /^salary range\b/i,
  /^privacy\b/i,
  /^applicant privacy\b/i,
  /^reasonable accommodation\b/i,
  /^accommodation\b/i,
];

const JD_NOISE_PATTERNS = [
  /\bequal opportunity\b/i,
  /\ball qualified applicants\b/i,
  /\bdoes not discriminate\b/i,
  /\bsexual orientation\b/i,
  /\bgender identity\b/i,
  /\bnational origin\b/i,
  /\bprotected veteran\b/i,
  /\bveteran status\b/i,
  /\breasonable accommodation\b/i,
  /\bapplicant privacy\b/i,
  /\bprivacy notice\b/i,
  /\bprivacy policy\b/i,
  /\bpersonal data\b/i,
  /\bmedical,?\s+dental,?\s+(?:and\s+)?vision\b/i,
  /\bpaid time off\b/i,
  /\bparental leave\b/i,
  /\b401k\b/i,
  /\bsalary range\b/i,
  /\bpay range\b/i,
  /\bcompensation range\b/i,
  /\bbonus eligible\b/i,
  /\bequity package\b/i,
  /\brace,?\s+color,?\s+religion\b/i,
];

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim().toLowerCase();
}

function isNoiseText(text: string): boolean {
  return JD_NOISE_PATTERNS.some((pattern) => pattern.test(normalize(text)));
}

function stripJobDescriptionNoise(text: string): string {
  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const kept: string[] = [];

  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) continue;

    const heading = lines[0].replace(/^[-*]\s*/, '');
    if (JD_NOISE_SECTION_HEADINGS.some((pattern) => pattern.test(heading)) || isNoiseText(paragraph)) {
      continue;
    }

    const filteredLines = lines.filter((line) => !isNoiseText(line.replace(/^[-*]\s*/, '')));
    if (filteredLines.length > 0) {
      kept.push(filteredLines.join('\n'));
    }
  }

  return kept.join('\n\n');
}

// ── JSON extraction ───────────────────────────────────────────────────────

function extractJsonObject(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gap analysis model did not return a JSON object.');
  return match[0];
}

// ── Response parsing ──────────────────────────────────────────────────────

function validateCategory(cat: unknown): KeywordCategory {
  const valid: KeywordCategory[] = [
    'language', 'framework', 'tool', 'infrastructure', 'architecture',
    'data', 'ai-ml', 'leadership', 'operational', 'security',
    'soft-skill', 'certification', 'other',
  ];
  return valid.includes(cat as KeywordCategory) ? (cat as KeywordCategory) : 'other';
}

function parseKeywordArray(raw: unknown): CategorizedKeyword[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).term === 'string')
    .map((item) => ({
      term: String(item.term),
      category: validateCategory(item.category),
    }));
}

function parseImpliedSkills(raw: unknown): ImpliedSkill[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).term === 'string')
    .map((item) => ({
      term: String(item.term),
      category: validateCategory(item.category),
      rationale: typeof item.rationale === 'string' ? item.rationale : '',
    }));
}

function parsePartialMatches(raw: unknown): PartialMatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null &&
      typeof (item as Record<string, unknown>).jdTerm === 'string' &&
      typeof (item as Record<string, unknown>).resumeTerm === 'string')
    .map((item) => ({
      jdTerm: String(item.jdTerm),
      resumeTerm: String(item.resumeTerm),
      relationship: typeof item.relationship === 'string' ? item.relationship : 'related',
    }));
}

function parseExperienceRequirements(raw: unknown): ExperienceRequirement[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null &&
      typeof (item as Record<string, unknown>).skill === 'string' &&
      typeof (item as Record<string, unknown>).years === 'number')
    .map((item) => ({
      skill: String(item.skill),
      years: Number(item.years),
      isRequired: typeof item.isRequired === 'boolean' ? item.isRequired : true,
    }));
}

function parseOverallFit(raw: unknown): GapAnalysis['overallFit'] {
  if (raw === 'strong' || raw === 'moderate' || raw === 'weak') return raw;
  return 'moderate';
}

// ── AI gap analysis ───────────────────────────────────────────────────────

/**
 * AI-driven gap analysis. The model extracts, classifies, and evaluates
 * keywords in a single pass, including implied skills and exact ATS phrases.
 */
export async function analyzeGapWithAI(
  resume: string,
  bio: string,
  jobDescription: string,
  jobTitle?: string,
  model = 'auto',
  complete: (
    model: string,
    systemPrompt: string,
    userPrompt: string,
    verbose?: boolean,
  ) => Promise<string> = defaultComplete,
): Promise<GapAnalysis> {
  const cleanedJD = stripJobDescriptionNoise(jobDescription);
  // Fall back to raw JD if stripping removed >30% of content (prevents dropping real requirements)
  const jdForPrompt = cleanedJD.length < jobDescription.length * 0.7 ? jobDescription : cleanedJD;
  const raw = await complete(
    model,
    gapAnalysisSystemPrompt(),
    gapAnalysisUserPrompt({ resume, bio, jobDescription: jdForPrompt, jobTitle }),
  );

  const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;

  return {
    matchedKeywords: parseKeywordArray(parsed.matchedKeywords),
    missingKeywords: parseKeywordArray(parsed.missingKeywords),
    partialMatches: parsePartialMatches(parsed.partialMatches),
    impliedSkills: parseImpliedSkills(parsed.impliedSkills),
    experienceRequirements: parseExperienceRequirements(parsed.experienceRequirements),
    overallFit: parseOverallFit(parsed.overallFit),
    narrative: typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '',
    exactPhrases: Array.isArray(parsed.exactPhrases) ? parsed.exactPhrases.map(String) : [],
    tailoringHints: Array.isArray(parsed.tailoringHints) ? parsed.tailoringHints.map(String) : [],
  };
}
