import OpenAI, { AzureOpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { startRetrySpinner } from './spinner.js';

/**
 * Resolve an abstract model alias to a provider-specific model ID.
 * If the hint already looks like a real model ID, pass it through.
 */
function resolveModel(hint: string, providerDefault: string): string {
  const abstracts = new Set(['auto', 'default']);
  return abstracts.has(hint.toLowerCase()) ? providerDefault : hint;
}

const MAX_ATTEMPTS = 6;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;

function getErrorStatus(err: unknown): number | undefined {
  if (err instanceof OpenAI.APIError || err instanceof Anthropic.APIError) {
    return err.status ?? undefined;
  }
  const status = typeof err === 'object' && err !== null && 'status' in err
    ? (err as { status?: unknown }).status
    : undefined;
  return typeof status === 'number' ? status : undefined;
}

function isRateLimited(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status === 429 || status === 529) return true;
  return err instanceof Error && err.message.includes('429');
}

function resolveDelayMs(err: unknown, attempt: number): number {
  // Honor Retry-After if the API supplies it
  const headers = typeof err === 'object' && err !== null && 'headers' in err
    ? (err as { headers?: { get?(k: string): string | null } }).headers
    : undefined;
  const raw = headers?.get?.('retry-after');
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
  await new Promise<void>((r) => setTimeout(r, ms));
  spinner.stop();
}

/**
 * Retry `fn` up to MAX_ATTEMPTS times on 429/529 rate-limit errors,
 * with exponential backoff + jitter and a live spinner while waiting.
 * Honors Retry-After headers when present.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimited(err) || attempt >= MAX_ATTEMPTS - 1) throw err;
      await sleepWithSpinner(resolveDelayMs(err, attempt));
    }
  }
}

function vlog(verbose: boolean, msg: string): void {
  if (verbose) console.log(msg);
}

/**
 * Return a human-readable description of which provider + model will be used
 * for the given model hint (mirrors the priority logic in complete()).
 */
export function describeProvider(model: string): string {
  if (process.env.GEMINI_API_KEY) {
    return `Gemini · ${resolveModel(model, 'gemini-2.0-flash-lite')}`;
  }
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
    if (['auto', 'default'].includes(model.toLowerCase()) && !process.env.AZURE_OPENAI_DEPLOYMENT) {
      throw new Error('AZURE_OPENAI_DEPLOYMENT is not set. Set it to your Azure deployment name.');
    }
    return `Azure OpenAI · ${resolveModel(model, process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini')}`;
  }
  if (process.env.OPENAI_API_KEY) {
    return `OpenAI · ${resolveModel(model, 'gpt-4o-mini')}`;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return `Anthropic · ${resolveModel(model, 'claude-haiku-4-5-20251001')}`;
  }
  return '(no provider configured)';
}

/**
 * Send a prompt to the configured AI provider and return the text response.
 *
 * Provider priority (first matching env wins):
 *   1. GEMINI_API_KEY                              → Google Gemini (gemini-2.0-flash-lite)
 *   2. AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY → Azure AI Foundry / Azure OpenAI (gpt-4o-mini)
 *   3. OPENAI_API_KEY (+ optional OPENAI_BASE_URL)  → OpenAI or any OpenAI-compatible endpoint
 *   4. ANTHROPIC_API_KEY                            → Anthropic Claude (claude-haiku-4-5)
 */
