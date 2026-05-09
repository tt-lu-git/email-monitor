# email-monitor

A Cloudflare Worker that monitors your Gmail inbox, classifies emails with AI, and pushes prioritized notifications to your phone via [Gotify](https://gotify.net/).

## How it works

1. **Gmail Pub/Sub push** — Google sends a webhook to the worker whenever new mail arrives. Multiple Gmail accounts are supported.
2. **Rule-based pre-filter** — Promotions, social, and spam labels are discarded immediately. Newsletters (list-unsubscribe header) are batched as low priority. A per-domain allowlist bypasses label rules and always goes to AI.
3. **AI classification** — Each remaining email is classified by priority (`Critical` → `High` → `Medium` → `Low` → `Not Necessary` → `Ignore`) and summarized in one actionable sentence. Uses [OpenRouter](https://openrouter.ai/) with Workers AI as fallback.
4. **Batched delivery** — Classified emails sit in a D1 queue. Cron jobs flush each priority tier on its own schedule to Gotify.

## Priority schedule

| Priority | Flush interval | Example |
|---|---|---|
| Critical | immediate (on receive) | Security alert, OTP, payment failure |
| High | every 30 min | Meeting change, deadline, time-sensitive billing |
| Medium | every hour | Order confirmation, delivery update, FYI |
| Low | every 2 hours | Automated status update |
| Not Necessary | once daily | Digest, routine ping |
| Ignore | never | Ads, promotions, spam |

## Prerequisites

- [Cloudflare](https://cloudflare.com/) account (Workers, D1, KV, Workers AI — all on free tier)
- [Google Cloud](https://console.cloud.google.com/) project with Gmail API + Pub/Sub enabled
- [Gotify](https://gotify.net/) server (self-host on [Fly.io](https://fly.io/) free tier or any server)
- [OpenRouter](https://openrouter.ai/) API key (optional — falls back to Workers AI)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/tt-lu-git/email-monitor
cd email-monitor
npm install
```

### 2. Create Cloudflare resources

```bash
# KV namespace
wrangler kv namespace create email-monitor-kv
wrangler kv namespace create email-monitor-kv --preview

# D1 database
wrangler d1 create email-monitor-db

# Apply migrations
wrangler d1 migrations apply email-monitor-db
```

Update `wrangler.toml` with the IDs printed by these commands.

### 3. Google Cloud setup

1. Create a project and enable **Gmail API** and **Cloud Pub/Sub**.
2. Create an OAuth 2.0 client (type: **Web application**). Under **Authorized redirect URIs** add `https://developers.google.com/oauthplayground`. Note the client ID and secret.
3. Get a refresh token for your primary Gmail account — use the [OAuth Playground](https://developers.google.com/oauthplayground/): gear icon → enable "Use your own OAuth credentials" → enter your client ID and secret → scope `https://mail.google.com/` → authorize → exchange for tokens → copy the refresh token.
4. Create a Pub/Sub topic (e.g. `gmail-push`) and a push subscription pointing to `https://<your-worker>.workers.dev/pubsub/webhook`.
5. Create a service account, grant it the `Pub/Sub Token Creator` role, and note its email address.

### 4. Set secrets

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GMAIL_REFRESH_TOKEN
wrangler secret put GMAIL_WATCH_TOPIC        # projects/<project>/topics/<topic>
wrangler secret put OPENROUTER_API_KEY
wrangler secret put GOTIFY_SERVER            # https://<your-gotify-host>
wrangler secret put GOTIFY_TOKEN             # app token from Gotify UI
wrangler secret put PUBSUB_AUDIENCE          # https://<your-worker>.workers.dev/pubsub/webhook
wrangler secret put PUBSUB_SA_EMAIL          # <service-account>@<project>.iam.gserviceaccount.com
wrangler secret put DEBUG_SECRET             # any random string — protects /debug and /test/notify
```

### 5. Deploy

```bash
npm run deploy
```

After the first deploy, register the Gmail push watch:

```bash
curl "https://<your-worker>.workers.dev/pubsub/renew-watch?secret=<DEBUG_SECRET>"
```

The worker renews the watch automatically once daily via cron.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in your values, then:

```bash
npm run dev          # start local worker on port 8787
npm run db:migrate   # apply D1 migrations locally
npm test             # run test suite
```

## Multiple Gmail accounts

The worker supports monitoring multiple Gmail accounts from a single deployment. Each account gets its own OAuth refresh token stored in KV.

### Add an account

1. Get a refresh token for the account using the same OAuth Playground flow as setup step 3 (sign in with the target account when authorizing).
2. Register it via the admin endpoint:

```bash
curl -X POST "https://<your-worker>.workers.dev/admin/accounts?secret=<DEBUG_SECRET>&email=other@gmail.com&refresh_token=<REFRESH_TOKEN>"
```

This stores the token and immediately registers a Gmail push watch for the new account.

### List accounts

```bash
curl "https://<your-worker>.workers.dev/admin/accounts?secret=<DEBUG_SECRET>"
```

### Remove an account

```bash
curl -X DELETE "https://<your-worker>.workers.dev/admin/accounts?secret=<DEBUG_SECRET>&email=other@gmail.com"
```

## Customising classification

**Rules** (`src/classifier/rules.json`):
- `ignoreLabels` — Gmail labels that skip AI and are discarded silently.
- `allowlist` — Domains (e.g. `@example.com`) or full addresses that bypass label rules and always go to AI.

**Prompt** (`src/classifier/prompt.ts`): Edit the system prompt to change priority definitions or summary style.

## Routes

| Route | Description |
|---|---|
| `POST /pubsub/webhook` | Gmail Pub/Sub push endpoint |
| `GET /pubsub/renew-watch` | Manually trigger Gmail watch renewal |
| `GET /health` | Health check |
| `GET /debug?secret=` | Show worker state and recent DB entries |
| `GET /test/notify?secret=&scenario=` | Send a test notification (see `src/handlers/test.ts` for scenarios) |
| `GET /admin/accounts?secret=` | List monitored Gmail accounts |
| `POST /admin/accounts?secret=&email=&refresh_token=` | Add a Gmail account |
| `DELETE /admin/accounts?secret=&email=` | Remove a Gmail account |

## Tech stack

- **Runtime** — Cloudflare Workers (TypeScript)
- **Router** — [Hono](https://hono.dev/)
- **Database** — Cloudflare D1 (SQLite)
- **Cache/state** — Cloudflare KV
- **AI** — OpenRouter (primary) + Cloudflare Workers AI (fallback)
- **Notifications** — Self-hosted Gotify
- **Auth** — JWT verification via Google JWKS for Pub/Sub webhooks

## License

MIT
