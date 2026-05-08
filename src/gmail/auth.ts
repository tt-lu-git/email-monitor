import type { Env } from '../env';

interface CachedToken {
  token: string;
  exp:   number;
}

export async function getAccountEmails(env: Env): Promise<string[]> {
  const raw = await env.KV.get('gmail:accounts');
  if (raw) {
    const emails = JSON.parse(raw) as string[];
    if (emails.length > 0) return emails;
  }
  // Fallback: single-account mode using the legacy secret
  if (env.GMAIL_REFRESH_TOKEN) return ['__primary__'];
  return [];
}

async function getRefreshToken(env: Env, email: string): Promise<string> {
  if (email !== '__primary__') {
    const fromKV = await env.KV.get(`gmail:refresh_token:${email}`);
    if (fromKV) return fromKV;
  }
  return env.GMAIL_REFRESH_TOKEN;
}

export async function getAccessToken(env: Env, email = '__primary__'): Promise<string> {
  const cacheKey = `gmail:access_token:${email}`;
  const raw = await env.KV.get(cacheKey);
  if (raw) {
    const cached: CachedToken = JSON.parse(raw);
    if (cached.exp > Date.now() + 60_000) return cached.token;
  }

  const refreshToken = await getRefreshToken(env, email);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
    }),
  });

  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status}`);

  const data = await res.json<{ access_token: string; expires_in: number }>();
  const cached: CachedToken = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  await env.KV.put(cacheKey, JSON.stringify(cached), { expirationTtl: Math.max(data.expires_in - 60, 1) });
  return data.access_token;
}
