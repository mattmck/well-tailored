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

// ── Keyword grounding ─────────────────────────────────────────────────────

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Normalize a term for fuzzy substring comparison against JD text.
// Lowercase, strip punctuation, collapse whitespace, drop common suffixes.
function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/\.js\b/g, '')
    // Remove everything except unicode letters (\p{L}), numbers (\p{N}),
    // whitespace, +, #, and / so terms like C++, C#, and CI/CD stay distinguishable.
    .replace(/[^\p{L}\p{N}\s+#/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common aliases / expansions the LLM might use that don't substring-match the JD.
const RAW_TERM_ALIASES: Record<string, string[]> = {
  'k8s': ['kubernetes'],
  'kubernetes': ['k8s'],
  'gcp': ['google cloud', 'google cloud platform'],
  'aws': ['amazon web services'],
  'ci/cd': ['ci cd', 'cicd', 'continuous integration', 'continuous delivery', 'continuous deployment'],
  'postgres': ['postgresql'],
  'postgresql': ['postgres'],
  'node': ['nodejs', 'node.js'],
  'typescript': ['ts'],
  'javascript': ['js'],
};

// Build bidirectional alias map: both term→aliases and alias→term entries
const TERM_ALIASES: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [term, aliases] of Object.entries(RAW_TERM_ALIASES)) {
    const normalizedTerm = normalizeTerm(term);
    const normalizedAliases = aliases
      .map((alias) => normalizeTerm(alias))
      .filter((alias) => alias.length > 0);

    // term → aliases
    map[normalizedTerm] = normalizedAliases;

    // each alias → [term]
    for (const alias of normalizedAliases) {
      if (!map[alias]) map[alias] = [];
      if (!map[alias].includes(normalizedTerm)) {
        map[alias].push(normalizedTerm);
      }
    }
  }
  return map;
})();

function termAppearsInJd(term: string, jdNormalized: string): boolean {
  const normalized = normalizeTerm(term);
  if (!normalized) return false;

  // Helper: check if a term matches with word boundaries
  const matchesWithBoundary = (checkTerm: string): boolean => {
    const tokens = checkTerm.split(' ').filter((t) => t.length > 0);
    if (tokens.length === 1) {
      // Single token: use word boundary check
      const regex = new RegExp(`\\b${escapeRegExp(tokens[0])}\\b`);
      return regex.test(jdNormalized);
    } else {
      // Multi-word: each token must match as whole word
      return tokens.every((token) => {
        const regex = new RegExp(`\\b${escapeRegExp(token)}\\b`);
        return regex.test(jdNormalized);
      });
    }
  };

  // Check direct match
  if (matchesWithBoundary(normalized)) return true;

  // Check aliases
  const aliases = TERM_ALIASES[normalized];
  if (aliases?.some((alias) => matchesWithBoundary(alias))) return true;

  return false;
}

// Drops keywords the LLM hallucinated or pulled from the bio. Every JD-referenced
// term must actually appear in the JD text (post-normalization). Returns a new
// gap object plus counts of what was filtered for logging.
function filterToJdGroundedKeywords(
  gap: GapAnalysis,
  jobDescription: string,
): { gap: GapAnalysis; dropped: { matched: string[]; missing: string[]; partial: string[] } } {
  const jdNormalized = normalizeTerm(jobDescription);

  const dropped = { matched: [] as string[], missing: [] as string[], partial: [] as string[] };

  const matchedKeywords = gap.matchedKeywords.filter((kw) => {
    const keep = termAppearsInJd(kw.term, jdNormalized);
    if (!keep) dropped.matched.push(kw.term);
    return keep;
  });
  const missingKeywords = gap.missingKeywords.filter((kw) => {
    const keep = termAppearsInJd(kw.term, jdNormalized);
    if (!keep) dropped.missing.push(kw.term);
    return keep;
  });
  const partialMatches = gap.partialMatches.filter((pm) => {
    const keep = termAppearsInJd(pm.jdTerm, jdNormalized);
    if (!keep) dropped.partial.push(pm.jdTerm);
    return keep;
  });

  return {
    gap: { ...gap, matchedKeywords, missingKeywords, partialMatches },
    dropped,
  };
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

  const rawGap: GapAnalysis = {
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

  const { gap, dropped } = filterToJdGroundedKeywords(rawGap, jdForPrompt);
  const totalDropped = dropped.matched.length + dropped.missing.length + dropped.partial.length;
  if (totalDropped > 0) {
    console.info('[gap] Dropped ungrounded keywords not present in JD', {
      totalDropped,
      matchedCount: dropped.matched.length,
      missingCount: dropped.missing.length,
      partialCount: dropped.partial.length,
    });
  }
  return gap;
}