# Codex Phase 1: Foundation Libraries

**Branch**: `codex/diff-gap-parser-foundation`
**Base**: `feat/workbench-ux-redesign`

All tasks are pure functions with no AI calls, no side effects, no network access.
Run `npm run typecheck && npm test` before committing. TypeScript ESM with `.js` extensions in imports.

---

## Task 1: Types (`src/types/index.ts`)

Add these types at the end of the existing file. Do not modify existing types.

```typescript
// ── Diff ─────────────────────────────────────────────────────────────────

/** A contiguous block of diff lines sharing the same change type. */
export interface DiffHunk {
  type: 'added' | 'removed' | 'unchanged';
  lines: string[];
}

/** Result of diffing two documents. */
export interface DiffResult {
  hunks: DiffHunk[];
  stats: { added: number; removed: number; unchanged: number };
}

// ── Gap Analysis ─────────────────────────────────────────────────────────

/** Keyword categorization. */
export type KeywordCategory =
  | 'language'
  | 'framework'
  | 'tool'
  | 'platform'
  | 'soft-skill'
  | 'certification'
  | 'methodology'
  | 'other';

/** A categorized keyword or phrase extracted from a JD. */
export interface CategorizedKeyword {
  term: string;
  category: KeywordCategory;
}

/** A partial match between a JD term and a resume term. */
export interface PartialMatch {
  jdTerm: string;
  resumeTerm: string;
  relationship: string; // e.g. "related framework", "subset of", "similar tool"
}

/** Years-of-experience requirement extracted from a JD. */
export interface ExperienceRequirement {
  skill: string;
  years: number;
  isRequired: boolean; // true = "must have", false = "nice to have"
}

/** Heuristic gap analysis result (no AI needed). */
export interface GapAnalysis {
  matchedKeywords: CategorizedKeyword[];
  missingKeywords: CategorizedKeyword[];
  partialMatches: PartialMatch[];
  experienceRequirements: ExperienceRequirement[];
  overallFit: 'strong' | 'moderate' | 'weak';
}

/** AI-enriched gap analysis (extends heuristic). */
export interface EnrichedGapAnalysis extends GapAnalysis {
  narrative: string;
  tailoringHints: string[];
}

// ── Resume Sections ──────────────────────────────────────────────────────

/** Type of resume section detected from heading content. */
export type ResumeSectionType =
  | 'header'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'other';

/** A parsed section of a markdown resume. */
export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  heading: string;
  headingLevel: number;
  content: string;
  bullets: string[];
}
```

---

## Task 2: Diff Engine (`src/lib/diff.ts`)

Implement a Myers-style line diff algorithm. No npm dependencies.

### Exports

