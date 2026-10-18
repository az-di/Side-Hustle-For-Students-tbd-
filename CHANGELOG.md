# Changelog

Newest first. Each entry is one pushed feature; the HANDOFF §11 number it closes is in brackets.

## 2026-10-18 — Rate limiting [§11.11]

**What it stops**

| Action | Limit | Keyed by |
| --- | --- | --- |
| Sign-in code requested | 20 / 15 min | client IP (first `X-Forwarded-For`, which Traefik sets) |
| Sign-in code requested | 5 / 15 min | email address |
| Code verification | 15 / 15 min | email address (on top of 5 attempts per code) |
| Request posted (open or direct) | 10 / hour | buyer |
| Response to an open request | 30 / hour | seller |
| Message sent | 120 / hour | sender |
| Report filed | 5 / day | reporter |
| Portfolio upload | 30 / hour | seller |

Plus the existing 5 new inquiry threads per day. Each refusal is a friendly `RATE_LIMITED` message shown inline.

**How it works**

- `RateLimit(key, windowStart, count)` in Postgres — no Redis, no `@upstash/ratelimit`: this runs on one box and the counts are tiny. `modules/ratelimit/mutations.ts#consumeRateLimit()` is **one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`** that starts, bumps or resets the fixed window, so concurrent hits cannot both read "4" and both write "5" (tested with `Promise.allSettled`). Clock bound from JS, per the §10 gotcha.
- Limits are applied inside the module mutations (they already have the actor id), except OTP, which is applied in `auth.actions.ts` because `lib/auth` must not depend on modules.
- The rules table is `modules/ratelimit/state.ts` (pure, unit-tested). The instrumentation timer prunes dead rows roughly hourly.
- Migration `20261018130000_rate_limit`.

**Tests** — `npm test` 86 (+5), `npm run test:int` 52 (+4): max allowed then refused then reset after the window; exact counting under concurrency; subjects and actions independent; pruning.

## 2026-10-18 — Admin console with an audit log [§11.8]

**What an admin sees** (`User.isAdmin`; non-admins get a 404)

- `/admin` — overview tiles (accounts, open reports, active tags, pending emails) and the **auto-suspend threshold** form, which was previously only editable in Prisma Studio.
- `/admin/reports` — the queue from §11.1, unchanged in behaviour.
- `/admin/tags` — create tags, edit name / kind / sort order / **hidden synonyms**, deactivate and reactivate. Saving regenerates `Tag.searchTerms` (normalized name + synonyms, deduped) in one transaction, with the same normalizer the typeahead applies to queries. Slugs are stable on rename because they are in URLs and seed data.
- `/admin/users` — search by handle, name or email; suspend / reinstate / close; make or remove admin. Shows status, standing, seller state and report counts.
- `/admin/audit` — every admin write, newest first, with who, what, target and a JSON payload.

**How it works**

- `modules/admin/audit.ts#withAudit(adminUserId, entry, fn)` is the **only** way an admin write gets a transaction: it checks `isAdmin` (and `ACTIVE`), runs the change, and writes the `AdminAuditLog` row in the same transaction. The audit entry is a required argument, so an unlogged admin action does not typecheck; an action that throws rolls back its log line with it.
- `resolveReport` and `setUserStatus` moved from `trust/mutations.ts` into `admin/mutations.ts` behind `withAudit`, and the report-queue actions moved to `admin.actions.ts`. The layout gate is UX; the module is the security boundary.
- Migration `20261018120000_admin_audit`.

**Tests** — `npm run test:int` 48 (+10): synonym found by search after create, regenerated on update (removed synonym gone), deactivation hides from search, duplicate refused; promote / demote / cannot demote self; closing deletes sessions; threshold stored and validated; every write refused for a non-admin; every action above logged; a rolled-back action leaves no log line.

## 2026-10-18 — Pre-request inquiry threads [§11.7]

**What a user sees**

- A **Message** button on every seller profile opens a conversation with them before any request exists ("are you free on the 7th?"). One thread per buyer/seller pair; pressing it again returns to the same thread. The thread header offers **Request from them** so the inquiry turns into a request in one tap.
- A buyer can start at most **5 new** conversations a day. Returning to an existing one never counts.

**How it works**

