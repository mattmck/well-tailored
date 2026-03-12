import { loadPrompt } from './files.js';
import { TailorInput } from '../types/index.js';

export function resumeSystemPrompt(): string {
  const defaultPrompt = `You are an expert resume writer. Your job is to tailor the candidate's base resume \
for a specific role at a specific company. 

Please provide a prompt override in prompts/resume-system.md to enable advanced tailoring.`;

  return loadPrompt('resume-system.md', defaultPrompt);
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

export function coverLetterSystemPrompt(): string {
  const defaultPrompt = `You are a cover letter writer. Your job is to produce a finished cover letter \
tailored to the specific role and company.

Please provide a prompt override in prompts/cover-letter-system.md to enable advanced writing.`;

  return loadPrompt('cover-letter-system.md', defaultPrompt);
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
