import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_TARGET_CURSOR_SELECTOR,
  shouldDisableTargetCursor,
} from './target-cursor-utils';

test('DEFAULT_TARGET_CURSOR_SELECTOR covers common interactive elements site-wide', () => {
  assert.match(DEFAULT_TARGET_CURSOR_SELECTOR, /\ba\b/);
  assert.match(DEFAULT_TARGET_CURSOR_SELECTOR, /\bbutton\b/);
  assert.match(DEFAULT_TARGET_CURSOR_SELECTOR, /\[role="button"\]/);
  assert.match(DEFAULT_TARGET_CURSOR_SELECTOR, /\.cursor-target/);
});

test('shouldDisableTargetCursor returns true for small touch devices', () => {
  const actual = shouldDisableTargetCursor({
    hasTouchScreen: true,
    innerWidth: 390,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  });

  assert.equal(actual, true);
});

test('shouldDisableTargetCursor returns false for desktop environments', () => {
  const actual = shouldDisableTargetCursor({
    hasTouchScreen: false,
    innerWidth: 1440,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  });

  assert.equal(actual, false);
});
