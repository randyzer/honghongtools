import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyProviderFailure,
  ProviderRequestError,
} from './errors';
import {
  extractArkOutputText,
  extractJsonObject,
} from './parsers';

test('extractJsonObject strips markdown fence and keeps JSON body', () => {
  const text = `\`\`\`json
{"title":"恋爱小技巧","summary":"摘要","content":"正文","tags":["沟通"]}
\`\`\``;

  const actual = extractJsonObject(text);

  assert.equal(
    actual,
    '{"title":"恋爱小技巧","summary":"摘要","content":"正文","tags":["沟通"]}',
  );
});

test('extractJsonObject finds the largest valid JSON object inside mixed text', () => {
  const text = `我先想一下，候选项比如 {"text":"先别用这个"}。
最终请返回：
{
  "reply": "你还知道回来啊？",
  "options": [
    { "text": "我马上补过纪念日", "scoreChange": 15, "type": "good" }
  ],
  "emotionState": "委屈生气"
}`;

  const actual = extractJsonObject(text);

  assert.equal(
    actual,
    `{
  "reply": "你还知道回来啊？",
  "options": [
    { "text": "我马上补过纪念日", "scoreChange": 15, "type": "good" }
  ],
  "emotionState": "委屈生气"
}`,
  );
});

test('extractArkOutputText returns the assistant output_text content', () => {
  const payload = {
    output: [
      {
        type: 'reasoning',
        summary: [{ type: 'summary_text', text: '中间推理' }],
      },
      {
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'output_text', text: '这是最终回复' },
        ],
      },
    ],
  };

  const actual = extractArkOutputText(payload);

  assert.equal(actual, '这是最终回复');
});

test('classifyProviderFailure maps 429 to a readable business error', () => {
  const error = classifyProviderFailure(
    new ProviderRequestError({
      provider: 'volcengine',
      message: 'rate limited',
      statusCode: 429,
      details: 'too many requests',
    }),
  );

  assert.equal(error.code, 'RATE_LIMITED');
  assert.equal(error.statusCode, 429);
  assert.match(error.userMessage, /请求过于频繁/);
});
