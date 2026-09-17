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

**What I'm building:** the "list yourself" form — the other side of the marketplace from Phase 2's browse/request flow.

**Decision — comma-separated text for specialties, not a tag picker.** Category has a fixed enum because it drives the browse filter (Phase 1's reasoning). Specialties don't filter anything — they're just descriptive text on a card — so there's no controlled vocabulary to enforce and a tag-picker UI would be more component for no functional gain. A single text input split on commas gets the same result (an array, stored the same way) with a fraction of the code.

**Decision — the confirmation screen deliberately echoes the private fields back.** Every other view in this app is built around *not* showing `exactLocation`/`contactMethod` to anyone but the listing's own owner post-acceptance. The one exception is immediately after someone submits their own listing — showing their own room number back to them isn't a leak, it's confirming the form saved what they think it saved. Worth calling out explicitly here since it looks, at a glance, like it might contradict the privacy rule everywhere else; it doesn't, because the only "requester" of this data is the provider themselves, and the API route it comes from (`POST /api/providers`) already returns the owner view by design (Phase 1).

**Bug watch, confirmed clean:** the obvious way this could break is a newly-created listing leaking its own exact location onto the public directory it immediately appears on. Manually created a listing, then loaded Find a Service in the same session and confirmed the card showed only the public fields — the confirmation screen and the directory card are reading from two different API responses (`POST` owner view vs. `GET` public view), so there's no shared object that could accidentally carry the private fields onto the public page.

---

## Phase 4 — My Requests & Manage Requests (`feature/manage-requests`)

**What I'm building:** the two views that close the loop — a requester checking on what they've sent, and a provider acting on what's come in. This is also where the location-unlock rule becomes visible in the UI for the first time, rather than just correct in an API response.

**Decision — "who am I" via a typed name, not an automatic session.** My Requests asks for the name you requested under rather than silently trusting whatever's in `localStorage`. Slightly more friction than auto-filling and going, but it means the page still works correctly if someone requested services under two different names in the same browser, or if a housemate uses the same laptop — the page shows exactly the name you tell it to, not "whichever name happened to be saved last." This is a small stand-in for what real auth will make unnecessary (see README's Identity section), not a permanent design.

**Decision — reload from the server after accept/decline instead of updating local state optimistically.** `ManageRequests` calls `PATCH`, then re-fetches the full list rather than flipping the one row's status in place. Slightly more network traffic, but the server is the only source of truth for status, and if a `PATCH` ever fails partway (network blip, a stale providerId) the UI reflects what actually happened instead of what was requested to happen.

**Decision — the listing picker only appears with more than one listing.** `getMyListings()` supports multiple listings per browser (someone could plausibly offer more than one kind of service), but rendering a one-item dropdown for the common case just adds a control with no real choice in it. The picker only renders when `listings.length > 1`.

**Bug hit, environment-specific:** while testing this phase's UI by driving a real browser, coordinate-based clicks and typed text kept silently landing on the wrong element or not registering at all. Root cause: the browser preview pane was hidden (not fronted) for most of this session, and it turns out this particular tool doesn't fully render/composite a hidden page, so pixel-coordinate input isn't reliable against it — screenshots looked stale and clicks landed tens or hundreds of pixels off from where they should have. Worked around it by switching to ref-based `form_input` for filling fields (resolves the actual DOM node, not a pixel guess) and `element.click()` / `form.requestSubmit()` via direct JS execution for buttons, both of which don't depend on the pane being visually rendered. Not a bug in the app — flagging it here because it's the kind of thing worth knowing before trusting a screenshot-driven test against a tool like this: if interactions stop landing correctly, check whether the thing you're testing is actually on screen before assuming the app broke.

**Manual test, full loop:** listed a new provider through the real form, created a request against it, confirmed it showed up in Manage Requests as pending, accepted it, confirmed the status updated immediately, then loaded My Requests under the requester's name and confirmed the exact location and contact method were now visible — the same rule verified with curl in Phase 1, now verified through the actual UI a person would use.

---

## Phase 5 — Design pass (`feature/design-pass`)

**What I'm building:** the polish pass — favicon, tab titles, a mobile check, and whatever rough edges turn up along the way. Most of the actual visual design decisions were already made and logged in Phase 2, since building each view against the theme from the start meant there wasn't a large separate "restyle everything" step left here.

**Checked, no changes needed — mobile layout.** Resized the browser to a 375px-wide viewport and walked through all four views plus the request modal. Everything held up without a single mobile-specific class: nav wraps into a 2x2 grid, provider cards go full-width, the modal doesn't overflow. That's a direct result of using flexbox/grid with `gap` and `flex-wrap` everywhere from Phase 2 onward instead of fixed widths — worth noting as a case where doing the layout right the first time meant there was nothing left to fix here.

**Added — a real favicon.** `client/public/favicon.svg`: navy rounded square, a cream serif "H," and an amber dot in the same spot as the provider cards' "pin." Small, but a generic default-Vite tab icon is exactly the kind of unfinished-looking detail that undercuts everything else in the design direction.

**Added — per-view tab titles.** `usePageTitle`, a five-line effect hook, instead of the static title from `index.html` for every route. Didn't reach for a routing-aware title library for four fixed strings.

