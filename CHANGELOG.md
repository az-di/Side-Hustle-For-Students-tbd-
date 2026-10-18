# Changelog

Newest first. Each entry is one pushed feature; the HANDOFF §11 number it closes is in brackets.

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
