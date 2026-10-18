# HUSTL

A campus-only marketplace where UW students hire other UW students for creative work — photography, design, video, music production, and tutoring by course code.

Sign-up is restricted to `@uw.edu`. Work starts from either side: a seller publishes a service and buyers request it, or a buyer posts a request under a tag and every seller holding that tag is notified.

## The one thing to understand first

**A buyer's budget is a ceiling that no seller ever sees.**

A buyer sets `$100`. Every seller-facing surface — feed, inbox, request page, job page, notifications — shows `$90`, which is the budget minus HUSTL's 10%. In v1 that fee is **waived**: the buyer pays the seller the `$90` directly over Venmo and HUSTL collects nothing. The mechanism exists from day one so that turning on real payments later changes no number a seller has ever seen.

Two consequences that look like bugs if you don't know the rule:

- **Seller-authored prices are stored net; buyer-authored budgets are stored gross.** A seller who types `90` into their listing sees `$90` back on their own profile. When a buyer requests that listing, the budget is grossed up to `$100` (`grossFromNet`).
- **Nothing shared between the two parties may contain money.** Thread system messages say "Job started", never an amount, because both parties read them. Notification rows store ids only and are rendered per viewer.

`src/lib/money.ts` is the only place money arithmetic happens. `src/modules/requests/dto.ts` is the only place a request becomes JSON, and it has one mapper per audience — the seller DTO has no field that could hold a gross figure. `src/modules/requests/dto.test.ts` fails the build if one ever does.

## Running it locally

Requires Node 20+ and a local PostgreSQL 17.

```bash
npm install
cp .env.example .env     # defaults match a local postgres with password "postgres"
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Then open http://localhost:3000.

`DEMO_MODE=1` (the default in `.env.example`) does two things, both of which are off in production:

- OTP codes are shown on screen instead of requiring a delivered email
- the header gets a **switch** dropdown for jumping between seeded personas

Seeded personas: **Alex Kim** and **Zoe Williams** (buyers), **Maya Chen** and **Kai Alvarez** (photographers), plus sellers for design, video, web, 3D, baking, live music, and tutoring. Five completed jobs with reviews are seeded so no profile is blank.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run lint` | ESLint, including the module boundary rules (runs in CI) |
| `npm test` | Unit tests — money math, the state machines, trust rules, the leak suite |
| `npm run test:int` | Integration tests against the Postgres in `DATABASE_URL` (safe on a seeded dev DB) |
| `npm run db:seed` | Idempotent seed; safe to re-run |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:studio` | Prisma Studio — this is the admin console for now |

## How the code is laid out

```
src/lib/        money.ts, auth.ts, db.ts, env.ts, errors.ts   — the chokepoints
src/modules/    catalog, requests, jobs, messaging, notifications
src/app/        pages + server actions (adapters only: no business rules here)
src/components/ design system
prisma/         schema, migrations, seed
```

Three conventions keep this portable, and `npm run lint` enforces them (see `eslint.config.mjs`):

1. **Prisma is imported only inside `src/modules/*/` and `src/lib/db.ts`.** Never from `app/`.
2. **Money arithmetic happens only in `src/lib/money.ts`.**
3. **No page receives a Prisma model.** Reads go through a `dto.ts`/`queries.ts` function, and seller-facing mappers are named `toSeller*`.

Each module is `state.ts` (pure rules) → `mutations.ts` (writes) → `queries.ts` (reads) → `dto.ts` (serialization). The state machines in `src/modules/requests/state.ts` and `src/modules/jobs/state.ts` are pure functions with no I/O and no clock, which is why every rule in the spec is unit-tested in milliseconds.

### No cron, on purpose

Request expiry and the 7-day completion auto-confirm are **derived at read time**, not swept by a scheduler. An expired request reads as expired the instant it lapses and is filtered out of every seller feed; the stored row catches up when someone next opens it (`materializeExpiry`, `materializeAutoComplete`). A scheduler would only ever improve notification timeliness, never correctness.

Set `AUTO_COMPLETE_MS=120000` to make auto-confirm demoable in two minutes instead of seven days.

## Deploying to Vultr

One instance runs the app and Postgres. Budget 45–90 minutes the first time.

1. **DNS first** — propagation is the one delay you cannot compress later. On your domain, point an A record (e.g. `hustl.yourdomain.com`) at the instance IP, and add Resend's sender-verification records in the same sitting.
2. **Provision** a Vultr High Performance instance, **2 vCPU / 4 GB**, Ubuntu 24.04, Seattle. Do not take the 0.5–1 GB tiers — `next build` runs out of memory on them. Add all teammates' SSH keys at creation.
3. **Add 2 GB of swap** before the first build:
   ```bash
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```
4. **Install Coolify** (one `curl | bash` from its docs). It brings up Docker, Traefik and the dashboard.
5. **Create a Postgres resource** in Coolify and copy its internal connection string into the app's `DATABASE_URL`.
6. **Connect this repo**, set the env vars below, add the domain, enable HTTPS. Traefik runs the Let's Encrypt challenge over port 80, so **80 and 443 must be open** in the Vultr firewall *and* on the box. Open 22, 80, 443 only — Postgres stays on the Docker network.
7. **Set the start command to run migrations**: `npx prisma migrate deploy && npm start`. Without this you ship a schema-less database.
8. **Snapshot the instance** once the demo path works. Restoring a snapshot beats debugging a dead box.

Production env:

```
DATABASE_URL=postgresql://…      # Coolify's internal Postgres URL
SESSION_SECRET=<32+ random chars>
OTP_PEPPER=<32+ random chars>
RESEND_API_KEY=re_…
EMAIL_FROM="HUSTL <login@yourdomain.com>"
DEMO_MODE=0                      # must be 0: it echoes OTP codes and enables persona switching
AUTO_COMPLETE_MS=604800000       # 7 days
```

Note: Vultr blocks outbound port 25 by default. That does not affect us — Resend is called over HTTPS — but it would silently break any SMTP library, so don't swap in nodemailer.

## What is and isn't built

Built: the uw.edu gate, tag search with hidden synonyms ("photoshoot" → Photography) and course codes, seller profiles with listings and portfolio links, pause, open **and** direct requests with budgets and deadlines, multi-seller responses with buyer selection, thread-scoped messaging, the mutual completion handshake with auto-confirm, reviews, and in-app notifications with a polled badge.

Also built: reports and mutual blocking with auto-suspension and an admin report queue (`/admin/reports`, `User.isAdmin`); email notifications through a transactional outbox with a daily digest and one-click unsubscribe; portfolio uploads (photos, video, PDF) stored on a volume at `MEDIA_DIR`. See `CHANGELOG.md` for each feature as it lands.

Not built yet: the full admin console (use Prisma Studio) and watched-tag "a seller just opened up" alerts. Each is noted in HANDOFF.md §11 with what it would take.

Before any real launch: the F-1 notice already shown at signup needs a legal read, as do the academic-integrity rules on course tags, the cottage-food question on Cooking/Baking, and a default ownership-of-work clause.
