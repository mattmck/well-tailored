import { ProviderChoice, ProviderKind, ProviderOption } from '../types/index.js';

export interface ResolvedProvider extends ProviderOption {
  apiKey: string;
}

const LEGACY_PROVIDER_PRIORITY: ProviderKind[] = ['azure', 'openai', 'anthropic', 'gemini'];

function parseList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function envToken(id: string): string {
  return id.trim().replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function kindLabel(kind: ProviderKind, baseURL?: string): string {
  switch (kind) {
    case 'gemini':
      return 'Gemini';
    case 'azure':
      return 'Azure OpenAI';
    case 'openai':
      return baseURL ? 'OpenAI-compatible' : 'OpenAI';
    case 'anthropic':
      return 'Anthropic';
  }
}

function defaultLabel(id: string, kind: ProviderKind, baseURL?: string): string {
  if (id === kind) {
    return kindLabel(kind, baseURL);
  }
  return titleCase(id);
}

function normalizeKind(value?: string): ProviderKind | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'gemini' || normalized === 'azure' || normalized === 'openai' || normalized === 'anthropic'
    ? normalized
    : undefined;
}

export function normalizeProviderChoice(value?: string): ProviderChoice | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized === 'auto' ? 'auto' : normalized;
}

function sharedModelChoices(): string[] {
  return parseList(process.env.TAILORED_MODELS);
}

function legacyProviderModels(kind: ProviderKind): string[] {
  switch (kind) {
    case 'gemini':
      return parseList(process.env.TAILORED_GEMINI_MODELS);
    case 'azure':
      return unique([
        ...parseList(process.env.TAILORED_AZURE_MODELS),
        ...parseList(process.env.TAILORED_AZURE_OPENAI_MODELS),
      ]);
    case 'openai':
      return parseList(process.env.TAILORED_OPENAI_MODELS);
    case 'anthropic':
      return parseList(process.env.TAILORED_ANTHROPIC_MODELS);
  }
}

