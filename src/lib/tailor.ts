import OpenAI from 'openai';
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
  client: OpenAI,
  model: string,
  input: TailorInput,
): Promise<TailorOutput> {
  const [resume, coverLetter] = await Promise.all([
    complete(client, model, resumeSystemPrompt(), resumeUserPrompt(input)),
    complete(client, model, coverLetterSystemPrompt(), coverLetterUserPrompt(input)),
  ]);

  return { resume, coverLetter };
}
