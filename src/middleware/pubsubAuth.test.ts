import { describe, it, expect, vi, afterEach } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('pubsubAuth middleware', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when Authorization header is missing', async () => {
    const res = await SELF.fetch('http://localhost/pubsub/webhook', {
      method: 'POST',
      body:   JSON.stringify({ message: { data: btoa('{}'), messageId: 'x' } }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is not a Bearer scheme', async () => {
    const res = await SELF.fetch('http://localhost/pubsub/webhook', {
      method:  'POST',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      body:    JSON.stringify({ message: { data: btoa('{}'), messageId: 'x' } }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /health returns 200 without auth', async () => {
    const res = await SELF.fetch('http://localhost/health');
    expect(res.status).toBe(200);
    const body = await res.json<{ status: string }>();
    expect(body.status).toBe('ok');
  });
});
