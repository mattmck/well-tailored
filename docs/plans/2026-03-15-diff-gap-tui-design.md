# Design: Diff View, Match Gap Analysis, Interactive TUI

**Date**: 2026-03-15
**Status**: Draft

---

## Feature 1: Diff View

### What it does
Shows what the AI changed from the base resume to the tailored version. Supports both base-vs-tailored and version-vs-version comparison.

### CLI surface
```bash
# After tailoring, automatically show a summary:
job-shit tailor --company "Acme" --job jd.txt --diff

# Compare two saved versions:
job-shit diff <jobId> --v1 0 --v2 1
```

Terminal output uses ANSI colors: green for additions, red for removals, gray for unchanged context. Line-level diff with word-level highlighting within changed lines.

### Workbench surface
Side-by-side or unified diff panel in the workbench UI. Triggered when viewing a result that has a base resume available. Toggle between "vs. base" and "vs. previous version" when version history exists.

### Architecture

**New file: `src/lib/diff.ts`** — Pure diff engine, no UI concerns.

```typescript
export interface DiffHunk {
  type: 'added' | 'removed' | 'unchanged';
  lines: string[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  stats: { added: number; removed: number; unchanged: number };
}

/** Line-level diff between two markdown documents. */
export function diffMarkdown(before: string, after: string): DiffResult;

/** Format a DiffResult as ANSI-colored terminal output. */
export function formatDiffAnsi(diff: DiffResult): string;

/** Format a DiffResult as HTML for the workbench. */
export function formatDiffHtml(diff: DiffResult): string;
```

**Algorithm**: Use a longest-common-subsequence (LCS) diff. No npm dependency needed — a simple Myers diff is ~80 lines. Markdown-aware: treat heading lines as section anchors so diffs don't drift across sections.

**Integration points**:
- `TailorRunResult` gets an optional `diff?: DiffResult` field, populated when base resume is available
- Server gets `POST /api/diff` endpoint accepting `{ before: string, after: string }` returning `DiffResult`
- CLI `tailor` command prints diff summary when `--diff` flag is set
- Workbench renders diff HTML in a new panel/tab

### Codex scope (mechanical)
- [ ] Implement Myers diff algorithm in `src/lib/diff.ts`
- [ ] `formatDiffAnsi()` — ANSI color formatting
- [ ] Unit tests: identical docs, completely different docs, single-line changes, heading preservation
- [ ] `DiffResult` type added to `src/types/index.ts`

### Claude scope (integration + UI)
- [ ] `formatDiffHtml()` — styled HTML for workbench
- [ ] Wire `--diff` flag into CLI `tailor` command
- [ ] `POST /api/diff` server endpoint
- [ ] Workbench diff panel component

---

## Feature 2: Match Gap Analysis

### What it does
Before tailoring, analyzes the JD against the base resume and surfaces:
- **Matched skills/keywords** — what you already have that the JD wants
- **Gaps** — what the JD asks for that isn't in your resume
- **Strength signals** — your strongest selling points for this role
- **Risk flags** — years-of-experience mismatches, missing required certs, etc.

### CLI surface
```bash
# Standalone analysis:
job-shit gap --job jd.txt

# Automatically shown before tailoring (opt-out):
job-shit tailor --company "Acme" --job jd.txt  # shows gap summary, then tailors

# Huntr integration:
job-shit huntr gap <jobId>
```

### Workbench surface
Gap analysis panel that populates when a JD is loaded, before the user hits "Generate." Shows a keyword grid: green (matched), red (missing), yellow (partial/related). Strength signals and risk flags as bullet lists.

### Architecture

**Two tiers, matching the scoring pattern:**

