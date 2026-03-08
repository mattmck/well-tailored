import Anthropic from '@anthropic-ai/sdk';
import { complete } from './ai.js';
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
  client: Anthropic,
  model: string,
  input: TailorInput,
): Promise<TailorOutput> {
  const [resume, coverLetter] = await Promise.all([
    complete(client, model, resumeSystemPrompt(), resumeUserPrompt(input)),
    complete(client, model, coverLetterSystemPrompt(), coverLetterUserPrompt(input)),
  ]);

  return { resume, coverLetter };
}

/**
 * Generate a tailored resume only (no cover letter, single AI call).
 * Use this when a cover letter is not required (e.g. stack profiles).
 */
export async function tailorResume(
  client: Anthropic,
  model: string,
  input: TailorInput,
): Promise<string> {
  return complete(client, model, resumeSystemPrompt(), resumeUserPrompt(input));
}