```typescript
import { DiffHunk, DiffResult } from '../types/index.js';

/**
 * Compute a line-level diff between two strings.
 * Split on newlines, run LCS/Myers, return typed hunks.
 */
export function diffLines(before: string, after: string): DiffResult;

/**
 * Format a DiffResult as ANSI-colored terminal output.
 * - Green (`\x1b[32m`) for added lines, prefixed with `+`
 * - Red (`\x1b[31m`) for removed lines, prefixed with `-`
 * - Gray (`\x1b[90m`) for unchanged context lines, prefixed with ` `
 * - Reset (`\x1b[0m`) after each line
 *
 * Show up to 3 lines of unchanged context around changes.
 * Collapse longer unchanged blocks with a "... N unchanged lines ..." marker.
 */
export function formatDiffAnsi(diff: DiffResult): string;
```

### Algorithm notes
- Split both inputs on `\n`
- Use a simple Myers diff or LCS-based approach
- Merge consecutive lines of the same type into hunks
- Stats count individual lines, not hunks

### Test file: `tests/diff.test.ts`

Cover these cases:
1. **Identical documents** → single unchanged hunk, stats `{ added: 0, removed: 0, unchanged: N }`
2. **Completely different** → one removed hunk + one added hunk
3. **Single line changed** → unchanged context, removed line, added line, unchanged context
4. **Lines added at end** → unchanged hunk + added hunk
5. **Lines removed from middle** → unchanged + removed + unchanged
6. **Empty inputs** → both empty, one empty, other empty
7. **ANSI formatting** → verify `formatDiffAnsi` output contains correct escape codes and prefixes
8. **Context collapsing** → unchanged blocks > 6 lines should collapse to show 3 lines on each side with marker

---

## Task 3: Resume Section Parser (`src/lib/resume-parser.ts`)

Parse a markdown resume into sections based on headings. Must round-trip cleanly.

### Exports

```typescript
import { ResumeSection, ResumeSectionType } from '../types/index.js';

/**
 * Parse a markdown resume into sections.
 *
 * Rules:
 * - Split on markdown headings (lines starting with # at any level)
 * - Content before the first heading is the "header" section
 * - Each heading starts a new section
 * - Section `id` is a slug of the heading (lowercase, spaces to hyphens, strip non-alphanumeric)
 * - Section `type` is classified from the heading text (see classifySectionType)
 * - `bullets` extracts lines starting with `- ` or `* ` from the content
 * - `headingLevel` is the number of `#` characters
 */
export function parseResumeSections(markdown: string): ResumeSection[];

/**
 * Reassemble sections back into markdown.
 * Must round-trip: assembleSections(parseResumeSections(md)) === md
 * (modulo trailing newline normalization)
 */
export function assembleSections(sections: ResumeSection[]): string;

/**
 * Classify a heading string into a section type.
 *
 * Matching rules (case-insensitive, match anywhere in heading):
 * - "experience", "work history", "employment" → 'experience'
 * - "education", "academic" → 'education'
 * - "skill", "technical", "technologies", "proficiencies", "competencies" → 'skills'
 * - "project" → 'projects'
 * - "certification", "certificate", "license" → 'certifications'
 * - "summary", "objective", "profile", "about" → 'summary'
 * - Everything else → 'other'
 */
export function classifySectionType(heading: string): ResumeSectionType;
```

### Test file: `tests/resume-parser.test.ts`

Cover these cases:
1. **Standard resume** — header + summary + experience + education + skills sections
2. **Round-trip** — `assembleSections(parseResumeSections(md))` matches original (normalize trailing newlines)
3. **No headings** — entire doc is one "header" section
4. **Mixed heading levels** — h1, h2, h3 all create sections with correct `headingLevel`
5. **Bullet extraction** — both `- ` and `* ` style bullets are captured
6. **Section type classification** — test all categories including edge cases like "Technical Skills & Tools"
7. **ID generation** — slugs are correct, handle special characters
8. **Experience entry format** — the `### Title | Company | Location\nDate range\n- bullet` format from prompts.ts is preserved through round-trip

---

## Task 4: Gap Analysis (`src/services/gap.ts`)

Heuristic-only gap analysis. Follows the same pattern as `src/services/scoring.ts`.

### Exports

```typescript
import { GapAnalysis, CategorizedKeyword, ExperienceRequirement, PartialMatch } from '../types/index.js';

/**
 * Extract keywords and multi-word phrases from text.
 *
 * - Extract single words (4+ chars, excluding stop words)
 * - Extract bigrams and trigrams (e.g., "distributed systems", "CI/CD pipelines")
 * - Deduplicate: if a phrase contains a single word, keep the phrase, drop the word
 * - Return sorted by frequency descending, then alphabetically
 *
 * Use the same STOP_WORDS set as scoring.ts (import or duplicate).
 */
export function extractPhrases(text: string): string[];

/**
 * Categorize a keyword/phrase into a KeywordCategory.
 *
 * Use pattern matching:
 * - language: known programming languages (typescript, python, java, go, rust, c++, c#, ruby, swift, kotlin, scala, etc.)
 * - framework: known frameworks (react, angular, vue, django, flask, spring, express, next.js, rails, etc.)
 * - tool: known tools (docker, kubernetes, terraform, jenkins, git, jira, figma, webpack, etc.)
 * - platform: cloud/infra (aws, azure, gcp, heroku, vercel, netlify, linux, etc.)
 * - certification: contains "certified", "certification", "certificate", or known certs (AWS SAA, PMP, etc.)
 * - methodology: agile, scrum, kanban, devops, ci/cd, tdd, etc.
 * - soft-skill: leadership, communication, mentoring, collaboration, etc.
 * - other: everything else
 *
 * The lists don't need to be exhaustive — cover the top 20-30 per category.
 */
export function categorizeKeyword(term: string): CategorizedKeyword;

/**
 * Extract years-of-experience requirements from a job description.
 *
 * Patterns to match:
 * - "5+ years of experience with X"
 * - "3-5 years experience in X"
 * - "minimum 3 years of X"
 * - "at least 2 years X"
 *
 * Determine isRequired by context:
 * - "required", "must have", "minimum" → true
 * - "preferred", "nice to have", "ideally", "bonus" → false
 * - Default to true if no qualifier
 */
export function extractExperienceRequirements(jobDescription: string): ExperienceRequirement[];

/**
 * Run heuristic gap analysis: compare JD keywords against resume content.
 *
 * Steps:
 * 1. Extract phrases from JD (including jobTitle if provided)
 * 2. Categorize each phrase
 * 3. Check which phrases appear in the resume (case-insensitive substring match)
 * 4. For missing keywords, check for partial matches (e.g., "React" in resume matches "React.js" in JD)
 * 5. Extract experience requirements from JD
 * 6. Compute overallFit:
 *    - strong: >= 70% keywords matched
 *    - moderate: >= 40% keywords matched
 *    - weak: < 40% keywords matched
 */
export function analyzeGap(
  resume: string,
  jobDescription: string,
  jobTitle?: string,
): GapAnalysis;
```

### Partial match detection

Build a small map of related terms for common tech synonyms:
```typescript
const SYNONYMS: Record<string, string[]> = {
  'react': ['react.js', 'reactjs'],
  'node': ['node.js', 'nodejs'],
  'typescript': ['ts'],
  'javascript': ['js', 'es6', 'ecmascript'],
  'postgres': ['postgresql', 'psql'],
  'mongo': ['mongodb'],
  'k8s': ['kubernetes'],
  'aws': ['amazon web services'],
  // ... add 10-15 more common ones
};
```

When a JD term is missing from the resume, check if any synonym of that term appears. If so, add a `PartialMatch`.

### Test file: `tests/gap.test.ts`

Cover these cases:
1. **Perfect match** — resume contains all JD keywords → `overallFit: 'strong'`
2. **No match** — resume is unrelated to JD → `overallFit: 'weak'`
3. **Partial match** — resume has "React" but JD says "React.js" → appears in `partialMatches`
4. **Phrase extraction** — "distributed systems" extracted as a phrase, not two separate words
5. **Category classification** — verify languages, frameworks, tools, platforms are correctly categorized
6. **Experience extraction** — "5+ years of Python" → `{ skill: 'Python', years: 5, isRequired: true }`
7. **Experience with qualifiers** — "preferred: 3 years of Go" → `{ isRequired: false }`
8. **Mixed required/nice-to-have** — JD with both sections properly parsed
9. **Deduplication** — "CI/CD" as single word doesn't also appear broken up
10. **Empty inputs** — graceful handling

---

## General Instructions

- All files are TypeScript ESM. Use `.js` extensions in imports (e.g., `from '../types/index.js'`).
- Export only what's listed above. Keep helpers private.
- No npm dependencies — everything is pure TypeScript.
- Follow the existing code style (see `src/services/scoring.ts` for reference).
- Run `npm run typecheck && npm test` and ensure everything passes.
- Commit with a descriptive message.
