import type { Env } from '../env';
import { postToNtfy } from '../notify/publisher';

export async function sendSystemAlert(message: string, env: Env): Promise<void> {
  try {
    await postToNtfy({
      title:    'email-monitor: infra alert',
      message:  `[SYSTEM] ${message.slice(0, 280)}`,
      priority: 5,
      tags:     ['rotating_light'],
      markdown: false,
    }, env);
  } catch { /* gotify might be unreachable during a fatal error */ }
}
