import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeStoredArticle,
  renderArticleContent,
} from './blog-article';

test('normalizeStoredArticle repairs rows whose content stores the full JSON article payload', () => {
  const actual = normalizeStoredArticle({
    id: 11,
    title:
      '{"title":"吵架后越哄越烦？3招让他主动抱你求和好","summary":"吵架别再冷战或敷衍道歉了，3个实用技巧，快速消气还能让感情升温。","content":"是不是好多情侣都有这个困惑？',
    summary: '### ❌ 先避坑！这2个雷区别踩',
    content:
      '{"title":"吵架后越哄越烦？3招让他主动抱你求和好","summary":"吵架别再冷战或敷衍道歉了，3个实用技巧，快速消气还能让感情升温。","content":"是不是好多情侣都有这个困惑？\\n\\n### ❌ 先避坑！这2个雷区别踩","tags":["恋爱沟通","吵架和解技巧","情侣相处"]}',
    tags: '["恋爱技巧","沟通"]',
  });

  assert.equal(actual.title, '吵架后越哄越烦？3招让他主动抱你求和好');
  assert.equal(actual.summary, '吵架别再冷战或敷衍道歉了，3个实用技巧，快速消气还能让感情升温。');
  assert.match(actual.content, /### ❌ 先避坑！这2个雷区别踩/);
  assert.equal(actual.tags, '["恋爱沟通","吵架和解技巧","情侣相处"]');
});

test('renderArticleContent supports markdown h3 headings and inline bold text', () => {
  const actual = renderArticleContent(
    '### 第一招：先停下来\n\n核心要记住：**先共情，再解释**，不要一上来讲道理。',
  );

  assert.match(actual, /<h3[^>]*>第一招：先停下来<\/h3>/);
  assert.match(actual, /<strong>先共情，再解释<\/strong>/);
  assert.doesNotMatch(actual, /###/);
});
