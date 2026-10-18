# HUSTL — Handoff

Everything that exists, why it is built the way it is, and exactly what to do next.

Written at commit `05b890d`. If you read one section before touching code, make it [The money boundary](#4-the-money-boundary--read-before-touching-any-money-code).

---

## Contents

1. [Status](#1-status)
2. [Get it running in 5 minutes](#2-get-it-running-in-5-minutes)
3. [What is built](#3-what-is-built)
4. [The money boundary](#4-the-money-boundary--read-before-touching-any-money-code)
5. [Architecture](#5-architecture)
6. [The state machines](#6-the-state-machines)
7. [Data model](#7-data-model)
8. [Auth and demo mode](#8-auth-and-demo-mode)
9. [Decisions that look like bugs but are not](#9-decisions-that-look-like-bugs-but-are-not)
10. [Gotchas found while building](#10-gotchas-found-while-building)
11. [What is NOT built, and how to build it](#11-what-is-not-built-and-how-to-build-it)
12. [Deploying to Vultr](#12-deploying-to-vultr)
13. [The demo](#13-the-demo)
14. [Verification](#14-verification)
15. [Open questions for the team](#15-open-questions-for-the-team)

---

## 1. Status

**The spec's core loop works end to end and has been walked in a browser**: a buyer finds a seller, they agree on a job, it gets done, the buyer reviews. Deployed nowhere yet — it runs locally.

| | |
| --- | --- |
| Commit | `05b890d`, 73 files |
| Tests | 45 passing across 4 files (`npm test`) |
| Typecheck | clean (`npx tsc --noEmit`) |
| Production build | succeeds, 16 routes |
| Spec coverage | 10 of 14 in-scope items complete, 2 partial, 2 not started — see [§3](#3-what-is-built) |
| Deployed | **no** — see [§12](#12-deploying-to-vultr) |

The original product spec is [Side Hustle for Students (temp title).md](Side%20Hustle%20for%20Students%20(temp%20title).md). The full technical plan, including the phased build order and the risk table, lives outside the repo at `C:\Users\azdi\.claude\plans\read-the-attached-markdown-lively-lagoon.md` — **copy it into the repo** if more than one person is working from it.

---

## 2. Get it running in 5 minutes

Requires **Node 20+** and **PostgreSQL 17**. On the machine this was built on, both were installed with winget (`OpenJS.NodeJS.LTS`, `PostgreSQL.PostgreSQL.17`); the Postgres superuser password is `postgres`.

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run db:seed
npm run dev
```

http://localhost:3000. Click **switch** in the header to jump between seeded personas — no email required.

> The local database currently holds test data from the build (a `demo.tester@uw.edu` account, plus one completed "Headshots" job). Run `npm run db:reset` for a clean seeded state before demoing.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run db:seed` | Idempotent seed — safe to re-run |
| `npm run db:reset` | Drop → migrate → seed |
| `npm run db:studio` | Prisma Studio — escape hatch; the admin console is `/admin` |

### Versions, pinned deliberately

Next `16.4.0`, React `19.3.0`, Prisma `7.10.0`, Tailwind `4.3.3`, Zod `4.6.5`, Resend `6.32.1`, Vitest `5.0.3`.

**Do not run `npm update`.** npm's `latest` tag currently points at prereleases for both Next (`16.5.0-canary.8`) and Prisma (`8.1.0-dev.9`). Everything here is pinned to the latest *stable*. If you need to bump, check `npm view <pkg> versions` and pick a version with no `-canary`/`-dev`/`-rc` suffix.

---

## 3. What is built

Against the spec's 14 in-scope items:

| # | Spec item | Status |
| --- | --- | --- |
| 1 | Sign-up restricted to verified UW email | ✅ Email OTP; enforced in app code **and** as a DB CHECK constraint |
| 2 | Task tags, flat list, hidden synonyms, found by search | ✅ 15 service tags + 20 course codes, each with a hidden synonym list, editable at `/admin/tags`. ⚠️ Not the full UW catalog |
| 3 | Seller profile: bio, tags, portfolio, reviews, job history | ✅ All of it, including hosted photos/video/PDF (`MEDIA_DIR` volume) plus links |
| 4 | Seller tags and listings | ✅ Listings with flat and/or hourly pricing, turnaround, tags |
| 5 | Pause | ✅ Stays listed with a Paused badge, excluded from fan-out and direct requests |
| 6 | Open and direct requests | ✅ Both, including one thread per responder and losers closed out on selection |
| 7 | Budget and time limit on every request | ✅ Expiry derived at read time — no cron needed |
| 8 | In-app notifications | ✅ All job/request lifecycle events, in-app **and by email** (outbox + daily digest), plus the watched-tag alert with `/settings/watched-tags` |
| 9 | Tag search with type-ahead incl. course codes; filter sellers by rating | ✅ |
| 10 | Job flow: request, accept/decline, both mark complete | ✅ Plus auto-confirm with a configurable window |
| 11 | Messaging | ✅ Request, job and pre-request inquiry threads (one per pair, 5 new/day), polled |
| 12 | Reviews, buyers only, after completion | ✅ Rating recomputed transactionally |
| 13 | Buyer accountability (reports → hidden rating → closure) | ✅ Weighted reports, hidden `UserTrust` standing, auto-suspend at a tunable threshold, admin queue. See CHANGELOG |
| 14 | Reporting and blocking | ✅ Mutual, silent blocks enforced in point actions **and** every feed; integration-tested in both directions |

Beyond the spec: the **hidden platform cut** ([§4](#4-the-money-boundary--read-before-touching-any-money-code)) and **Venmo handle exchange** on the job page, revealed only to the two people on a job.

---

## 4. The money boundary — read before touching any money code

**A buyer's budget is a ceiling that no seller ever sees.**

A buyer sets `$100`. Every seller-facing surface shows `$90` — the budget minus HUSTL's 10%. In v1 the fee is **waived**: the buyer Venmos the seller that `$90` directly and HUSTL collects nothing. The mechanism exists now so that turning on real payments later changes no number a seller has ever seen.

`feeBps` is **basis points** (hundredths of a percent): `1000` = 10%. It is stored per row on `Request` and `Job`, frozen at creation, so changing the platform fee never restates the history of old jobs. Setting it to `0` makes net equal gross — that is how you ship a true 0% beta without a migration.

### The polarity rule, which is the easiest thing to get wrong

| Authored by | Stored as | Example |
| --- | --- | --- |
| **Seller** (listing price, hourly rate, profile rate) | **NET** | Maya types `90`, sees `$90` on her own listing |
| **Buyer** (request budget, agreed job amount) | **GROSS** | Alex types `100`, seller sees `$90` |

Storing both as gross would render a seller's own `$100` listing back to them as `$90`, which everyone would read as a bug. The two converters are exact inverses — one floors, one ceils — and a property test proves the round trip:

```ts
netFromGross(grossFromNet(n, fee), fee) === n   // for all n, fee
```

**When a buyer requests a listing, the budget must be grossed up** (`budgetFromListing` in `src/modules/requests/mutations.ts`). Forget that one conversion and a $100 listing silently becomes $90 of work.

### How it is enforced

1. **One mapper per audience.** `src/modules/requests/dto.ts` has `toSellerRequest` and `toBuyerRequest`. `SellerRequestDto` has **no field that could hold a gross value** — not a renamed one, not a nested one.
2. **No object spread in `dto.ts`.** `...row` is exactly how `grossFixedBudgetCents` escapes. Every field is written out by hand. Keep it that way.
3. **One place does the arithmetic.** `src/lib/money.ts`. Nowhere else.
4. **The leak suite.** `src/modules/requests/dto.test.ts` builds a row with a distinctive gross (`10000`), serializes the seller DTO, and asserts the number appears nowhere — including a recursive walk of nested values. **If you add a seller-facing mapper, add it to this file.**
5. **Shared surfaces count as seller-facing.** A thread is read by both parties, so system messages carry no money at all ("Job started", never an amount). Notification rows store **ids only** and are rendered per viewer — a stored string like "New request: $100 for photos" would be role-blind and would ship the ceiling to every seller in the tag.

Verified in the live app: on the seller's view of a `$100` request, the rendered HTML contains no `$100`, no `100`, no `10000`, and no occurrence of the word `gross`.

---

## 5. Architecture

```
src/lib/          money.ts auth.ts db.ts env.ts errors.ts tx.ts mail.ts   ← chokepoints
src/modules/      catalog/ requests/ jobs/ messaging/ notifications/
src/app/          pages + server actions — adapters only
src/components/   design system (ui.tsx, app-shell, tag-search-box, …)
prisma/           schema.prisma, migrations/, seed.ts, seed-data.ts
```

Each module is the same four files:

| File | Holds | Rule |
| --- | --- | --- |
| `state.ts` | Transition table + a **pure** reducer | No I/O, no `Date.now()` — the clock is a parameter |
| `mutations.ts` | Writes | Load → ask `state.ts` → write in one transaction |
| `queries.ts` | Reads | Returns DTOs, never Prisma models |
| `dto.ts` | Serialization | One mapper per audience |

### Three conventions that keep this portable

1. **Prisma is imported only inside `src/modules/*/` and `src/lib/db.ts`.** Never from `app/`.
2. **Money arithmetic happens only in `src/lib/money.ts`.**
3. **No page receives a Prisma model.** Reads go through `queries.ts`/`dto.ts`; seller-facing mappers are named `toSeller*`.

**These are now lint errors** (`eslint.config.mjs`, see the CHANGELOG entry for §11.5): the UI cannot import Prisma or the money converters, and modules/lib cannot import UI. `npm run lint` runs in CI.

### The shape of every mutation

```ts
const row = await loadForTransition(id);                      // 1. load
const decision = applyRequestEvent(row, EVENT, actor, now);   // 2. pure rules
if (!decision.ok) throw notAllowed(decision.message);

return db.$transaction(async (tx) => {
  const updated = await tx.request.updateMany({
    where: { id, status: "OPEN" },                            // 3. optimistic guard
    data: { status: "MATCHED", … },
  });
  if (updated.count === 0) throw conflict();                  // someone beat us
  await notify(tx, { … });                                    // 4. same transaction
});
```

That `where: { status }` guard plus the affected-row check is what makes a double-click harmless — the second click updates zero rows and raises `CONFLICT` instead of creating a second job. The `@unique` constraints on `Job.requestId`, `Review.jobId` and `Request.chosenResponseId` are the database-level backstop. **Keep both.**

---

## 6. The state machines

Both are a `const` transition table plus a pure function. They are the most test-dense code in the repo and the right place to add any new rule.

### Requests — `src/modules/requests/state.ts`

| From | Event | Who | To |
| --- | --- | --- | --- |
| — | `CREATE_DIRECT` | buyer | `PENDING_SELLER` |
| — | `CREATE_OPEN` | buyer | `OPEN` (fan-out to every seller holding a tag) |
| `PENDING_SELLER` | `SELLER_ACCEPT` / `SELLER_DECLINE` | the targeted seller only | `MATCHED` / `DECLINED` |
| `OPEN` | `SELLER_RESPOND` | any available seller with the tag, not the buyer | `OPEN` (stays open) |
| `OPEN` | `BUYER_SELECT` | buyer only | `MATCHED` — others → `SUPERSEDED`, request leaves every feed |
| `OPEN`/`PENDING_SELLER` | `BUYER_CANCEL` | buyer | `CANCELLED` |
| `OPEN`/`PENDING_SELLER` | `EXPIRE` | system | `EXPIRED` |

`MATCHED`, `DECLINED`, `EXPIRED`, `CANCELLED` are terminal and refuse every event.

### Jobs — `src/modules/jobs/state.ts`

| From | Event | Who | To |
| --- | --- | --- | --- |
| — | `START` | system, on `MATCHED` | `IN_PROGRESS` |
| `IN_PROGRESS` | `MARK_COMPLETE` | **either** party | `AWAITING_CONFIRMATION` |
| `AWAITING_CONFIRMATION` | `CONFIRM_COMPLETE` | **the other** party only | `COMPLETED` (`MUTUAL`) |
| `AWAITING_CONFIRMATION` | `REJECT_COMPLETION` | the other party | `IN_PROGRESS` |
| `AWAITING_CONFIRMATION` | `AUTO_COMPLETE` | system, after the window | `COMPLETED` (`AUTO`) |
| `COMPLETED` | `LEAVE_REVIEW` | buyer only, once | — |

Two guards worth preserving:

- **`MARK_COMPLETE` requires that both people have posted in the thread.** Without it, anyone could mark a dead job complete, wait out the auto-confirm window, and manufacture a completed-job count and a review slot out of nothing.
- **Only the *other* party may confirm.** Otherwise whoever marked complete could immediately confirm their own mark.

### No cron, deliberately

Expiry and auto-confirm are **derived at read time**. An expired request reads as expired the instant it lapses (`effectiveRequestStatus`) and every seller feed filters `expiresAt > now()`. The stored row catches up when someone next opens it (`materializeExpiry`, `materializeAutoComplete`). A scheduler would only ever improve notification *timeliness*, never correctness.

`AUTO_COMPLETE_MS` controls the window — `120000` (2 min) makes it demoable, `604800000` (7 days) is production.

---

## 7. Data model

16 models in `prisma/schema.prisma`. All money is `Int` **cents**, never `Float`.

- **identity** — `User` (`uwEmail` unique, `venmoHandle`, `isDemo`), `Session` (sha256 of the cookie; the raw token is never stored), `OtpChallenge` (HMAC'd code, attempt counter), `SellerProfile` (`isAvailable` = not paused, net prices, denormalized rating and job counts)
- **catalog** — `Tag` (`kind: SERVICE | COURSE`, `searchTerms[]` = name + **hidden** synonyms), `SellerTag`, `Listing`, `ListingTag`
- **requests** — `Request` (gross budgets, frozen `feeBps`, `chosenResponseId` unique), `RequestTag`, `RequestResponse` (unique per request+seller)
- **jobs** — `Job` (gross snapshot at match, `completionSource: MUTUAL | AUTO`)
- **messaging** — `Thread` (`requestResponseId` unique → one thread per responder), `Message` (`senderUserId` null = system)
- **reviews** — `Review` (`jobId` unique = one review per job)
- **notifications** — `Notification` (`@@unique([userId, dedupeKey])` makes fan-out and retries idempotent)

### The constraints are load-bearing

`prisma/migrations/20261018050000_invariants/migration.sql` adds 11 CHECK constraints and 3 partial indexes that Prisma cannot express. These are what stop a bug in a server action from producing a non-UW account, a self-dealt job, a budget-less request or a 7-star review:

```sql
user_uw_email          CHECK ("uwEmail" LIKE '%@uw.edu')
job_no_self            CHECK ("buyerUserId" <> "sellerUserId")
request_direct_target  CHECK (DIRECT ⇒ target set, OPEN ⇒ target null)
request_has_budget     CHECK (at least one budget column is set)
review_rating_range    CHECK (rating BETWEEN 1 AND 5)
…plus fee-range, non-negative-money and message-author checks
```

Verified: inserting `someone@gmail.com` directly via psql is rejected by `user_uw_email`.

Partial indexes serve the unread badge (`WHERE readAt IS NULL`) and the expiry/auto-complete filters, so those stay O(matching rows) rather than O(table).

---

## 8. Auth and demo mode

Email OTP, `@uw.edu` only. Six-digit code, HMAC'd with `OTP_PEPPER`, 10-minute expiry, 5 attempts, constant-time compare. Sessions are DB rows; the cookie holds a random token and only its hash is stored.

Email goes through `src/lib/mail.ts`, which **never throws** — a failed send must not break sign-in. With no `RESEND_API_KEY` it logs the code to the server console instead.

`DEMO_MODE=1` does two things, both impossible in production because the actions check the flag server-side:

- OTP codes are returned to the browser and shown on screen
- the header shows a **switch** dropdown to jump between seeded personas instantly

**Judges will not have `@uw.edu` addresses**, so they cannot sign up. Demo with your own UW addresses and the persona switcher. Seeded personas: Alex Kim and Zoe Williams (buyers), Maya Chen and Kai Alvarez (photographers — two, so the "several respond, buyer picks" moment works), plus design, video, web, 3D, baking, live music and tutoring sellers.

---

## 9. Decisions that look like bugs but are not

| Looks wrong | Why it is right |
| --- | --- |
| Seller sees `$90` when the buyer typed `$100` | The entire point. See [§4](#4-the-money-boundary--read-before-touching-any-money-code) |
| HUSTL collects nothing despite "taking 10%" | v1 has no payments. The fee is waived and the buyer pays the net figure. Copy says so explicitly in three places |
| Seller's own listing shows exactly what they typed | Seller prices are stored net. Deliberate polarity |
| "Send a message first" when marking a job complete | Anti-unilateral-completion guard |
| Paused sellers still appear in search | The spec is explicit: they stay listed, they just receive no new requests |
| A request with a passed deadline shows "Expired" with no cron running | Expiry is derived at read time |
| Notification rows contain no text | They store ids; copy lives in `src/app/notifications/page.tsx` so money can be rendered per viewer |
| `npm test` has only 45 tests | Scope choice: the money boundary and both state machines are covered; integration and e2e are deferred ([§11](#11-what-is-not-built-and-how-to-build-it)) |

---

## 10. Gotchas found while building

Hard-won; do not rediscover them.

- **Prisma 7 is Rust-free.** There is no query-engine binary and `binaryTargets` no longer exists. Instead: the connection URL lives in `prisma.config.ts` (**not** `schema.prisma` — putting `url` in the datasource block is now an error), the generator is `prisma-client` with an explicit `output`, and the client must be constructed with a driver adapter (`@prisma/adapter-pg`). All three are already done.
- **Seeding is no longer automatic.** `prisma migrate dev` does not seed in v7; the seed command is configured under `migrations.seed` in `prisma.config.ts` and runs only via `prisma db seed`.
- **npm 11 blocks install scripts by default.** A fresh `npm install` will skip `esbuild` and `@prisma/engines` postinstalls, which silently breaks vitest and `prisma migrate`. Fix: `npm install-scripts approve prisma @prisma/engines esbuild unrs-resolver`, then reinstall.
- **`create-next-app` currently scaffolds a canary** with Turbopack-only Tailwind and `cacheComponents` enabled — the latter forces `use cache` semantics on every DB read. This repo deliberately uses stable Next with Tailwind through PostCSS instead.
- **`vitest.config.ts` must be `.mts`** or Vite loads it as CommonJS and warns on every run.
- **Raw SQL must not compare Prisma timestamps to `now()`.** Prisma stores `DateTime` as a naive UTC timestamp; Postgres `now()` renders in the session time zone. On any box not set to UTC the comparison is off by the offset (silently, in whichever direction). Bind the clock from JS (`${new Date()}`) instead. Both existing raw statements do this now.
- **Deleting a seller `User` can violate `request_direct_target`.** `Request.targetSellerUserId` is `ON DELETE SET NULL`, and the CHECK says a DIRECT request must have a target. There is no account-deletion feature yet; when one is built, delete or close the person's requests first. The integration test cleanup does exactly that.
- **Vultr blocks outbound port 25** on new instances. Harmless here (Resend is an HTTPS API) but it would silently break any SMTP library — do not swap in nodemailer.
- **Coolify's `sslip.io` hostnames are for testing only** and Let's Encrypt behaviour on them is unconfirmed. Use the real domain.

---

## 11. What is NOT built, and how to build it

In the order I would do them.

### 1. Reports and blocking — spec items 13 and 14 ★ DONE

**Built — see `src/modules/trust/` and the CHANGELOG entry.** The design below is what was implemented, with two
deviations: the trust row is `UserTrust` (reports go both ways, not just at buyers), and reports carry a `scopeKey`
(`jobId` or `"general"`) because Postgres treats NULLs as distinct in a unique index. Blocking is enforced in both
places described here and `trust.int.test.ts` is the `describe.each` test asked for.

<details><summary>Original plan (kept for reference)</summary>

**Schema** (`prisma/schema.prisma`, then `npx prisma migrate dev --name trust`):

```prisma
model Report {
  id             String   @id @default(cuid())
  reporterUserId String
  subjectUserId  String
  kind           ReportKind      // NO_SHOW ABUSIVE SCAM ACADEMIC_DISHONESTY OFF_PLATFORM_PRESSURE SPAM OTHER
  reason         String
  jobId          String?
  status         ReportStatus @default(OPEN)
  weight         Int      @default(1)
  createdAt      DateTime @default(now())
  @@unique([reporterUserId, subjectUserId, jobId])   // one report per job per reporter
  @@index([subjectUserId, status])
}

model Block {
  blockerUserId String
  blockedUserId String
  createdAt     DateTime @default(now())
  @@id([blockerUserId, blockedUserId])
  @@index([blockedUserId, blockerUserId])            // reverse lookup for feeds
}

model BuyerTrust {                                   // never leaves admin surfaces
  userId              String @id
  internalScore       Int    @default(100)
  negativeReportCount Int    @default(0)
  autoClosedAt        DateTime?
}
```

**Blocking needs enforcement in two different places, and this is the part people get wrong:**

- *Point actions* (create request, respond, send message) — add a check in the relevant `mutations.ts`, next to the existing `applyRequestEvent` call.
- *Lists and feeds* — policy cannot filter a list. Add one shared SQL fragment and compose it into **every** feed query:

```ts
// src/modules/trust/block-filter.ts
export const notBlockedWith = (userId: string) => Prisma.sql`
  NOT EXISTS (SELECT 1 FROM "Block" b
    WHERE (b."blockerUserId" = ${userId} AND b."blockedUserId" = t."otherUserId")
       OR (b."blockedUserId" = ${userId} AND b."blockerUserId" = t."otherUserId"))`;
```

Call sites to update: `listOpenRequestsForSeller`, `listSellersForTag`, `fanOutOpenRequest` (add the `NOT EXISTS` to the existing `INSERT … SELECT`), `listThreadsForUser`. Write one `describe.each` test asserting every feed hides blocked counterparties **in both directions**.

Account closure: a `User.status` enum (`ACTIVE | SUSPENDED | CLOSED`) checked once in `getViewer()`, plus a threshold in a `PlatformSetting` table so it is tunable without a deploy. The spec leaves the number TBD — start at 3 weighted reports and make it config.

</details>

### 2. Deploy to Vultr

See [§12](#12-deploying-to-vultr). Do this before adding features if anyone else needs to see it.

### 3. Email notifications — DONE

**Built — see `src/modules/email/` and the CHANGELOG entry.** Outbox rows in the same transaction as notifications,
daily digest for the fan-out kind, in-process drain timer plus `POST /api/email/drain`, one-click unsubscribe with
`List-Unsubscribe` headers, `/settings/email`. Templates are plain text + inline HTML strings rather than
`@react-email/components` (no new dependency, no install-script dance) and are money-free by construction.

<details><summary>Original plan (kept for reference)</summary>

`src/lib/mail.ts` already wraps Resend and degrades safely. What is missing is an outbox so email survives a crash, and digesting so fan-out does not blow a free tier.

- Add `OutboundEmail` (template, payload, `collapseKey`, `dedupeKey` unique, `status`, `sendAfter`, `attempts`) and write rows **in the same transaction** as the notification.
- Drain it from a route hit by an external scheduler, or — since this runs on your own box, not serverless — a `setInterval` in the server process.
- **Digest the fan-out kinds.** One open request in a popular tag is hundreds of emails; Resend's free tier is ~100/day. `OPEN_REQUEST_IN_TAG` and the watched-tag alert must collapse into one "3 new requests in your tags" message, max one per user per day. 1:1 events (direct request, selected, completion requested, review received) stay immediate.
- Templates: `@react-email/components`, typed to **role-specific props** — a seller email props type must carry only net figures.
- Needs `List-Unsubscribe` headers and an unsubscribe route using an HMAC of `User.emailUnsubKey` (the column does not exist yet; add it).

</details>

### 4. Media uploads — DONE

**Built — see `src/modules/media/` and the CHANGELOG entry.** Local volume (`MEDIA_DIR`), sniffed types, served by
`/media/[key]`. Links were kept in `SellerProfile.portfolioLinks` rather than folded into `PortfolioItem`; hosted
media is the new `MediaAsset` + `PortfolioItem` pair. **Deploy note: mount a persistent volume at `MEDIA_DIR` in
Coolify or uploads vanish on redeploy.**

<details><summary>Original plan (kept for reference)</summary>

Portfolio is links-only today. On your own box there is no 4.5 MB serverless body cap, so the simple path works: accept the upload, write to a mounted volume, serve through the app. Add a `MediaAsset` model (`storageKey`, `kind`, `mimeType`, `bytes`, `status`) and a `PortfolioItem` that is either a link or an asset. Set a sanity cap (~200 MB) or the disk fills. Move to Vultr Object Storage with presigned URLs when disk or bandwidth becomes the constraint — that also decouples media from the instance lifecycle.

</details>

### 5. Module boundary enforcement — DONE (lint + CI)

**Built — see `eslint.config.mjs`, `.github/workflows/ci.yml` and the CHANGELOG entry.** Done with ESLint's built-in
`no-restricted-imports` rather than `eslint-plugin-boundaries` / `dependency-cruiser`, so no dependency was added.
The `domain/application/ports/infra` split and repository interfaces were **not** done; the existing
`state → mutations → queries → dto` layout is the seam and the rules now keep the UI on the right side of it. If a
separate API ever needs extracting, that split is the next step.

<details><summary>Original plan (kept for reference)</summary>

Make the three conventions in [§5](#5-architecture) mechanical: `eslint-plugin-boundaries` + `dependency-cruiser` in CI, with the rule that only `modules/*/infra/**` and `src/lib/db.ts` may import `@prisma/client`. Then split each module into `domain/ application/ ports/ infra/` and introduce repository interfaces. This is what makes "we could extract a separate API later" true rather than aspirational.

</details>

### 6. The watched-tag alert — DONE (completes spec item 8)

**Built — see `src/modules/interests/` and the CHANGELOG entry.** Exactly the design below: `BuyerTagInterest`
upserted on every request, three triggers funnelled through `notifyWatchers()`, the monthly dedupe key, the 90-day
window, the 200-watcher cap, and the off switch at `/settings/watched-tags`.

<details><summary>Original plan (kept for reference)</summary>

"A buyer is notified when a seller becomes open to a tag they requested" needs state the request lifecycle otherwise throws away:

- Add `BuyerTagInterest(buyerUserId, tagId, notifyOnNewSeller, lastRequestedAt, mutedUntil)`, upserted on every request create and **never deleted when the request closes**.
- Trigger it from three places, all funnelled through one function: seller adds the tag, seller resumes from pause, seller publishes a listing with that tag.
- **The dedupe is the whole difficulty.** Without it, a seller toggling pause twice a day notifies hundreds of buyers repeatedly. Use `dedupeKey = seller_open:{sellerId}:{tagId}:{YYYYMM}` for at most one per buyer/seller/tag per month, skip buyers whose `lastRequestedAt` is older than ~90 days, and cap watchers notified per event (~200, most recently active first).
- Ship a `/settings/watched-tags` screen with per-tag toggles at the same time. Without an off switch this feature is the app's main spam source.

</details>

### 7. Pre-request inquiry threads — DONE

**Built — see `messaging/state.ts`, `openInquiry()` and the CHANGELOG entry.** Note: `inquiryKey` was described as
already in the schema but only the `INQUIRY` enum value was; the column arrived with migration
`20261018110000_inquiry_key`. Entry point is the **Message** button on a seller profile; the cap is 5 new
conversations per buyer per day.

<details><summary>Original plan (kept for reference)</summary>

A buyer may open **one** rate-limited thread per seller before requesting. `Thread.kind = INQUIRY` and `inquiryKey = "{buyerId}:{sellerId}"` unique already exist in the schema — only the entry point and the rate limit are missing.

</details>

### 8. Admin console — DONE

**Built — see `src/modules/admin/` and `src/app/admin/`.** Tag CRUD with synonym editing (one transaction), the report
queue, user suspension / closure / admin toggling, the suspend threshold, and `AdminAuditLog` behind `withAudit()`,
whose required audit argument is what makes an unlogged admin action a type error. Make someone an admin from
`/admin/users` (or `isAdmin` in Prisma Studio for the very first one — the seeded Alex Kim already is).

<details><summary>Original plan (kept for reference)</summary>

Prisma Studio covers it for now. When it does not: tag CRUD with synonym editing (regenerating `searchTerms` in one transaction), a report queue, user suspension, and an `AdminAuditLog` where the repository method *requires* an audit payload argument, so an unlogged admin action does not typecheck.

</details>

### 9. Full UW course catalog

20 courses are seeded. A scraper against UW's public catalog producing a committed JSON would give full coverage, at the cost of thousands of zero-seller tags drowning the 15 real service tags in search. If you do it: keep courses grouped separately in results (already done), keep them out of the browse-all grid (already done), and add a subject bulk-select ("all MATH 1xx") in the seller tag editor.

### 10. More tests

Current coverage is the money boundary and both state machines. Highest-value additions, in order:

1. **Integration tests against a real Postgres** (`@testcontainers/postgresql`): concurrent `selectResponse` — the unique `chosenResponseId` must mean exactly one winner; double `markComplete`; double review; fan-out SQL correctness with paused sellers and blocks.
2. **A Playwright money-leak e2e**: with `gross = $100`, assert `expect(page.locator("body")).not.toContainText("100")` on every seller-facing route. This is the test that protects the pitch.
3. A happy-path e2e for the whole loop.

Use a `ClockPort`/`FakeClock` so the 7-day window is testable in milliseconds — today `AUTO_COMPLETE_MS` is read directly from env in `markJobComplete`.

### 11. Rate limiting

None exists. Before any public launch, limit OTP requests per IP and per address, request creation, responses, and messages. `@upstash/ratelimit` with a Postgres fallback keeps local dev dependency-free.

### 12. Legal and policy

The F-1 notice, academic-integrity rules and the Venmo/no-escrow explanation are shown at `/welcome`. Still needed: standalone terms and privacy pages, a default ownership-of-work clause, the cottage-food question for Cooking/Baking (Washington has specific rules), and a quick legal read before real users touch it.

---

## 12. Deploying to Vultr

One instance runs the app and Postgres. Budget 45–90 minutes the first time, and do it while awake — every failure mode here is cheaper to debug at 2pm than 3am.

1. **DNS first.** Propagation is the one delay you cannot compress later. On your domain, point an A record (e.g. `hustl.yourdomain.com`) at the instance IP, and add Resend's sender-verification records in the same sitting. One DNS visit covers both HTTPS and OTP delivery.
2. **Provision**: Vultr High Performance, **2 vCPU / 4 GB**, Ubuntu 24.04, **Seattle**. Not the 0.5–1 GB tiers — `next build` runs out of memory on them. Put **every teammate's SSH key** on at creation; one key-holder asleep at hour 14 is a real outage.
3. **Swap, before the first build:**
   ```bash
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```
4. **Install Coolify** (one `curl | bash` from its docs — verify the command against the docs, not a blog). Brings up Docker, Traefik and the dashboard in ~5–10 minutes.
5. **Create a Postgres resource** in Coolify; copy its internal connection string into the app's `DATABASE_URL`.
6. **Connect this repo**, set env (below), add the domain, enable HTTPS. Traefik runs the Let's Encrypt HTTP-01 challenge, so **ports 80 and 443 must be open** in the Vultr firewall **and** on the box. Open 22, 80, 443 only — Postgres stays on the Docker network, never exposed.
7. **Set the start command to migrate**: `npx prisma migrate deploy && npm start`. Without this you ship a schema-less database. Seed once by hand: `npx prisma db seed`.
   **Add a persistent volume** mounted at `/app/data/media` (or wherever `MEDIA_DIR` points) — portfolio uploads live on disk and a redeploy without the volume deletes them.
8. **Snapshot the instance** once the demo path works. Restoring a snapshot beats debugging a dead box.

```
DATABASE_URL=postgresql://…          # Coolify's internal Postgres URL
SESSION_SECRET=<32+ random chars>    # changing it signs everyone out
OTP_PEPPER=<32+ random chars>        # changing it invalidates live codes
RESEND_API_KEY=re_…
EMAIL_FROM="HUSTL <login@yourdomain.com>"
APP_URL=https://hustl.yourdomain.com # links inside emails
EMAIL_DRAIN_INTERVAL_MS=60000        # in-process outbox drain; 0 = external scheduler only
CRON_SECRET=<32+ random chars>       # optional: enables POST /api/email/drain
ALLOWED_EMAIL_DOMAIN=uw.edu
DEMO_MODE=0                          # MUST be 0 — it echoes OTP codes and enables persona switching
AUTO_COMPLETE_MS=604800000           # 7 days
```

Everyone pushes to `main` and Coolify deploys it. One box, one environment, no staging — so whoever pushes watches the build finish.

---

## 13. The demo

Three minutes. Have a **second browser profile or laptop signed in as Maya** so step 5 is one glance rather than a logout.

1. **The problem** — a group chat screenshot: "anyone know a photographer?"
2. **The gate** — try `you@gmail.com`, get rejected visibly. Then a real `@uw.edu` address, code arrives, you are in. This is the trust pitch; let it breathe.
3. **Discovery** — search **"photoshoot"**. It resolves to **Photography** — a hidden synonym doing visible work — and lists ranked sellers.
4. **The post** — Alex posts an open request, budget **$100**. His screen says *"Your seller will see $90."*
5. **The reveal** — switch to Maya. Her feed says **$90**. Put the two screens side by side. *"The seller never sees the buyer's ceiling. Today the 10% is waived; when payments land, the number the seller sees doesn't change."*
6. **The match** — Maya responds, Kai responds, Alex picks Maya. Kai's thread closes with "not selected" and the request disappears from his feed.
7. **The job** — they chat, Venmo handles are exchanged, both mark complete.
8. **The loop closes** — Alex leaves 5★ and it appears on Maya's profile with her rating and completed-job count.
9. **Next** — one line: Stripe Connect flips the 10% from display to real, and no seller-facing number changes.

Set `AUTO_COMPLETE_MS=120000` if you want to show auto-confirm on stage. Run `npm run db:reset` beforehand for clean data.

---

## 14. Verification

```bash
npm run lint             # includes the module boundary rules; must be clean
npx tsc --noEmit         # must be silent
npm test                 # unit: money math, state machines, trust/email/media rules, the leak suite
npm run test:int         # integration, against DATABASE_URL (safe on a seeded dev DB)
npm run build            # must succeed — this is what Coolify runs
```

All five run in GitHub Actions on every push (`.github/workflows/ci.yml`).

To re-verify the money boundary by hand: sign in as a seller, open any request, and check the rendered page for the buyer's number.

```js
// in devtools on a seller's view of a $100 request
/\$100|\b100\b/.test(document.body.innerText)              // must be false
document.documentElement.outerHTML.includes("10000")       // must be false
/gross/i.test(document.documentElement.outerHTML)          // must be false
```

---

## 15. Open questions for the team

1. **Does the 10% stay waived?** Right now nobody pays it and nobody collects it — a $100 budget becomes $90 of work and the $10 evaporates. The mechanism is right for v2, but if "fee waived in beta" proves confusing, set `feeBps = 0` and the hiding still works, just with net equal to gross.
2. **Report threshold for account closure.** The spec marks it TBD. Put it in `PlatformSetting`, not code.
3. **Cooking and baking.** Washington's cottage food rules and UW housing policy may restrict selling home-prepared food. Both tags are seeded and live — confirm before anyone actually sells a cake.
4. **Full course catalog or curated?** 20 courses now. Full coverage means thousands of empty tags.
5. **Does the pitch want "no 20% platform fee" on the landing page** while a 10% fee exists in the data model? Currently the copy says the cut is waived in beta, which is accurate — keep it accurate.
