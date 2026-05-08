import type { Context } from 'hono';
import type { Env } from '../env';
import type { PendingEmail } from '../db/pending';
import { formatBatch, formatImmediate } from '../notify/formatter';
import { postToNtfy } from '../notify/publisher';
import { notifyBatch } from '../notify/batch';

const NOW = Date.now();

const MOCK_EMAILS: PendingEmail[] = [
  {
    id: 'msg001',
    from_addr: 'Grand Hotel <reservations@grandhotel.example>',
    subject: 'Your hotel folio for Grand Hotel Downtown',
    summary: 'Hotel stay confirmed, $250.00 charged. Check-in Jan 10, check-out Jan 12.',
    priority: 'High',
    received_at: NOW - 1000 * 60 * 20,
  },
  {
    id: 'msg002',
    from_addr: 'ShopCo <orders@shopco.example>',
    subject: 'Your order has shipped!',
    summary: 'Order #5678 for $34.99 has shipped, estimated delivery Jan 15.',
    priority: 'High',
    received_at: NOW - 1000 * 60 * 15,
  },
  {
    id: 'msg003',
    from_addr: 'ShopCo <orders@shopco.example>',
    subject: 'Your package was delivered',
    summary: 'Order #5678 delivered to front door at 2:14 PM.',
    priority: 'High',
    received_at: NOW - 1000 * 60 * 10,
  },
  {
    id: 'msg004',
    from_addr: 'Community Updates <updates@yourorganization.example>',
    subject: 'Upcoming event: Spring Fair Jan 20',
    summary: 'Spring Fair is on Jan 20, 11am–3pm at Riverside Community Center. Volunteers needed.',
    priority: 'Medium',
    received_at: NOW - 1000 * 60 * 45,
  },
  {
    id: 'msg005',
    from_addr: 'Delivery Service <notify@deliveryservice.example>',
    subject: 'Informed Delivery: 2 packages arriving today',
    summary: 'Two packages expected by 8pm today.',
    priority: 'Low',
    received_at: NOW - 1000 * 60 * 90,
  },
];

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

export async function testNotifyHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const secret = c.req.query('secret') ?? '';
  if (!c.env.DEBUG_SECRET || !timingSafeEqual(secret, c.env.DEBUG_SECRET)) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const scenario = c.req.query('scenario') ?? 'batch-high';
  const results: Array<{ scenario: string; payload: unknown; status?: number; ok?: boolean; ntfy_response?: string; error?: string }> = [];

  async function send(label: string, payload: Parameters<typeof postToNtfy>[0]) {
    try {
      await postToNtfy(payload, c.env);
      results.push({ scenario: label, payload, ok: true });
    } catch (err) {
      results.push({ scenario: label, payload, ok: false, error: String(err) });
    }
  }

  if (scenario === 'immediate-critical') {
    const p = formatImmediate(
      { from: 'Bank of America <security@bankofamerica.com>', subject: 'Unusual sign-in detected on your account', summary: 'We detected a sign-in from a new device in Seattle, WA. If this was not you, secure your account immediately.' },
      'Critical',
    );
    await send('immediate-critical', p);

  } else if (scenario === 'immediate-high') {
    const p = formatImmediate(
      { from: 'Grand Hotel <reservations@grandhotel.example>', subject: 'Hotel folio: Grand Hotel Downtown', summary: 'Hotel stay confirmed, $250.00 charged. Stay: Jan 10–12.' },
      'High',
    );
    await send('immediate-high', p);

  } else if (scenario === 'batch-high') {
    const highEmails = MOCK_EMAILS.filter(e => e.priority === 'High');
    const payloads = formatBatch(highEmails, 'High');
    for (const p of payloads) await send('batch-high', p);

  } else if (scenario === 'batch-medium') {
    const medEmails = MOCK_EMAILS.filter(e => e.priority === 'Medium');
    const payloads = formatBatch(medEmails, 'Medium');
    for (const p of payloads) await send('batch-medium', p);

  } else if (scenario === 'batch-all') {
    for (const priority of ['High', 'Medium', 'Low'] as const) {
      const emails = MOCK_EMAILS.filter(e => e.priority === priority);
      if (emails.length === 0) continue;
      const payloads = formatBatch(emails, priority);
      for (const p of payloads) await send(`batch-${priority.toLowerCase()}`, p);
    }

  } else if (scenario === 'batch-large') {
    // 21 emails to test chunking at 20
    const emails: PendingEmail[] = Array.from({ length: 21 }, (_, i) => ({
      id: `bulk${i}`,
      from_addr: `sender${i}@example.com`,
      subject: `Test email ${i}`,
      summary: `This is test summary number ${i} with some realistic-sounding content.`,
      priority: 'Low' as const,
      received_at: NOW - i * 60000,
    }));
    const payloads = formatBatch(emails, 'Low');
    for (const p of payloads) await send('batch-large-chunk', p);

  } else if (scenario === 'cron-high') {
    await notifyBatch('High', c.env);
    return c.json({ ok: true, message: 'High cron triggered — check ntfy' });

  } else if (scenario === 'cron-medium') {
    await notifyBatch('Medium', c.env);
    return c.json({ ok: true, message: 'Medium cron triggered — check ntfy' });

  } else if (scenario === 'cron-low') {
    await notifyBatch('Low', c.env);
    return c.json({ ok: true, message: 'Low cron triggered — check ntfy' });

  } else if (scenario === 'cron-all') {
    await notifyBatch('High', c.env);
    await notifyBatch('Medium', c.env);
    await notifyBatch('Low', c.env);
    await notifyBatch('Not Necessary', c.env);
    return c.json({ ok: true, message: 'All crons triggered — check ntfy' });

  } else if (scenario === 'resend-since') {
    const sinceParam = c.req.query('since');
    if (!sinceParam || !Number.isFinite(Number(sinceParam))) {
      return c.json({ error: 'resend-since requires ?since=<timestamp_ms> (integer)' }, 400);
    }
    const since = Number(sinceParam);
    const { meta } = await c.env.DB.prepare(
      'UPDATE pending_emails SET sent_at = NULL WHERE received_at >= ? OR sent_at >= ?'
    ).bind(since, since).run();
    await notifyBatch('High', c.env);
    await notifyBatch('Medium', c.env);
    await notifyBatch('Low', c.env);
    await notifyBatch('Not Necessary', c.env);
    return c.json({ ok: true, rows_reset: meta.changes, message: 'Reset and triggered all batches' });

  } else {
    return c.json({ error: `Unknown scenario: ${scenario}. Valid: immediate-critical, immediate-high, batch-high, batch-medium, batch-all, batch-large, cron-high, cron-medium, cron-low, cron-all` }, 400);
  }

  return c.json({ ok: true, results });
}
