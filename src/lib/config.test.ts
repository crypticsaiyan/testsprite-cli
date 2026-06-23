import { mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultConfigPath, loadConfig } from './config.js';
import { writeProfile } from './credentials.js';

let tmpRoot: string;
let credentialsPath: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'testsprite-config-'));
  credentialsPath = join(tmpRoot, 'credentials');
});

describe('loadConfig', () => {
  it('returns built-in defaults when nothing is provided', () => {
    const config = loadConfig({ env: {}, credentialsPath });
    expect(config.apiUrl).toBe('https://api.testsprite.com');
    expect(config.apiKey).toBeUndefined();
    expect(config.profile).toBe('default');
  });

  it('honors TESTSPRITE_API_URL over the file', () => {
    writeProfile('default', { apiUrl: 'https://from-file.example.com' }, { path: credentialsPath });
    const config = loadConfig({
      env: { TESTSPRITE_API_URL: 'https://from-env.example.com' },
      credentialsPath,
    });
    expect(config.apiUrl).toBe('https://from-env.example.com');
  });

  it('honors TESTSPRITE_API_KEY over the file', () => {
    writeProfile('default', { apiKey: 'sk-from-file' }, { path: credentialsPath });
    const config = loadConfig({
      env: { TESTSPRITE_API_KEY: 'sk-from-env' },
      credentialsPath,
    });
    expect(config.apiKey).toBe('sk-from-env');
  });

  it('honors TESTSPRITE_PROFILE', () => {
    expect(loadConfig({ env: { TESTSPRITE_PROFILE: 'staging' }, credentialsPath }).profile).toBe(
      'staging',
    );
  });

  it('option.profile overrides env var', () => {
    expect(
      loadConfig({
        profile: 'option-profile',
        env: { TESTSPRITE_PROFILE: 'env-profile' },
        credentialsPath,
      }).profile,
    ).toBe('option-profile');
  });

  it('option.endpointUrl overrides everything', () => {
    writeProfile('default', { apiUrl: 'https://file' }, { path: credentialsPath });
    const config = loadConfig({
      endpointUrl: 'https://flag',
      env: { TESTSPRITE_API_URL: 'https://env' },
      credentialsPath,
    });
    expect(config.apiUrl).toBe('https://flag');
  });

  it('falls back to credentials file when env is unset', () => {
    writeProfile(
      'default',
      { apiKey: 'sk-file', apiUrl: 'https://from-file.example.com' },
      { path: credentialsPath },
    );
    const config = loadConfig({ env: {}, credentialsPath });
    expect(config.apiKey).toBe('sk-file');
    expect(config.apiUrl).toBe('https://from-file.example.com');
  });

  it('reads the requested profile, not just default', () => {
    writeProfile('dev', { apiKey: 'sk-dev' }, { path: credentialsPath });
    const config = loadConfig({ profile: 'dev', env: {}, credentialsPath });
    expect(config.apiKey).toBe('sk-dev');
  });

  // Regression: `export TESTSPRITE_API_URL=` (empty string) is non-nullish,
  // so `??` previously let it win the precedence chain over the file/default
  // instead of falling through, breaking `new URL('' + path)` for every
  // command. Empty/whitespace-only env vars must be treated as unset.
  it('falls through to the file when TESTSPRITE_API_URL is an empty string', () => {
    writeProfile('default', { apiUrl: 'https://from-file.example.com' }, { path: credentialsPath });
    const config = loadConfig({ env: { TESTSPRITE_API_URL: '' }, credentialsPath });
    expect(config.apiUrl).toBe('https://from-file.example.com');
  });

  it('falls through to the built-in default when TESTSPRITE_API_URL is whitespace-only', () => {
    const config = loadConfig({ env: { TESTSPRITE_API_URL: '   ' }, credentialsPath });
    expect(config.apiUrl).toBe('https://api.testsprite.com');
  });

  // Regression: an empty TESTSPRITE_API_KEY used to shadow a valid
  // credentials-file key, producing a spurious AUTH_REQUIRED instead of
  // falling through to the file.
  it('falls through to the file when TESTSPRITE_API_KEY is an empty string', () => {
    writeProfile('default', { apiKey: 'sk-from-file' }, { path: credentialsPath });
    const config = loadConfig({ env: { TESTSPRITE_API_KEY: '' }, credentialsPath });
    expect(config.apiKey).toBe('sk-from-file');
  });

  // Regression: an empty TESTSPRITE_PROFILE used to select the literal
  // empty-string profile instead of falling through to "default".
  it('falls through to "default" when TESTSPRITE_PROFILE is an empty string', () => {
    const config = loadConfig({ env: { TESTSPRITE_PROFILE: '' }, credentialsPath });
    expect(config.profile).toBe('default');
  });
});

describe('defaultConfigPath', () => {
  it('points to ~/.testsprite/config', () => {
    expect(defaultConfigPath()).toBe(join(homedir(), '.testsprite', 'config'));
  });
});
