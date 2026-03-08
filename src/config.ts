import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import https from 'https';
import { join } from 'path';
import { homedir } from 'os';
import { Config } from './types/index.js';

dotenv.config();

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
 *   5. HUNTR_TOKEN env var (job-shit backward compat)
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

export function loadConfig(): Config {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env or export it in your shell.');
  }

  return {
    apiKey,
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5',
  };
}
