import { Hono }                from 'hono';
import type { Env }            from './env';
import { pubsubAuthMiddleware } from './middleware/pubsubAuth';
import { webhookHandler }      from './handlers/webhook';
import { healthHandler }       from './handlers/health';
import { debugHandler }        from './handlers/debug';
import { testNotifyHandler }   from './handlers/test';
import { listAccountsHandler, addAccountHandler, removeAccountHandler } from './handlers/admin';

export function createRouter() {
  const app = new Hono<{ Bindings: Env }>();
  app.get('/health', healthHandler);
  app.get('/debug', debugHandler);
  app.get('/test/notify', testNotifyHandler);
  app.get('/admin/accounts', listAccountsHandler);
  app.post('/admin/accounts', addAccountHandler);
  app.delete('/admin/accounts', removeAccountHandler);
  app.post('/pubsub/webhook', pubsubAuthMiddleware, webhookHandler);
  return app;
}
