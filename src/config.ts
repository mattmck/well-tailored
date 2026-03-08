import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
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
 * Returns undefined if the file doesn't exist or has no token.
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
 * Try to read the static API token from the system keychain.
 * Uses the same service/account names as huntr-cli's KeychainManager.
 * Returns undefined if keytar is unavailable or no token is stored.
 */
async function readHuntrCliKeychainToken(): Promise<string | undefined> {
  try {
    // Dynamic import so we fail gracefully on systems without a native keyring
    // (e.g., Linux without libsecret, CI environments, etc.)
    const { default: keytar } = await import('keytar');
    const token = await keytar.getPassword('huntr-cli', 'api-token');
    return token ?? undefined;
  } catch {
    // keytar unavailable or no keyring present — not an error, just skip
    return undefined;
  }
}

/**
 * Resolve the Huntr token using the same precedence as huntr-cli's TokenManager:
 *   1. HUNTR_API_TOKEN env var  (same name as huntr-cli)
 *   2. ~/.huntr/config.json     (huntr-cli config file)
 *   3. system keychain          (huntr-cli keytar entry)
 *   4. HUNTR_TOKEN env var      (job-shit backward compat)
 */
export async function resolveHuntrToken(): Promise<string | undefined> {
  if (process.env.HUNTR_API_TOKEN) return process.env.HUNTR_API_TOKEN;

  const configToken = readHuntrCliConfigToken();
  if (configToken) return configToken;

  const keychainToken = await readHuntrCliKeychainToken();
  if (keychainToken) return keychainToken;

  return process.env.HUNTR_TOKEN ?? undefined;
}

export function loadConfig(): Config {
  const openaiApiKey = process.env.OPENAI_API_KEY ?? '';
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set. Add it to .env or export it in your shell.');
  }

  return {
    openaiApiKey,
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o',
    // huntrToken is resolved asynchronously via resolveHuntrToken()
  };
}
