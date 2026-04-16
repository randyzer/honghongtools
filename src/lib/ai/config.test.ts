import test from 'node:test';
import assert from 'node:assert/strict';

import { AiConfig, getTextRequestPolicy } from './config';

const baseConfig: AiConfig = {
  textPrimaryProvider: 'volcengine',
  textFallbackProvider: 'coze',
  speechPrimaryProvider: 'siliconflow',
  speechFallbackProvider: 'coze',
  requestTimeoutMs: 20_000,
  gameTextTimeoutMs: 60_000,
  blogTextTimeoutMs: 120_000,
  gameMaxOutputTokens: 1_024,
  blogMaxOutputTokens: 2_048,
  cozeModel: 'demo-model',
  volcengineArkApiKey: 'test-key',
  volcengineArkBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  volcengineArkModel: 'doubao-seed-2-0-pro-260215',
  volcengineSpeechAppId: undefined,
  volcengineSpeechAccessToken: undefined,
  volcengineSpeechApiKey: undefined,
  volcengineSpeechCluster: 'volcano_tts',
  volcengineSpeechTtsUrl: 'https://openspeech.bytedance.com/api/v1/tts',
  volcengineSpeechAsrUrl: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash',
  volcengineSpeechAsrResourceId: 'volc.bigasr.auc_turbo',
  siliconflowApiKey: 'test-key',
  siliconflowTtsUrl: 'https://api.siliconflow.cn/v1/audio/speech',
  siliconflowTtsModel: 'fnlp/MOSS-TTSD-v0.5',
  siliconflowTtsDefaultVoice: 'alex',
  siliconflowTtsStream: false,
  siliconflowAsrUrl: 'https://api.siliconflow.cn/v1/audio/transcriptions',
  siliconflowAsrModel: 'FunAudioLLM/SenseVoiceSmall',
};

test('getTextRequestPolicy returns game-specific timeout and token cap', () => {
  const actual = getTextRequestPolicy('game_start', baseConfig);

  assert.deepEqual(actual, {
    timeoutMs: 60_000,
    maxOutputTokens: 1_024,
  });
});

test('getTextRequestPolicy returns blog-specific timeout and token cap', () => {
  const actual = getTextRequestPolicy('blog_generate', baseConfig);

  assert.deepEqual(actual, {
    timeoutMs: 120_000,
    maxOutputTokens: 2_048,
  });
});

test('getTextRequestPolicy falls back to the default timeout for other capabilities', () => {
  const actual = getTextRequestPolicy('custom_capability', baseConfig);

  assert.deepEqual(actual, {
    timeoutMs: 20_000,
  });
});
