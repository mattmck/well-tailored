import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import https from 'https';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { Config, ProviderChoice, ProviderOption } from './types/index.js';
import { listConfiguredProviders, normalizeProviderChoice } from './lib/providers.js';

dotenv.config();

function resolveSharedWorktreeEnvPath(): string | undefined {
  const gitPath = join(process.cwd(), '.git');
  if (!existsSync(gitPath)) return undefined;

  try {
    const gitPointer = readFileSync(gitPath, 'utf8').trim();
    const prefix = 'gitdir: ';
    if (!gitPointer.startsWith(prefix)) return undefined;

    const gitDir = resolve(process.cwd(), gitPointer.slice(prefix.length).trim());
    const repoRoot = dirname(dirname(dirname(gitDir)));
    const sharedEnvPath = join(repoRoot, '.env');
    if (!existsSync(sharedEnvPath)) return undefined;

    const localEnvPath = resolve(process.cwd(), '.env');
    return sharedEnvPath === localEnvPath ? undefined : sharedEnvPath;
  } catch {
    return undefined;
  }
}

const sharedWorktreeEnvPath = resolveSharedWorktreeEnvPath();
if (sharedWorktreeEnvPath) {
  dotenv.config({ path: sharedWorktreeEnvPath });
}

/** Matches the format used by huntr-cli's ConfigManager. */
interface HuntrCliConfig {
  apiToken?: string;
}

/**
 * Read the static token from ~/.huntr/config.json (huntr-cli's config file).
 */
