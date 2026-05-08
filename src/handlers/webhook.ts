import type { Handler } from 'hono';
import type { Env }     from '../env';
import { logger }         from '../lib/logger';
import { sendSystemAlert } from '../lib/alert';
import { processWebhook }  from '../gmail';
import { modifyMessage }   from '../gmail/modify';
import { getAccessToken }  from '../gmail/auth';
import { classifyEmail }   from '../classifier';
import { notifyImmediate } from '../notify';
import { addPendingEmail } from '../db/pending';

interface PubSubBody {
  message: { data: string; messageId: string };
}

export const webhookHandler: Handler<{ Bindings: Env }> = async (c) => {
  const ctx = c.executionCtx;
  let body: PubSubBody;

  try {
    body = await c.req.json<PubSubBody>();
  } catch {
    logger.warn({ event: 'webhook.bad_json' });
    return c.text('OK', 200);
  }

  let payload: { emailAddress: string; historyId: string };
  try {
    payload = JSON.parse(atob(body.message.data));
  } catch {
    logger.warn({ event: 'webhook.bad_envelope', messageId: body.message.messageId });
    return c.text('OK', 200);
  }

  const { historyId } = payload;

  ctx.waitUntil(
    (async () => {
      try {
        const { meta } = await c.env.DB
          .prepare('INSERT OR IGNORE INTO processed_history (history_id, processed_at) VALUES (?, ?)')
          .bind(historyId, Date.now()).run();

        if (meta.changes === 0) {
          logger.info({ event: 'webhook.duplicate', messageId: historyId, method: 'dedup' });
          return;
        }

        const [emails, accessToken] = await Promise.all([
          processWebhook(payload, c.env),
          getAccessToken(c.env, payload.emailAddress),
        ]);

        await Promise.all(
          emails.map(async (email) => {
            const start = Date.now();
            try {
              const result = await classifyEmail(email, c.env);

              if (result.priority === 'Ignore') {
                // silently discard — no notification, no pending record
              } else if (result.priority === 'Critical') {
                await notifyImmediate(
                  { from: email.from, subject: email.subject, summary: result.summary },
                  'Critical',
                  c.env
                );
              } else {
                await addPendingEmail({
                  id:          email.id,
                  from_addr:   email.from,
                  subject:     email.subject,
                  summary:     result.summary,
                  priority:    result.priority as 'High' | 'Medium' | 'Low' | 'Not Necessary',
                  received_at: Date.now(),
                }, c.env);
              }

              // Apply AI label and mark non-critical as read (skip for Ignore — silently discarded)
              if (result.priority !== 'Ignore') {
                await modifyMessage(email.id, result.label, result.priority !== 'Critical', accessToken, c.env);
              }

              logger.info({
                event:      'email.processed',
                messageId:  email.id,
                priority:   result.priority,
                label:      result.label,
                method:     result.method,
                durationMs: Date.now() - start,
              });
            } catch (err) {
              logger.error({ event: 'email.process_error', messageId: email.id, error: String(err) });
            }
          })
        );
      } catch (err) {
        logger.error({ event: 'webhook.fatal', error: String(err) });
        await sendSystemAlert(`webhook fatal: ${String(err)}`, c.env);
      }
    })()
  );

  return c.text('OK', 200);
};
