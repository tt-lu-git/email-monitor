import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { getState, setState } from './state';

describe('state', () => {
  it('returns null for missing key', async () => {
    expect(await getState('missing:key', env)).toBeNull();
  });

  it('round-trips a value', async () => {
    await setState('gmail:history_id', '12345', env);
    expect(await getState('gmail:history_id', env)).toBe('12345');
  });

  it('overwrites existing value', async () => {
    await setState('gmail:history_id', 'v1', env);
    await setState('gmail:history_id', 'v2', env);
    expect(await getState('gmail:history_id', env)).toBe('v2');
  });
});