function readHuntrCliConfigToken(): string | undefined {
  const configPath = join(homedir(), '.huntr', 'config.json');
  if (!existsSync(configPath)) return undefined;
  try {
    const cfg = JSON.parse(readFileSync(configPath, 'utf8')) as HuntrCliConfig;
    return cfg.apiToken ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Try to read the static API token from the keychain (huntr-cli's KeychainManager).
 */
async function readKeychainApiToken(): Promise<string | undefined> {
  try {
    const { default: keytar } = await import('keytar');
    const token = await keytar.getPassword('huntr-cli', 'api-token');
    return token ?? undefined;
  } catch {
    return undefined;
  }
}

/** Clerk JS version sent to the FAPI token endpoint — matches huntr-cli's pinned version. */
const CLERK_JS_VERSION = '4.73.14';

/** Timeout (ms) for the Clerk FAPI token request. */
const CLERK_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Try to get a fresh JWT from huntr-cli's Clerk session (stored by `huntr login`).
 * Replicates huntr-cli's ClerkSessionManager.getFreshToken() logic.
 */
async function resolveHuntrClerkToken(): Promise<string | undefined> {
  try {
    const { default: keytar } = await import('keytar');
    const sessionCookie = await keytar.getPassword('huntr-cli', 'clerk-session-cookie');
    const sessionId = await keytar.getPassword('huntr-cli', 'clerk-session-id');
    const clientUat = await keytar.getPassword('huntr-cli', 'clerk-client-uat');
    const extraCookiesRaw = await keytar.getPassword('huntr-cli', 'clerk-extra-cookies');

    if (!sessionCookie || !sessionId) return undefined;

    // Strip prefix if present
    const raw = sessionCookie.startsWith('__session=')
      ? sessionCookie.slice('__session='.length)
      : sessionCookie;

    const uat = clientUat?.trim() || '1';
    const cookieParts = [`__session=${raw}`, `__client_uat=${uat}`];

    // Include extra cookies (e.g. __client JWT) stored by huntr-cli
    if (extraCookiesRaw) {
      try {
        const extraCookies = JSON.parse(extraCookiesRaw) as Record<string, string>;
        for (const [name, value] of Object.entries(extraCookies)) {
          cookieParts.push(`${name}=${value}`);
        }
      } catch { /* ignore malformed extra cookies */ }
    }

    const cookieHeader = cookieParts.join('; ');
    const path = `/v1/client/sessions/${sessionId}/tokens?_clerk_js_version=${CLERK_JS_VERSION}`;

    return new Promise<string | undefined>((resolve) => {
      let settled = false;
      const finish = (value: string | undefined): void => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const req = https.request(
        {
          hostname: 'clerk.huntr.co',
          path,
          method: 'POST',
          headers: {
            'Cookie': cookieHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': '0',
            'Accept': 'application/json',
            'Origin': 'https://huntr.co',
            'Referer': 'https://huntr.co/',
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          res.on('error', () => finish(undefined));
          res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 201) {
              try {
                const data = JSON.parse(body) as { jwt?: string };
                finish(data.jwt ?? undefined);
              } catch {
                finish(undefined);
              }
            } else {
              finish(undefined);
            }
          });
        },
      );
      req.setTimeout(CLERK_REQUEST_TIMEOUT_MS, () => {
        req.destroy();
        finish(undefined);
      });
      req.on('error', () => finish(undefined));
      req.end();
    });
  } catch {
    return undefined;
  }
}

/**
 * Resolve the Huntr token, checking all credential sources in order:
 *   1. HUNTR_API_TOKEN env var
 *   2. ~/.huntr/config.json (static token set via `huntr config set-token`)
 *   3. Keychain static api-token (set via `huntr config set-token --keychain`)
 *   4. Clerk session (set via `huntr login`) — refreshes automatically
 *   5. HUNTR_TOKEN env var (legacy backward compat)
 */
export async function resolveHuntrToken(): Promise<string | undefined> {
  if (process.env.HUNTR_API_TOKEN) return process.env.HUNTR_API_TOKEN;

  const configToken = readHuntrCliConfigToken();
  if (configToken) return configToken;

  const keychainToken = await readKeychainApiToken();
  if (keychainToken) return keychainToken;

  const clerkToken = await resolveHuntrClerkToken();
  if (clerkToken) return clerkToken;

  return process.env.HUNTR_TOKEN ?? undefined;
}

function parseModelList(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueModels(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function defaultProvider(providers: ProviderOption[], preferred?: ProviderChoice): ProviderChoice {
  if (preferred && preferred !== 'auto' && providers.some((provider) => provider.id === preferred)) {
    return preferred;
  }
  return providers[0]?.id ?? 'auto';
}

function modelsForProvider(
  providers: ProviderOption[],
  provider: ProviderChoice,
  extras: string[],
  selectedModel: string,
): string[] {
  const providerModels = provider === 'auto'
    ? (providers[0]?.models ?? ['auto'])
    : (providers.find((entry) => entry.id === provider)?.models ?? ['auto']);
  return uniqueModels([
    ...providerModels,
    selectedModel,
    ...extras,
  ]);
}

export function loadConfig(): Config {
  const providers = listConfiguredProviders();
  const preferredProvider = normalizeProviderChoice(process.env.TAILORED_PROVIDER);
  const tailoringProvider = defaultProvider(
    providers,
    normalizeProviderChoice(process.env.TAILORED_TAILORING_PROVIDER) ?? preferredProvider,
  );
  const scoringProvider = defaultProvider(
    providers,
    normalizeProviderChoice(process.env.TAILORED_SCORING_PROVIDER) ?? preferredProvider ?? tailoringProvider,
  );
  const sharedDefault = process.env.TAILORED_MODEL
    ?? (tailoringProvider === 'auto'
      ? providers[0]?.defaultModel
      : providers.find((provider) => provider.id === tailoringProvider)?.defaultModel)
    ?? 'auto';
  const tailoringModel = process.env.TAILORED_TAILORING_MODEL ?? sharedDefault;
  const scoringModel = process.env.TAILORED_SCORING_MODEL ?? process.env.TAILORED_MODEL ?? tailoringModel;
  const tailoringModels = modelsForProvider(
    providers,
    tailoringProvider,
    parseModelList(process.env.TAILORED_TAILORING_MODELS),
    tailoringModel,
  );
  const scoringModels = modelsForProvider(
    providers,
    scoringProvider,
    parseModelList(process.env.TAILORED_SCORING_MODELS),
    scoringModel,
  );

  return {
    model: tailoringModel,
    tailoringProvider,
    scoringProvider,
    tailoringModel,
    scoringModel,
    tailoringModels,
    scoringModels,
    providers,
  };
}
