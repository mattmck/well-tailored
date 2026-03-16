import { complete as defaultComplete } from '../lib/ai.js';
import { gapAnalysisSystemPrompt, gapAnalysisUserPrompt } from '../lib/prompts.js';
import {
  CategorizedKeyword,
  EnrichedGapAnalysis,
  ExperienceRequirement,
  GapAnalysis,
  KeywordCategory,
  PartialMatch,
} from '../types/index.js';

// ── Stop words & known-term dictionaries ─────────────────────────────────

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'among', 'an', 'and', 'any', 'are', 'because',
  'been', 'before', 'being', 'between', 'both', 'build', 'candidate', 'company', 'could', 'each',
  'from', 'have', 'having', 'into', 'just', 'like', 'more', 'must', 'need', 'needs', 'other',
  'role', 'their', 'there', 'these', 'they', 'this', 'those', 'through', 'using', 'with', 'your',
  'you', 'will', 'years', 'work', 'working', 'team', 'strong', 'ability', 'able', 'looking',
  'experience', 'position', 'responsibilities', 'requirements', 'qualifications', 'environment',
  'opportunity', 'including', 'across', 'within', 'ensure', 'provide', 'support', 'help',
  'make', 'take', 'well', 'good', 'best', 'high', 'new', 'first', 'part', 'great', 'join',
  'apply', 'what', 'when', 'where', 'which', 'while', 'would', 'should', 'such', 'than',
  'then', 'that', 'very', 'some', 'only', 'over', 'also', 'back', 'most', 'much', 'many',
  'even', 'still', 'here', 'know', 'come', 'want', 'look', 'think', 'keep', 'open', 'find',
]);

/** Short tokens that are legitimate tech terms. */
const SHORT_KEYWORD_TERMS = new Set([
  'ai', 'api', 'aws', 'c#', 'c++', 'ci/cd', 'css', 'etl', 'gcp', 'git', 'go', 'ios', 'k8s',
  'ml', 'qa', 'sre', 'sql', 'tdd', 'ux', 'ui',
]);

const LANGUAGE_TERMS = new Set([
  'bash', 'c#', 'c++', 'css', 'go', 'golang', 'graphql', 'groovy', 'html', 'java', 'javascript',
  'kotlin', 'objective-c', 'perl', 'php', 'powershell', 'python', 'ruby', 'rust', 'scala', 'sql',
  'swift', 'typescript',
]);

const FRAMEWORK_TERMS = new Set([
  '.net', 'angular', 'django', 'ember', 'express', 'fastapi', 'flask', 'gatsby', 'laravel',
  'nestjs', 'next.js', 'nextjs', 'node.js', 'nodejs', 'rails', 'react', 'react.js', 'reactjs',
  'spring', 'spring boot', 'svelte', 'vue', 'vue.js',
]);

const TOOL_TERMS = new Set([
  'ansible', 'cypress', 'datadog', 'docker', 'elasticsearch', 'figma', 'git', 'github',
  'github actions', 'gitlab', 'grafana', 'helm', 'jenkins', 'jira', 'kafka', 'kubernetes',
  'mongodb', 'playwright', 'postgres', 'postgresql', 'prometheus', 'rabbitmq', 'redis', 'selenium',
  'snowflake', 'splunk', 'terraform', 'vite', 'webpack',
]);

const PLATFORM_TERMS = new Set([
  'amazon web services', 'aws', 'azure', 'gcp', 'google cloud', 'google cloud platform', 'heroku',
  'linux', 'netlify', 'unix', 'vercel',
]);

const METHODOLOGY_TERMS = new Set([
  'agile', 'ci/cd', 'continuous integration', 'continuous delivery', 'devops', 'kanban', 'lean',
  'scrum', 'tdd', 'test driven development',
]);

const SOFT_SKILL_TERMS = new Set([
  'coaching', 'collaboration', 'communication', 'cross-functional', 'leadership', 'mentoring',
  'ownership', 'presentation', 'problem solving', 'stakeholder management', 'teamwork',
]);

const SYNONYMS: Record<string, string[]> = {
  aws: ['amazon web services'],
  'amazon web services': ['aws'],
  gcp: ['google cloud', 'google cloud platform'],
  'google cloud': ['gcp', 'google cloud platform'],
  javascript: ['js', 'ecmascript'],
  k8s: ['kubernetes'],
  kubernetes: ['k8s'],
  mongo: ['mongodb'],
  mongodb: ['mongo'],
  node: ['node.js', 'nodejs'],
  'node.js': ['node', 'nodejs'],
  postgres: ['postgresql', 'psql'],
  postgresql: ['postgres', 'psql'],
  react: ['react.js', 'reactjs'],
  'react.js': ['react', 'reactjs'],
  typescript: ['ts'],
};

