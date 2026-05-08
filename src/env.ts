export interface Env {
  KV: KVNamespace;
  DB: D1Database;
  AI: Ai;

  GMAIL_REFRESH_TOKEN:  string;
  GOOGLE_CLIENT_ID:     string;
  GOOGLE_CLIENT_SECRET: string;
  GMAIL_WATCH_TOPIC:    string;

  OPENROUTER_API_KEY: string;

  GOTIFY_SERVER:  string;
  GOTIFY_TOKEN:   string;

  PUBSUB_AUDIENCE: string;
  PUBSUB_SA_EMAIL:  string;

  DEBUG_SECRET: string;
}
