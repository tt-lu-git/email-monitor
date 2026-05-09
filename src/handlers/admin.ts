import type { Context } from 'hono';
import type { Env } from '../env';
import { getAccountEmails } from '../gmail/auth';
import { renewWatch } from '../gmail/watch';

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

function authGuard(c: Context<{ Bindings: Env }>): boolean {
  const secret = c.req.query('secret') ?? '';
  return !!c.env.DEBUG_SECRET && timingSafeEqual(secret, c.env.DEBUG_SECRET);
}

/** GET /admin/accounts — list registered accounts */
export async function listAccountsHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  if (!authGuard(c)) return c.json({ error: 'unauthorized' }, 401);
  const emails = await getAccountEmails(c.env);
  return c.json({ accounts: emails });
}

/** POST /admin/accounts?secret=&email=&refresh_token= — add an account */
export async function addAccountHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  if (!authGuard(c)) return c.json({ error: 'unauthorized' }, 401);

  const email        = c.req.query('email')?.trim().toLowerCase();
  const refreshToken = c.req.query('refresh_token')?.trim();

  if (!email || !refreshToken) {
    return c.json({ error: 'email and refresh_token are required' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'invalid email format' }, 400);
  }

  const current = await getAccountEmails(c.env);
  const list    = current.filter(e => e !== '__primary__');

  if (!list.includes(email)) list.push(email);

  await c.env.KV.put('gmail:accounts', JSON.stringify(list));
  await c.env.KV.put(`gmail:refresh_token:${email}`, refreshToken);

  // Register Gmail push watch for the new account immediately
  try {
    await renewWatch(c.env);
  } catch (err) {
    return c.json({ ok: true, email, warning: `Account saved but watch renewal failed: ${String(err)}` });
  }

  return c.json({ ok: true, email, accounts: list });
}

/** DELETE /admin/accounts?secret=&email= — remove an account */
export async function removeAccountHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  if (!authGuard(c)) return c.json({ error: 'unauthorized' }, 401);

  const email = c.req.query('email')?.trim().toLowerCase();
  if (!email) return c.json({ error: 'email is required' }, 400);

  const current = await getAccountEmails(c.env);
  const list    = current.filter(e => e !== '__primary__' && e !== email);

  await c.env.KV.put('gmail:accounts', JSON.stringify(list));
  await c.env.KV.delete(`gmail:refresh_token:${email}`);
  await c.env.KV.delete(`gmail:access_token:${email}`);

  return c.json({ ok: true, removed: email, accounts: list });
}
