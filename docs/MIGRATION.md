# MongoDB → PostgreSQL migration runbook

This is the exact sequence to move Easy Arabic from its old MongoDB database
to the new PostgreSQL schema (`prisma/schema.prisma`). Follow it in order —
each step assumes the one before it succeeded.

## 0. Before you start

- Have a PostgreSQL database ready (14+ is fine; any host — RDS, Supabase,
  Neon, Railway, a self-hosted box). Get its connection string.
- Keep the OLD MongoDB database reachable and untouched until you've
  finished and verified this migration. Nothing here modifies or deletes
  the Mongo data — it only reads from it.
- This has NOT been run against real data. It's been written carefully and
  reviewed against the schema, but you are the first one to run it against
  your actual database — read the output closely the first time.

## 1. Set environment variables

Copy `.env.example` to `.env` and fill in:

```
DATABASE_URL="postgresql://user:password@host:5432/easy_arabic?schema=public"
JWT_SECRET="<a long random value — openssl rand -base64 48>"
MONGO_DATABASE_URL="<your existing Mongo connection string>"
```

`MONGO_DATABASE_URL` is only needed for step 4 (the data import) — you can
leave it out for normal app operation afterward.

## 2. Install dependencies and generate the Postgres client

```
npm install
npx prisma generate
```

This generates the app's Prisma Client into `generated/prisma`, wired to
the `@prisma/adapter-pg` driver adapter — no separate "query engine"
binary download needed at runtime for this part.

## 3. Create the Postgres schema

```
npx prisma migrate dev --name init
```

This creates every table, index, and foreign key from
`prisma/schema.prisma` in your (empty) Postgres database. If you're
deploying straight to a production database instead of iterating locally,
use `npx prisma migrate deploy` instead — same effect, no interactive
prompts.

At this point the Postgres database has the right shape but zero rows.

## 4. Import the data from MongoDB

Generate the second, read-only Prisma Client that talks to Mongo:

```
npm run generate:legacy-mongo
```

Then run the import:

```
npm run migrate:from-mongo
```

What it does, in order: Users and Families first (nothing depends on
them), then Lessons (need both to exist), then Notifications (need Users
and Lessons). It preserves every record's original MongoDB id as the new
Postgres id, so relationships don't need remapping. `classDate` is
converted from the old plain string to a real `DateTime` here.

It refuses to run if the target Postgres tables already have any rows —
re-running it against a database you've already seeded would create
duplicates or hit the id unique constraint. If you genuinely want to
resume/retry against a partially-seeded environment, pass `--force`:
`npm run migrate:from-mongo -- --force`.

**Read the printed report.** It shows source count vs. migrated count vs.
failed count per table, lists exactly which record ids failed and why, and
finishes with a validation pass (row-count comparison + a relation spot
check). A record most commonly fails here because its `userId`/`familyId`
didn't actually resolve to a real user/family in Mongo — Mongo never
enforced that relationship, so this migration is often the first time it's
actually checked. If you see failures, decide whether to fix the source
data and re-run, or accept the loss of those specific orphaned records —
either way, the script will not silently drop anything without telling
you.

## 5. Verify before switching anything over

```
npm run typecheck
npm run lint
npm run build
```

Then spot-check the app itself against the new database in a
non-production environment before pointing production `DATABASE_URL` at
it: sign in as admin/teacher/family, open a few profiles, check lesson
history and notifications look right.

## 6. Decommission the old database

Only after you've verified the app works end-to-end against Postgres —
keep the MongoDB backup/snapshot around for a while regardless, in case
something surfaces later that the validation pass didn't catch.

## Rolling back

Nothing in this process touches or deletes the MongoDB data, so rolling
back at any point before step 6 just means pointing `DATABASE_URL` back at
Mongo and reverting to the pre-Phase-2 dependency versions
(`@prisma/client`/`prisma` `6.19.3`, `provider = "mongodb"` in
`prisma/schema.prisma`) — see git history for the exact prior schema.
