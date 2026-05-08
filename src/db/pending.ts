import type { Env } from '../env';

export interface PendingEmail {
  id:          string;
  from_addr:   string;
  subject:     string;
  summary:     string;
  priority:    'High' | 'Medium' | 'Low' | 'Not Necessary';
  received_at: number;
}

export async function addPendingEmail(email: PendingEmail, env: Env): Promise<void> {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO pending_emails (id, from_addr, subject, summary, priority, received_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(email.id, email.from_addr, email.subject, email.summary, email.priority, email.received_at).run();
}

export async function getPendingByPriority(
  priority: 'High' | 'Medium' | 'Low' | 'Not Necessary',
  env: Env
): Promise<PendingEmail[]> {
  const result = await env.DB.prepare(
    'SELECT id, from_addr, subject, summary, priority, received_at FROM pending_emails WHERE priority = ? AND sent_at IS NULL ORDER BY received_at ASC LIMIT 100'
  ).bind(priority).all<PendingEmail>();
  return result.results;
}

export async function markSent(ids: string[], env: Env): Promise<void> {
  if (ids.length === 0) return;
  const now = Date.now();
  await env.DB.batch(
    ids.map(id =>
      env.DB.prepare('UPDATE pending_emails SET sent_at = ? WHERE id = ?').bind(now, id)
    )
  );
}

export async function cleanupOld(env: Env): Promise<void> {
  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
  const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pending_emails WHERE sent_at IS NOT NULL AND sent_at < ?').bind(cutoff24h),
    env.DB.prepare('DELETE FROM processed_messages WHERE processed_at < ?').bind(cutoff48h),
    env.DB.prepare('DELETE FROM processed_history WHERE processed_at < ?').bind(cutoff48h),
  ]);
}
