import type { Env } from '../env';

export async function isProcessed(messageId: string, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 FROM processed_messages WHERE message_id = ?'
  ).bind(messageId).first();
  return row !== null;
}

export async function markProcessed(messageId: string, env: Env): Promise<void> {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO processed_messages (message_id, processed_at) VALUES (?, ?)'
  ).bind(messageId, Date.now()).run();
}
