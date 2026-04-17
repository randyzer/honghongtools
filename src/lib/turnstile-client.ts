const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

type ClientEnv = {
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  NODE_ENV?: string;
};

export function getTurnstileSiteKey(env: ClientEnv = process.env): string | null {
  if (env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  }

  if (env.NODE_ENV !== 'production') {
    return TURNSTILE_TEST_SITE_KEY;
  }

  return null;
}