- `Thread.inquiryKey` (`"{buyerId}:{sellerId}"`, unique) is the idempotency key the handoff described — it was in the plan but not actually in the schema, so migration `20261018110000_inquiry_key` adds it.
- `messaging/state.ts` holds the pure rules (`canOpenInquiry`, `inquiryKey`, the daily cap); `messaging/mutations.ts#openInquiry()` applies them plus `assertCanReach()` (blocks, suspension) and creates the thread with a system message.
- Inquiry threads use the ordinary message path, inbox listing, unread badges and `MESSAGE_RECEIVED` emails. They are not job threads, so the completion-handshake dialogue guard is unaffected.

**Tests** — `npm test` 81 (+5), `npm run test:int` 38 (+4): one thread per pair and idempotent re-open; messages both ways and both inboxes; self / non-seller / blocked refused; the daily cap applies to new threads only.

## 2026-10-18 — Watched-tag alerts [§11.6 — completes spec item 8]

**What a user sees**

- Post a request under a tag and, for the next 90 days, you are told when a seller becomes open to it: "Maya Chen is now open to Photography — you asked for that recently", linking to the tag's search page. At most once per seller per tag per month.
- `/settings/watched-tags` lists every tag you have requested under, with a per-tag **Watch / Stop** switch and **Turn all off**. Lapsed tags (older than 90 days) are marked; posting again re-arms them.
- The alert is digested by email (bundled with new-request alerts into the daily "N updates in your tags" message), never sent immediately.

**How it works**

- `BuyerTagInterest(buyerUserId, tagId, notifyOnNewSeller, lastRequestedAt, mutedUntil)` is upserted on every request create (`recordInterest()` in both request creators) and never deleted when the request closes.
- The three triggers — seller adds a tag, resumes from pause, publishes a listing under a new tag — all funnel through `interests/mutations.ts#notifyWatchers()` inside the same transaction as the change. Only tags that are **new** to the seller count; toggling a tag you already hold, or clicking Resume twice, announces nothing. A paused or suspended seller announces nothing until active.
- **The dedupe is the whole difficulty** and lives in the notification's dedupe key, `seller_open:{sellerId}:{tagId}:{YYYY-MM}`, enforced by `@@unique([userId, dedupeKey])`. The set-based INSERT also applies: 90-day activity window, the per-tag switch, mutes, not the seller themselves, not blocked either way, not suspended, capped at the 200 most recently active watchers per tag.
- `NotificationKind.SELLER_OPEN_TO_TAG` with `Notification.tagId`. Copy moved to a context-object signature (`notificationContext()`), shared by the page and email.
- The digest-email INSERT was factored into `enqueueDigestsForNotificationKey()` and is now used by both the open-request fan-out and this alert; the digest renders both kinds.
- Migration `20261018100000_watched_tags`.

**Tests**

- `npm test` — 76 (+5: dedupe key by month, the 90-day window, switch, mute).
- `npm run test:int` — 34 (+8): interest recorded and listed; add-tag alerts the active watcher but not stale / opted-out / blocked buyers; digest (not immediate) email queued; off-and-on in the same month is one alert; resume alerts for every held tag minus earlier ones and repeating Resume is a no-op; a paused seller's new tag waits until they resume; a listing alerts only for tags new to the seller.

## 2026-10-18 — Module boundaries enforced by lint, plus CI [§11.5]

**What changed**

- The three conventions in HANDOFF §5 are now ESLint errors (`eslint.config.mjs`, built-in `no-restricted-imports`, **no new dependency**):
  1. `src/app/**` and `src/components/**` may not import `@/lib/db`, `@/lib/tx` or `@/generated/prisma/client`. Reads go through a module's `queries.ts`, writes through `mutations.ts`.
  2. The same files may not import `netFromGross` / `grossFromNet` / `netFromGrossOrNull` — pages receive DTOs that already carry the right figure.
  3. `src/modules/**` and `src/lib/**` may not import `@/app/*` or `@/components/*`. Dependencies point one way: app → modules → lib.
- Eleven places under `src/app/` (and one component) reached Prisma directly. They now go through new module files: `identity/queries.ts` (handle lookups, demo personas, seller settings), `catalog/mutations.ts` (become seller, pause, tags, profile, listings — moved out of `marketplace.actions.ts`), `email/queries.ts` + `email/mutations.ts` (settings, unsubscribe-by-token), `notifications/queries.ts` (badge counts), `trust/queries.ts#getReportContext`.
- `npm run lint` is clean for the first time: the `Date.now()`-in-render findings in `ui.tsx` are server components rendered per request (documented and disabled per line), the set-state-in-effect in `tag-search-box.tsx` moved into the change handler, and an unused import went.
- **CI**: `.github/workflows/ci.yml` runs lint → typecheck → unit tests → migrate + seed → integration tests → production build against a Postgres 17 service on every push and PR. Node 24, matching `nixpacks.toml`.