1. **Heuristic gap analysis** (`src/services/gap.ts`) — fast, no AI call:
   ```typescript
   export interface GapAnalysis {
     matchedKeywords: string[];
     missingKeywords: string[];
     partialMatches: Array<{ jdTerm: string; resumeTerm: string; similarity: string }>;
     strengthSignals: string[];
     riskFlags: string[];
     overallFit: 'strong' | 'moderate' | 'weak';
   }

   /** Extract and compare keywords/phrases from JD vs resume. */
   export function analyzeGap(resume: string, jobDescription: string, jobTitle?: string): GapAnalysis;
   ```

   This extends the existing `extractKeywords()` logic in `scoring.ts` but adds:
   - Multi-word phrase extraction (e.g., "distributed systems", "CI/CD")
   - Category detection (languages, frameworks, soft skills, certifications)
   - Years-of-experience pattern matching (`/(\d+)\+?\s*years?/i`)

2. **AI-enhanced gap analysis** (optional, uses AI call):
   ```typescript
   export interface EnrichedGapAnalysis extends GapAnalysis {
     narrative: string;           // 2-3 sentence summary
     tailoringHints: string[];    // suggestions for the AI tailor
   }

   export async function analyzeGapWithAI(
     resume: string, bio: string, jobDescription: string, jobTitle?: string,
     model?: string, complete?: typeof defaultComplete,
   ): Promise<EnrichedGapAnalysis>;
   ```

   New prompt in `prompts.ts` — ask the model for structured JSON with narrative + hints. These hints can optionally feed into the tailoring prompt to improve output.

### Integration points
- `POST /api/gap` endpoint: `{ resume, jobDescription, jobTitle?, useAI? }` → `GapAnalysis | EnrichedGapAnalysis`
- CLI `gap` command (new top-level command)
- Optionally pipe gap analysis into tailoring prompts as context

### Codex scope (mechanical)
- [ ] Multi-word keyword/phrase extractor (bigrams, trigrams from JD)
- [ ] Category classifier: languages, frameworks, tools, soft skills, certifications
- [ ] Years-of-experience extractor from JD and resume
- [ ] `GapAnalysis` and `EnrichedGapAnalysis` types in `src/types/index.ts`
- [ ] `analyzeGap()` heuristic function in `src/services/gap.ts`
- [ ] Unit tests: keyword extraction, phrase matching, experience parsing, category classification

### Claude scope (integration + judgment)
- [ ] Gap analysis prompt in `prompts.ts`
- [ ] `analyzeGapWithAI()` in `src/services/gap.ts`
- [ ] `POST /api/gap` server endpoint
- [ ] CLI `gap` command
- [ ] Workbench gap panel component
- [ ] Optional: feed gap hints into tailoring prompt

---

## Feature 3: Interactive TUI / Review Mode

### What it does
After generation, lets you review the tailored resume section-by-section, accept/reject/regenerate individual parts, and make inline edits. Available in both terminal (Ink) and workbench.

### CLI surface
```bash
# Enter interactive mode after tailoring:
job-shit tailor --company "Acme" --job jd.txt --interactive

# Review an existing result:
job-shit review <jobId>
```

### Terminal TUI (Ink)
Ink (React for CLIs) renders a scrollable view of the resume broken into sections. Each section shows:
- The section heading + bullets
- Diff indicators vs. base resume
- Gap analysis tags (which keywords this section covers)

**Controls**:
- `↑/↓` — navigate sections
- `Enter` — expand section for editing
- `a` — accept section as-is
- `r` — regenerate this section (AI call with section-specific prompt)
- `e` — open in `$EDITOR` for manual edits
- `d` — toggle diff view for this section
- `q` — finish, write final output

### Workbench surface
The workbench already has a result view. Extend it with:
- Section-by-section breakdown (collapsible accordion)
- Inline edit mode (contenteditable or textarea per section)
- "Regenerate section" button per section
- Diff overlay per section
- Gap coverage indicators per section

### Architecture

**Resume parser** (`src/lib/resume-parser.ts`) — this is where structured output pays off:

