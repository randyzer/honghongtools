import test from 'node:test';
import assert from 'node:assert/strict';

import { getTurnstileSiteKey } from './turnstile-client';
import { getTurnstileSecretKey } from './turnstile-server';

test('getTurnstileSiteKey returns the configured public key when present', () => {
  assert.equal(
    getTurnstileSiteKey({
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key-from-env',
      NODE_ENV: 'development',
    }),
    'site-key-from-env',
  );
});

test('getTurnstileSiteKey falls back to Cloudflare test key outside production', () => {
  assert.equal(
    getTurnstileSiteKey({
      NODE_ENV: 'development',
    }),
    '1x00000000000000000000AA',
  );
});

test('getTurnstileSiteKey returns null in production when no key is configured', () => {
  assert.equal(
    getTurnstileSiteKey({
      NODE_ENV: 'production',
    }),
    null,
  );
});

test('getTurnstileSecretKey returns the configured server secret when present', () => {
  assert.equal(
    getTurnstileSecretKey({
      TURNSTILE_SECRET_KEY: 'secret-from-env',
      NODE_ENV: 'development',
    }),
    'secret-from-env',
  );
});

test('getTurnstileSecretKey falls back to Cloudflare test secret outside production', () => {
  assert.equal(
    getTurnstileSecretKey({
      NODE_ENV: 'development',
    }),
    '1x0000000000000000000000000000000AA',
  );
});

test('getTurnstileSecretKey returns null in production when no secret is configured', () => {
  assert.equal(
    getTurnstileSecretKey({
      NODE_ENV: 'production',
    }),
    null,
  );
});
