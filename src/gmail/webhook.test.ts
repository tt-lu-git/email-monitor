import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { processWebhook } from './webhook';

const mockEmail = {
  id: 'msg1', threadId: 't1', snippet: 'hello',
  labelIds: ['INBOX'],
  payload: {
    mimeType: 'text/plain',
    body: { data: btoa('Hello world'), size: 11 },
    headers: [
      { name: 'From', value: 'alice@example.com' },
      { name: 'Subject', value: 'Test email' },
      { name: 'Date', value: 'Thu, 7 May 2026 10:00:00 +0000' },
    ],
  },
};

afterEach(() => vi.restoreAllMocks());

describe('processWebhook', () => {
  it('returns empty array when all messages already processed', async () => {
    await env.DB.prepare('INSERT INTO processed_messages (message_id, processed_at) VALUES (?, ?)')
      .bind('msg1', Date.now()).run();
    await env.DB.prepare('INSERT INTO state (key, value, updated_at) VALUES (?, ?, ?)')
      .bind('gmail:history_id:me@gmail.com', '100', Date.now()).run();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = url.toString();
      if (u.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
      if (u.includes('history')) return new Response(JSON.stringify({ historyId: '101', history: [{ messagesAdded: [{ message: { id: 'msg1' } }] }] }));
      return new Response('{}');
    });

    const result = await processWebhook({ emailAddress: 'me@gmail.com', historyId: '101' }, env);
    expect(result).toHaveLength(0);
  });

  it('fetches and returns new messages', async () => {
    await env.DB.prepare('INSERT INTO state (key, value, updated_at) VALUES (?, ?, ?)')
      .bind('gmail:history_id:me@gmail.com', '100', Date.now()).run();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = url.toString();
      if (u.includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }));
      if (u.includes('history')) return new Response(JSON.stringify({ historyId: '102', history: [{ messagesAdded: [{ message: { id: 'msg2' } }] }] }));
      if (u.includes('/messages/msg2')) return new Response(JSON.stringify(mockEmail));
      return new Response('{}');
    });

    const result = await processWebhook({ emailAddress: 'me@gmail.com', historyId: '102' }, env);
    expect(result).toHaveLength(1);
    expect(result[0]!.from).toBe('alice@example.com');
  });
});
