import type { Env } from '../env';
import { formatImmediate } from './formatter';
import { postToNtfy } from './publisher';
import { logger } from '../lib/logger';

export async function notifyImmediate(
  email: { from: string; subject: string; summary: string },
  priority: 'Critical' | 'High' | 'Medium' | 'Low',
  env: Env
): Promise<void> {
  try {
    const payload = formatImmediate(email, priority);
    await postToNtfy(payload, env);
  } catch (err) {
    logger.error({ event: 'notify.immediate-failed', error: String(err) });
  }
}
