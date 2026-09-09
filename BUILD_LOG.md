# Build Log — HuskyBook

(Repo and Phase 0 below were built under the working name "Campus Cuts," before the scope changed — see the "Scope change" note partway through Phase 1.)

This is a running log, written as I go, not reconstructed afterward. Entries are grouped by branch/phase in the order I actually did them. Git history is the ground truth for *what* changed line by line; this is the *why*.

---

## Phase 0 — Repo scaffold (2026-09-08)

**What I'm building:** the empty shell — root `package.json`, `.gitignore`, README stub, and this log — before any feature code.

**Decisions:**

- **npm workspaces (`client/`, `server/`) over a single flat app.** The frontend and backend have genuinely different toolchains (Vite vs. a plain Node process) and I don't want Vite's dependency tree tangled up with Express's. Workspaces let `npm install` at the root wire up both, and `npm run dev` at the root fans out to both via `concurrently`, so the "one command to run everything" requirement still holds without faking a monolith.
- **Not using create-vite or create-react-app scaffolding directly** — building the client by hand in the next phase so the file layout matches the app's actual shape (pages for the four flows, not a generic template) instead of stripping out boilerplate afterward.
- Committing this scaffold straight to `main` rather than a branch. There's no feature here to isolate — it's the equivalent of `git init` — and having *something* runnable at every point on `main`, even if it's just "npm install succeeds," is the property I want to hold from commit one. Everything after this goes through a feature branch + PR.

**Deferred:** choice of backend (SQLite vs. Firebase/Supabase) and the exact schema — that's the first real decision and it gets its own phase below, done as a branch.

---

## Phase 1 — Data model & API (`feature/data-model`)

**What I'm building:** the SQLite schema and the Express endpoints for browsing providers, listing yourself, submitting a request, and accepting/declining — the whole server side of the app, before any UI exists.

**Decision — SQLite over Firebase/Supabase.** The spec offered either. Firebase/Supabase buy you hosted auth and realtime out of the box, which this app doesn't need yet (there's no real auth, per the Identity section in the README, and nothing here needs to update live across open tabs). SQLite is a single file, needs no account/project setup to run locally, and the whole point of the "npm install && npm run dev" requirement is that it should just work on a fresh clone with zero external accounts. Cost is that if this ever needs multi-writer concurrency at scale or real hosted auth, that's a rewrite, not a config change — acceptable for what this is right now.

**Decision — node:sqlite over better-sqlite3.** Reached for better-sqlite3 first since it's the standard choice. `npm install` failed: its native binding doesn't compile against this machine's Node (v26 — very new; node-gyp errors were V8 API deprecations, i.e. better-sqlite3's C++ hasn't caught up to the newest V8 headers yet). Rather than pin an older Node just to satisfy one dependency, switched to Node's own built-in `sqlite` module, which needs no native compilation at all since it ships inside the runtime. Confirmed it works with a throwaway script before committing to it. Set `server/package.json`'s `engines` field to `>=22.5.0`, the version node:sqlite became available — anyone on an older Node needs to upgrade, which is the one real cost of this choice. Logging this because it's a good example of a dependency choice getting overridden by what the actual environment could build, not by preference.

**Decision — where the privacy rule lives.** The one hard requirement in the spec is that `exact_location` (and, by extension, `contact_method`) never reaches a requester until their specific request is accepted. Put that logic in exactly two places: `toPublicProvider`/`toOwnerProvider` in `server/src/lib/serialize.js` for the browse/create endpoints, and a `CASE WHEN status = 'accepted'` in the SQL itself for the my-requests query. Deliberately did *not* fetch full rows and strip fields in JS afterward — that pattern means a future route can forget the strip step and leak the field. Gating it at the query/serializer boundary means there's no code path where the private fields are even in the JS object for a pending or declined request.

**Decision — fixed category enum, not free text.** `providers.category` is a `CHECK` constraint against `hair | nails | makeup | braids | other`, not an open text field. Free text would let providers self-describe more precisely, but it also means the browse filter degrades into fuzzy string matching or a growing pile of near-duplicate tags ("nail art" vs "nails" vs "manicures"). A fixed, small set keeps filtering exact and the directory legible. `specialties` stays free-text-ish (a JSON array of tags within a category) since that's lower-stakes than the primary browse dimension.

**Deferred, on purpose:**
- No auth backing "does this providerId actually belong to you" on the manage-requests endpoint — it's provider_id in, matching data out. Documented explicitly in the README rather than pretending it's not a gap.
- No pagination on `GET /api/providers` — fine at seed-data scale, would need it before this ever had real traffic.
- No rate limiting or input sanitization beyond required-field checks — this is a local dev demo, not something facing the open internet.

