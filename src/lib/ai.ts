import Anthropic, { APIError } from '@anthropic-ai/sdk';
import { startRetrySpinner } from './spinner.js';

export function createAnthropicClient(apiKey: string): Anthropic {
  // Disable SDK built-in retries; we manage our own with better UX
  return new Anthropic({ apiKey, maxRetries: 0 });
}

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 3_000;
const MAX_DELAY_MS = 30_000;

function isRetryable(err: unknown): err is APIError {
  return err instanceof APIError && (err.status === 429 || err.status === 529);
}

function resolveDelayMs(err: APIError, attempt: number): number {
  // Honor Retry-After if the API supplies it
  const raw = err.headers?.get('retry-after');
  if (raw) {
    const secs = parseInt(raw, 10);
    if (!isNaN(secs) && secs > 0) return secs * 1000;
  }
  // Exponential backoff with ±20% jitter, capped at MAX_DELAY_MS
  const base = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return Math.round(base * (0.8 + 0.4 * Math.random()));
}

async function sleepWithSpinner(ms: number): Promise<void> {
  const spinner = startRetrySpinner(ms);
  await new Promise<void>(resolve => setTimeout(resolve, ms));
  spinner.stop();
}

/**
 * Send a single Messages API request and return the text.
 * Retries on 429/529 up to MAX_ATTEMPTS times, honoring Retry-After when present.
 * Shows an animated spinner while waiting so the CLI never appears hung.
 */
export async function complete(
  client: Anthropic,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      if (textBlocks.length === 0) throw new Error('Claude returned an empty response.');
      return textBlocks.map(block => block.text).join('').trim();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt >= MAX_ATTEMPTS - 1) throw err;
      await sleepWithSpinner(resolveDelayMs(err, attempt));
    }
  }

  throw lastErr;
}