// ── Helpers ──────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim().toLowerCase();
}

function tokenize(text: string): string[] {
  return (normalize(text).match(/[a-z0-9][a-z0-9+.#/&-]*/g) ?? [])
    .map((t) => t.replace(/[.]+$/, '')); // strip trailing dots (but keep internal ones like "node.js")
}

function isRelevantToken(token: string): boolean {
  return !STOP_WORDS.has(token) && (token.length >= 4 || SHORT_KEYWORD_TERMS.has(token));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(text: string, term: string): boolean {
  if (!text || !term) return false;
  const escaped = escapeRegExp(normalize(term)).replace(/\\ /g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=[^a-z0-9]|$)`, 'i').test(normalize(text));
}

function extractJsonObject(raw: string): string {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gap analysis model did not return a JSON object.');
  return match[0];
}

// ── Categorization ───────────────────────────────────────────────────────

/**
 * Categorize a keyword/phrase. Only returns a specific category for terms
 * that are actually in the known dictionaries — everything else is 'other'.
 */
export function categorizeKeyword(term: string): CategorizedKeyword {
  const n = normalize(term);

  if (LANGUAGE_TERMS.has(n)) return { term, category: 'language' };
  if (FRAMEWORK_TERMS.has(n)) return { term, category: 'framework' };
  if (TOOL_TERMS.has(n)) return { term, category: 'tool' };
  if (PLATFORM_TERMS.has(n)) return { term, category: 'platform' };
  if (METHODOLOGY_TERMS.has(n)) return { term, category: 'methodology' };
  if (SOFT_SKILL_TERMS.has(n)) return { term, category: 'soft-skill' };
  if (/certif|license|certified/.test(n)) return { term, category: 'certification' };

  return { term, category: 'other' };
}

// ── Heuristic extraction (fallback for --no-ai) ─────────────────────────

/**
 * Extract meaningful keywords from text. Returns only terms that match a
 * known tech category OR appear 2+ times as a multi-word phrase.
 * Capped at 30 terms max.
 */
export function extractPhrases(text: string): string[] {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();

  // Single tokens
  for (const token of tokens) {
    if (!isRelevantToken(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  // Bigrams and trigrams
  for (let i = 0; i < tokens.length; i++) {
    for (let width = 2; width <= 3; width++) {
      const slice = tokens.slice(i, i + width);
      if (slice.length !== width || slice.some((t) => STOP_WORDS.has(t) && !SHORT_KEYWORD_TERMS.has(t))) continue;
      const phrase = slice.join(' ');
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }

  // Deduplicate: drop single words that are part of a kept phrase
  const wordsInPhrases = new Set<string>();
  for (const term of counts.keys()) {
    if (!term.includes(' ')) continue;
    for (const part of term.split(' ')) wordsInPhrases.add(part);
  }

  // Filter: keep known-category terms, or phrases with 2+ occurrences
  return [...counts.entries()]
    .filter(([term, count]) => {
      const category = categorizeKeyword(term).category;
      // Always keep terms we can categorize as something specific
      if (category !== 'other') return true;
      // Keep multi-word phrases that appear 2+ times (likely real requirements)
      if (term.includes(' ') && count >= 2) return true;
      // Drop low-frequency 'other' single words — this is where the 993 noise lived
      return false;
    })
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 30)
    .map(([term]) => term);
}

/**
 * Extract years-of-experience requirements from a job description.
 */
export function extractExperienceRequirements(jobDescription: string): ExperienceRequirement[] {
  const requirements: ExperienceRequirement[] = [];
  const pattern = /(\d+)(?:\s*-\s*\d+)?\+?\s*years?\s+(?:of\s+)?(?:experience\s+)?(?:(?:with|in)\s+)?([A-Za-z0-9+#./&,\- ]{2,60})/gi;
  const preferredPattern = /\b(preferred|nice to have|ideally|bonus)\b/i;
  const requiredPattern = /\b(required|must have|minimum|at least)\b/i;
  const seen = new Set<string>();

  for (const line of jobDescription.split(/\n/)) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(line)) !== null) {
      const years = parseInt(match[1], 10);
      if (!Number.isFinite(years)) continue;

      const skill = match[2].replace(/\b(experience|skills?|required|preferred)\b/gi, '').trim();
      if (!skill) continue;

      const key = `${normalize(skill)}:${years}`;
      if (seen.has(key)) continue;
      seen.add(key);

      requirements.push({
        skill,
        years,
        isRequired: preferredPattern.test(line) ? false : requiredPattern.test(line) || true,
      });
    }
  }

  return requirements;
}

/**
 * Heuristic gap analysis — fallback when AI is unavailable.
 * Only surfaces known-category terms, capped at 30.
 */
export function analyzeGap(
  resume: string,
  jobDescription: string,
  jobTitle?: string,
): GapAnalysis {
  const jdTerms = extractPhrases(`${jobTitle ?? ''}\n${jobDescription}`);
  const resumeTerms = extractPhrases(resume);
  const resumeText = normalize(resume);
  const matchedKeywords: CategorizedKeyword[] = [];
  const missingKeywords: CategorizedKeyword[] = [];
  const partialMatches: PartialMatch[] = [];
  const partialSeen = new Set<string>();

  for (const term of jdTerms) {
    const keyword = categorizeKeyword(term);

    if (containsTerm(resumeText, term)) {
      matchedKeywords.push(keyword);
      continue;
    }

    // Check synonyms
    const normalizedTerm = normalize(term);
    const synonyms = SYNONYMS[normalizedTerm] ?? [];
    let foundPartial = false;

    for (const syn of synonyms) {
      if (containsTerm(resumeText, syn)) {
        const key = `${normalizedTerm}::${normalize(syn)}`;
        if (!partialSeen.has(key)) {
          partialSeen.add(key);
          partialMatches.push({ jdTerm: term, resumeTerm: syn, relationship: 'synonym' });
        }
        foundPartial = true;
        break;
      }
    }

    // Check substring matches against resume terms
    if (!foundPartial) {
      for (const rTerm of resumeTerms) {
        const nr = normalize(rTerm);
        if (nr.includes(normalizedTerm) || normalizedTerm.includes(nr)) {
          const key = `${normalizedTerm}::${nr}`;
          if (!partialSeen.has(key)) {
            partialSeen.add(key);
            partialMatches.push({ jdTerm: term, resumeTerm: rTerm, relationship: 'subset match' });
          }
          foundPartial = true;
          break;
        }
      }
    }

    if (!foundPartial) {
      missingKeywords.push(keyword);
    }
  }

  const total = jdTerms.length;
  const matchRatio = total === 0 ? 0 : matchedKeywords.length / total;
  const overallFit = matchRatio >= 0.7 ? 'strong' : matchRatio >= 0.4 ? 'moderate' : 'weak';

  return {
    matchedKeywords,
    missingKeywords,
    partialMatches,
    experienceRequirements: extractExperienceRequirements(jobDescription),
    overallFit,
  };
}

// ── AI-driven gap analysis (primary path) ────────────────────────────────

function validateCategory(cat: unknown): KeywordCategory {
  const valid: KeywordCategory[] = [
    'language', 'framework', 'tool', 'platform',
    'soft-skill', 'certification', 'methodology', 'other',
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

/**
 * AI-driven gap analysis. The model extracts, classifies, and evaluates
 * keywords in a single pass — no heuristic extraction needed.
 *
 * Falls back to heuristic analysis if the AI call fails.
 */
export async function analyzeGapWithAI(
  resume: string,
  bio: string,
  jobDescription: string,
  jobTitle?: string,
  model = 'auto',
  complete = defaultComplete,
): Promise<EnrichedGapAnalysis> {
  try {
    const raw = await complete(
      model,
      gapAnalysisSystemPrompt(),
      gapAnalysisUserPrompt({ resume, bio, jobDescription, jobTitle }),
    );

    const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;

    return {
      matchedKeywords: parseKeywordArray(parsed.matchedKeywords),
      missingKeywords: parseKeywordArray(parsed.missingKeywords),
      partialMatches: parsePartialMatches(parsed.partialMatches),
      experienceRequirements: parseExperienceRequirements(parsed.experienceRequirements),
      overallFit: parseOverallFit(parsed.overallFit),
      narrative: typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '',
      tailoringHints: Array.isArray(parsed.tailoringHints) ? parsed.tailoringHints.map(String) : [],
    };
  } catch (error) {
    // Fall back to heuristic if AI fails
    const heuristic = analyzeGap(resume, jobDescription, jobTitle);
    return {
      ...heuristic,
      narrative: `AI analysis unavailable: ${(error as Error).message}. Showing heuristic results.`,
      tailoringHints: [],
    };
  }
}
