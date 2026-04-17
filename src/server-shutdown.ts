type ShutdownSignal = 'SIGINT' | 'SIGTERM';

interface ShutdownCapableServer {
  close(callback: (error?: Error) => void): void;
  closeAllConnections?(): void;
  closeIdleConnections?(): void;
}

interface ProcessLike {
  once(event: ShutdownSignal, listener: () => void): this;
}

interface LoggerLike {
  log(message: string): void;
  error(message: string, error: unknown): void;
}

interface RegisterGracefulShutdownOptions {
  server: ShutdownCapableServer;
  processRef?: ProcessLike;
  logger?: LoggerLike;
  exit?: (code: number) => void;
  forceCloseDelayMs?: number;
}

const DEFAULT_FORCE_CLOSE_DELAY_MS = 1_000;

export function registerGracefulShutdown({
  server,
  processRef = process,
  logger = console,
  exit = process.exit,
  forceCloseDelayMs = DEFAULT_FORCE_CLOSE_DELAY_MS,
}: RegisterGracefulShutdownOptions): void {
  let isShuttingDown = false;
  let hasExited = false;
  let forceCloseTimer: ReturnType<typeof setTimeout> | undefined;

  const finish = (code: number) => {
    if (hasExited) {
      return;
    }

    hasExited = true;

    if (forceCloseTimer) {
      clearTimeout(forceCloseTimer);
      forceCloseTimer = undefined;
    }

    exit(code);
  };

  const shutdown = (signal: ShutdownSignal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    logger.log(`Received ${signal}; shutting down HTTP server...`);

    forceCloseTimer = setTimeout(() => {
      logger.log('Graceful shutdown timed out; closing remaining connections.');
      server.closeAllConnections?.();
      finish(0);
    }, forceCloseDelayMs);
    forceCloseTimer.unref?.();

    server.close(error => {
      if (error) {
        logger.error('Failed to close HTTP server cleanly.', error);
        finish(1);
        return;
      }

      finish(0);
    });

    server.closeIdleConnections?.();
  };

  processRef.once('SIGINT', () => shutdown('SIGINT'));
  processRef.once('SIGTERM', () => shutdown('SIGTERM'));
}
