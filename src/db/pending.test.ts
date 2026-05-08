import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { addPendingEmail, getPendingByPriority, markSent, cleanupOld } from './pending';

const base = {
  from_addr: 'alice@example.com',
  subject:   'Hello',
  summary:   'A test email',
  received_at: Date.now(),
};

describe('pending emails', () => {
  it('getPendingByPriority returns empty initially', async () => {
    expect(await getPendingByPriority('High', env)).toHaveLength(0);
  });

  it('addPendingEmail then retrieve by priority', async () => {
    await addPendingEmail({ id: 'e1', ...base, priority: 'High' }, env);
    await addPendingEmail({ id: 'e2', ...base, priority: 'Low' }, env);
    const high = await getPendingByPriority('High', env);
    expect(high).toHaveLength(1);
    expect(high[0]!.id).toBe('e1');
  });

  it('markSent removes emails from pending query', async () => {
    await addPendingEmail({ id: 'e3', ...base, priority: 'High' }, env);
    await addPendingEmail({ id: 'e4', ...base, priority: 'High' }, env);
    await markSent(['e3'], env);
    const pending = await getPendingByPriority('High', env);
    const ids = pending.map(e => e.id);
    expect(ids).not.toContain('e3');
    expect(ids).toContain('e4');
  });

  it('markSent with empty array is a no-op', async () => {
    await expect(markSent([], env)).resolves.toBeUndefined();
  });

  it('cleanupOld removes sent emails older than 24h', async () => {
    const old = Date.now() - 25 * 60 * 60 * 1000;
    await env.DB.prepare(
      'INSERT INTO pending_emails (id, from_addr, subject, summary, priority, received_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind('old1', 'x@y.com', 'Old', 'Old', 'Low', old, old).run();
    await addPendingEmail({ id: 'new1', ...base, priority: 'Low' }, env);
    await cleanupOld(env);
    const row = await env.DB.prepare('SELECT id FROM pending_emails WHERE id = ?').bind('old1').first();
    expect(row).toBeNull();
  });
});
