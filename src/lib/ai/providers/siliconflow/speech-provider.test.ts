import test from 'node:test';
import assert from 'node:assert/strict';

import { SiliconFlowSpeechProvider } from './speech-provider';

test('SiliconFlowSpeechProvider retries once when TTS upstream returns 5xx', async () => {
  process.env.SILICONFLOW_API_KEY = 'test-key';
  process.env.SILICONFLOW_TTS_URL = 'https://api.siliconflow.cn/v1/audio/speech';
  process.env.SILICONFLOW_TTS_MODEL = 'fnlp/MOSS-TTSD-v0.5';
  process.env.SILICONFLOW_TTS_DEFAULT_VOICE = 'alex';
  process.env.SILICONFLOW_TTS_STREAM = 'false';
  process.env.AI_REQUEST_TIMEOUT_MS = '20000';

  const provider = new SiliconFlowSpeechProvider();
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const warnLogs: string[] = [];
  let attempts = 0;

  global.fetch = (async () => {
    attempts += 1;

    if (attempts === 1) {
      return new Response(
        JSON.stringify({ error: { message: 'temporary upstream error' } }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(Buffer.from('audio-binary'), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'x-siliconcloud-trace-id': 'trace-success',
      },
    });
  }) as typeof fetch;
  console.warn = ((message?: unknown) => {
    warnLogs.push(String(message ?? ''));
  }) as typeof console.warn;

  try {
    const result = await provider.synthesizeSpeech({
      text: '你好，这是重试测试。',
      voiceId: '',
      uid: 'retry-test',
    });

    assert.equal(attempts, 2);
    assert.equal(result.provider, 'siliconflow');
    assert.match(result.audioUrl, /^data:audio\/mpeg;base64,/);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.raw, {
      traceId: 'trace-success',
      byteLength: 12,
      attempts: 2,
    });
    assert.equal(warnLogs.length, 1);
    assert.match(warnLogs[0], /"event":"request_retry"/);
    assert.match(warnLogs[0], /"attempt":1/);
    assert.match(warnLogs[0], /"maxAttempts":2/);
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test('SiliconFlowSpeechProvider does not retry non-5xx TTS errors', async () => {
  process.env.SILICONFLOW_API_KEY = 'test-key';
  process.env.SILICONFLOW_TTS_URL = 'https://api.siliconflow.cn/v1/audio/speech';
  process.env.SILICONFLOW_TTS_MODEL = 'fnlp/MOSS-TTSD-v0.5';
  process.env.SILICONFLOW_TTS_DEFAULT_VOICE = 'alex';
  process.env.SILICONFLOW_TTS_STREAM = 'false';
  process.env.AI_REQUEST_TIMEOUT_MS = '20000';

  const provider = new SiliconFlowSpeechProvider();
  const originalFetch = global.fetch;
  let attempts = 0;

  global.fetch = (async () => {
    attempts += 1;

    return new Response(
      JSON.stringify({ error: { message: 'invalid api key' } }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    await assert.rejects(
      provider.synthesizeSpeech({
        text: '你好，这是非重试测试。',
        voiceId: '',
        uid: 'no-retry-test',
      }),
      error =>
        error instanceof Error &&
        error.message === 'invalid api key',
    );

    assert.equal(attempts, 1);
  } finally {
    global.fetch = originalFetch;
  }
});
