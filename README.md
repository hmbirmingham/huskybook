# HuskyBook

A peer-to-peer directory connecting UConn students who offer personal-care services — hair, nails, makeup, braids — with students looking to book one. Most providers here are informal: someone doing hair or nails out of a dorm room, or willing to travel to yours, not a licensed shop with fixed hours.

Full write-up of how this was built, and the reasoning behind the decisions below, is in [BUILD_LOG.md](./BUILD_LOG.md).

**Not affiliated with the University of Connecticut.** "Husky" is used here as a nod to the mascot, not an official UConn product.

## Setup

Requires Node 22.5+ (the server uses Node's built-in `node:sqlite` module — see BUILD_LOG for why).

```bash
npm install
npm run dev
```

This starts the Express API on `http://localhost:3001` and the Vite dev server on `http://localhost:5173`, and creates a local SQLite database at `server/data/huskybook.sqlite` on first run (schema is created automatically; no separate migration step).

To load/reset to the sample data at any point:

```bash
npm run seed
```

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

Sign-in is passwordless: enter an `@uconn.edu` email, get a one-time link. There's no real email provider wired up yet, so in development the API also hands the link straight back in the response (`devLoginUrl`) and the server logs it — see `server/src/lib/mailer.js`, the one function a real provider (Resend, Postmark, SMTP) would replace. **That dev-response shortcut must never ship to a real deployment** — it exists purely so this can be tested without an inbox.

Ownership is enforced server-side against the session, not against anything the client sends: creating a listing sets `owner_user_id` from `req.user`, and both accepting/declining a request and viewing a listing's incoming requests check that column against the signed-in account (`server/src/routes/providers.js`, `server/src/routes/requests.js`). A provider or request id you can guess isn't enough to act on it.

What's still not here: no email verification beyond "you clicked the link" (no re-confirmation, no account recovery flow), no rate limiting beyond the one-link-per-minute cooldown on requesting a new sign-in link, and no admin/moderation tooling. See "What's next" in BUILD_LOG.md.

## A word on liability

Nobody on this platform is vetted, licensed, or insured by HuskyBook. Arranging and receiving a service through this directory is between the two students involved — same as it would be if you found someone through a flyer on a dorm corkboard. This is disclosed plainly in the app footer, not buried.
