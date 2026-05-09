# email-monitor — Claude Agent Guide

You are helping a user set up, deploy, and customize **email-monitor**: a Cloudflare Worker that watches Gmail via Pub/Sub, classifies emails with AI, and pushes prioritized notifications to a self-hosted Gotify server.

## Your role

Guide the user step-by-step through setup. Each step has prerequisites — check them before proceeding. When a step requires the user to take action in an external UI (Google Cloud Console, Gotify, Fly.io), give exact instructions and wait for confirmation before continuing.

## Architecture overview

```
Gmail → Pub/Sub push → /pubsub/webhook → rules filter → AI classifier
                                                              ↓
                                                     D1 pending_emails
                                                              ↓
                                              cron jobs (per priority tier)
                                                              ↓
                                                    Gotify → phone
```

Key files:
- `src/classifier/rules.ts` + `rules.json` — label-based pre-filter and domain allowlist
- `src/classifier/prompt.ts` — AI system prompt (edit to change classification behavior)
- `src/classifier/openrouter.ts` — primary AI (OpenRouter); `workers-ai.ts` is the fallback
- `src/notify/formatter.ts` — notification format (title, body, markdown)
- `src/notify/batch.ts` — reads D1, sends unsent emails per priority tier
- `src/handlers/cron.ts` — cron schedule per priority
- `src/handlers/admin.ts` — multi-account management endpoints
- `src/gmail/auth.ts` — per-account token management (KV-backed)
- `wrangler.toml` — Cloudflare resource bindings and cron triggers

## Setup sequence

Walk the user through these phases in order. Do not skip ahead.

### Phase 1: Cloudflare resources

1. Confirm `wrangler` is installed and logged in: `wrangler whoami`
2. Create KV namespace:
   ```bash
   wrangler kv namespace create email-monitor-kv
   wrangler kv namespace create email-monitor-kv --preview
   ```
   Update `wrangler.toml` with the returned `id` and `preview_id`.
3. Create D1 database:
   ```bash
   wrangler d1 create email-monitor-db
   ```
   Update `wrangler.toml` with the returned `database_id`.
4. Apply migrations:
   ```bash
   wrangler d1 migrations apply email-monitor-db
   ```

### Phase 2: Google Cloud

The user needs a Google Cloud project with Gmail API and Cloud Pub/Sub enabled.

1. **Enable APIs** — in Google Cloud Console: APIs & Services → Enable both Gmail API and Cloud Pub/Sub API.
2. **OAuth credentials** — Credentials → Create OAuth 2.0 Client ID (type: **Web application**). Under Authorized redirect URIs add `https://developers.google.com/oauthplayground`. Note client ID and secret.
3. **Refresh token for primary account** — Direct the user to https://developers.google.com/oauthplayground/:
   - Gear icon → check "Use your own OAuth credentials" → enter client ID and secret
   - Scope: `https://mail.google.com/`
   - Authorize → sign in with the primary Gmail account → exchange for tokens → copy the refresh token
4. **Pub/Sub topic** — Pub/Sub → Topics → Create topic (e.g. `gmail-push`). Note the full name: `projects/<project>/topics/gmail-push`.
5. **Push subscription** — on the topic, create a Push subscription pointing to:
   `https://<worker-name>.<subdomain>.workers.dev/pubsub/webhook`
   (The worker URL is known after the first deploy in Phase 4 — come back to this step then.)
6. **Service account** — IAM → Service Accounts → Create. Grant role: `Pub/Sub Token Creator`. Note the email address.

### Phase 3: Gotify

The user needs a running Gotify server. Recommend Fly.io free tier if they don't have one.

**Fly.io setup (recommended):**
```bash
fly launch --image gotify/server --name <app-name> --region sjc --no-deploy
fly volumes create gotify_data --size 1 --region sjc
```

Edit the generated `fly.toml` — set:
```toml
[env]
  GOTIFY_SERVER_PORT = "8080"
[http_service]
  internal_port = 8080
  auto_stop_machines = "off"
  min_machines_running = 1
[mounts]
  source = "gotify_data"
  destination = "/app/data"
```

Then deploy:
```bash
fly deploy
```

After the server is up, the user must:
1. Open `https://<app-name>.fly.dev` and log in (default: admin/admin — change immediately).
2. Apps → Create application → note the **app token**.
3. Install the Gotify Android/iOS app and add the server.

### Phase 4: Secrets and deploy

