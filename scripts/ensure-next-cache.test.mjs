import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  determineNextCacheAction,
  syncNextCacheWorkspace,
} from './ensure-next-cache.mjs';

function createTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'hh-next-cache-'));
}

test('determineNextCacheAction clears copied cache without a workspace stamp', () => {
  const action = determineNextCacheAction({
    hasNextDir: true,
    recordedWorkspacePath: null,
    workspacePath: '/tmp/project-copy',
  });

  assert.equal(action.shouldClear, true);
  assert.equal(action.reason, 'missing-stamp');
});

test('syncNextCacheWorkspace clears stale cache when workspace path changed', () => {
  const workspacePath = createTempWorkspace();
  const nextDir = path.join(workspacePath, '.next');
  const stampFile = path.join(nextDir, '.workspace-path');
  const staleFile = path.join(nextDir, 'stale.txt');

  fs.mkdirSync(nextDir, { recursive: true });
  fs.writeFileSync(stampFile, '/tmp/original-project\n', 'utf8');
  fs.writeFileSync(staleFile, 'stale-cache', 'utf8');

  const result = syncNextCacheWorkspace({ workspacePath });

  assert.equal(result.shouldClear, true);
  assert.equal(result.reason, 'workspace-mismatch');
  assert.equal(fs.existsSync(staleFile), false);
  assert.equal(fs.readFileSync(stampFile, 'utf8'), `${workspacePath}\n`);
});

test('syncNextCacheWorkspace preserves current cache when workspace stamp matches', () => {
  const workspacePath = createTempWorkspace();
  const nextDir = path.join(workspacePath, '.next');
  const stampFile = path.join(nextDir, '.workspace-path');
  const cacheFile = path.join(nextDir, 'cache.txt');

  fs.mkdirSync(nextDir, { recursive: true });
  fs.writeFileSync(stampFile, `${workspacePath}\n`, 'utf8');
  fs.writeFileSync(cacheFile, 'keep-me', 'utf8');

  const result = syncNextCacheWorkspace({ workspacePath });

  assert.equal(result.shouldClear, false);
  assert.equal(result.reason, 'matched-workspace');
  assert.equal(fs.readFileSync(cacheFile, 'utf8'), 'keep-me');
  assert.equal(fs.readFileSync(stampFile, 'utf8'), `${workspacePath}\n`);
});
