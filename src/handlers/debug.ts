import type { Handler } from 'hono';
import type { Env }     from '../env';

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

// Protected by DEBUG_SECRET query param — remove this handler after debugging is done.
export const debugHandler: Handler<{ Bindings: Env }> = async (c) => {
  const secret = c.req.query('secret') ?? '';
  if (!c.env.DEBUG_SECRET || !timingSafeEqual(secret, c.env.DEBUG_SECRET)) {
    return c.text('Forbidden', 403);
  }

  const [pending, processed, history, kvHistory] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, from_addr, subject, priority, received_at, sent_at FROM pending_emails ORDER BY received_at DESC LIMIT 30'
    ).all(),
    c.env.DB.prepare(
      'SELECT message_id, processed_at FROM processed_messages ORDER BY processed_at DESC LIMIT 30'
    ).all(),
    c.env.DB.prepare(
      'SELECT history_id, processed_at FROM processed_history ORDER BY processed_at DESC LIMIT 10'
    ).all(),
    c.env.KV.list({ prefix: 'gmail:history_id:' }),
  ]);

  const kvValues: Record<string, string | null> = {};
  for (const key of kvHistory.keys) {
    kvValues[key.name] = await c.env.KV.get(key.name);
  }

  return c.json({
    pending_emails:      pending.results,
    processed_messages:  processed.results,
    processed_history:   history.results,
    kv_history_ids:      kvValues,
    now:                 new Date().toISOString(),
  });
};