Set all secrets before deploying:
```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GMAIL_REFRESH_TOKEN
wrangler secret put GMAIL_WATCH_TOPIC        # projects/<project>/topics/<topic>
wrangler secret put OPENROUTER_API_KEY       # from openrouter.ai — optional but recommended
wrangler secret put GOTIFY_SERVER            # https://<app-name>.fly.dev
wrangler secret put GOTIFY_TOKEN             # app token from Gotify UI
wrangler secret put PUBSUB_SA_EMAIL          # <sa>@<project>.iam.gserviceaccount.com
wrangler secret put DEBUG_SECRET             # any random string
```

Deploy:
```bash
npm run deploy
```

After deploy, note the worker URL and:
- Complete the Pub/Sub push subscription (Phase 2 step 5) with the real worker URL.
- Set the remaining secret:
  ```bash
  wrangler secret put PUBSUB_AUDIENCE        # https://<worker>.workers.dev/pubsub/webhook
  ```

### Phase 5: Activate Gmail watch

Register the Gmail push subscription so Google starts sending webhooks:
```bash
curl "https://<worker>.workers.dev/pubsub/renew-watch?secret=<DEBUG_SECRET>"
```

The watch auto-renews once daily via cron.

### Phase 6: Verify

Send a test notification to confirm the full pipeline works:
```bash
curl "https://<worker>.workers.dev/test/notify?secret=<DEBUG_SECRET>&scenario=immediate-high"
```

Check `/debug?secret=<DEBUG_SECRET>` to inspect the DB state if something looks wrong.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in values, then:
```bash
npm run dev          # local worker on port 8787
npm run db:migrate   # apply migrations locally
npm test             # run test suite
```

Test notifications locally:
```bash
curl "http://localhost:8787/test/notify?secret=<DEBUG_SECRET>&scenario=batch-high"
```

Available test scenarios: `immediate-critical`, `immediate-high`, `batch-high`, `batch-medium`, `batch-all`, `batch-large`, `cron-high`, `cron-medium`, `cron-low`, `cron-all`, `resend-since`.

### Phase 7: Add more Gmail accounts (optional)

The worker monitors multiple Gmail accounts from a single deployment. For each additional account:

1. Go to https://developers.google.com/oauthplayground/ — use the same OAuth credentials (gear icon → your client ID and secret).
2. Authorize with the additional account's Gmail, exchange for tokens, copy the refresh token.
3. Register via the admin endpoint:
   ```bash
   curl -X POST "https://<worker>.workers.dev/admin/accounts?secret=<DEBUG_SECRET>&email=other@gmail.com&refresh_token=<REFRESH_TOKEN>"
   ```
   This stores the token in KV and immediately registers a push watch for the account.

To list all registered accounts:
```bash
curl "https://<worker>.workers.dev/admin/accounts?secret=<DEBUG_SECRET>"
```

**Important:** The OAuth Playground requires a **Web application** OAuth client (not Desktop). If the user created a Desktop client, guide them to create a new Web application client and add `https://developers.google.com/oauthplayground` as an authorized redirect URI.

## Customisation

### Change classification behavior
Edit `src/classifier/prompt.ts` — the `SYSTEM` constant is the full AI prompt. Adjust priority definitions or summary style as needed.

### Allowlist trusted senders
Edit `src/classifier/rules.json`:
```json
{
  "allowlist": ["@yourcompany.com", "specific@example.com"]
}
```
Allowlisted senders bypass label rules and always go through AI classification.

### Ignore additional labels
Add Gmail label IDs to `ignoreLabels` in `rules.json`. Emails with these labels are discarded without AI.

### Change notification schedule
Edit the `crons` array in `wrangler.toml` and the `switch` in `src/handlers/cron.ts`. Both must stay in sync.

## Debugging

- **No notifications arriving** — check `/debug` for pending emails; check if `sent_at` is null; manually trigger with `cron-high` scenario.
- **Webhook not receiving events** — verify the Pub/Sub push subscription URL matches the deployed worker URL exactly, including the `/pubsub/webhook` path.
- **Classification looks wrong** — check the AI prompt in `src/classifier/prompt.ts`; adjust priority rules or add examples.
- **Gotify not reachable** — confirm the Fly.io machine is running (`fly status`); check `GOTIFY_SERVER` has no trailing slash.
- **Gmail watch expired** — call `/pubsub/renew-watch` manually; watches expire after 7 days if the cron fails.
