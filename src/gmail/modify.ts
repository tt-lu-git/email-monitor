import type { Env } from '../env';
import { logger } from '../lib/logger';

const LABEL_PREFIX    = 'AI/';
const LABEL_CACHE_TTL = 86400;

async function getLabelId(name: string, accessToken: string, env: Env): Promise<string> {
  const cacheKey = `gmail:label:${name}`;
  const cached = await env.KV.get(cacheKey);
  if (cached) return cached;

  const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error(`gmail:labels.list:${listRes.status}`);
  const listData = await listRes.json<{ labels: Array<{ id: string; name: string }> }>();

  const fullName = `${LABEL_PREFIX}${name}`;
  const existing = listData.labels.find(l => l.name === fullName);
  if (existing) {
    await env.KV.put(cacheKey, existing.id, { expirationTtl: LABEL_CACHE_TTL });
    return existing.id;
  }

  const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method:  'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name: fullName }),
  });
  if (!createRes.ok) throw new Error(`gmail:labels.create:${createRes.status}`);
  const created = await createRes.json<{ id: string }>();
  await env.KV.put(cacheKey, created.id, { expirationTtl: LABEL_CACHE_TTL });
  return created.id;
}

export async function modifyMessage(
  id:          string,
  label:       string,
  markRead:    boolean,
  accessToken: string,
  env:         Env
): Promise<void> {
  const addLabelIds:    string[] = [];
  const removeLabelIds: string[] = [];

  if (markRead) removeLabelIds.push('UNREAD');

  try {
    const labelId = await getLabelId(label, accessToken, env);
    addLabelIds.push(labelId);
  } catch (err) {
    logger.warn({ event: 'gmail.label-lookup-failed', error: String(err) });
  }

  if (addLabelIds.length === 0 && removeLabelIds.length === 0) return;

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ addLabelIds, removeLabelIds }),
    }
  );
  if (!res.ok) throw new Error(`gmail:messages.modify:${res.status}`);
}
