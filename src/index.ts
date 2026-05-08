import type { ExportedHandler } from '@cloudflare/workers-types';
import type { Env }             from './env';
import { createRouter }         from './router';
import { scheduledHandler }     from './handlers/cron';

const router = createRouter();

export default {
  fetch:     router.fetch.bind(router),
  scheduled: scheduledHandler,
} satisfies ExportedHandler<Env>;
