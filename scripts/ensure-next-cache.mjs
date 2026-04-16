import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function determineNextCacheAction({
  hasNextDir,
  recordedWorkspacePath,
  workspacePath,
}) {
  if (!hasNextDir) {
    return { shouldClear: false, reason: 'missing-cache' };
  }

  if (!recordedWorkspacePath) {
    return { shouldClear: true, reason: 'missing-stamp' };
  }

  if (recordedWorkspacePath !== workspacePath) {
    return {
      shouldClear: true,
      reason: 'workspace-mismatch',
      recordedWorkspacePath,
    };
  }

  return { shouldClear: false, reason: 'matched-workspace' };
}

export function syncNextCacheWorkspace({
  workspacePath,
  nextDir = path.join(workspacePath, '.next'),
  log = console.log,
} = {}) {
  if (!workspacePath) {
    throw new Error('workspacePath is required');
  }

  const resolvedWorkspacePath = path.resolve(workspacePath);
  const resolvedNextDir = path.resolve(nextDir);
  const stampFile = path.join(resolvedNextDir, '.workspace-path');
  const hasNextDir = fs.existsSync(resolvedNextDir);
  const recordedWorkspacePath = fs.existsSync(stampFile)
    ? fs.readFileSync(stampFile, 'utf8').trim() || null
    : null;

  const action = determineNextCacheAction({
    hasNextDir,
    recordedWorkspacePath,
    workspacePath: resolvedWorkspacePath,
  });

  if (action.shouldClear) {
    if (action.reason === 'workspace-mismatch') {
      log(
        `Detected copied Next.js cache from ${action.recordedWorkspacePath}; clearing ${resolvedNextDir}.`,
      );
    } else {
      log(`Detected existing Next.js cache without workspace stamp; clearing ${resolvedNextDir}.`);
    }

    fs.rmSync(resolvedNextDir, { recursive: true, force: true });
  }

  fs.mkdirSync(resolvedNextDir, { recursive: true });
  fs.writeFileSync(stampFile, `${resolvedWorkspacePath}\n`, 'utf8');

  return {
    ...action,
    nextDir: resolvedNextDir,
    stampFile,
    workspacePath: resolvedWorkspacePath,
  };
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const workspacePath = process.env.COZE_WORKSPACE_PATH || process.cwd();

  syncNextCacheWorkspace({ workspacePath });
}
