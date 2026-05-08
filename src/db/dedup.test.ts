import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { isProcessed, markProcessed } from './dedup';

describe('dedup', () => {
  it('returns false before marking', async () => {
    expect(await isProcessed('msg_abc', env)).toBe(false);
  });

  it('returns true after marking', async () => {
    await markProcessed('msg_xyz', env);
    expect(await isProcessed('msg_xyz', env)).toBe(true);
  });

  it('markProcessed is idempotent', async () => {
    await markProcessed('msg_dup', env);
    await expect(markProcessed('msg_dup', env)).resolves.toBeUndefined();
  });
});
