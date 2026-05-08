import type { Env } from '../env';

export async function getState(key: string, env: Env): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT value FROM state WHERE key = ?'
  ).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setState(key: string, value: string, env: Env): Promise<void> {
  await env.DB.prepare(
    'INSERT OR REPLACE INTO state (key, value, updated_at) VALUES (?, ?, ?)'
  ).bind(key, value, Date.now()).run();
}