**Not done from the original plan**

- No `eslint-plugin-boundaries` / `dependency-cruiser` (would add dependencies and lockfile churn from an npm 10 machine; the built-in rule covers the three conventions). No `domain/application/ports/infra` split or repository interfaces — the module layout (`state → mutations → queries → dto`) is already the seam, and the lint rules now keep the UI on the right side of it.
- Money arithmetic cannot be *linted* for; the rule blocks importing the converters into the UI. `request-form.tsx` keeps a local `netFromGross` copy for its live preview (client component, mirrors `lib/money.ts`), which is deliberate and commented.

## 2026-10-18 — Media uploads [§11.4]

**What a user sees**

- Sellers upload photos, short videos and PDFs to a **Portfolio** section in `/settings/seller` (caption optional, up to 24 items, 25 MB per file, 200 MB per account). They appear as a grid under **Work** on the public profile; the existing portfolio links stay and render below it.
- Files are served from the app at `/media/<key>` with a long immutable cache.

**How it works**

- New module `src/modules/media/`: `state.ts` (pure: magic-byte sniffing, caps, key shape), `storage.ts` (the disk adapter — swap this file plus `mediaUrl()` to move to object storage), `mutations.ts`, `queries.ts`.
- The content type is decided by **sniffing the bytes**, never by the upload's declared MIME type or filename. Only JPG, PNG, GIF, WebP, MP4, MOV, WebM and PDF are accepted, so an HTML or SVG file (both can run script when served) can never be stored. The serving route sends `X-Content-Type-Options: nosniff` and the type from the row.
- Storage keys are random bare filenames (`<32 hex>.<ext>`), enforced by a regex in code **and** a CHECK constraint, so neither a URL nor a row can become a path.
- Ordering: file written before the row commits; row deleted before the file is removed. Worst case after a crash is an orphan file, never a row pointing at nothing.
- Uploads go through a server action; `next.config.ts` raises `serverActions.bodySizeLimit` to 30 MB.
- Env: `MEDIA_DIR` (default `./data/media`, gitignored; **mount a persistent volume here in Coolify**), `MEDIA_MAX_FILE_BYTES`, `MEDIA_MAX_TOTAL_BYTES`.
- Migration `20261018090000_media`: `MediaAsset`, `PortfolioItem`, two CHECK constraints.

**Tests**

- `npm test` — 71 (+9: sniffing incl. refusing HTML/SVG, caps, key shape).
- `npm run test:int` — 26 (+4): upload stores a sniffed file and lists a served URL, refuses non-media, refuses non-sellers, owner-only delete removes the file.
- Smoke-tested over HTTP against `next start`: 200 with `image/png` and the immutable cache header, 404 for a missing key and for a traversal attempt, 404 after delete.

## 2026-10-18 — Email notifications [§11.3]

**What a user sees**

- Direct requests, responses, being picked, job updates, completion requests and reviews **email right away**. New open requests in your tags are **bundled into at most one email a day** ("3 new requests in your tags"), sent an hour after the first one so several can collapse.
- Every email has a one-click unsubscribe link and the `List-Unsubscribe` / `List-Unsubscribe-Post` headers, so Gmail shows its own unsubscribe button. `/settings/email` turns email on or off and shows the last ten emails and their status. Sign-in codes are always sent.
- Without `RESEND_API_KEY` nothing changes for local dev: emails are printed to the server console and marked sent.

**How it works**

- `OutboundEmail` is an **outbox**: rows are written in the **same transaction** as the `Notification` they describe (`notify()` calls `enqueueForNotifications()`; the set-based fan-out INSERT has a matching set-based digest INSERT). A crash between "state changed" and "email sent" loses nothing.
- Payloads hold **ids only**, like notification rows. Templates (`modules/email/templates.ts`) render per recipient at send time and are money-free: the only numbers are counts. If a template ever needs an amount it must take role-specific props and join the leak suite — same rule as the request DTOs.
- `drainOutbox()` claims due rows with `FOR UPDATE SKIP LOCKED` (safe from several processes), sends, and marks `SENT` / `SKIPPED` (opted out, or nothing left to say) / retries with exponential backoff up to 6 attempts → `FAILED`. Rules in `modules/email/state.ts`, unit-tested.
- Two triggers: `src/instrumentation.ts` runs the drain on a timer inside the Next server process (`EMAIL_DRAIN_INTERVAL_MS`, default 60s, `0` disables) because this runs on one box, not serverless; and `POST /api/email/drain` with `Authorization: Bearer $CRON_SECRET` for an external scheduler.
- Unsubscribe: `/email/unsubscribe?u=<userId>&k=<hmac>` where the HMAC is over the user's private `emailUnsubKey` with `SESSION_SECRET`. GET shows a confirmation page, POST serves RFC 8058 one-click.
- Notification copy moved to `modules/notifications/copy.ts` so the app page and email share one source.
- New env: `APP_URL`, `EMAIL_DRAIN_INTERVAL_MS`, `CRON_SECRET` (see `.env.example`).
- Migration `20261018080000_email_outbox`: `OutboundEmail`, `User.emailOptOut`, `User.emailUnsubKey` (DB-generated default so existing rows get one), partial index over pending rows.

