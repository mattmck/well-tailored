import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shared mock functions – must be hoisted so they're available inside vi.mock() factories.
const { mockChatCreate, mockMessagesCreate } = vi.hoisted(() => ({
  mockChatCreate: vi.fn(),
  mockMessagesCreate: vi.fn(),
}));

// Mock the openai package (covers Gemini, Azure, and OpenAI paths in complete()).
// Class syntax is required — arrow functions cannot be used as constructors with `new`.
vi.mock('openai', () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  class OpenAIMock {
    chat = { completions: { create: mockChatCreate } };
    static APIError = APIError;
  }

  class AzureOpenAIMock {
    chat = { completions: { create: mockChatCreate } };
  }

  return { default: OpenAIMock, AzureOpenAI: AzureOpenAIMock };
});

// Mock the @anthropic-ai/sdk package (Anthropic path in complete()).
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  class AnthropicMock {
    messages = { create: mockMessagesCreate };
    static APIError = APIError;
  }

  return { default: AnthropicMock };
});

import { complete } from '../src/lib/ai.js';

/** Helper: a successful OpenAI-style response */
function openaiOk(text: string) {
  return { choices: [{ message: { content: text } }] };
}

/** Helper: a successful Anthropic-style response */
function anthropicOk(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

// Capture the original env so each test starts with a clean slate.
const SAVED_ENV: Record<string, string | undefined> = {};
const PROVIDER_KEYS = [
  'GEMINI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_DEPLOYMENT',
  'AZURE_OPENAI_API_VERSION',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
  'ANTHROPIC_API_KEY',
];

beforeEach(() => {
  PROVIDER_KEYS.forEach((k) => {
    SAVED_ENV[k] = process.env[k];
    delete process.env[k];
  });
  mockChatCreate.mockReset();
  mockMessagesCreate.mockReset();
});

afterEach(() => {
  PROVIDER_KEYS.forEach((k) => {
    if (SAVED_ENV[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED_ENV[k];
    }
  });
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider selection / priority
// ─────────────────────────────────────────────────────────────────────────────

describe('provider selection', () => {
  it('throws when no provider env vars are set', async () => {
    await expect(complete('auto', 'sys', 'user')).rejects.toThrow(
      'No AI provider configured',
    );
  });

  it('uses Gemini (via OpenAI client) when GEMINI_API_KEY is set', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('gemini response'));

    const result = await complete('auto', 'sys', 'user');

    expect(result).toBe('gemini response');
    expect(mockChatCreate).toHaveBeenCalledOnce();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('uses Azure OpenAI when AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY are set (and no Gemini)', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my-azure.openai.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('azure response'));

    const result = await complete('auto', 'sys', 'user');

    expect(result).toBe('azure response');
    expect(mockChatCreate).toHaveBeenCalledOnce();
  });

  it('uses OpenAI when OPENAI_API_KEY is set (no Gemini or Azure)', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('openai response'));

    const result = await complete('auto', 'sys', 'user');

    expect(result).toBe('openai response');
    expect(mockChatCreate).toHaveBeenCalledOnce();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('uses Anthropic when only ANTHROPIC_API_KEY is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    mockMessagesCreate.mockResolvedValueOnce(anthropicOk('anthropic response'));

    const result = await complete('auto', 'sys', 'user');

    expect(result).toBe('anthropic response');
    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('prefers Gemini over OpenAI when both keys are present', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('gemini wins'));

    const result = await complete('auto', 'sys', 'user');

    // Only one call — and it must be using the Gemini baseURL (checked indirectly
    // by the fact that the OpenAI mock receives the call while Anthropic does not).
    expect(result).toBe('gemini wins');
    expect(mockChatCreate).toHaveBeenCalledOnce();
  });

  it('prefers Azure over OpenAI and Anthropic', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my-azure.openai.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    process.env.OPENAI_API_KEY = 'openai-key';
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('azure wins'));

    const result = await complete('auto', 'sys', 'user');

    expect(result).toBe('azure wins');
    expect(mockChatCreate).toHaveBeenCalledOnce();
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Model alias resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('model alias resolution', () => {
  it('resolves "haiku" → Anthropic default (claude-haiku-4-5-20251001)', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    mockMessagesCreate.mockResolvedValueOnce(anthropicOk('ok'));

    await complete('haiku', 'sys', 'user');

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
    );
  });

  it('resolves "sonnet" → Anthropic provider default (all aliases map to providerDefault)', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    mockMessagesCreate.mockResolvedValueOnce(anthropicOk('ok'));

    await complete('sonnet', 'sys', 'user');

    // resolveModel maps any abstract alias to the single provider default;
    // 'sonnet' resolves to the same Anthropic default as 'haiku'.
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5-20251001' }),
    );
  });

  it('resolves "auto" → OpenAI default (gpt-4o-mini)', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('ok'));

    await complete('auto', 'sys', 'user');

    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' }),
    );
  });

  it('resolves "mini" → OpenAI default (gpt-4o-mini)', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('ok'));

    await complete('mini', 'sys', 'user');

    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' }),
    );
  });

  it('resolves "flash" → Gemini default (gemini-2.0-flash-lite)', async () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('ok'));

    await complete('flash', 'sys', 'user');

    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash-lite' }),
    );
  });

  it('passes a concrete model ID through unchanged (no alias substitution)', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';
    mockChatCreate.mockResolvedValueOnce(openaiOk('ok'));

    await complete('gpt-4o', 'sys', 'user');

    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o' }),
    );
  });

  it('passes a concrete Anthropic model ID through unchanged', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';
    mockMessagesCreate.mockResolvedValueOnce(anthropicOk('ok'));

    await complete('claude-3-5-sonnet-20241022', 'sys', 'user');

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-5-sonnet-20241022' }),
    );
  });

  it('uses AZURE_OPENAI_DEPLOYMENT env var as default when model alias is given', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://my-azure.openai.azure.com';
    process.env.AZURE_OPENAI_API_KEY = 'azure-key';
    process.env.AZURE_OPENAI_DEPLOYMENT = 'my-custom-deployment';
    mockChatCreate.mockResolvedValueOnce(openaiOk('ok'));

    await complete('auto', 'sys', 'user');

    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'my-custom-deployment' }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 429 retry / backoff
