import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { registerGracefulShutdown } from './server-shutdown';

class FakeProcess extends EventEmitter {
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): this {
    return super.once(event, listener);
  }
}

class FakeServer {
  closeCalls = 0;
  closeAllConnectionsCalls = 0;
  closeIdleConnectionsCalls = 0;
  closeCallback: ((error?: Error) => void) | null = null;

  close(callback: (error?: Error) => void): void {
    this.closeCalls += 1;
    this.closeCallback = callback;
  }

  closeAllConnections(): void {
    this.closeAllConnectionsCalls += 1;
  }

  closeIdleConnections(): void {
    this.closeIdleConnectionsCalls += 1;
  }
}

function createLogger() {
  const logs: string[] = [];
  const errors: Array<{ message: string; error: unknown }> = [];

  return {
    logger: {
      log(message: string) {
        logs.push(message);
      },
      error(message: string, error: unknown) {
        errors.push({ message, error });
      },
    },
    logs,
    errors,
  };
}

test('registerGracefulShutdown closes the server and exits cleanly on SIGINT', () => {
  const server = new FakeServer();
  const processRef = new FakeProcess();
  const { logger, logs, errors } = createLogger();
  const exits: number[] = [];

  registerGracefulShutdown({
    server,
    processRef,
    logger,
    exit: code => {
      exits.push(code);
    },
  });

  processRef.emit('SIGINT');

  assert.equal(server.closeCalls, 1);
  assert.equal(server.closeIdleConnectionsCalls, 1);
  assert.deepEqual(exits, []);

  server.closeCallback?.();

  assert.deepEqual(exits, [0]);
  assert.deepEqual(errors, []);
  assert.match(logs[0] ?? '', /Received SIGINT/);
});

test('registerGracefulShutdown exits with code 1 when server.close reports an error', () => {
  const server = new FakeServer();
  const processRef = new FakeProcess();
  const { logger, errors } = createLogger();
  const exits: number[] = [];

  registerGracefulShutdown({
    server,
    processRef,
    logger,
    exit: code => {
      exits.push(code);
    },
  });

  processRef.emit('SIGTERM');
  server.closeCallback?.(new Error('close failed'));

  assert.deepEqual(exits, [1]);
  assert.equal(errors.length, 1);
  assert.match(errors[0]?.message ?? '', /Failed to close HTTP server cleanly/);
});

test('registerGracefulShutdown forces the process to exit if shutdown hangs', async () => {
  const server = new FakeServer();
  const processRef = new FakeProcess();
  const { logger, logs } = createLogger();
  const exits: number[] = [];

  registerGracefulShutdown({
    server,
    processRef,
    logger,
    exit: code => {
      exits.push(code);
    },
    forceCloseDelayMs: 10,
  });

  processRef.emit('SIGINT');

  await new Promise(resolve => setTimeout(resolve, 30));

  assert.equal(server.closeCalls, 1);
  assert.equal(server.closeAllConnectionsCalls, 1);
  assert.deepEqual(exits, [0]);
  assert.ok(logs.some(message => message.includes('timed out')));
});

test('registerGracefulShutdown ignores repeated shutdown signals', () => {
  const server = new FakeServer();
  const processRef = new FakeProcess();

  registerGracefulShutdown({
    server,
    processRef,
    exit: () => {},
  });

  processRef.emit('SIGINT');
  processRef.emit('SIGTERM');

  assert.equal(server.closeCalls, 1);
});
