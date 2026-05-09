import type { Handler } from 'hono';
import type { Env }     from '../env';

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  const aPadded = new Uint8Array(maxLen);
  const bPadded = new Uint8Array(maxLen);
  aPadded.set(aBytes);
  bPadded.set(bBytes);
  return crypto.subtle.timingSafeEqual(aPadded, bPadded);
}

export const statsHandler: Handler<{ Bindings: Env }> = async (c) => {
  const secret = c.req.query('secret') ?? '';
  if (!c.env.DEBUG_SECRET || !timingSafeEqual(secret, c.env.DEBUG_SECRET)) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const now        = Date.now();
  const oneDayAgo  = now - 24 * 60 * 60 * 1000;
  const d          = new Date(now);
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);

  const [todayRow, monthRow, pendingRows, cronHigh, cronMedium, cronLow, cronNotNecessary] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM processed_messages WHERE processed_at > ?')
      .bind(oneDayAgo).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM processed_messages WHERE processed_at > ?')
      .bind(monthStart).first<{ count: number }>(),
    c.env.DB.prepare(
      'SELECT priority, COUNT(*) as count FROM pending_emails WHERE sent_at IS NULL GROUP BY priority'
    ).all<{ priority: string; count: number }>(),
    c.env.KV.get('cron:last_run:high'),
    c.env.KV.get('cron:last_run:medium'),
    c.env.KV.get('cron:last_run:low'),
    c.env.KV.get('cron:last_run:not_necessary'),
  ]);

  const pendingByPriority: Record<string, number> = {
    High: 0, Medium: 0, Low: 0, 'Not Necessary': 0,
  };
  for (const row of pendingRows.results) {
    pendingByPriority[row.priority] = row.count;
  }

  return c.json({
    processedToday:    todayRow?.count ?? 0,
    processedMonth:    monthRow?.count ?? 0,
    pendingByPriority,
    cronLastRun: {
      high:         cronHigh,
      medium:       cronMedium,
      low:          cronLow,
      notNecessary: cronNotNecessary,
    },
  });
};
