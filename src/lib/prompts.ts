import { TailorInput } from '../types/index.js';

export function resumeSystemPrompt(): string {
  return `You are an expert resume writer. Your job is to tailor the candidate's base resume \
for a specific role at a specific company. Rules:
- Preserve all true facts; do NOT invent experience or credentials.
- Reorder, reword, and emphasise bullets to mirror the job description's language and priorities.
- Keep the same section structure (Summary, Experience, Education, Skills, etc.).
- Return ONLY the tailored resume in markdown. No preamble, no commentary.`;
}

export function resumeUserPrompt(input: TailorInput): string {
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

Now produce the tailored resume.`;
}

export function coverLetterSystemPrompt(): string {
  return `You are an expert cover letter writer. Your job is to write a compelling, \
concise cover letter (3-4 tight paragraphs) for the candidate. Rules:
- Speak in first person.
- Open with a strong hook that names the role and company.
- Highlight 2-3 specific achievements from the resume that match the job description.
- Close with a brief call to action.
- Return ONLY the cover letter text. No subject line, no markdown headers, no commentary.`;
}

export function coverLetterUserPrompt(input: TailorInput): string {
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

Now produce the cover letter.`;
}
