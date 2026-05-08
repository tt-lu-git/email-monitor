import type { Env } from '../env';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const KV_KEY          = 'jwks:google';
const FALLBACK_TTL    = 3600;

export async function getGoogleJWKS(env: Env): Promise<string> {
  const cached = await env.KV.get(KV_KEY);
  if (cached) return cached;

  const res = await fetch(GOOGLE_JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

  const body = await res.text();
  const json = JSON.parse(body) as { keys?: unknown[] };
  if (!Array.isArray(json.keys) || json.keys.length === 0) {
    throw new Error('JWKS: invalid response — no keys');
  }

  const cc   = res.headers.get('Cache-Control') ?? '';
  const match = /max-age=(\d+)/.exec(cc);
  const ttl  = match ? parseInt(match[1]!, 10) : FALLBACK_TTL;

  await env.KV.put(KV_KEY, body, { expirationTtl: ttl });
  return body;
}
