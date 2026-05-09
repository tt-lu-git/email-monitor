import type { ScheduledController, ExecutionContext } from '@cloudflare/workers-types';
import type { Env }        from '../env';
import { notifyBatch }     from '../notify';
import { renewWatch }      from '../gmail';
import { cleanupOld }      from '../db/pending';
import { logger }          from '../lib/logger';
import { sendSystemAlert } from '../lib/alert';

export function scheduledHandler(
  event: ScheduledController,
  env:   Env,
  ctx:   ExecutionContext
): void {
  ctx.waitUntil(
    (async () => {
      logger.info({ event: 'cron.start', method: event.cron });
      try {
        switch (event.cron) {
          case '*/30 * * * *':
            await notifyBatch('High', env);
            break;
          case '0 * * * *':
            await notifyBatch('Medium', env);
            break;
          case '0 */2 * * *':
            await notifyBatch('Low', env);
            break;
          case '0 17 * * *':
            await notifyBatch('Not Necessary', env);
            await cleanupOld(env);
            await renewWatch(env);
            break;
          default:
            logger.warn({ event: 'cron.unknown', method: event.cron });
        }
        logger.info({ event: 'cron.done', method: event.cron });
      } catch (err) {
        logger.error({ event: 'cron.error', method: event.cron, error: String(err) });
        await sendSystemAlert(`cron ${event.cron} failed: ${String(err)}`, env);
      }
    })()
  );
}
