import type { Env } from '../env';

const FAILURES_KEY    = 'classifier:failures';
const CIRCUIT_KEY     = 'classifier:circuit-open';
const CIRCUIT_TTL_SEC = 300;
const FAILURE_LIMIT   = 3;

export async function isCircuitOpen(env: Env): Promise<boolean> {
  try {
    return (await env.KV.get(CIRCUIT_KEY)) !== null;
  } catch {
    return false;
  }
}

export async function recordFailure(env: Env): Promise<void> {
  try {
    const raw = await env.KV.get(FAILURES_KEY);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    if (count >= FAILURE_LIMIT) {
      // Trip the circuit and clear the failure counter so the count resets after circuit closes
      await env.KV.put(CIRCUIT_KEY, '1', { expirationTtl: CIRCUIT_TTL_SEC });
      await env.KV.delete(FAILURES_KEY);
    } else {
      // Failure counter also has a TTL so transient errors don't accumulate forever
      await env.KV.put(FAILURES_KEY, String(count), { expirationTtl: CIRCUIT_TTL_SEC });
    }
  } catch { /* non-fatal */ }
}

export async function recordSuccess(env: Env): Promise<void> {
  try {
    await env.KV.delete(FAILURES_KEY);
  } catch { /* non-fatal */ }
}