function legacyProviders(): ResolvedProvider[] {
  const sharedModels = sharedModelChoices();
  const byKind = new Map<ProviderKind, ResolvedProvider>();

  if (process.env.GEMINI_API_KEY) {
    const defaultModel = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite';
    byKind.set('gemini', {
      id: 'gemini',
      kind: 'gemini',
      label: 'Gemini',
      defaultModel,
      models: unique(['auto', defaultModel, ...sharedModels, ...legacyProviderModels('gemini')]),
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
    const defaultModel = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini';
    byKind.set('azure', {
      id: 'azure',
      kind: 'azure',
      label: 'Azure OpenAI',
      defaultModel,
      models: unique(['auto', defaultModel, ...sharedModels, ...legacyProviderModels('azure')]),
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-12-01-preview',
    });
  }

  if (process.env.OPENAI_API_KEY) {
    const defaultModel = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const baseURL = process.env.OPENAI_BASE_URL;
    byKind.set('openai', {
      id: 'openai',
      kind: 'openai',
      label: process.env.OPENAI_PROVIDER_NAME?.trim() || kindLabel('openai', baseURL),
      defaultModel,
      models: unique(['auto', defaultModel, ...sharedModels, ...legacyProviderModels('openai')]),
      apiKey: process.env.OPENAI_API_KEY,
      baseURL,
    });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const defaultModel = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
    byKind.set('anthropic', {
      id: 'anthropic',
      kind: 'anthropic',
      label: 'Anthropic',
      defaultModel,
      models: unique(['auto', defaultModel, ...sharedModels, ...legacyProviderModels('anthropic')]),
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  return LEGACY_PROVIDER_PRIORITY
    .map((kind) => byKind.get(kind))
    .filter((provider): provider is ResolvedProvider => Boolean(provider));
}

function namedProvider(id: string): ResolvedProvider | undefined {
  const token = envToken(id);
  const prefix = `TAILORED_PROVIDER_${token}_`;
  const kind = normalizeKind(process.env[`${prefix}KIND`]);
  if (!kind) return undefined;

  const sharedModels = sharedModelChoices();
  const label = process.env[`${prefix}LABEL`]?.trim();

  if (kind === 'azure') {
    const endpoint = process.env[`${prefix}ENDPOINT`];
    const apiKey = process.env[`${prefix}API_KEY`];
    if (!endpoint || !apiKey) return undefined;
    const defaultModel = process.env[`${prefix}DEFAULT_MODEL`]
      ?? process.env[`${prefix}DEPLOYMENT`]
      ?? 'gpt-4o-mini';
    return {
      id,
      kind,
      label: label || defaultLabel(id, kind),
      defaultModel,
      models: unique(['auto', defaultModel, ...sharedModels, ...parseList(process.env[`${prefix}MODELS`])]),
      apiKey,
      endpoint,
      apiVersion: process.env[`${prefix}API_VERSION`] ?? '2024-12-01-preview',
    };
  }

  if (kind === 'openai') {
    const apiKey = process.env[`${prefix}API_KEY`];
    if (!apiKey) return undefined;
    const baseURL = process.env[`${prefix}BASE_URL`];
    const defaultModel = process.env[`${prefix}DEFAULT_MODEL`]
      ?? process.env[`${prefix}MODEL`]
      ?? 'gpt-4o-mini';
    return {
      id,
      kind,
      label: label || defaultLabel(id, kind, baseURL),
      defaultModel,
      models: unique(['auto', defaultModel, ...sharedModels, ...parseList(process.env[`${prefix}MODELS`])]),
      apiKey,
      baseURL,
    };
  }

  if (kind === 'gemini') {
    const apiKey = process.env[`${prefix}API_KEY`];
    if (!apiKey) return undefined;
    const defaultModel = process.env[`${prefix}DEFAULT_MODEL`]
      ?? process.env[`${prefix}MODEL`]
      ?? 'gemini-2.0-flash-lite';
    return {
      id,
      kind,
      label: label || defaultLabel(id, kind),
      defaultModel,
      models: unique(['auto', defaultModel, ...sharedModels, ...parseList(process.env[`${prefix}MODELS`])]),
      apiKey,
    };
  }

  const apiKey = process.env[`${prefix}API_KEY`];
  if (!apiKey) return undefined;
  const defaultModel = process.env[`${prefix}DEFAULT_MODEL`]
    ?? process.env[`${prefix}MODEL`]
    ?? 'claude-haiku-4-5-20251001';
  return {
    id,
    kind,
    label: label || defaultLabel(id, kind),
    defaultModel,
    models: unique(['auto', defaultModel, ...sharedModels, ...parseList(process.env[`${prefix}MODELS`])]),
    apiKey,
  };
}

function namedProviders(): ResolvedProvider[] {
  return parseList(process.env.TAILORED_PROVIDER_PROFILES)
    .map((id) => namedProvider(id.toLowerCase()))
    .filter((provider): provider is ResolvedProvider => Boolean(provider));
}

function configuredProviders(): ResolvedProvider[] {
  const providers = [...namedProviders(), ...legacyProviders()];
  const seen = new Set<string>();
  return providers.filter((provider) => {
    if (seen.has(provider.id)) return false;
    seen.add(provider.id);
    return true;
  });
}

export function listConfiguredProviders(): ProviderOption[] {
  return configuredProviders().map(({ apiKey: _apiKey, ...provider }) => provider);
}

export function resolveProviderConfig(preferred?: ProviderChoice): ResolvedProvider | undefined {
  const providers = configuredProviders();
  if (preferred && preferred !== 'auto') {
    const matched = providers.find((provider) => provider.id === preferred);
    if (matched) return matched;
    throw new Error(
      `Provider "${preferred}" is not configured. Configure it or pick one of: ${providers.map((provider) => provider.id).join(', ') || 'none'}.`,
    );
  }
  return providers[0];
}
