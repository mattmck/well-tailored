import type {
  GapAnalysis,
  Scorecard,
  ScorecardCategory,
  ScorecardDocument,
  TailorResult,
} from '@/types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function slugify(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'document';
}

function formatDocumentLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Document';
  const normalized = trimmed.toLowerCase();
  if (normalized === 'coverletter' || normalized === 'cover letter') return 'Cover Letter';
  if (normalized === 'resume') return 'Resume';
  return trimmed.replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildCategory(
  name: string,
  score: unknown,
  summary: string,
  issues: string[] = [],
): ScorecardCategory {
  return {
    name,
    score: asNumber(score),
    weight: 1,
    summary,
    issues,
  };
}

const METRIC_DEFINITIONS = [
  {
    key: 'atsCompatibility',
    label: 'ATS Compatibility',
    fallback: 'Applicant tracking systems should be able to read the structure cleanly.',
  },
  {
    key: 'keywordCoverage',
    label: 'Keyword Coverage',
    fallback: 'The language should mirror the role requirements and terminology.',
  },
  {
    key: 'recruiterClarity',
    label: 'Recruiter Clarity',
    fallback: 'A recruiter should understand the fit quickly.',
  },
  {
    key: 'hrClarity',
    label: 'HR Clarity',
    fallback: 'The narrative should stay easy to evaluate for non-technical reviewers.',
  },
  {
    key: 'hiringMgrClarity',
    label: 'Hiring Manager Clarity',
    fallback: 'Technical relevance and ownership should read clearly.',
  },
  {
    key: 'tailoringAlignment',
    label: 'Tailoring Alignment',
    fallback: 'The content should feel specific to this role and company.',
  },
  {
    key: 'completionReadiness',
    label: 'Completion Readiness',
    fallback: 'The document should be close to ready for submission.',
  },
  {
    key: 'evidenceStrength',
    label: 'Evidence Strength',
    fallback: 'Claims should be backed up with outcomes and concrete proof.',
  },
  {
    key: 'aiObviousness',
    label: 'AI Obviousness',
    fallback: 'The writing should feel specific, credible, and human.',
  },
  {
    key: 'factualRisk',
    label: 'Factual Risk',
    fallback: 'The content should avoid sounding embellished or unverifiable.',
  },
] as const;

function buildMetricCategories(
  source: Record<string, unknown>,
  notes: string[],
  blockingIssues: string[] = [],
): ScorecardCategory[] {
  return METRIC_DEFINITIONS
    .filter((definition) => typeof source[definition.key] === 'number')
    .map((definition, index) =>
      buildCategory(
        definition.label,
        source[definition.key],
        notes[index] ?? definition.fallback,
        index === 0 ? blockingIssues : [],
      ),
    );
}

function normalizeHeuristicScorecard(heuristic: Record<string, unknown>): Scorecard | undefined {
  if (typeof heuristic.overall !== 'number') return undefined;

  const warnings = asStringArray(heuristic.warnings);
  const categories = [
    buildCategory(
      'Keyword Alignment',
      heuristic.keywordAlignment,
      'How much high-signal role language appears in the tailored resume.',
      warnings,
    ),
    buildCategory(
      'Quantified Impact',
      heuristic.quantifiedImpact,
      'How consistently resume bullets include measurable outcomes.',
    ),
    buildCategory(
      'Structure',
      heuristic.structure,
      'How cleanly the draft is organized for review and parsing.',
    ),
    buildCategory(
      'Cover Letter Specificity',
      heuristic.coverLetterSpecificity,
      'How specifically the cover letter connects to the company and role.',
    ),
    buildCategory(
      'AI Obviousness',
      typeof heuristic.aiObviousnessRisk === 'number' ? 100 - heuristic.aiObviousnessRisk : undefined,
      'How much the writing avoids generic or templated language.',
    ),
  ].filter((category) => category.score > 0);
  const overall = asNumber(heuristic.overall);
  const summary = warnings[0] ?? 'Heuristic score generated from the tailored draft.';

  return {
    overall,
    verdict: '',
    confidence: 0,
    summary,
    categories,
    documents: [
      buildDocumentFallback(
        'Resume',
        overall,
        summary,
        categories,
        warnings,
      ),
    ],
    notes: warnings,
    blockingIssues: [],
  };
}

function normalizeCategory(value: unknown, index: number): ScorecardCategory | null {
  const category = asRecord(value);
  if (!category) return null;

  return {
    name: asString(category.name, `Category ${index + 1}`),
    score: asNumber(category.score),
    weight: asNumber(category.weight, 1),
    summary: asString(category.summary),
    issues: asStringArray(category.issues),
  };
}

function buildDocumentFallback(
  label: string,
  overall: number,
  summary: string,
  categories: ScorecardCategory[],
  notes: string[] = [],
  blockingIssues: string[] = [],
  verdict = '',
  confidence = 0,
): ScorecardDocument {
  return {
    id: slugify(label),
    label,
    overall,
    verdict,
    confidence,
    summary,
    categories,
    notes,
    blockingIssues,
  };
}

