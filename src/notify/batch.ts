import type { Env } from '../env';
import type { PendingEmail } from '../db/pending';
import { getPendingByPriority, markSent } from '../db/pending';
import { formatBatch } from './formatter';
import { postToNtfy } from './publisher';
import { logger } from '../lib/logger';

export async function notifyBatch(priority: 'High' | 'Medium' | 'Low' | 'Not Necessary', env: Env): Promise<void> {
  const emails: PendingEmail[] = await getPendingByPriority(priority, env);
  if (emails.length === 0) return;

  const payloads = formatBatch(emails, priority);

  for (let i = 0; i < payloads.length; i++) {
    const chunkEmails = emails.slice(i * 20, (i + 1) * 20);
    try {
      await postToNtfy(payloads[i]!, env);
      await markSent(chunkEmails.map(e => e.id), env);
    } catch (err) {
      logger.error({ event: 'notify.batch-failed', priority, error: String(err) });
    }
  }
}
