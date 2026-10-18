# Changelog

Newest first. Each entry is one pushed feature; the HANDOFF §11 number it closes is in brackets.

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