function normalizeDocument(value: unknown, index: number): ScorecardDocument | null {
  const document = asRecord(value);
  if (!document) return null;

  const label = formatDocumentLabel(asString(document.label) || asString(document.document, `Document ${index + 1}`));
  const notes = asStringArray(document.notes);
  const blockingIssues = asStringArray(document.blockingIssues);
  const explicitCategories = Array.isArray(document.categories)
    ? document.categories
        .map((category, categoryIndex) => normalizeCategory(category, categoryIndex))
        .filter((category): category is ScorecardCategory => category !== null)
    : [];
  const categories = explicitCategories.length > 0
    ? explicitCategories
    : buildMetricCategories(document, notes, blockingIssues);

  return {
    id: asString(document.id, slugify(label)),
    label,
    overall: asNumber(document.overall),
    verdict: asString(document.verdict),
    confidence: asNumber(document.confidence),
    summary: asString(document.summary) || notes[0] || 'Loaded from a saved workspace.',
    categories,
    notes,
    blockingIssues,
  };
}

export function normalizeScorecard(value: unknown): Scorecard | undefined {
  const scorecard = asRecord(value);
  if (!scorecard) return undefined;

  if (typeof scorecard.overall === 'number' && Array.isArray(scorecard.categories)) {
    const categories = scorecard.categories
      .map((category, index) => normalizeCategory(category, index))
      .filter((category): category is ScorecardCategory => category !== null);
    const notes = asStringArray(scorecard.notes);
    const blockingIssues = asStringArray(scorecard.blockingIssues);
    const documents = Array.isArray(scorecard.documents)
      ? scorecard.documents
          .map((document, index) => normalizeDocument(document, index))
          .filter((document): document is ScorecardDocument => document !== null)
      : [];

    return {
      overall: asNumber(scorecard.overall),
      verdict: asString(scorecard.verdict),
      confidence: asNumber(scorecard.confidence),
      summary: asString(scorecard.summary),
      categories,
      documents:
        documents.length > 0
          ? documents
          : [
              buildDocumentFallback(
                'Resume',
                asNumber(scorecard.overall),
                asString(scorecard.summary),
                categories,
                notes,
                blockingIssues,
                asString(scorecard.verdict),
                asNumber(scorecard.confidence),
              ),
            ],
      notes,
      blockingIssues,
    };
  }

  const evaluator = asRecord(scorecard.evaluator) ?? scorecard;
  const heuristic = asRecord(scorecard.heuristic);
  if (typeof evaluator.overall !== 'number' && !Array.isArray(evaluator.documents)) {
    return heuristic ? normalizeHeuristicScorecard(heuristic) : undefined;
  }

  const notes = asStringArray(evaluator.notes);
  const blockingIssues = asStringArray(evaluator.blockingIssues);
  const documents = Array.isArray(evaluator.documents)
    ? evaluator.documents
        .map((document, index) => normalizeDocument(document, index))
        .filter((document): document is ScorecardDocument => document !== null)
    : [];
  const categories = buildMetricCategories(evaluator, notes, blockingIssues);

  if (documents.length === 0 && typeof evaluator.overall === 'number') {
    documents.push(
      buildDocumentFallback(
        'Resume',
        asNumber(evaluator.overall),
        notes[0] ?? 'Loaded from a saved workspace.',
        categories,
        notes,
        blockingIssues,
        asString(evaluator.verdict),
        asNumber(evaluator.confidence),
      ),
    );
  }

  const primaryDocument = documents.find((document) => document.id === 'resume') ?? documents[0];

  return {
    overall: asNumber(primaryDocument?.overall ?? evaluator.overall),
    verdict: asString(primaryDocument?.verdict ?? evaluator.verdict),
    confidence: asNumber(primaryDocument?.confidence ?? evaluator.confidence),
    summary: primaryDocument?.summary ?? notes[0] ?? 'Loaded from a saved workspace.',
    categories: primaryDocument?.categories?.length ? primaryDocument.categories : categories,
    documents,
    notes,
    blockingIssues,
  };
}

export function normalizeGapAnalysis(value: unknown): GapAnalysis | undefined {
  const gap = asRecord(value);
  if (!gap) return undefined;

  if (Array.isArray(gap.matchedKeywords) || Array.isArray(gap.missingKeywords) || Array.isArray(gap.partialMatches)) {
    return {
      matched: Array.isArray(gap.matchedKeywords)
        ? gap.matchedKeywords
            .map((entry) => asRecord(entry))
            .filter((entry): entry is Record<string, unknown> => entry !== null)
            .map((entry) => asString(entry.term))
            .filter(Boolean)
        : [],
      missing: Array.isArray(gap.missingKeywords)
        ? gap.missingKeywords
            .map((entry) => asRecord(entry))
            .filter((entry): entry is Record<string, unknown> => entry !== null)
            .map((entry) => asString(entry.term))
            .filter(Boolean)
        : [],
      partial: Array.isArray(gap.partialMatches)
        ? gap.partialMatches
            .map((entry) => asRecord(entry))
            .filter((entry): entry is Record<string, unknown> => entry !== null)
            .map((entry) => asString(entry.jdTerm))
            .filter(Boolean)
        : [],
      fitRating: asString(gap.overallFit, 'weak') || 'weak',
    };
  }

  return {
    matched: asStringArray(gap.matched),
    missing: asStringArray(gap.missing),
    partial: asStringArray(gap.partial),
    fitRating: asString(gap.fitRating, 'weak') || 'weak',
  };
}

export function normalizeTailorResult(value: unknown): TailorResult | null {
  const result = asRecord(value);
  if (!result) return null;

  const output = asRecord(result.output);
  if (!output) return null;

  const resume = asString(output.resume);
  const coverLetter = asString(output.coverLetter);
  if (!resume && !coverLetter) return null;

  return {
    output: { resume, coverLetter },
    scorecard: normalizeScorecard(result.scorecard),
    gapAnalysis: normalizeGapAnalysis(result.gapAnalysis),
  };
}
