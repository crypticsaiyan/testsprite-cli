import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PROFILE, defaultCredentialsPath, readProfile } from './credentials.js';

export interface Config {
  apiUrl: string;
  apiKey?: string;
  profile: string;
}

export interface LoadConfigOptions {
  profile?: string;
  endpointUrl?: string;
  env?: NodeJS.ProcessEnv;
  credentialsPath?: string;
}

const DEFAULT_API_URL = 'https://api.testsprite.com';

export function defaultConfigPath(): string {
  return join(homedir(), '.testsprite', 'config');
}

/**
 * Resolves the active profile name and its (apiUrl, apiKey) pair.
 *
 * Resolution order, highest precedence first:
 *   profile name:  options.profile  > env.TESTSPRITE_PROFILE > "default"
 *   apiKey:        env.TESTSPRITE_API_KEY > credentials file profile entry
 *   apiUrl:        options.endpointUrl > env.TESTSPRITE_API_URL > credentials file > built-in default
 *
 * Env wins over the credentials file so CI / scripted callers can run without touching
 * the user's ~/.testsprite/credentials.
 */
export function loadConfig(options: LoadConfigOptions = {}): Config {
  const env = options.env ?? process.env;
  // Normalize empty / whitespace-only env vars to unset. `??` only catches
  // null/undefined, so `export TESTSPRITE_API_URL=` (empty string) would
  // otherwise win the precedence chain over a real default/profile value
  // instead of falling through. Mirrors the same guard already applied in
  // auth.ts (runConfigure) and init.ts for TESTSPRITE_API_URL/API_KEY.
  const envProfile = env.TESTSPRITE_PROFILE?.trim() || undefined;
  const envApiUrl = env.TESTSPRITE_API_URL?.trim() || undefined;
  const envApiKey = env.TESTSPRITE_API_KEY?.trim() || undefined;
  const profile = options.profile ?? envProfile ?? DEFAULT_PROFILE;
  const credentialsPath = options.credentialsPath ?? defaultCredentialsPath();
  const fileEntry = readProfile(profile, { path: credentialsPath });

  return {
    apiUrl: options.endpointUrl ?? envApiUrl ?? fileEntry?.apiUrl ?? DEFAULT_API_URL,
    apiKey: envApiKey ?? fileEntry?.apiKey,
    profile,
  };
}
