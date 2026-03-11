import OpenAI, { AzureOpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Resolve an abstract model alias to a provider-specific model ID.
 * If the hint already looks like a real model ID, pass it through.
 */
function resolveModel(hint: string, providerDefault: string): string {
  const abstracts = new Set(['haiku', 'sonnet', 'opus', 'flash', 'mini', 'auto', 'default']);
  return abstracts.has(hint.toLowerCase()) ? providerDefault : hint;
}

/** Sleep for `ms` milliseconds. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function getErrorStatus(err: unknown): number | undefined {
  if (err instanceof OpenAI.APIError || err instanceof Anthropic.APIError) {
    return err.status ?? undefined;
  }
  const status = typeof err === 'object' && err !== null && 'status' in err ? (err as { status?: unknown }).status : undefined;
  return typeof status === 'number' ? status : undefined;
}

function formatErrorWithStatus(err: unknown): Error {
  if (!(err instanceof Error)) return new Error(String(err));
  const status = getErrorStatus(err);
  if (!status || err.message.includes(`${status}`)) return err;
  return new Error(`HTTP ${status}: ${err.message}`, { cause: err });
}

/**
 * Retry `fn` up to `maxAttempts` times on 429 rate-limit errors,
 * with exponential backoff starting at `baseDelayMs`.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 6, baseDelayMs = 30_000): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const status = getErrorStatus(err);
      const is429 = status === 429 || (err instanceof Error && err.message.includes('429'));
      attempt++;
      if (!is429 || attempt >= maxAttempts) throw formatErrorWithStatus(err);
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      const statusText = status ? ` (HTTP ${status})` : '';
      console.log(`  ⏳  Rate limited${statusText} — retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})...`);
      await sleep(delay);
    }
  }
}

function vlog(verbose: boolean, msg: string): void {
  if (verbose) console.log(msg);
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
  model: string,
  systemPrompt: string,
  userPrompt: string,
  verbose = false,
): Promise<string> {

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
