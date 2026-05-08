import type { Env } from '../env';
import type { NtfyPayload } from './types';
import { logger } from '../lib/logger';

const PRIORITY_MAP: Record<number, number> = {
  5: 10,  // Critical  → Gotify high
  4: 8,   // High      → Gotify high
  3: 5,   // Medium    → Gotify normal
  2: 2,   // Low       → Gotify low
  1: 1,   // Not Nec.  → Gotify min
};

export async function postToNtfy(payload: NtfyPayload, env: Env): Promise<void> {
  const gotifyPriority = PRIORITY_MAP[payload.priority] ?? 5;
  const body = JSON.stringify({
    title:    payload.title,
    message:  payload.message,
    priority: gotifyPriority,
    extras: {
      'client::display': { contentType: 'text/markdown' },
      'client::notification': { bigImageUrl: undefined },
    },
  });

  const delays = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(`${env.GOTIFY_SERVER}/message`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Gotify-Key': env.GOTIFY_TOKEN },
        body,
      });
      if (res.ok) return;
      logger.warn({ event: 'gotify.http-error', method: `attempt-${attempt}`, error: `${res.status}` });
    } catch (err) {
      logger.error({ event: 'gotify.network-error', method: `attempt-${attempt}`, error: String(err) });
    }
    if (attempt < delays.length) await new Promise(r => setTimeout(r, delays[attempt]!));
  }
  throw new Error('gotify: all delivery attempts failed');
}
