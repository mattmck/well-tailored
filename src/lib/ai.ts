import OpenAI, { AzureOpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { startRetrySpinner } from './spinner.js';
import { ProviderChoice } from '../types/index.js';
import { ResolvedProvider, resolveProviderConfig } from './providers.js';

export function createAnthropicClient(
  options?: ConstructorParameters<typeof Anthropic>[0],
): Anthropic {
  if (options) {
    return new Anthropic(options);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY (or OPENAI_API_KEY) environment variable for Anthropic client',
    );
  }

  return new Anthropic({ apiKey });
}

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

export interface CompleteOptions {
  provider?: ProviderChoice;
}

/**
 * Return a human-readable description of which provider + model will be used
 * for the given model hint (mirrors the priority logic in complete()).
 */
export function describeProvider(model: string, preferredProvider: ProviderChoice = 'auto'): string {
  const provider = resolveProviderConfig(preferredProvider);
  if (!provider) {
    return '(no provider configured)';
  }
  if (['auto', 'default'].includes(model.toLowerCase()) && !provider.defaultModel) {
    throw new Error(
      `No default model configured for provider "${provider.label}". ` +
        'Set a defaultModel in your provider profile or specify an explicit model.',
    );
  }
  return `${provider.label} · ${resolveModel(model, provider.defaultModel)}`;
}

/**
 * Send a prompt to the configured AI provider and return the text response.
 *
 * Provider selection:
 *   - If `options.provider` is set, use that configured provider profile.
 *   - Otherwise, use the first configured provider profile.
 */
export async function complete(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  verboseArg?: boolean,
  optionsArg?: CompleteOptions,
): Promise<string> {
  const verbose = verboseArg ?? false;
  const provider = resolveProviderConfig(optionsArg?.provider);

  if (!provider) {
    throw new Error(
      'No AI provider configured. Set one of: GEMINI_API_KEY, AZURE_OPENAI_ENDPOINT+AZURE_OPENAI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.',
    );
  }

  // ── 1. Gemini ───────────────────────────────────────────────────────────
  if (provider.kind === 'gemini') {
    const resolved = resolveModel(model, provider.defaultModel);
    vlog(verbose, `    🔧  ${provider.label} · ${resolved}`);
    vlog(verbose, `    📝  system ${systemPrompt.length} chars | user ${userPrompt.length} chars`);
    const t0 = Date.now();
    const client = new OpenAI({
      apiKey: provider.apiKey,
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
  if (provider.kind === 'azure') {
    const resolved = resolveModel(model, provider.defaultModel);
    vlog(verbose, `    🔧  ${provider.label} · ${resolved}`);
    vlog(verbose, `    📝  system ${systemPrompt.length} chars | user ${userPrompt.length} chars`);
    const t0 = Date.now();
    const client = new AzureOpenAI({
      endpoint: provider.endpoint,
      apiKey: provider.apiKey,
      apiVersion: provider.apiVersion ?? '2024-12-01-preview',
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
  if (provider.kind === 'openai') {
    const resolved = resolveModel(model, provider.defaultModel);
    vlog(verbose, `    🔧  ${provider.label} · ${resolved}`);
    vlog(verbose, `    📝  system ${systemPrompt.length} chars | user ${userPrompt.length} chars`);
    const t0 = Date.now();
    const client = new OpenAI({
      apiKey: provider.apiKey,
      ...(provider.baseURL ? { baseURL: provider.baseURL } : {}),
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
  if (provider.kind === 'anthropic') {
    const resolved = resolveModel(model, provider.defaultModel);
    vlog(verbose, `    🔧  ${provider.label} · ${resolved}`);
    vlog(verbose, `    📝  system ${systemPrompt.length} chars | user ${userPrompt.length} chars`);
    const t0 = Date.now();
    const client = new Anthropic({ apiKey: provider.apiKey });
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

  throw new Error(`Unsupported provider configuration: ${provider.kind}`);
}
