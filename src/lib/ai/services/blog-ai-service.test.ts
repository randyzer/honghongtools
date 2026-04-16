import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildArticlePrompts,
  parseArticleData,
  resolveBlogTopic,
} from './blog-ai-service';

test('parseArticleData keeps structured JSON output intact', () => {
  const actual = parseArticleData(
    '{"title":"恋爱小技巧","summary":"三步和好","content":"先道歉，再解释，最后补偿。","tags":["恋爱技巧","沟通"]}',
  );

  assert.equal(actual.title, '恋爱小技巧');
  assert.equal(actual.summary, '三步和好');
  assert.equal(actual.content, '先道歉，再解释，最后补偿。');
  assert.deepEqual(actual.tags, ['恋爱技巧', '沟通']);
});

test('parseArticleData salvages title and summary from malformed json-like output', () => {
  const actual = parseArticleData(
    '{"title":"吵架后越哄越烦？3招让他主动抱你求和好","summary":"吵架别再冷战或敷衍道歉了，3个实用技巧，快速消气还能让感情升温。","content":"是不是好多情侣都有这个困惑？吵架后要么冷战憋到内伤，要么低头道歉对方还摆臭脸',
  );

  assert.equal(actual.title, '吵架后越哄越烦？3招让他主动抱你求和好');
  assert.equal(actual.summary, '吵架别再冷战或敷衍道歉了，3个实用技巧，快速消气还能让感情升温。');
  assert.match(actual.content, /是不是好多情侣都有这个困惑/);
  assert.deepEqual(actual.tags, ['恋爱技巧', '沟通']);
});

test('resolveBlogTopic prefers the provided topic after trimming', () => {
  const actual = resolveBlogTopic('  异地恋争吵后怎么和好  ');

  assert.equal(actual, '异地恋争吵后怎么和好');
});

test('resolveBlogTopic picks a predefined topic when no topic is provided', () => {
  const actual = resolveBlogTopic('', () => 0);

  assert.equal(actual, '吵架后怎么高情商道歉并快速和好');
});

test('buildArticlePrompts keeps the blog request concise and JSON-only', () => {
  const actual = buildArticlePrompts('纪念日忘记后怎么补救');

  assert.match(actual.systemPrompt, /不要输出思考过程/);
  assert.match(actual.userPrompt, /正文控制在600-900字/);
  assert.match(actual.userPrompt, /只返回一个JSON对象/);
  assert.match(actual.userPrompt, /纪念日忘记后怎么补救/);
});