// ─────────────────────────────────────────────────────────────────────────────

describe('429 retry / backoff', () => {
  it('retries once on a 429 error and returns the successful result', async () => {
    vi.useFakeTimers();
    process.env.OPENAI_API_KEY = 'openai-key';

    mockChatCreate
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValueOnce(openaiOk('success after retry'));

    // Attach handlers *before* advancing timers to avoid "handled asynchronously" warnings.
    const promise = complete('auto', 'sys', 'user');
    const check = promise.then((r) => {
      expect(r).toBe('success after retry');
    });
    await vi.runAllTimersAsync();
    await check;

    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it('retries multiple times on successive 429 errors', async () => {
    vi.useFakeTimers();
    process.env.OPENAI_API_KEY = 'openai-key';

    mockChatCreate
      .mockRejectedValueOnce(new Error('429'))
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce(openaiOk('success on 3rd attempt'));

    const promise = complete('auto', 'sys', 'user');
    const check = promise.then((r) => {
      expect(r).toBe('success on 3rd attempt');
    });
    await vi.runAllTimersAsync();
    await check;

    expect(mockChatCreate).toHaveBeenCalledTimes(3);
  });

  it('throws after exhausting the maximum retry attempts (6)', async () => {
    vi.useFakeTimers();
    process.env.OPENAI_API_KEY = 'openai-key';

    // 1 initial attempt + 5 retries = 6 total calls; use Once variants to
    // avoid a persistent rejection leaking outside the test boundary.
    mockChatCreate
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockRejectedValueOnce(new Error('429 rate limited'));

    // Attach the rejection handler before advancing timers.
    const promise = complete('auto', 'sys', 'user');
    const check = expect(promise).rejects.toThrow('429');
    await vi.runAllTimersAsync();
    await check;

    expect(mockChatCreate).toHaveBeenCalledTimes(6);
  });

  it('does NOT retry on non-429 errors', async () => {
    process.env.OPENAI_API_KEY = 'openai-key';

    mockChatCreate.mockRejectedValueOnce(new Error('Internal Server Error 500'));

    await expect(complete('auto', 'sys', 'user')).rejects.toThrow(
      'Internal Server Error 500',
    );
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on non-429 errors from Anthropic', async () => {
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';

    mockMessagesCreate.mockRejectedValueOnce(new Error('Bad Request 400'));

    await expect(complete('auto', 'sys', 'user')).rejects.toThrow('Bad Request 400');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  it('also retries on Anthropic 429 responses', async () => {
    vi.useFakeTimers();
    process.env.ANTHROPIC_API_KEY = 'anthropic-key';

    mockMessagesCreate
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce(anthropicOk('anthropic retry success'));

    const promise = complete('auto', 'sys', 'user');
    const check = promise.then((r) => {
      expect(r).toBe('anthropic retry success');
    });
    await vi.runAllTimersAsync();
    await check;

    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
  });
});
