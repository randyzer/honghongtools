import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSiliconFlowSpeechProfile,
  normalizeSpeechText,
  parseBase64AudioPayload,
  resolveAudioContentType,
  resolveSiliconFlowResponseFormat,
  resolveSiliconFlowSampleRate,
  resolveSiliconFlowVoice,
} from './speech-utils';

test('resolveSiliconFlowVoice maps legacy game voice ids to MOSS preset voices', () => {
  const actual = resolveSiliconFlowVoice(
    'saturn_zh_female_tiaopigongzhu_tob',
    'fnlp/MOSS-TTSD-v0.5',
    'alex',
  );

  assert.equal(actual, 'fnlp/MOSS-TTSD-v0.5:bella');
});

test('resolveSiliconFlowVoice falls back to configured default voice', () => {
  const actual = resolveSiliconFlowVoice('', 'fnlp/MOSS-TTSD-v0.5', 'alex');

  assert.equal(actual, 'fnlp/MOSS-TTSD-v0.5:alex');
});

test('normalizeSpeechText collapses whitespace for speech synthesis', () => {
  const actual = normalizeSpeechText('  你好啊\n\n今天  真不错  ');

  assert.equal(actual, '你好啊 今天 真不错');
});

test('parseBase64AudioPayload supports raw base64 audio', () => {
  const actual = parseBase64AudioPayload(Buffer.from('hello').toString('base64'));

  assert.equal(actual.contentType, 'audio/mpeg');
  assert.equal(actual.extension, 'mp3');
  assert.equal(actual.bytes.toString('utf8'), 'hello');
});

test('parseBase64AudioPayload supports data url audio input', () => {
  const actual = parseBase64AudioPayload('data:audio/wav;base64,aGVsbG8=');

  assert.equal(actual.contentType, 'audio/wav');
  assert.equal(actual.extension, 'wav');
  assert.equal(actual.bytes.toString('utf8'), 'hello');
});

test('resolveSiliconFlowResponseFormat maps ogg_opus to opus', () => {
  assert.equal(resolveSiliconFlowResponseFormat('ogg_opus'), 'opus');
});

test('resolveSiliconFlowSampleRate normalizes mp3 requests to supported rates', () => {
  assert.equal(resolveSiliconFlowSampleRate('mp3', 24_000), 32_000);
  assert.equal(resolveSiliconFlowSampleRate('mp3', 44_100), 44_100);
});

test('resolveAudioContentType falls back to audio mime by format', () => {
  assert.equal(resolveAudioContentType('mp3'), 'audio/mpeg');
  assert.equal(resolveAudioContentType('opus'), 'audio/ogg');
});

test('buildSiliconFlowSpeechProfile tunes gentle persona for hurt emotion', () => {
  const actual = buildSiliconFlowSpeechProfile({
    text: '我现在真的很难过！！！😢',
    personalityId: 'gentle',
    emotionState: '委屈生气',
    legacyVoiceId: 'zh_female_xiaohe_uranus_bigtts',
    model: 'fnlp/MOSS-TTSD-v0.5',
    defaultVoice: 'alex',
  });

  assert.equal(actual.voice, 'fnlp/MOSS-TTSD-v0.5:claire');
  assert.equal(actual.text, '我现在真的很难过呀。');
  assert.equal(actual.speed, 0.92);
  assert.equal(actual.gain, -0.7);
});

test('buildSiliconFlowSpeechProfile adds restrained edge for tsundere persona', () => {
  const actual = buildSiliconFlowSpeechProfile({
    text: '你到底有没有把我放在心上！！！',
    personalityId: 'tsundere',
    emotionState: '非常生气',
    legacyVoiceId: 'saturn_zh_female_tiaopigongzhu_tob',
    model: 'fnlp/MOSS-TTSD-v0.5',
    defaultVoice: 'alex',
  });

  assert.equal(actual.voice, 'fnlp/MOSS-TTSD-v0.5:bella');
  assert.equal(actual.text, '哼，你到底有没有把我放在心上！');
  assert.equal(actual.speed, 1.05);
  assert.equal(actual.gain, 0.8);
});

test('buildSiliconFlowSpeechProfile keeps cool persona restrained and cleans particles', () => {
  const actual = buildSiliconFlowSpeechProfile({
    text: '你先别说了啦！！！我现在不想听呢……',
    personalityId: 'cool',
    emotionState: '还在生气',
    legacyVoiceId: 'zh_female_meilinvyou_saturn_bigtts',
    model: 'fnlp/MOSS-TTSD-v0.5',
    defaultVoice: 'alex',
  });

  assert.equal(actual.voice, 'fnlp/MOSS-TTSD-v0.5:anna');
  assert.equal(actual.text, '你先别说了！我现在不想听……');
  assert.equal(actual.speed, 0.94);
  assert.equal(actual.gain, -0.6);
});
