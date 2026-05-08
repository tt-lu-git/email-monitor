import type { Handler } from 'hono';

const START = Date.now();

export const healthHandler: Handler = (c) =>
  c.json({ status: 'ok', uptime: Math.floor((Date.now() - START) / 1000) });