**Bug hit — a stale local reference to a deleted listing.** While testing, hit a real edge case in the no-auth identity model documented back in Phase 1: I'd reseeded the database mid-session (wiping and recreating all providers with fresh ids) without clearing the browser's `localStorage`, which still remembered an old listing id. Manage Requests hit that id, got a 404, and surfaced the raw server error string `"Provider not found"` with no way to recover short of clearing site data by hand. Fixed properly rather than dismissing it as a testing artifact, since the identical thing happens for any real user if a listing is ever deleted: added a `notFound` state with a "Forget this listing" action (`identity.js`'s new `removeMyListing`) that clears the dead reference and falls back to the normal empty state. This is the sort of gap that's easy to miss when testing only against a database that never changes out from under the browser — worth remembering for any project with client-cached ids and no server-side session to invalidate them.

---

## Phase 6 — Real authentication (`feature/auth`)

**What I'm building:** the thing every earlier phase's BUILD_LOG entry flagged as the actual gap — replacing the localStorage-name stand-in with real sign-in, and closing the two authorization holes that depended on it (anyone could read anyone's requests by typing their name; anyone could act on any listing by guessing its id).

**Decision — magic-link email, restricted to `@uconn.edu`, instead of real NetID SSO.** The original plan (written into the README from Phase 1 onward) was UConn NetID verification. This session has no access to UConn's actual SSO infrastructure, and pretending otherwise would mean building against a system I can't verify against. Passwordless email sign-in gated to the `@uconn.edu` domain is the closest honest stand-in: it doesn't prove "this is a current student" the way real NetID does, but it does prove "this person controls a `@uconn.edu` inbox," which is a real, verifiable claim rather than a cosmetic one. Swapping in real NetID/SSO later is a change to `server/src/routes/auth.js` and `server/src/lib/auth.js` specifically — the rest of the app reads identity through `req.user`/`useAuth()`, not through how that got populated.

**Decision — no password, ever.** Passwordless removes an entire class of problems (weak passwords, reused passwords, a password database to protect) at the cost of depending on email deliverability, which this build doesn't have yet anyway (see below). For a demo/portfolio project, magic-link is also just less code than password hashing + reset flows + the UI for both.

**Decision — hash the token, not just the session.** Login tokens are stored as a sha256 hash (`login_tokens.token_hash`), never the raw value — the raw token exists only in the URL that gets emailed. This is the same reasoning as never storing a plaintext password: if the database ever leaked, a login token hash is useless to an attacker the same way a password hash is.

**Decision — no real email provider; a `devLoginUrl` shortcut instead.** There's no Resend/Postmark/SMTP account to wire up here, and building against a real one that only I could test would make this un-runnable for anyone else. `lib/mailer.js` logs the link to the server console, and `POST /request-link` additionally returns it as `devLoginUrl` in the JSON response when not in production. This is flagged loudly in both the code comment and the README because it's a real footgun: shipping that response shortcut to production would mean anyone could "sign in" as any email address just by asking the API for its own magic link. The gate is `NODE_ENV !== 'production'`, not a feature flag that could be left on by accident.

**Decision — `display_name` lives on the account, not per-browser.** The old `identity.js` stored a typed name in `localStorage`, which meant switching browsers meant retyping it, and nothing stopped two different people from typing the same name. `users.display_name` is set once, right after first sign-in, and every request/listing reads it from the session — solving both problems as a side effect of just having real accounts.

**Decision — a listing's display name stays separate from the account's `display_name`.** Briefly considered auto-filling `providers.name` from the account and calling it done, but a listing name is arguably a small business name ("Marcus's Fades") and there's no reason it has to match what a provider wants to be called *as a requester* on someone else's listing. Kept them as two fields; `ListYourself` just pre-fills the listing name field from the account's display name as a convenience default, editable like anything else in the form.

**Simplification this enabled — Manage Requests lost its stale-listing-id handling.** The design-pass phase added a whole `notFound`/"Forget this listing" recovery flow because the old client-side `localStorage` list of "my listing ids" could point at a row that no longer existed. `GET /api/providers/mine` makes that entire class of bug impossible: the list is always exactly what the database says this account owns, fetched fresh, so a deleted listing is just absent rather than a dangling reference the client has to notice and clean up. Deleted more code in this phase's Manage Requests rewrite than I added.

**Bug hit — React 18 StrictMode double-invoking a non-idempotent effect.** `VerifyLogin`'s effect calls the verify endpoint as soon as the token is in the URL. In dev, StrictMode mounts, unmounts, and re-mounts components specifically to catch effects that aren't safe to run twice — and this one wasn't, because a login token is single-use by design. The first call succeeded and set a valid session; the second call (StrictMode's deliberate re-fire) hit an already-used token and failed, and because it resolved after the first one, its error state won the render race — so the UI showed "this link is invalid or expired" even though sign-in had actually worked. Fixed with a `useRef` guard that only lets the effect's real work run once per mount, which is the standard fix for this exact class of StrictMode-surfaced bug, not a workaround around StrictMode's warning.

**Manual test, full loop, as two separate accounts:** confirmed 401 on every route that now requires a session with no cookie at all; created a listing as account A; requested it as account B and confirmed the request showed pending with no location under B's My Requests; confirmed account B gets 403 trying to view or act on account A's listing directly via the API; accepted the request as account A through the real Manage Requests UI; confirmed account B's My Requests then showed the unlocked location and contact method. Every step run against the actual running app, not just the API in isolation.

---

## Sprint 1 — email delivery, deployment, notifications

A sprint plan arrived from the user partway through this build (2026-09-16), targeting a November 1st open beta across three sprints. Sprint 1's stated goal: "app is live and email works — nothing else matters until this is done." Three branches, logged separately below since each got its own PR, but they're one sprint toward one goal.

### Phase 7 — Resend email delivery (`feat/resend-email`)

**What I'm building:** real email delivery for the magic-link sign-in, replacing the console-log-only mailer from Phase 6.

**Decision — keep the NODE_ENV branch inside `mailer.js`, not in the route.** The sprint plan's snippet put the dev/prod branch and the `devLoginUrl` return value in the same function. Split them instead: `mailer.js`'s `sendMagicLinkEmail` only decides *whether the email goes out*; `server/src/routes/auth.js` already separately decided (back in Phase 6) whether to *also* hand the raw link back in the API response. Merging those two concerns into one function would mean the dev-response shortcut and the email-sending logic have to agree with each other by coincidence instead of by construction. Kept them as two independent decisions that happen to both key off `NODE_ENV`.

**Bug hit and fixed before it shipped — constructing the Resend client at module load.** First pass wrote `const resend = new Resend(process.env.RESEND_API_KEY)` at the top of the file. The Resend SDK throws synchronously in its constructor if the key is missing or empty — which meant if this ever ran in production before `RESEND_API_KEY` was set (exactly the state a first deploy is in), the *entire server* would crash on import, taking down browsing and everything else with it, not just email sending. Caught this by actually testing `NODE_ENV=production` locally with no key configured before considering the branch done — it crashed immediately, confirming the bug. Fixed by constructing the client lazily, inside the function, on first real send: a missing key now only breaks the one thing that actually needs it.

**Manual test:** confirmed dev mode is unchanged (still logs, still no Resend import touched). Confirmed `NODE_ENV=production` with no `RESEND_API_KEY` set boots cleanly and serves `/api/health` — the fix above, verified.

### Phase 8 — Railway deployment config (`feat/deploy-config`)

**What I'm building:** the config to actually deploy this as a Railway service — `railway.toml`, a health check, env var documentation, and (found while building this) a way to serve the client at all.

**Gap found in the plan — no build step for the client.** The sprint plan's `start` script only ran `node server/src/index.js`, with no mention of building or serving the React app. As written, a Railway deploy would expose the API and nothing else — the plan's own "verify after deploy" checklist (click through the sign-in flow, create a listing, etc.) would be impossible to actually perform against it. Fixed by adding a root `build` script (`vite build` for the client) and having `index.js` serve `client/dist` itself in production, with an Express catch-all falling back to `index.html` for client-side routes so `/verify`, `/manage`, etc. don't 404 on a direct load or refresh. One Railway service serving both the API and the built SPA, rather than the plan's implicit assumption of a second static host that was never specified.

**Decision — rename `CLIENT_ORIGIN` to `BASE_URL`.** Phase 6 introduced `CLIENT_ORIGIN` for building the magic-link URL. The sprint plan's env var list calls the same concept `BASE_URL`. Renamed to match, since this is the name that's going to live in Railway's dashboard and in every future doc referencing it — no reason to keep two names for one URL.

**Decision — didn't wire up `SESSION_SECRET`.** It's in the sprint plan's env var list, but nothing in this app's session design uses a secret: sessions are opaque random tokens looked up against the `sessions` table, not signed or encrypted cookies, so there's nothing for a "session secret" to sign. Adding the env var without a corresponding use would be documentation theater — a variable someone dutifully sets in Railway that does nothing. Left it out of `.env.example`, which only lists variables the running code actually reads; flagged this decision back to the user rather than silently dropping a named requirement.

**Manual test:** built the client, ran the full server with `NODE_ENV=production`, and confirmed the API, static assets, and a client-side-only route (`/manage`, not a real file) all resolved correctly from the same process and port.

### Phase 9 — Request/accept email notifications (`feat/notifications`)

**What I'm building:** the two notification events from the sprint plan — a provider learns about a new request, a requester learns about a decision — without either one being able to break the request/accept flow itself if email delivery has a bad day.

**Decision — fire after the response, not before.** Both `POST /requests` and `PATCH /requests/:id` call `res.json()` first and kick off the notification email afterward, wrapped in a `notify()` helper that `.catch()`s and logs instead of throwing. The user submitting or accepting a request is waiting on that action succeeding, not on whether an email happened to send — those are genuinely different failure domains, and coupling them would mean a mail provider hiccup turns into a broken core feature.

**Consistent with seed data being unclaimed (Phase 3):** a request against one of the seeded demo listings has no `owner_user_id` to resolve an email from, so `POST /requests` just skips sending — silently, not as an error, since there's nothing wrong, just nobody real to notify.

**Manual test:** created a request from one real account to another's real listing, confirmed the provider-notification log line; accepted it, confirmed the requester status-update log line with the correct listing name and status.

---

## Phase 10 — Migrate off Railway: libSQL/Turso instead of node:sqlite (`feat/turso-db`)

**What I'm building:** a database layer that works on a host that's actually free. Railway turned out not to be a free option for the user personally, and checking current free-tier terms across the field (2026-09-17) turned up a worse picture than expected: Fly.io no longer has a free tier at all (a card is required even for the trial); Render's free web service tier is genuinely free with no card, but its free tier has no persistent disk — a plain SQLite file on Render's free tier doesn't survive a redeploy. `node:sqlite` (Phase 1's choice) only ever worked as a local file, so it couldn't follow the app to a host without local persistent storage.

