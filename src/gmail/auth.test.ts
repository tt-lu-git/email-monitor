import { describe, it, expect, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { getAccessToken } from './auth';

const mockToken = { access_token: 'tok_fresh', expires_in: 3600 };

afterEach(() => vi.restoreAllMocks());

describe('getAccessToken', () => {
  it('returns cached token when not expired', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cached = { token: 'tok_cached', exp: Date.now() + 3000000 };
    await env.KV.put('gmail:access_token:__primary__', JSON.stringify(cached));
    const result = await getAccessToken(env);
    expect(result).toBe('tok_cached');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refreshes when cache is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockToken), { status: 200 })
    );
    const result = await getAccessToken(env);
    expect(result).toBe('tok_fresh');
  });

  it('refreshes when token is expired', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockToken), { status: 200 })
    );
    const expired = { token: 'tok_old', exp: Date.now() - 1000 };
    await env.KV.put('gmail:access_token:__primary__', JSON.stringify(expired));
    const result = await getAccessToken(env);
    expect(result).toBe('tok_fresh');
  });

  it('throws on token endpoint 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    );
    await expect(getAccessToken(env)).rejects.toThrow('401');
  });
});