export async function complete(
  clientOrModel: Anthropic | OpenAI | AzureOpenAI | string,
  modelOrSystemPrompt: string,
  systemPromptOrUserPrompt: string,
  userPromptOrVerbose?: string | boolean,
  verboseArg?: boolean,
): Promise<string> {
  // Support both legacy signature:
  //   complete(client, model, systemPrompt, userPrompt, verbose?)
  // and new signature:
  //   complete(model, systemPrompt, userPrompt, verbose?)
  const usingInjectedClient = typeof clientOrModel !== 'string';

  const model = usingInjectedClient
    ? modelOrSystemPrompt
    : (clientOrModel as string);

  const systemPrompt = usingInjectedClient
    ? systemPromptOrUserPrompt
    : modelOrSystemPrompt;

  const userPrompt = usingInjectedClient
    ? (typeof userPromptOrVerbose === 'string' ? userPromptOrVerbose : '')
    : systemPromptOrUserPrompt;

  const verbose = usingInjectedClient
    ? (typeof verboseArg === 'boolean' ? verboseArg : false)
    : (typeof userPromptOrVerbose === 'boolean' ? userPromptOrVerbose : false);

  // ── 1. Gemini ───────────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    const resolved = resolveModel(model, 'gemini-2.0-flash-lite');
    vlog(verbose, `    🔧  Gemini · ${resolved}`);
    vlog(verbose, `    📝  system ${systemPrompt.length} chars | user ${userPrompt.length} chars`);
    const t0 = Date.now();
    const client = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
    return withRetry(async () => {
      const resp = await client.chat.completions.create({
        model: resolved,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const text = resp.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Gemini returned an empty response.');
      vlog(verbose, `    ⏱   ${((Date.now() - t0) / 1000).toFixed(1)}s · ${text.length} chars`);
      return text;
    });
  }

  // ── 2. Azure AI Foundry / Azure OpenAI ──────────────────────────────────
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
    if (['auto', 'default'].includes(model.toLowerCase()) && !process.env.AZURE_OPENAI_DEPLOYMENT) {
      throw new Error('AZURE_OPENAI_DEPLOYMENT is not set. Set it to your Azure deployment name.');
    }
    const resolved = resolveModel(model, process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini');
    vlog(verbose, `    🔧  Azure OpenAI · ${resolved}`);
    vlog(verbose, `    📝  system ${systemPrompt.length} chars | user ${userPrompt.length} chars`);
    const t0 = Date.now();
    const client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-12-01-preview',
      deployment: resolved,
    });
    return withRetry(async () => {
      const resp = await client.chat.completions.create({
        model: resolved,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const text = resp.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('Azure OpenAI returned an empty response.');
      vlog(verbose, `    ⏱   ${((Date.now() - t0) / 1000).toFixed(1)}s · ${text.length} chars`);
      return text;
    });
  }

  // ── 3. OpenAI (or custom OpenAI-compatible endpoint) ────────────────────
  if (process.env.OPENAI_API_KEY) {
    const resolved = resolveModel(model, 'gpt-4o-mini');
    vlog(verbose, `    🔧  OpenAI · ${resolved}`);
    vlog(verbose, `    📝  system ${systemPrompt.length} chars | user ${userPrompt.length} chars`);
    const t0 = Date.now();
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      ...(process.env.OPENAI_BASE_URL ? { baseURL: process.env.OPENAI_BASE_URL } : {}),
    });
    return withRetry(async () => {
      const resp = await client.chat.completions.create({
        model: resolved,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const text = resp.choices[0]?.message?.content?.trim();
      if (!text) throw new Error('OpenAI returned an empty response.');
      vlog(verbose, `    ⏱   ${((Date.now() - t0) / 1000).toFixed(1)}s · ${text.length} chars`);
      return text;
    });
  }

  // ── 4. Anthropic ─────────────────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    const resolved = resolveModel(model, 'claude-haiku-4-5-20251001');
    vlog(verbose, `    🔧  Anthropic · ${resolved}`);
    vlog(verbose, `    📝  system ${systemPrompt.length} chars | user ${userPrompt.length} chars`);
    const t0 = Date.now();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return withRetry(async () => {
      const msg = await client.messages.create({
        model: resolved,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const block = msg.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') throw new Error('Anthropic returned no text content.');
      vlog(verbose, `    ⏱   ${((Date.now() - t0) / 1000).toFixed(1)}s · ${block.text.length} chars`);
      return block.text.trim();
    });
  }

  throw new Error(
    'No AI provider configured. Set one of: GEMINI_API_KEY, AZURE_OPENAI_ENDPOINT+AZURE_OPENAI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.',
  );
}
