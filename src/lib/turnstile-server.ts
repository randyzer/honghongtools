const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

type ServerEnv = {
  TURNSTILE_SECRET_KEY?: string;
  NODE_ENV?: string;
};

export function getTurnstileSecretKey(env: ServerEnv = process.env): string | null {
  if (env.TURNSTILE_SECRET_KEY) {
    return env.TURNSTILE_SECRET_KEY;
  }

  if (env.NODE_ENV !== 'production') {
    return TURNSTILE_TEST_SECRET_KEY;
  }

  return null;
}