**Decision — libSQL over switching to a different database engine entirely.** libSQL (the engine behind Turso) is SQLite-compatible and its client library can point at either a local file (`file:./path.db`) or a hosted Turso database (`libsql://...`) with no other code change — same SQL, same client API, only the connection URL differs. That meant local dev could keep working with zero external accounts (Phase 1's original goal, still true four phases and one full rewrite of the identity system later), while production points at Turso's free tier (also genuinely free, no card required). Switching to Postgres (Supabase/Neon free tiers, also viable) would have meant translating the schema and every query's dialect quirks; this migration only had to change *how the client talks to the database*, not the database language itself.

**Cost of this decision — a real refactor, not a config change.** `node:sqlite`'s `DatabaseSync` is synchronous; libSQL's client is promise-based with no sync option. Every function that ever called `db.prepare(...).get/.all/.run()` had to become `async`/`await`, which touched `db/index.js`, `db/schema.js`'s migration runner, every function in `lib/auth.js`, `middleware/auth.js`'s `attachUser`, every route in `auth.js`/`providers.js`/`requests.js`, and `seed.js` — effectively the whole server. Added `lib/asyncHandler.js` (the standard Express 4 pattern for forwarding a rejected promise from an async route handler to the error middleware, since Express 4 doesn't do this on its own) to avoid repeating try/catch in every single route.

**Bug caught by testing before writing the rest of the migration:** wrote a throwaway script to check libSQL's exact behavior before touching any real code, and found that `db.execute()` given a semicolon-separated multi-statement string (exactly the shape of the `SCHEMA` constant) silently executes *only the first statement* — no error, no warning, just every table after the first one never getting created. Used `executeMultiple()` for the schema instead, which runs all statements as expected. This would have been a brutal bug to debug after the fact (the app would look fine until the first request touching, say, the `sessions` table, threw "no such table").

**Bug caught the same way — `lastInsertRowid` is a BigInt.** `node:sqlite` returned it as a plain number; libSQL returns a BigInt, and `JSON.stringify` throws on a raw BigInt. Every place that used it to look up the just-inserted row now wraps it in `Number(...)` first. Caught by actually running the full "create a listing, then look it up" flow end to end rather than assuming the return type matched the old driver's.

**Decision — relaxed the Node engine requirement.** `server/package.json` required Node `>=22.5.0` specifically because that's when `node:sqlite` stabilized (Phase 1). With that dependency gone, relaxed it to `>=18` — a reasonable modern floor, though not exhaustively tested against an actual Node 18 install in this session (only Node 26, what's on this machine, was available to test against).

**Full regression test after converting everything**, against a fresh local libSQL file: browse/filter with no private fields leaking; 401 on every route requiring auth with no session at all; a full two-account flow — list a service, request it from a second account, confirm 403 when that second account tries to view or act on the first account's listing, accept as the real owner, confirm the requester's own list then shows the unlocked location and contact method; both notification emails logging correctly. Also re-verified through the actual browser (Find a Service rendering real seeded data, zero console errors) and a full `NODE_ENV=production` boot serving the built client — the same production-mode check that caught the Resend and static-serving bugs back in Sprint 1, run again here since this touched the same startup path.

---

## Phase 11 — Render deployment config (`feat/render-deploy`)

**What I'm building:** the actual host-specific deploy config, now that the database layer no longer assumes a local disk (Phase 10).

**Fly.io ruled out by direct observation, not just research.** Before landing on Render, the user tried launching this repo through Fly.io's own "Launch an App from GitHub" dashboard flow directly — machine size `shared-cpu-1x`/256MB, region defaulted to Amsterdam — and hit a wall requiring a credit card before it would deploy anything, even at that tiny size. That's the same conclusion the web research in Phase 10 reached, now confirmed against the real current UI rather than secondhand pricing pages. (Also flagged in passing: Amsterdam would've been a poor region choice for a UConn-facing app regardless — Fly's `ewr`/Newark or `bos`/Boston would be far closer to Storrs.)

**`render.yaml` (a Render "Blueprint")** defines the service declaratively: `runtime: node`, `plan: free`, `region: virginia` (closest US region Render offers to Connecticut), the existing `build`/`start` scripts, and `healthCheckPath: /api/health` (the same endpoint from Phase 1 — still hasn't needed to change). Verified the exact field names (`runtime` vs. an older `env` key, `sync: false` for secrets, valid `region` values) against Render's current Blueprint spec docs rather than guessing from memory, since getting this wrong would mean a confusing failure on first deploy attempt rather than a local test failure I could catch myself.

**Every real secret is `sync: false`** — `RESEND_API_KEY`, `BASE_URL`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. Render prompts for each of these once, in its own dashboard, the first time the Blueprint is applied; none of them ever have a value in this file. Only `NODE_ENV=production` is set directly, since it isn't a secret.

**Honest limitation:** this config has been checked against Render's documented Blueprint spec and the app's own build/start scripts have been verified locally (repeatedly, since Phase 8), but nobody has actually run this Blueprint against a real Render account yet. That's a real difference from almost everything else in this log — everywhere else, "manually tested" meant tested against the running app; here it means "written correctly per the spec, not yet proven against the real service." Flagging that gap explicitly rather than letting "tested" quietly mean two different things.

**Known, accepted tradeoff:** Render's free web services spin down after 15 minutes idle and take about a minute to wake up on the next request. Documented in the README rather than worked around — a paid "always-on" tier is the only real fix, and that's explicitly off the table per the $0 hosting budget this whole phase (10 and 11) exists to satisfy.

---

## Phase 12 — Fix the real Render build failure (`fix/render-build-devdeps`)

**What happened:** the user actually applied the Render Blueprint from Phase 11 against a real Render account for the first time. It failed on the very first deploy: `sh: 1: vite: not found`, npm error code 127, during `npm run build -w client`.

**Root cause, confirmed by reproducing it locally rather than guessing from the error text:** `render.yaml` sets `NODE_ENV=production` as an env var on the service, and Render applies a service's configured env vars during the build step, not just at runtime. `npm install` skips `devDependencies` whenever `NODE_ENV=production` is already set in the environment it runs in — and `vite`, `@vitejs/plugin-react`, and `tailwindcss` are all `devDependencies` of `client/`. So the build step had nothing to build the client with. This is exactly the gap flagged honestly in Phase 11's log entry: everything had been tested locally, but `npm install` had only ever been run there *without* `NODE_ENV=production` already set going in — Phase 10's production-mode tests always built first, then separately set `NODE_ENV=production` only for the `node server/src/index.js` runtime step, never for the install step itself. A real deploy is the one thing that runs both under the identical environment, and that's exactly where the gap was.

**Fix:** `buildCommand` now runs `npm install --include=dev` before `npm run build`, forcing devDependencies in regardless of `NODE_ENV`. Confirmed the failure first (a clean-room `NODE_ENV=production npm install` in a scratch copy of the repo really does install roughly 80 fewer packages and omits `vite` entirely), then confirmed `--include=dev` fixes it, then re-ran the complete build-then-start sequence from a from-scratch checkout before pushing the fix — the same discipline as every other bug in this log, just triggered by a real deploy instead of a local test this time.

**Also verified while credentials were available:** with the user's real Turso database URL and auth token (shared directly, not committed anywhere), ran the app's schema initialization against the actual hosted database for the first time — all six tables created correctly — and a full insert/read/delete round trip to confirm the `lastInsertRowid` BigInt handling from Phase 10 behaves identically against real Turso, not just local libSQL. Cleaned up completely afterward (confirmed zero rows in every table) since this is the user's real production database, not a scratch environment.

---

## Phase 13 — Real sending domain for Resend (`fix/resend-sender-domain`)

**What happened:** `huskybook.app` in `mailer.js`'s `FROM_ADDRESS` was always a placeholder carried over from the original sprint plan's example code — nobody owns that domain, so Resend could never have verified it no matter how correctly `RESEND_API_KEY` was configured. Asked the user directly what domain they actually own; the answer was their portfolio domain, `hmbirmingham.me`.

**Decision — a subdomain, not the root domain.** Sending from `noreply@huskybook.hmbirmingham.me` instead of `noreply@hmbirmingham.me`. Resend verifies a subdomain with its own independent DKIM/SPF records, so this app's transactional email — a steady stream of magic links to strangers' `@uconn.edu` addresses, a very different sending pattern than a personal portfolio site — never shares sending reputation or DNS configuration with the root domain. If HuskyBook's mail ever got flagged as spam somewhere, the fallout stays contained to the subdomain, not the person's own portfolio email.

**Still outstanding, and it's a real setup step, not just an env var:** having a domain isn't the same as having it verified. The user still needs to add `huskybook.hmbirmingham.me` in Resend's dashboard and create the DNS records Resend provides (wherever `hmbirmingham.me`'s DNS is actually managed) before `RESEND_API_KEY` alone will result in delivered mail.

---

## Sprint 2 — Phase 14: automated tests for the two rules that matter (`test/privacy-and-ownership`)

**What I'm building:** the thing "What I'd do differently" flagged twice in this log by name — automated coverage for the location-unlock SQL and the ownership checks, instead of relying on repeated manual curl/browser walkthroughs every phase. Sprint scope, and the domain-verified-but-still-spam question, were both confirmed with the user directly before starting rather than assumed: this sprint is tests only, and the spam issue (Resend shows the sending domain as fully verified — SPF/DKIM green — yet mail still lands in spam) is a separate, already-flagged follow-up, not something folded into this branch.

**Decision — `node:test` over Vitest/Jest.** Same reasoning as Phase 1's `node:sqlite` pick: it ships in the runtime the project already requires (`engines: >=18`), so it's zero new dependencies for a server that currently has exactly four (`@libsql/client`, `cors`, `express`, `resend`). Nothing about this app's test needs (HTTP integration tests against Express, a couple of unit tests) calls for a heavier runner.

**Decision — real HTTP integration tests over calling route handlers directly.** Each test file boots the actual Express app on an ephemeral port (`app.listen(0)`) and drives it with the platform `fetch`, including a real magic-link sign-in (`POST /request-link` → `devLoginUrl` → `GET /verify` → session cookie) rather than inserting a session row directly. The privacy and ownership rules live partly in SQL (`CASE WHEN status = 'accepted'`), partly in route handlers, and partly in `requireAuth` middleware — a test that skips the HTTP layer to call a handler function directly would stop testing the thing that actually matters, which is what a real request over the wire gets back.

**Refactor this required — split `app.js` out of `index.js`.** `index.js` used to build the Express app and call `app.listen()` in the same file. Tests need the app object without binding the real configured port (or starting a real production `.listen()` that never resolves). Moved everything up through the error-handling middleware into `server/src/app.js` (exporting `app`), leaving `index.js` as just `app.listen(...)` plus the existing boot-time env-check log. No behavior change — confirmed by booting `NODE_ENV=production` against it directly, the same check that's caught two real bugs earlier in this log (Sprint 1's static-serving gap, Phase 12's devDependency bug).

**Decision — a `DATABASE_URL` env var override in `db/index.js`, additive only.** Every test file needs its own throwaway sqlite file so tests can't stomp on the real dev database or on each other. `db/index.js` now checks `DATABASE_URL` before falling back to the existing `TURSO_DATABASE_URL` / local-file logic from Phase 10 — checked first specifically so a developer's local `.env` can't accidentally point a test run at production. Default behavior (no env vars set) is byte-for-byte unchanged.

**Bug hit in my own test helper, caught immediately by the suite itself:** the shared `api()` fetch wrapper attached a JSON body to every call, including `GET`s — `fetch` throws (`Request with GET/HEAD method cannot have body`) rather than silently ignoring it. Fixed by skipping the body for `GET`/`HEAD`. Exactly the kind of thing this sprint is for: a real assertion catching a real mistake immediately, instead of a manual walkthrough that might not have exercised that exact call shape.

**Bug hit in file naming, not code:** first pass named the shared test helper module `test-helpers.js`. Node's default `--test` file discovery matches a `test-*.js` filename pattern globally, not just inside a `test/` directory — so it got silently picked up and run as its own (trivially passing, zero-assertion) test. Renamed to `server/spec-helpers.js`, which matches none of the runner's default patterns (`*.test.js`, `*-test.js`, `*_test.js`, `test-*.js`, `test.js`, or any file inside a directory literally named `test`), and confirmed the phantom test disappeared from the run output on the next pass.

**Coverage added, 18 tests across four files (`server/test/`):**
- `serialize.test.js` — `toPublicProvider` never carries `exactLocation`/`contactMethod`, `toOwnerProvider` does; a string-search assertion against the serialized JSON as a belt-and-suspenders check against a future field-rename slipping a private value through under a different key.
- `privacy.test.js` — the full location-unlock lifecycle end to end over real HTTP: a public directory listing never carries the private fields; a pending request hides them; accepting one unlocks them only for that specific requester (a third, uninvolved account sees nothing); declining keeps them hidden; a provider's own freshly-submitted listing correctly echoes its own private fields back (the Phase 3 "this looks like a leak but isn't" case, now a regression test instead of a comment explaining why it's fine).
- `ownership.test.js` — a non-owner 403s viewing another listing's incoming requests or acting on one of its requests, the actual owner can; every route that requires a session 401s with no cookie at all; the public directory route stays public with no session.
- `auth.test.js` — non-`@uconn.edu` emails are rejected; a login token is single-use (the exact property whose violation, via React StrictMode's double-invoke, was the Phase 6 bug); an unknown token is rejected; a repeated link request inside the cooldown window doesn't reveal a second `devLoginUrl`, matching the "can't distinguish spammed from sent" property from Phase 6's log entry.

**Manual verification, on top of the suite itself:** ran `npm run test` from the repo root (proxies to the server workspace) to confirm the root-level script works, and re-ran a full `NODE_ENV=production` boot after the `app.js` split to confirm no behavior changed for the one thing that's broken silently before (Phase 8, Phase 12).

**Not done in this phase, on purpose:** no tests for the client (React) — the sprint's own framing, and every "write this as a test" note earlier in this log, was specifically about the server-side privacy/ownership logic, not UI behavior. No CI wiring (GitHub Actions or similar) to run this suite automatically on push — the suite exists now; running it automatically on every change is a reasonable next step but a separate decision, not assumed here.

---

## What's next

**Fully built:** the four core flows from the spec end to end, against a real SQLite-compatible backend (libSQL — a local file in dev, Turso in production) that's actually deployable on a host that's free, sitting behind real `@uconn.edu` authentication, with real email delivery (Resend) for sign-in links and for request/accept notifications. The two rules the app is organized around — exact location/contact info never leave the server until a specific request is accepted, and only the account that owns a listing can act on it — are both enforced server-side, not bolted onto the UI. All of it manually tested through the running app as multiple real accounts, not just reviewed by reading the code.

**Live, with one known gap.** The app is deployed and sending real email: the sending domain (`huskybook.hmbirmingham.me`, Phase 13) is verified in Resend, and magic-link/notification mail is actually arriving — but landing in spam rather than the inbox, confirmed by the user directly rather than assumed. Since the domain itself checks out, this is a content/reputation problem (missing DMARC alignment, no plain-text part alongside the HTML body, or a cold-reputation new subdomain), not a repeat of Phase 13's DNS gap — tracked as its own follow-up rather than folded into Sprint 2, which is scoped to tests only.

**Stubbed or deliberately deferred:**

- **Booking/scheduling.** Providers can't yet define availability, and there's no calendar/appointment concept beyond a request's status.
- **Payment connectors.** No Venmo/Cash App linking yet, and no deposit terms on a listing. Scoped deliberately narrow when it lands: a link/handle a provider adds and a requester follows to pay *outside* the app — HuskyBook itself never touches or processes money.
- **Social handles.** Providers can't yet attach Instagram/TikTok/etc. to a listing.
- **Location features beyond the free-text building/zone field.** No structured campus building picker, no live "on my way"/"arrived" status for mobile bookings.
- **Pagination on the directory.** Fine at seed-data scale; would need it before any real traffic.
- **Rate limiting / abuse prevention beyond the login-link cooldown.** Nothing stops a signed-in account from spamming requests at a provider or creating many listings.
- **Tests, partially addressed (Sprint 2 / Phase 14, extended Phase 16).** The privacy-gating SQL, ownership checks, and the edit/delete/withdraw routes now have automated HTTP-level coverage (`server/test/`, `npm run test`). Still no coverage for the client (React), and no CI wiring to run the suite automatically on push — both still manual/deferred.
- **Account recovery / email re-verification.** Sign-in only proves "clicked a link sent to this address" once — no re-confirmation later, no way to recover if a `@uconn.edu` account is ever compromised or the email changes.
- **Feedback channel.** No in-app way for a beta user to report a problem yet.

**What I'd do differently with more time:**

- What Phase 6's log entry already said before it happened: build the auth seam *before* the four flows, not alongside them. Having lived through the retrofit now, the actual cost was mostly in Manage Requests, which had grown real complexity (the stale-listing-id recovery flow) specifically to compensate for not having real ownership yet — complexity that turned out to be temporary scaffolding, not permanent product logic. Real auth first would have skipped building that scaffolding at all.
- Write the SQL privacy-gating logic (the `CASE WHEN status = 'accepted'` pattern in `requests.js`) and the ownership checks in `providers.js`/`requests.js` as a small set of automated tests, rather than relying on repeated manual curl/browser checks through every phase. Both have held up every time by hand, but that's a fragile guarantee for the two rules this entire app exists to enforce.
- Decide the category taxonomy (`hair | nails | makeup | braids | other`) with more research into what UConn students actually offer, rather than picking a reasonable-looking list. `other` doing a lot of quiet work in the current enum is a sign it's probably incomplete.
- Sprint 1's plan specified a `start` script but not a `build` step, which would have shipped an API with no way to reach the actual app. Worth remembering generally: a deployment plan that hasn't been run once, even locally in production mode, can look complete while skipping the one step that makes the other nine matter. Caught it here by actually building the client and running the full server locally before calling the branch done, rather than trusting the plan's checklist at face value.
## Phase 15 — Diagnosing spam-foldering (`fix/mailer-deliverability`)

**What happened:** the follow-up flagged after Phase 14 — real mail is delivering (Resend shows the sending domain fully verified) but landing in spam, not the inbox. Diagnosed by actually checking DNS, not guessing from the code.

**Diagnosis, checked directly against DNS rather than assumed:**
- SPF: present and correct, on `send.huskybook.hmbirmingham.me` (Resend's dedicated return-path subdomain), not the domain itself — this is Resend's own recommended setup, and it resolves correctly.
- DKIM: present and correct at `resend._domainkey.huskybook.hmbirmingham.me`.
- DMARC: present at `_dmarc.huskybook.hmbirmingham.me` as `v=DMARC1; p=none;` — and per Resend's own DMARC docs, `p=none` is the *correct* starting policy (monitor first, only move to `quarantine`/`reject` once every legitimate sending source is confirmed passing). This is not a misconfiguration; it was already set up correctly.
- So the technical setup Phase 13 built is genuinely fine. The remaining cause, per Resend's own deliverability documentation, is the one thing no DNS record fixes: **a brand-new sending subdomain has no reputation yet.** Mailbox providers weight sending history and recipient engagement (opens, replies, not-marked-as-spam) heavily, and a domain's very first sends landing in spam regardless of correct SPF/DKIM/DMARC is the expected, normal pattern — it improves with consistent legitimate sending and real engagement over time, not with a configuration change.

**Fixed — every email now sends a plain-text part alongside the HTML body** (`server/src/lib/mailer.js`). Resend's SDK accepts `text` on the same `emails.send()` call as `html`; HTML-only mail is a minor but real spam-filter signal, and this was a zero-risk, zero-tradeoff fix. Confirmed against the SDK's own shipped type definitions before writing it, not assumed from memory.

**Decision — a forwarding alias for Reply-To, not the account owner's real inbox.** The user's first instinct was "reply-to my personal email but don't disclose it" — flagged back to them that a Reply-To header is inherently visible to the recipient, so that specific ask isn't achievable as stated. Landed on `feedback@huskybook.hmbirmingham.me` instead, forwarded to the owner's inbox via Cloudflare Email Routing (this domain's DNS is already on Cloudflare — confirmed via NS lookup, not assumed). This gets the actual goal (a working reply channel, informally doubling as the feedback channel this log has flagged as deferred since Sprint 1) without putting a personal address in outgoing mail headers, and a genuinely replyable sender is itself a minor positive deliverability signal (reads as correspondence, not fire-and-forget automated mail).

**Setup step completed:** `huskybook` was registered as a subdomain under the `hmbirmingham.me` zone's Cloudflare Email Routing (its own scoped MX/TXT records, separate from the root domain's), a routing rule was added for `feedback@huskybook.hmbirmingham.me` → the owner's Gmail, and the destination address showed as already verified (it had been verified previously under the root domain's own, pre-existing Email Routing setup, so no new confirmation email was needed). The one live gotcha along the way: the "Subdomains" field on that settings page wants a bare label (`huskybook`), not a full email address — the full address belongs in a routing rule, added afterward on the separate "Routing rules" tab. The root domain's own unrelated SPF "Missing"/"Conflicting" flags on that same settings page were deliberately left untouched — see below.

**Considered and deliberately not done:**
- **List-Unsubscribe header.** Gmail/Yahoo's 2024 bulk-sender rules effectively require it, but only above ~5,000 messages/day to that provider — nowhere near this app's beta volume — and every email here is transactional (triggered by the recipient's own action: requesting a link, receiving a notice about their own request), not bulk/marketing mail someone "subscribed" to. Adding one without a real unsubscribe mechanism behind it would be actively misleading. Revisit if real send volume or a marketing-style email ever gets added.
- **Rewriting email copy for spam-trigger words.** Reviewed all three templates directly — no ALL-CAPS, no excessive punctuation, no urgency language beyond the legitimate "this link expires in 15 minutes" security framing, one relevant link per email. Content wasn't the issue.
- **Tightening the DMARC policy to `quarantine`/`reject`.** Explicitly against Resend's own guidance at this stage — `p=none` is correct until every real sending source is confirmed passing, which isn't something to change opportunistically while chasing an unrelated spam-foldering issue.

**What actually fixes this:** time and real engagement, not another config change. Every real test send that gets opened, replied to, or manually moved from spam to inbox (in Gmail specifically, "not spam" is a strong positive signal) builds the domain's reputation. There's no shortcut past this for a brand-new sending domain.

## Phase 16 — Edit/delete/withdraw, documented and tested after the fact (`feature/edit-delete-listings-requests`, PR #16)

**What shipped, retroactively logged.** PR #16 merged same-day as Phase 15 with no BUILD_LOG entry of its own — this closes that gap. It adds the piece this log had listed as deferred since Sprint 1: a provider can edit or delete their own listing, and a requester can withdraw a request while it's still pending. Server side: `PATCH /api/providers/:id` (partial update — only fields present in the body change, so the client can send just what the edit form touched), `DELETE /api/providers/:id` (removes the listing and, in the same `db.batch`, any requests sent to it — a dangling `provider_id` would break the join every other `requests.js` query relies on), and `DELETE /api/requests/:id` (only the original requester, only while `status = 'pending'` — once a provider has acted on it, it's their record too, so it's left alone rather than disappearing out from under them). All three follow the same ownership-check pattern as the rest of the app: look the row up, compare `owner_user_id`/`requester_user_id` against the session, 403 before doing anything else. Client side: a new My Listings page (`client/src/pages/MyListings.jsx`) for edit/delete, and a withdraw action added to My Requests.

**Test coverage added this phase (`server/test/edit-delete-withdraw.test.js`, 15 tests, same real-HTTP pattern Phase 14 established):** owner-can/non-owner-cannot for all three routes; partial edit only changes the fields sent; invalid category and empty-body edits are rejected; deleting a listing cascades to its requests and drops it from the public directory; withdraw succeeds only while pending and 409s once accepted; all three routes 401 with no session; all three 404 against a nonexistent id. This was the gap HANDOFF.md flagged: the routes existed and worked (manually verified when they shipped) but had no regression coverage, unlike everything Phase 14 covers.

**Not done in this phase:** no client (React) test coverage — same scope boundary Phase 14 drew, still deferred.