**Gotcha fixed on the way**

- Raw SQL that compared Prisma-written timestamps to Postgres `now()` was off by the session's UTC offset on any box not set to UTC (Prisma stores `DateTime` as naive UTC; `now()` renders local). The fan-out INSERT and the outbox claim now bind the clock from JS. If you write raw SQL with timestamps, do the same.

**Tests**

- `npm test` — 62 (+6 for email rules). `npm test` now excludes `*.int.test.ts`.
- `npm run test:int` — 22 (+5): row enqueued in the same transaction, two fan-outs → one digest that renders both titles and no money, drain sends and marks, opt-out → `SKIPPED`, no double send.

## 2026-10-18 — Reports, blocking, account status [§11.1 — spec items 13 and 14]

**What a user sees**

- **Report** and **Block** on every profile, conversation and job page (`SafetyMenu`). Reports go to `/report/[handle]`, optionally tied to a job; the form offers to block at the same time.
- Blocking is mutual and silent. A blocked pair cannot see each other's profiles, requests, responses, search results or inbox threads, and neither can message or request the other. Existing job threads stay readable (history is not rewritten) but get no new messages. The wording is identical in both directions, so a blocked person cannot tell who blocked whom.
- `/settings/safety` lists your blocks (with undo) and the reports you sent, with their status.
- A suspended account sees a banner and can still read, but every write is refused in `requireViewer()`.

**How it works**

- New module `src/modules/trust/` in the house layout: `state.ts` (pure rules, unit-tested), `mutations.ts`, `queries.ts`, plus `block-filter.ts` (the one place that knows how to hide a blocked pair, as both a Prisma `notIn` helper and a raw-SQL `NOT EXISTS` fragment) and `settings.ts` (reads `PlatformSetting`).
- Enforcement in **both** places the handoff warned about: `assertCanReach()` next to every state-machine decision in `requests/mutations.ts` and `messaging/mutations.ts`; `blockedUserIds()` / `notBlockedSql()` composed into every feed (`listOpenRequestsForSeller`, `listIncomingDirectRequests`, `listSellersForTag`, `listThreadsForUser`, `fanOutOpenRequest`, `getRequestForViewer`).
- Reports are accepted only from someone who shares a thread with the subject (anti-brigading), once per reporter per job (or once "general"). Each kind has a weight (`REPORT_WEIGHTS`) frozen onto the row. `recomputeTrust()` runs after every report write; at `PlatformSetting.report_suspend_threshold` (default **3**, tunable in Prisma Studio) the account is auto-suspended, and dismissing reports below the line auto-reinstates it. A status set by hand by an admin is never auto-reverted.
- `User.status` (`ACTIVE | SUSPENDED | CLOSED`). CLOSED deletes sessions and reads as signed out; the OTP path refuses it too.
- Minimal admin queue at `/admin/reports` (`User.isAdmin`; the seeded **Alex Kim** is an admin): uphold / dismiss, suspend / reinstate / close. The full admin console is still §11.8.
- Migration `20261018072014_trust` adds `Report`, `Block`, `UserTrust`, `PlatformSetting`, three CHECK constraints (no self-report, no self-block, positive weight) and a partial index over open reports.

**Tests**

- `npm test` — 56 unit tests (+11 for trust rules).
- `npm run test:int` — **new** integration suite against the Postgres in `DATABASE_URL`. `src/modules/trust/trust.int.test.ts` runs a `describe.each` over both block directions and asserts every feed, the request page, search, direct requests, responses, messages and the fan-out SQL all hide the blocked counterparty; plus the suspension threshold round trip. Fixtures are tagged with a run id and deleted afterwards, so it is safe against a seeded dev database.

**Known gaps**

- No email to the reported/suspended person (email lands with §11.3).
- No rate limit on reports beyond the one-per-scope rule (§11.11).
