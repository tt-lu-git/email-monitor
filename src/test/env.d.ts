import type { Env } from '../env';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}
