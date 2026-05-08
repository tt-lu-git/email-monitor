import { Hono }                from 'hono';
import type { Env }            from './env';
import { pubsubAuthMiddleware } from './middleware/pubsubAuth';
import { webhookHandler }      from './handlers/webhook';
import { healthHandler }       from './handlers/health';
import { debugHandler }        from './handlers/debug';
import { testNotifyHandler }   from './handlers/test';

export function createRouter() {
  const app = new Hono<{ Bindings: Env }>();
  app.get('/health', healthHandler);
  app.get('/debug', debugHandler);
  app.get('/test/notify', testNotifyHandler);
  app.post('/pubsub/webhook', pubsubAuthMiddleware, webhookHandler);
  return app;
}
