import { describe, it, expect } from 'vitest';
import { formatImmediate, formatBatch } from './formatter';
import type { PendingEmail } from '../db/pending';

const email: PendingEmail = { from_addr: 'alice@x.com', subject: 'Urgent', summary: 'Fix now', id: 'e1', priority: 'High' as const, received_at: Date.now() };

describe('formatImmediate', () => {
  it('Critical has ntfy priority 5 and rotating_light tag', () => {
    const p = formatImmediate({ from: 'a@b.com', subject: 'Down', summary: 'Server down' }, 'Critical', );
    expect(p.priority).toBe(5);
    expect(p.tags).toContain('rotating_light');
    expect(p.title).toContain('Down');
    expect(p.message).toBe('Server down');
  });
});

describe('formatBatch', () => {
  it('High batch has priority 4', () => {
    const payloads = formatBatch([email], 'High', );
    expect(payloads[0]!.priority).toBe(4);
  });

  it('chunks at 20 emails and title shows count', () => {
    // Use distinct senders so each gets its own bullet
    const emails: PendingEmail[] = Array.from({ length: 21 }, (_, i) => ({
      ...email, id: `e${i}`, from_addr: `sender${i}@x.com`, summary: `Summary ${i}`,
    }));
    const payloads = formatBatch(emails, 'High', );
    expect(payloads).toHaveLength(2);
    expect(payloads[0]!.title).toMatch(/^\[20 emails\]/);
    expect(payloads[1]!.title).toMatch(/^\[1 email\]/);
  });

  it('groups same-sender emails into one bullet', () => {
    const emails: PendingEmail[] = [
      { ...email, id: 'e1', summary: 'Order confirmed $30' },
      { ...email, id: 'e2', summary: 'Shipping update for order' },
    ];
    const payloads = formatBatch(emails, 'High', );
    expect(payloads[0]!.message).toContain('(2)');
    expect(payloads[0]!.message).toContain('Order confirmed $30');
    expect(payloads[0]!.message).toContain('Shipping update');
  });

  it('returns empty array for empty input', () => {
    expect(formatBatch([], 'Low', )).toHaveLength(0);
  });
});
