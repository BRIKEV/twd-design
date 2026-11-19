import { LogLevel, type Logger } from '@slack/logger';

// One JSON object per line on stdout/stderr, so any log collector can parse it.
// LOG_LEVEL: debug | info | warn | error (default info).

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type Level = (typeof LEVELS)[number];

let minLevel: Level = (LEVELS as readonly string[]).includes(process.env.LOG_LEVEL ?? '')
  ? (process.env.LOG_LEVEL as Level)
  : 'info';

function write(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (LEVELS.indexOf(level) < LEVELS.indexOf(minLevel)) return;
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...fields });
  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
}

export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => write('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};

export const errorFields = (err: unknown) =>
  err instanceof Error ? { error: err.message, stack: err.stack } : { error: String(err) };

/** Bolt's logger interface, writing the same JSON lines. */
export function boltLogger(): Logger {
  let name = 'bolt';
  const text = (msg: unknown[]) => msg.map((m) => (m instanceof Error ? m.message : typeof m === 'string' ? m : JSON.stringify(m))).join(' ');
  return {
    debug: (...msg) => write('debug', text(msg), { source: name }),
    info: (...msg) => write('info', text(msg), { source: name }),
    warn: (...msg) => write('warn', text(msg), { source: name }),
    error: (...msg) => write('error', text(msg), { source: name }),
    setLevel: (level: LogLevel) => { minLevel = level as Level; },
    getLevel: () => minLevel as LogLevel,
    setName: (n: string) => { name = n; },
  };
}
