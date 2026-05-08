import { createLocalJWKSet, jwtVerify } from 'jose';
import type { MiddlewareHandler }         from 'hono';
import type { Env }                       from '../env';
import { getGoogleJWKS }                  from '../lib/jwks';
import { logger }                         from '../lib/logger';

export const pubsubAuthMiddleware: MiddlewareHandler<{ Bindings: Env }> =
  async (c, next) => {
    const auth  = c.req.header('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      logger.warn({ event: 'jwt.missing' });
      return c.text('Unauthorized', 401);
    }

    try {
      const jwksRaw = await getGoogleJWKS(c.env);
      const JWKS    = createLocalJWKSet(JSON.parse(jwksRaw));

      const { payload } = await jwtVerify(token, JWKS, {
        issuer:   'https://accounts.google.com',
        audience: c.env.PUBSUB_AUDIENCE,
      });

      if (payload['email'] !== c.env.PUBSUB_SA_EMAIL) {
        logger.warn({ event: 'jwt.wrong_email' });
        return c.text('Unauthorized', 401);
      }
      if (payload['email_verified'] !== true) {
        logger.warn({ event: 'jwt.email_not_verified' });
        return c.text('Unauthorized', 401);
      }

      await next();
    } catch (err) {
      logger.warn({ event: 'jwt.invalid', error: String(err) });
      return c.text('Unauthorized', 401);
    }
  };
