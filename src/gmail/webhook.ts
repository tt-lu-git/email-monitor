import type { Env } from '../env';
import type { GmailWebhookPayload, EmailMessage } from './types';
import { getAccessToken } from './auth';
import { fetchHistory, fallbackSync } from './history';
import { fetchMessage } from './messages';
import { getState, setState, isProcessed, markProcessed } from '../db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function processWebhook(
  payload: GmailWebhookPayload,
  env: Env
): Promise<EmailMessage[]> {
  const { emailAddress } = payload;
  if (!EMAIL_RE.test(emailAddress)) {
    throw new Error(`webhook: invalid emailAddress in payload: ${emailAddress}`);
  }
  const historyKey = `gmail:history_id:${emailAddress}`;
  const tokenKey   = `gmail:access_token:${emailAddress}`;

  let accessToken = await getAccessToken(env, emailAddress);

  const cursor = await getState(historyKey, env);
  let messageIds: string[];
  let nextHistoryId: string;

  try {
    if (!cursor) throw new Error('gmail:history:gap');
    const result = await fetchHistory(cursor, accessToken);
    messageIds    = result.messageIds;
    nextHistoryId = result.nextHistoryId;
  } catch (err) {
    if (String(err).includes('gmail:auth:401')) {
      await env.KV.delete(tokenKey);
      accessToken = await getAccessToken(env, emailAddress);
      const result = await fetchHistory(cursor ?? '1', accessToken);
      messageIds    = result.messageIds;
      nextHistoryId = result.nextHistoryId;
    } else {
      messageIds    = await fallbackSync(accessToken);
      nextHistoryId = payload.historyId;
    }
  }

  const newIds: string[] = [];
  for (const id of messageIds) {
    if (!(await isProcessed(id, env))) newIds.push(id);
  }

  const messages: EmailMessage[] = [];
  for (const id of newIds) {
    try {
      const msg = await fetchMessage(id, accessToken);
      await markProcessed(id, env);
      messages.push(msg);
    } catch {
      // Skip unfetchable messages
    }
  }

  await setState(historyKey, nextHistoryId, env);
  return messages;
}
