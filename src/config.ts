import dotenv from 'dotenv';
import { Config } from './types/index.js';

dotenv.config();

export function loadConfig(): Config {
  const openaiApiKey = process.env.OPENAI_API_KEY ?? '';
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env or export it in your shell.');
  }

  return {
    openaiApiKey,
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
    huntrToken: process.env.HUNTR_TOKEN,
  };
}
