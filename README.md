# Campus Cuts

A peer-to-peer directory connecting UConn students who cut hair (dorm-based or mobile) with students looking for a cut. Most providers here are informal — someone cutting hair out of a dorm room or willing to travel to yours, not a shop with fixed hours.

Full write-up of how this was built, and the reasoning behind the decisions below, is in [BUILD_LOG.md](./BUILD_LOG.md).

## Setup

Requires Node 18+.

```bash
npm install
npm run dev
```

This starts the Express API on `http://localhost:3001` and the Vite dev server on `http://localhost:5173`, and creates a local SQLite database at `server/data/campus-cuts.sqlite` on first run (schema is created automatically; no separate migration step).

To reset to the sample data at any point:

```bash
npm run seed
```

## Data model

**barbers**

| column | type | notes |
|---|---|---|
| id | integer, pk | |
| name | text | |
| type | text | `dorm` or `mobile` |
| building_zone | text | public — shown on the directory (e.g. "Buckley Hall", "North Campus") |
| exact_location | text | private — room number / precise meeting spot. Never sent to the browse endpoint. Only included in a requester's own request list once that specific request is `accepted` |
| specialties | text | JSON array, e.g. `["fades", "line-ups"]` |
| price_range | text | free-form, e.g. "$15-25" |
| contact_method | text | private, same disclosure rule as `exact_location` |
| available | integer (0/1) | provider-controlled toggle |
| verified | integer (0/1) | reserved for a future manual/NetID verification pass — unused for now, see BUILD_LOG |
| created_at | text | ISO timestamp |

**requests**

| column | type | notes |
|---|---|---|
| id | integer, pk | |
| barber_id | integer, fk → barbers.id | |
| requester_name | text | plain name, no auth yet — see "Identity" below |
| note | text | optional |
| status | text | `pending` \| `accepted` \| `declined` |
| created_at | text | ISO timestamp |

## Identity — read this before assuming it's secure

There is no real authentication in this build. "Who you are" is just a name you type in, kept in the browser's `localStorage` (see `client/src/lib/identity.js`). It's enough to demo the request/accept flow end to end, but it means:

- Nothing stops someone from typing a different name and reading requests sent to a name that isn't theirs.
- Nothing stops someone from guessing another provider's `barber_id` and hitting the manage-requests endpoint for a listing that isn't theirs.

Swapping in real identity (UConn NetID / `@uconn.edu` email verification) means replacing `client/src/lib/identity.js` and adding an auth middleware in `server/src/middleware/` that resolves a verified identity from a session/token instead of a request body field — the rest of the app reads identity through that one module, not by threading a name around, specifically so this swap doesn't ripple through every route and component. See "What's next" in BUILD_LOG.md for the full list of what real auth would need to lock down.
