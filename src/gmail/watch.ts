import type { Env } from '../env';
import { getAccessToken, getAccountEmails } from './auth';
import { getState, setState, cleanupOld } from '../db';

async function watchAccount(email: string, env: Env): Promise<void> {
  const accessToken = await getAccessToken(env, email);
  const historyKey  = `gmail:history_id:${email}`;

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName: env.GMAIL_WATCH_TOPIC,
      labelIds:  [
        'INBOX',
        'CATEGORY_SOCIAL',
        'CATEGORY_PROMOTIONS',
        'CATEGORY_UPDATES',
        'CATEGORY_FORUMS',
      ],
    }),
  });

  if (!res.ok) throw new Error(`gmail:watch:${res.status}:${email}`);

  const data = await res.json<{ historyId: string; expiration: string }>();

  const existing = await getState(historyKey, env);
  if (!existing) await setState(historyKey, data.historyId, env);
}

export async function renewWatch(env: Env): Promise<void> {
  const emails = await getAccountEmails(env);

  await Promise.all(emails.map(email => watchAccount(email, env)));

  await cleanupOld(env);
}
