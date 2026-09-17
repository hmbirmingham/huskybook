# HuskyBook

A peer-to-peer directory connecting UConn students who offer personal-care services — hair, nails, makeup, braids — with students looking to book one. Most providers here are informal: someone doing hair or nails out of a dorm room, or willing to travel to yours, not a licensed shop with fixed hours.

Full write-up of how this was built, and the reasoning behind the decisions below, is in [BUILD_LOG.md](./BUILD_LOG.md).

**Not affiliated with the University of Connecticut.** "Husky" is used here as a nod to the mascot, not an official UConn product.

## Setup

Requires Node 18+.

```bash
npm install
npm run dev
```

This starts the Express API on `http://localhost:3001` and the Vite dev server on `http://localhost:5173`, and creates a local SQLite database at `server/data/huskybook.sqlite` on first run (schema is created automatically; no separate migration step). The database is a real SQLite file via [libSQL](https://github.com/tursodatabase/libsql) — no external account needed for local dev. In production, the same client instead points at a hosted [Turso](https://turso.tech) database (see Deployment below) so data survives a redeploy on a host with no persistent disk of its own.

To load/reset to the sample data at any point:

```bash
npm run seed
```

## Deployment

Target host is [Render](https://render.com) — free web service tier, no card required. (`railway.toml` is still in the repo in case Railway access ever changes, but it isn't the maintained path; Fly.io was also considered and ruled out since it now requires a card even for its trial.)

**To deploy:** push this repo to GitHub (already done), then in Render's dashboard use "New > Blueprint" and point it at the repo — `render.yaml` at the root defines the service, so most of the setup happens automatically. Render will prompt for the environment variables marked `sync: false` in that file (see below) the first time the Blueprint is applied.

The app builds and runs the same regardless of host: `npm run build` builds the client (`vite build` → `client/dist`), `npm run start` runs `node server/src/index.js`, which in production also serves `client/dist` itself and falls back to `index.html` for client-side routes (see the `IS_PRODUCTION` block in `server/src/index.js`). One process, one URL — no separate static host to configure.

**Environment variables** — see `.env.example` for the full list with descriptions. `render.yaml` declares which ones exist but never their values; set the actual values in Render's dashboard when prompted, not in a committed file:

- `NODE_ENV=production` — the one value `render.yaml` does set directly, since it's not a secret.
- `RESEND_API_KEY` — from [resend.com](https://resend.com); without it, magic-link emails fail to send in production (the app itself still boots and serves the directory fine — see BUILD_LOG Sprint 1 for why that failure is isolated rather than crashing the whole process). Mail is sent from `hello@huskybook.hmbirmingham.me` (`server/src/lib/mailer.js`) — that subdomain needs to be added and verified (DKIM/SPF records) in Resend's dashboard before sending will actually work, separate from just having an API key. Also add a DMARC record at `_dmarc.huskybook.hmbirmingham.me` (e.g. `v=DMARC1; p=none;`) — Resend's deliverability insights flag its absence, and Google/Microsoft/Yahoo weight it heavily for inbox-vs-spam placement.
- `BASE_URL` — the deployed app's own public URL, no trailing slash (Render assigns this — something like `https://huskybook.onrender.com` — once the service exists). Used to build the link inside the sign-in email, so it has to match wherever this is actually reachable.
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — from [turso.tech](https://turso.tech) (free, no card required). **Required for data to survive a redeploy.** Without these the app silently falls back to a local file, which Render's free tier doesn't persist across deploys — see BUILD_LOG Phase 10 for the full reasoning.

**Known rough edge:** Render's free web services spin down after 15 minutes of no traffic and take roughly a minute to wake back up on the next request. The very first sign-in attempt after a quiet period will feel slow — not broken, just cold. There's no fix for this on the free tier short of a paid "always-on" plan.

**Health check** — `GET /api/health` returns `{"ok": true}`.

## Data model

**providers**

| column | type | notes |
|---|---|---|
| id | integer, pk | |
| name | text | |
| category | text | `hair` \| `nails` \| `makeup` \| `braids` \| `other` |
| type | text | `dorm` or `mobile` |
| building_zone | text | public — shown on the directory (e.g. "Buckley Hall", "North Campus") |
| exact_location | text | private — room number / precise meeting spot. Never sent to the browse endpoint. Only included in a requester's own request list once that specific request is `accepted` |
| specialties | text | JSON array, e.g. `["fades", "line-ups"]` or `["gel-x", "nail art"]` |
| price_range | text | free-form, e.g. "$15-25" |
| contact_method | text | private, same disclosure rule as `exact_location` |
| available | integer (0/1) | provider-controlled toggle |
| verified | integer (0/1) | a separate, higher trust bar than just having a signed-in account (e.g. a manual review pass) — unused for now, see BUILD_LOG |
| owner_user_id | integer, fk → users.id | who actually owns this listing — checked server-side, not client-supplied |
| created_at | text | ISO timestamp |

**requests**

| column | type | notes |
|---|---|---|
| id | integer, pk | |
| provider_id | integer, fk → providers.id | |
| requester_name | text | the requester's account display name at the time of the request |
| requester_user_id | integer, fk → users.id | who actually sent it — this, not requester_name, is what's checked |
| note | text | optional |
| status | text | `pending` \| `accepted` \| `declined` |
| created_at | text | ISO timestamp |

**users**

| column | type | notes |
|---|---|---|
| id | integer, pk | |
| email | text, unique | must end in `@uconn.edu` |
| display_name | text | set once, right after first sign-in — what other people see you as |
| created_at | text | ISO timestamp |

**login_tokens** / **sessions** — back the magic-link sign-in flow (single-use hashed tokens, and the session a signed-in browser holds as a cookie). See BUILD_LOG Phase 6 for the reasoning; not something the rest of the app touches directly.

## Identity

Sign-in is passwordless: enter an `@uconn.edu` email, get a one-time link. Real delivery goes through [Resend](https://resend.com) in production; in development, no email provider is used at all — the API hands the link straight back in the response (`devLoginUrl`) and the server logs it, so this can be tested without a real inbox. See `server/src/lib/mailer.js`. **That dev-response shortcut must never ship to a real deployment** — it's gated on `NODE_ENV`, not a flag someone could leave on by accident.

Ownership is enforced server-side against the session, not against anything the client sends: creating a listing sets `owner_user_id` from `req.user`, and both accepting/declining a request and viewing a listing's incoming requests check that column against the signed-in account (`server/src/routes/providers.js`, `server/src/routes/requests.js`). A provider or request id you can guess isn't enough to act on it.

What's still not here: no email verification beyond "you clicked the link" (no re-confirmation, no account recovery flow), no rate limiting beyond the one-link-per-minute cooldown on requesting a new sign-in link, and no admin/moderation tooling. See "What's next" in BUILD_LOG.md.

## A word on liability

Nobody on this platform is vetted, licensed, or insured by HuskyBook. Arranging and receiving a service through this directory is between the two students involved — same as it would be if you found someone through a flyer on a dorm corkboard. This is disclosed plainly in the app footer, not buried.
