import { env } from 'cloudflare:test';
import { beforeAll } from 'vitest';

beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS state (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS processed_history (
      history_id   TEXT PRIMARY KEY,
      processed_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS pending_emails (
      id          TEXT PRIMARY KEY,
      from_addr   TEXT NOT NULL,
      subject     TEXT NOT NULL,
      summary     TEXT NOT NULL,
      priority    TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      sent_at     INTEGER
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS processed_messages (
      message_id   TEXT PRIMARY KEY,
      processed_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pending_priority_sent ON pending_emails(priority, sent_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_messages(processed_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_history_at ON processed_history(processed_at)`),
  ]);
});
