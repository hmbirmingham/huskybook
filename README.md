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
| verified | integer (0/1) | reserved for a future manual/NetID verification pass — unused for now, see BUILD_LOG |
| created_at | text | ISO timestamp |

**requests**

| column | type | notes |
|---|---|---|
| id | integer, pk | |
| provider_id | integer, fk → providers.id | |
| requester_name | text | plain name, no auth yet — see "Identity" below |
| note | text | optional |
| status | text | `pending` \| `accepted` \| `declined` |
| created_at | text | ISO timestamp |

## Identity — read this before assuming it's secure

There is no real authentication in this build. "Who you are" is just a name you type in, kept in the browser's `localStorage` (see `client/src/lib/identity.js`). It's enough to demo the request/accept flow end to end, but it means:

- Nothing stops someone from typing a different name and reading requests sent to a name that isn't theirs.
- Nothing stops someone from guessing another provider's `provider_id` and hitting the manage-requests endpoint for a listing that isn't theirs.

Swapping in real identity (UConn NetID / `@uconn.edu` email verification) means replacing `client/src/lib/identity.js` and adding an auth middleware in `server/src/middleware/` that resolves a verified identity from a session/token instead of a request body field — the rest of the app reads identity through that one module, not by threading a name around, specifically so this swap doesn't ripple through every route and component. See "What's next" in BUILD_LOG.md for the full list of what real auth would need to lock down.

## A word on liability

Nobody on this platform is vetted, licensed, or insured by HuskyBook. Arranging and receiving a service through this directory is between the two students involved — same as it would be if you found someone through a flyer on a dorm corkboard. This is disclosed plainly in the app footer, not buried.