**Bug hit:** first draft of the my-requests POST handler re-selected the request row with a plain `SELECT * FROM requests` and passed it to the same serializer the GET route uses — which expects joined `provider_name`/`provider_category`/etc. columns that a plain select doesn't have, so a freshly-created request would've come back with a `provider` object full of `undefined`. Fixed by extracting the joined SELECT into one `REQUEST_WITH_PROVIDER_SQL` string used by both the create and list handlers, so there's one query shape instead of two that need to be kept in sync by hand.

**Manual test before committing:** ran the server directly, created a request, confirmed `GET /api/requests?requesterName=...` returned `exactLocation: null` while pending, `PATCH`ed it to accepted, confirmed the same query now returned the real room/contact info, and confirmed a `PATCH` with a mismatched `providerId` 403s instead of changing anything. Screenshots aren't useful for an API-only phase, so this is a full manual walkthrough logged here instead — output is captured in the PR description for this branch.

### Scope change, mid-phase

Partway through this phase, the brief changed: instead of hair cuts specifically, the directory should cover general student-run personal-care services (hair, nails, makeup, braids), and the app is renamed **HuskyBook**. Went back and renamed the `barbers` table/routes to `providers`, added the `category` field described above, and updated the README/schema before committing anything under the old names — so the git history doesn't have a confusing "rename everything" commit sitting in the middle of it; `feature/data-model`'s commits reflect the final shape directly.

---

## Phase 2 — Find & request flow (`feature/find-and-request-flow`)

**What I'm building:** the client from scratch, then the first full vertical slice through it — browsing the directory, filtering, and sending a request. The other three views (list yourself, my requests, manage requests) get placeholder pages here so navigation works, and get built out for real on their own branches.

**Decision — Tailwind v4 via `@tailwindcss/vite` over v3.** v4's Vite plugin needs no `postcss.config.js`/`tailwind.config.js` pair and no `autoprefixer` — theme customization happens with an `@theme` block directly in CSS. One fewer config file for the same result, and this project has no need for v3-only plugins.

**Decision — the actual design direction.** The brief specifically called out avoiding the default AI-generated look (cream + terracotta, or dark + neon, or identical soft-shadow rounded cards everywhere). Went with a "flyer pinned to a dorm corkboard" metaphor instead of the barbershop-signage idea from the original hair-only brief, since that no longer fit once the scope covers nails/makeup/braids too: warm paper background with a faint dot-grid texture, navy + amber + pine as the accent trio, Zilla Slab (a slab serif with some weight to it) for headings against Inter for body copy, and a flat "shadow-pin" utility — a hard-offset shadow with zero blur — instead of the soft, blurred drop-shadows that show up on almost every generated card UI. Every provider card also gets a small circular "pin" at its top edge, reinforcing the metaphor without leaning on clip-art icons.

**Decision — React Router for four real routes instead of tab state.** Four views map cleanly to four URLs (`/`, `/list`, `/my-requests`, `/manage`); using the router means each view is linkable/refreshable/bookmarkable, which costs nothing over a `useState` tab switcher and gets URL semantics for free.

**Decision — identity.js as the one seam.** Every place that needs "who is this" or "which listings did I create" (the request form, and eventually my-requests and manage-requests) imports from `client/src/lib/identity.js` rather than touching `localStorage` directly. Cheap now, and it's the whole point of the file: when real auth exists, this is the only client file that needs to change.

**Visual QA, not just "it compiled":** ran the actual dev server (both API and Vite, via the root `npm run dev`) and drove it through a headless browser rather than trusting the code by inspection. Caught two real things this way:
- The confirmation banner read "Request sent to Marcus T.." with a double period, because the sample name already ends in one and the message appended another after it. Reworded the sentence to use an em dash instead of a period there specifically so it can't collide with a name that happens to end in punctuation.
- First filter-panel layout looked cramped at the exact width the browser tool's default viewport uses; confirmed it was a viewport-size artifact, not a real breakpoint bug, by resizing to a standard desktop width — layout held correctly at both.

**Aside — a standalone demo build.** Separately from the real client, put together a single-file `demo.html` (vanilla JS, no build step, no backend) that mirrors this branch's look and the full four-flow interaction loop — including accept/decline updating what a requester sees — for quick sharing without needing anyone to clone the repo and run `npm install`. It's a demo shell, not the app: state resets on refresh, and there's no SQLite behind it. Kept out of git (`.gitignore`) since it's a snapshot for sharing, not a build artifact of this codebase.

---

## Phase 3 — Provider listing (`feature/provider-listing`)

