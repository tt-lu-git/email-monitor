type Level = 'info' | 'warn' | 'error';

interface LogEntry {
  ts:          string;
  level:       Level;
  event:       string;
  messageId?:  string;
  priority?:   string;
  label?:      string;
  method?:     string;
  durationMs?: number;
  error?:      string;
}

function log(level: Level, entry: Omit<LogEntry, 'ts' | 'level'>): void {
  const line: LogEntry = { ts: new Date().toISOString(), level, ...entry };
  console.log(JSON.stringify(line));
}

export const logger = {
  info:  (entry: Omit<LogEntry, 'ts' | 'level'>) => log('info',  entry),
  warn:  (entry: Omit<LogEntry, 'ts' | 'level'>) => log('warn',  entry),
  error: (entry: Omit<LogEntry, 'ts' | 'level'>) => log('error', entry),
};

export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logger.info({ event: label, method: label, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    logger.error({ event: `${label}.error`, method: label, durationMs: Date.now() - start, error: String(err) });
    throw err;
  }
}
