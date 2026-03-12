import { complete as defaultComplete } from './ai.js';
import {
  resumeSystemPrompt,
  resumeUserPrompt,
  coverLetterSystemPrompt,
  coverLetterUserPrompt,
} from './prompts.js';
import { TailorInput, TailorOutput } from '../types/index.js';

/**
 * Generate a tailored resume AND cover letter in parallel.
 * Returns both strings once both API calls complete.
 */
export async function tailorDocuments(
  model: string,
  input: TailorInput,
  verbose = false,
  complete = defaultComplete,
): Promise<TailorOutput> {
  const [resume, coverLetter] = await Promise.all([
    complete(model, resumeSystemPrompt(), resumeUserPrompt(input), verbose),
    complete(model, coverLetterSystemPrompt(), coverLetterUserPrompt(input), verbose),
  ]);

  return { resume, coverLetter };
}

/**
 * Generate a tailored resume only (no cover letter, single AI call).
 * Use this when a cover letter is not required (e.g. stack profiles).
 */
export async function tailorResume(
  model: string,
  input: TailorInput,
  verbose = false,
  complete = defaultComplete,
): Promise<string> {
  return complete(model, resumeSystemPrompt(), resumeUserPrompt(input), verbose);
}
