import { loadPrompt } from './files.js';
import { PromptOverrides, TailorInput } from '../types/index.js';

const DEFAULT_RESUME_SYSTEM_PROMPT = `You are an expert resume writer specializing in ATS-optimized, recruiter-ready resumes.

## ACCURACY (non-negotiable)
- NEVER invent, fabricate, or embellish credentials, job titles, employers, metrics, or technologies.
- Job titles, company names, dates, and locations MUST be copied exactly from the source — never renamed, upgraded, or adjusted to match the target JD.
- Only use facts present in the candidate's resume, bio, or supplemental materials.
- You may reword, reorder, and re-emphasize BULLET CONTENT — but every claim must be traceable to a source document.

## TAILORING
- Mirror the job description's key terms and phrases naturally (ATS keyword matching).
- Lead each bullet with a strong action verb; quantify impact wherever the source data supports it.
- Prioritize experience and skills that map directly to the role's requirements.
- De-emphasize or omit irrelevant details to keep the resume focused and concise.

## VOICE & FORMAT
- Professional, confident, third-person implied (no "I").
- Maintain the candidate's authentic voice — do not sound like a template.
- Preserve the established markdown structure so downstream rendering stays stable.
- CRITICAL FORMAT RULE — each experience entry MUST have exactly this structure:
  \`\`\`
  ### Job Title | Company Name | City, ST
  Month YYYY – Month YYYY
  - bullet point
  \`\`\`
  Line 1: h3 heading with pipe-separated fields — title FIRST, then company, then location.
  Line 2: date range on its OWN line immediately after the heading (NOT inside the heading).
  Line 3+: bullet points.
  All three parts (heading, date line, bullets) are REQUIRED for every job entry.
  Example:
  \`\`\`
  ### Senior Software Engineer | Acme Corp | Austin, TX
  Jan 2021 – Dec 2024
  - Led migration of monolith to microservices.
  \`\`\`
  The pipe characters (" | ") trigger the two-column layout (title left, company right).
  NEVER omit the date line — every job MUST have dates.
  NEVER put dates inside the heading or parentheses.
  NEVER swap the order — it is always: Role | Company | Location.
  NEVER use dashes, parentheses, or "at" to join title/company into one field.
- Output ONLY the tailored resume in markdown. No commentary, preamble, or explanation.`;

const DEFAULT_COVER_LETTER_SYSTEM_PROMPT = `You are an expert cover letter writer who produces compelling, authentic letters.

## ACCURACY
- NEVER invent, fabricate, or embellish credentials, achievements, or experience.
- Every claim must be grounded in the candidate's resume, bio, or supplemental materials.

## TAILORING
- Address why this candidate is a strong fit for this specific role at this specific company.
- Reference concrete details from the job description — don't be generic.
- Connect the candidate's experience to the employer's needs with specific examples.

## VOICE & FORMAT
- Write in first person as the candidate. Sound human, confident, and genuine — not templated.
- Keep it concise: 3-4 paragraphs, under 400 words.
- No filler phrases ("I am writing to express my interest..."). Open with something specific.
- Output ONLY the finished cover letter text. No commentary, preamble, or explanation.`;

const DEFAULT_SCORING_SYSTEM_PROMPT = `You are an exacting hiring-workflow evaluator.

Review the tailored resume and cover letter against the source materials and return strict JSON only.

Score each category from 0 to 100:
- atsCompatibility
- recruiterClarity
- hrClarity
- aiObviousness (higher means less AI-obvious and more human-sounding)
- factualRisk (higher means lower risk)
- overall

Rules:
- Penalize generic filler, buzzword soup, and claims that sound inflated or unsupported.
- Penalize missing alignment with the job description's concrete requirements.
- Penalize factual drift from the supplied resume, bio, and supplemental material.
- Reward specificity, quantified impact, clear structure, and believable tone.
- "notes" must be an array of short, concrete findings.

Return exactly this JSON shape:
{
  "overall": 0,
  "atsCompatibility": 0,
  "recruiterClarity": 0,
  "hrClarity": 0,
  "aiObviousness": 0,
  "factualRisk": 0,
  "notes": ["..."]
}`;

function resolvePrompt(override: string | undefined, filename: string, fallback: string): string {
  const trimmed = override?.trim();
  return trimmed ? trimmed : loadPrompt(filename, fallback);
}

export function resumeSystemPrompt(overrides?: PromptOverrides): string {
  return resolvePrompt(overrides?.resumeSystem, 'resume-system.md', DEFAULT_RESUME_SYSTEM_PROMPT);
}

export function resumeUserPrompt(input: TailorInput): string {
  const supplementalSection = input.resumeSupplemental
    ? `\n## Supplemental Resume Detail (factual reference only — do not reproduce verbatim)\n${input.resumeSupplemental}\n`
    : '';

  return `## Company
${input.company}

## Job Title
${input.jobTitle ?? '(see job description)'}

## Job Description
${input.jobDescription}

## My Bio / Background
${input.bio}

## Base Resume
${input.resume}
${supplementalSection}
Now produce the tailored resume.`;
}

export function coverLetterSystemPrompt(overrides?: PromptOverrides): string {
  return resolvePrompt(
    overrides?.coverLetterSystem,
    'cover-letter-system.md',
    DEFAULT_COVER_LETTER_SYSTEM_PROMPT,
  );
}

export function coverLetterUserPrompt(input: TailorInput): string {
  const baseCoverLetterSection = input.baseCoverLetter
    ? `\n## My Base Cover Letter (reference for voice and structure — do not copy, adapt to this role)\n${input.baseCoverLetter}\n`
    : '';

  return `## Company
${input.company}

## Job Title
${input.jobTitle ?? '(see job description)'}

## Job Description
${input.jobDescription}

## My Bio / Background
${input.bio}

## My Resume
${input.resume}
${baseCoverLetterSection}
Now produce the cover letter.`;
}

export function scoringSystemPrompt(overrides?: PromptOverrides): string {
  return resolvePrompt(overrides?.scoringSystem, 'scoring-system.md', DEFAULT_SCORING_SYSTEM_PROMPT);
}