```typescript
export interface ResumeSection {
  id: string;
  type: 'header' | 'summary' | 'experience' | 'education' | 'skills' | 'other';
  heading: string;
  content: string;
  bullets?: string[];
  /** Keywords from the JD that this section covers. */
  coveredKeywords?: string[];
}

/** Parse a markdown resume into sections. */
export function parseResumeSections(markdown: string): ResumeSection[];

/** Reassemble sections back into markdown. */
export function assembleSections(sections: ResumeSection[]): string;
```

**Section regeneration** — new prompt that takes a single section + JD context and produces an improved version. Much cheaper than regenerating the whole resume.

**TUI app** (`src/tui/review.tsx`) — Ink components:
- `<ReviewApp>` — top-level state management
- `<SectionList>` — scrollable section navigator
- `<SectionView>` — single section with diff/gap overlays
- `<StatusBar>` — keybindings, progress, gap coverage summary

### Dependency
- `ink` + `ink-text-input` for terminal TUI (~lightweight, React-based)
- No other new dependencies

### Codex scope (mechanical)
- [ ] `parseResumeSections()` — markdown heading-based parser
- [ ] `assembleSections()` — round-trip reassembly
- [ ] Section type classifier (experience vs. education vs. skills based on heading text)
- [ ] Unit tests: parse→assemble round-trip, section type detection, edge cases (no headings, single section)
- [ ] `ResumeSection` type in `src/types/index.ts`

### Claude scope (integration + UI)
- [ ] Section regeneration prompt in `prompts.ts`
- [ ] `POST /api/regenerate-section` server endpoint
- [ ] Ink TUI components (`src/tui/review.tsx`)
- [ ] Workbench interactive review panel
- [ ] Wire `--interactive` flag into CLI `tailor` command
- [ ] Wire gap analysis coverage into section view

---

## Shared Infrastructure

### New types (`src/types/index.ts`)
```typescript
DiffHunk, DiffResult
GapAnalysis, EnrichedGapAnalysis
ResumeSection
```

### New dependencies
```
ink              — React for CLIs (TUI)
ink-text-input   — text input component for Ink
```

### New files
```
src/lib/diff.ts              — diff engine
src/lib/resume-parser.ts     — markdown resume → sections
src/services/gap.ts           — gap analysis (heuristic + AI)
src/tui/review.tsx            — Ink TUI app
src/commands/gap.ts           — CLI gap command
src/commands/review.ts        — CLI review command
```

### Server endpoints
```
POST /api/diff                — compute diff between two documents
POST /api/gap                 — run gap analysis
POST /api/regenerate-section  — regenerate a single resume section
```

---

## Implementation Order

### Phase 1: Foundation (Codex — all mechanical, well-tested)
1. `src/lib/diff.ts` — Myers diff algorithm + ANSI formatter
2. `src/lib/resume-parser.ts` — section parser + assembler
3. `src/services/gap.ts` — heuristic gap analysis (keyword extraction, categorization, experience matching)
4. Types in `src/types/index.ts`
5. Full test coverage for all three

### Phase 2: Integration (Claude — judgment + wiring)
1. Server endpoints (`/api/diff`, `/api/gap`, `/api/regenerate-section`)
2. CLI commands (`gap`, `--diff` flag, `--interactive` flag)
3. AI-enhanced gap analysis prompt + `analyzeGapWithAI()`
4. Section regeneration prompt

### Phase 3: UI (Claude — design-heavy)
1. `formatDiffHtml()` + workbench diff panel
2. Workbench gap analysis panel
3. Workbench interactive review mode
4. Ink TUI (`src/tui/review.tsx`)

---

## What makes this impressive

- **Diff view** proves the tool is transparent, not a black box
- **Gap analysis** shows domain understanding beyond "throw it at an LLM"
- **Interactive TUI** demonstrates real product thinking — human-in-the-loop, not just batch generation
- The heuristic-first approach (gap analysis works without AI) shows engineering judgment
- Section-level regeneration is cost-efficient and shows you understand the economics of API calls
