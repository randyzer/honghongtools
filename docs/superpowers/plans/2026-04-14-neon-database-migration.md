# Neon Database Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Supabase-backed Postgres access layer with Neon Postgres while keeping the existing API routes and user-facing behavior stable.

**Architecture:** Keep the database schema on Postgres, but replace the runtime access layer from `@supabase/supabase-js` to a Neon-native access layer. Use Neon Postgres as the database host, `@neondatabase/serverless` for Next.js server runtime access, and Drizzle schema definitions as the single source of truth for schema and typed queries where practical.

**Tech Stack:** Next.js App Router, TypeScript, Postgres, Neon, `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`

---

## File Map

**Existing files that drive the current database layer**
- Modify: `src/storage/database/supabase-client.ts`
  Current runtime DB entrypoint. Reads `COZE_SUPABASE_URL` and `COZE_SUPABASE_ANON_KEY`, creates a Supabase client, and is imported by API routes and services.
- Modify: `src/app/api/auth/login/route.ts`
  Reads `users` via Supabase query builder.
- Modify: `src/app/api/auth/register/route.ts`
  Inserts into `users` and depends on Postgres unique violation code `23505`.
- Modify: `src/app/api/auth/verify/route.ts`
  Reads `users` by id.
- Modify: `src/app/api/game/records/route.ts`
  Inserts and reads `game_records`.
- Modify: `src/app/api/leaderboard/route.ts`
  Uses Supabase `.rpc('get_leaderboard')` and Supabase join syntax `users!inner(username)`.
- Modify: `src/lib/blog-service.ts`
  Reads and writes `blog_post`.
- Modify: `src/app/api/blog/[id]/route.ts`
  Deletes from `blog_post`.
- Reference: `src/storage/database/shared/schema.ts`
  Drizzle schema definitions for `users`, `blog_post`, and `game_records`.
- Modify: `.env.local`
  Replace Supabase runtime env vars with Neon env vars.

**New files recommended for the Neon migration**
- Create: `src/storage/database/neon-client.ts`
  Creates and exports Neon database client(s) for app runtime.
- Create: `src/storage/database/db.ts`
  Thin stable entrypoint for app code so routes do not depend directly on Neon implementation details.
- Create: `drizzle.config.ts`
  Central Drizzle config for migrations and schema generation if not already present.
- Create: `src/storage/database/queries/leaderboard.ts`
  Encapsulates leaderboard query logic so Supabase RPC and join syntax are removed cleanly.
- Create: `scripts/db/check-neon.ts`
  Optional smoke script to verify Neon connection and core tables.

**Tests to add or update**
- Create: `src/storage/database/neon-client.test.ts`
  Verifies env parsing and connection bootstrap logic.
- Modify or create route-level tests around:
  - `src/app/api/auth/*`
  - `src/app/api/game/records/route.ts`
  - `src/app/api/leaderboard/route.ts`
  - `src/lib/blog-service.ts`

## Migration Strategy

### Recommended approach

Use a two-track migration:

1. **Database host migration**
   Move the current Postgres schema and data from the Supabase-managed database into Neon.

2. **Application access-layer migration**
   Replace `@supabase/supabase-js` runtime queries with Neon-native database access.

This is safer than trying to "point Supabase client at Neon", because the current code uses Supabase-specific features like:
- `.rpc('get_leaderboard')`
- relation syntax `users!inner(username)`

Those do not exist on bare Neon Postgres.

### Recommended runtime stack

- Use `@neondatabase/serverless` for Next.js server-side DB access
- Use `drizzle-orm` on top of Neon where type-safe queries are worth it
- Keep raw SQL available for the leaderboard query if that is simpler than translating everything to Drizzle relations on day one

### Rollout recommendation

- First migrate **schema + data** into a Neon staging database
- Then migrate **runtime code** to read/write Neon in staging
- Then run API regression tests
- Then cut production traffic over with a short write freeze or maintenance window

## Default Assumptions For This Project

Because the user has only provided Neon target database info so far, the migration starts from these conservative defaults:

- Migrate **dev/local first**, not production first
- Use **`pg_dump` + `pg_restore`** as the first migration path
- Accept a **short write freeze** for final production cutover if production migration happens later
- Replace the current Supabase runtime query layer with **Neon + SQL/Drizzle**
- Move the current `get_leaderboard` behavior into **application SQL**, rather than keeping a database RPC function
- Keep secrets in local development under `.env.local`, and later mirror them into deployment platform environment variables
- Assume there are **no extra Postgres extensions, RLS policies, or triggers** beyond what is already visible in the repository until proven otherwise

If any of these assumptions turns out to be wrong during implementation, stop the migration at the current checkpoint, update the plan, and re-run validation before continuing.

## Risk Assessment And Contingency Plan

### Risk Matrix

| Risk | Impact | Likelihood | Prevention | Contingency |
| --- | --- | --- | --- | --- |
| Supabase-specific query syntax cannot be translated 1:1 | High | High | Inventory all `.rpc(...)`, relation syntax, and Supabase query builder usage before any cutover | Keep `supabase-client.ts` available during migration and migrate route-by-route |
| Data loss or row mismatch during dump/restore | High | Medium | Validate row counts and key constraints for `users`, `blog_post`, `game_records` before and after import | Re-run restore from source dump; do not switch runtime until counts and constraints match |
| Leaderboard behavior changes after removing RPC | Medium | High | Capture current expected ranking behavior in tests before rewriting query | Temporarily preserve a SQL function version in Neon if inline SQL cannot match behavior quickly |
| App partially points to Supabase and partially to Neon | High | Medium | Introduce a single DB entrypoint and remove direct Supabase imports only after all routes are migrated | Revert env vars and imports to the old access path if mixed read/write behavior appears |
| Connection issues caused by wrong pooled/unpooled URL usage | Medium | Medium | Use pooled URL for runtime and unpooled/direct URL for migration tooling; verify with a smoke script first | Switch runtime back to old DB and fix connection wiring before retrying cutover |
| Authentication or duplicate username handling changes unexpectedly | Medium | Medium | Add route tests for login/register/verify before changing the data access layer | Restore old handler path and compare actual Postgres error payloads against the new code |
| Rollback is not possible because the old path is removed too early | High | Medium | Keep old Supabase code path and source DB credentials until Neon is verified stable | Redeploy using old env vars and old access layer branch immediately |
| Secret leakage or accidental exposure during migration | High | Medium | Never print connection strings in logs, code, or commit diffs | Rotate credentials immediately if any secret is exposed outside approved env storage |

### High-Risk Areas In This Repository

1. **`src/app/api/leaderboard/route.ts`**
   Uses Supabase RPC and relation syntax, so it is the most likely place for logic drift.
2. **`src/storage/database/supabase-client.ts`**
   This is the current runtime entrypoint, so replacing it too early would make rollback harder.
3. **`src/app/api/auth/register/route.ts`**
   It depends on duplicate username detection and friendly error mapping, which must stay unchanged.
4. **`src/lib/blog-service.ts` and `src/app/api/game/records/route.ts`**
   These are straightforward CRUD paths, but they are easy places to accidentally change field ordering or return shape.

### Mitigation Strategy Before Any Real Cutover

1. Add or update tests around auth, blog, game records, and leaderboard behavior **before** replacing the query layer.
2. Keep the migration incremental:
   - first add Neon client
   - then migrate one functional area at a time
   - then run verification
3. Keep the old Supabase runtime path until:
   - row counts match
   - route tests pass
   - smoke tests pass
4. Do not remove `@supabase/supabase-js` until the final checkpoint is green.
5. Treat production cutover as a separate step from development migration.

### Rollback Plan

If any verification checkpoint fails, roll back using this sequence:

1. Stop further route migration work.
2. Restore app env vars to the old Supabase-backed runtime configuration.
3. Redeploy or restart the app on the old configuration.
4. Keep Neon data for analysis, but do not continue writing production traffic to it.
5. Compare:
   - route response payloads
   - row counts
   - unique constraints
   - leaderboard ranking output
6. Fix the issue in staging or local first, then retry cutover later.

### Emergency Checklist

- Keep a fresh source dump before final migration
- Keep the old Supabase env values available until the new path is stable
- Do not delete old DB access code on the same day as the first successful cutover
- Smoke test immediately after any env switch:
  - register
  - login
  - verify
  - save game record
  - list game records
  - leaderboard
  - blog create/list/delete
- If the user-shared Neon credentials were exposed outside secure env storage, rotate them before production use

## Task 1: Inventory current DB behavior and migration blockers

**Files:**
- Modify: `docs/superpowers/plans/2026-04-14-neon-database-migration.md`
- Reference: `src/storage/database/supabase-client.ts`
- Reference: `src/app/api/auth/login/route.ts`
- Reference: `src/app/api/auth/register/route.ts`
- Reference: `src/app/api/auth/verify/route.ts`
- Reference: `src/app/api/game/records/route.ts`
- Reference: `src/app/api/leaderboard/route.ts`
- Reference: `src/lib/blog-service.ts`
- Reference: `src/app/api/blog/[id]/route.ts`

- [ ] **Step 1: Confirm every runtime DB touchpoint**

Run:

```bash
pnpm exec rg -n "getSupabaseClient|\\.rpc\\(|users!inner|from\\('" src
```

Expected:
- Every runtime query site is listed
- No hidden Supabase query paths remain

- [ ] **Step 2: Capture current DB feature usage**

Document these facts:
- Tables in use: `users`, `blog_post`, `game_records`
- Constraints in use: unique username, foreign key `game_records.user_id -> users.id`
- Supabase-only features in use:
  - RPC `get_leaderboard`
  - relation syntax `users!inner(username)`

- [ ] **Step 3: Decide the replacement pattern**

Recommended replacement:

```ts
// src/storage/database/db.ts
export { getDb, sql } from './neon-client';
```

```ts
// src/storage/database/neon-client.ts
import { neon } from '@neondatabase/serverless';

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(databaseUrl);
}
```

Expected:
- One stable app-level DB entrypoint
- No route should import Supabase client after migration

## Task 2: Prepare Neon project and migration tooling

**Files:**
- Create: `drizzle.config.ts`
- Modify: `.env.local`
- Create: `scripts/db/check-neon.ts`

- [ ] **Step 1: Create Neon project resources**

You need:
- Neon project
- target database
- application role/user
- pooled runtime connection string
- direct or unpooled connection string for migrations

- [ ] **Step 2: Add runtime and migration env vars**

Target env layout:

```env
DATABASE_URL=postgresql://<runtime-user>:<password>@<pooled-host>/<db>?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://<migrate-user>:<password>@<direct-host>/<db>?sslmode=require
```

Optional:

```env
NEON_PROJECT_ID=<project-id>
NEON_BRANCH_ID=<branch-id>
```

- [ ] **Step 3: Add Neon runtime dependency if not already installed**

Run:

```bash
pnpm add @neondatabase/serverless
```

Expected:
- `package.json` includes `@neondatabase/serverless`

- [ ] **Step 4: Add Drizzle config**

Example:

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/storage/database/shared/schema.ts',
  out: './src/storage/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '',
  },
});
```

- [ ] **Step 5: Add Neon smoke script**

Example:

```ts
// scripts/db/check-neon.ts
import { neon } from '@neondatabase/serverless';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const rows = await sql`select now() as now`;
console.log(rows);
```

Run:

```bash
pnpm exec tsx scripts/db/check-neon.ts
```

Expected:
- Returns current timestamp from Neon

## Task 3: Migrate schema and data from current Postgres to Neon

**Files:**
- Reference: `src/storage/database/shared/schema.ts`
- Create: optional local dump files in a temp directory

- [ ] **Step 1: Export schema and data**

Preferred tools:
- Neon Import Data Assistant for simpler migrations
- `pg_dump` + `pg_restore` for controlled manual migration

Manual path:

```bash
pg_dump "<SOURCE_POSTGRES_URL>" --format=custom --no-owner --no-privileges --file=./tmp/source.dump
pg_restore --no-owner --no-privileges --dbname="<DATABASE_URL_UNPOOLED>" ./tmp/source.dump
```

Expected:
- Tables `users`, `blog_post`, `game_records` exist in Neon
- Indexes and constraints are restored

- [ ] **Step 2: Recreate required SQL functions if needed**

If `get_leaderboard` exists in source and you want to keep it, export and recreate it in Neon.

Validation query:

```sql
select routine_name
from information_schema.routines
where routine_name = 'get_leaderboard';
```

- [ ] **Step 3: Validate row counts**

Run on source and destination:

```sql
select 'users' as table_name, count(*) from users
union all
select 'blog_post', count(*) from blog_post
union all
select 'game_records', count(*) from game_records;
```

Expected:
- Counts match before cutover

- [ ] **Step 4: Validate schema compatibility**

Check:
- unique username constraint exists
- `game_records.user_id` foreign key exists
- timestamps and defaults exist

## Task 4: Introduce the Neon access layer

**Files:**
- Create: `src/storage/database/neon-client.ts`
- Create: `src/storage/database/db.ts`
- Modify: `src/storage/database/supabase-client.ts`
- Test: `src/storage/database/neon-client.test.ts`

- [ ] **Step 1: Write the failing test for missing Neon env**

Example:

```ts
test('getDb throws when DATABASE_URL is missing', () => {
  delete process.env.DATABASE_URL;
  assert.throws(() => getDb(), /DATABASE_URL is not set/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec node --import tsx --test src/storage/database/neon-client.test.ts
```

Expected:
- FAIL because `getDb` does not exist yet

- [ ] **Step 3: Implement minimal Neon client**

Example:

```ts
// src/storage/database/neon-client.ts
import { neon } from '@neondatabase/serverless';

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}
```

- [ ] **Step 4: Add stable export wrapper**

Example:

```ts
// src/storage/database/db.ts
export { getDb } from './neon-client';
```

- [ ] **Step 5: Keep Supabase client temporarily for rollback only**

Do not delete `supabase-client.ts` immediately.
Rename usage path after all routes are migrated.

## Task 5: Replace blog data access

**Files:**
- Modify: `src/lib/blog-service.ts`
- Modify: `src/app/api/blog/[id]/route.ts`
- Test: blog service tests or new route-level tests

- [ ] **Step 1: Write a failing test for article CRUD against Neon layer**

Behavior to cover:
- list articles
- fetch article by id
- create article
- delete article

- [ ] **Step 2: Replace `.from('blog_post')` calls**

Example minimal query style:

```ts
const db = getDb();
const rows = await db`
  select id, title, summary, author, read_time, tags, created_at
  from blog_post
  order by created_at desc
`;
```

- [ ] **Step 3: Verify create path still returns inserted row**

Example:

```ts
const [row] = await db`
  insert into blog_post (title, summary, content, author, read_time, tags)
  values (${article.title}, ${article.summary}, ${article.content}, ${article.author}, ${article.read_time}, ${article.tags})
  returning *
`;
```

- [ ] **Step 4: Run blog tests**

Run:

```bash
pnpm test:unit
```

Expected:
- Existing blog-related behavior still passes

## Task 6: Replace auth and user verification queries

**Files:**
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/auth/verify/route.ts`

- [ ] **Step 1: Write route tests for login/register/verify**

Cover:
- register success
- duplicate username returns 400
- login success
- login bad password returns 401
- verify missing user returns `user: null`

- [ ] **Step 2: Replace Supabase query builder with Neon queries**

Example:

```ts
const db = getDb();
const [user] = await db`
  select id, username, password
  from users
  where username = ${username}
  limit 1
`;
```

- [ ] **Step 3: Preserve duplicate username handling**

Catch Postgres unique violation:

```ts
if (error instanceof Error && /duplicate key|23505/.test(error.message)) {
  return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
}
```

- [ ] **Step 4: Run auth route tests**

Expected:
- No behavior change for API consumers

## Task 7: Replace game record reads/writes

**Files:**
- Modify: `src/app/api/game/records/route.ts`

- [ ] **Step 1: Write failing tests for insert and list**

Cover:
- save game record success
- invalid result rejected
- list by `userId` returns newest first

- [ ] **Step 2: Replace insert query**

Example:

```ts
await db`
  insert into game_records (user_id, scenario, final_score, result)
  values (${userId}, ${scenario}, ${finalScore}, ${result})
`;
```

- [ ] **Step 3: Replace list query**

Example:

```ts
const records = await db`
  select *
  from game_records
  where user_id = ${Number(userId)}
  order by played_at desc
  limit 50
`;
```

- [ ] **Step 4: Run route tests**

Expected:
- Saved and listed records match pre-migration behavior

## Task 8: Replace leaderboard RPC and join syntax

**Files:**
- Create: `src/storage/database/queries/leaderboard.ts`
- Modify: `src/app/api/leaderboard/route.ts`

- [ ] **Step 1: Decide whether to keep SQL function or inline query**

Recommended for simplicity:
- Remove `.rpc('get_leaderboard')`
- Use one SQL query in app code

- [ ] **Step 2: Write failing test for leaderboard**

Behavior:
- only `result = 'success'`
- each user contributes only their best score
- top 20 only

- [ ] **Step 3: Implement a direct SQL query**

Example:

```ts
const leaderboard = await db`
  with ranked as (
    select
      gr.user_id,
      u.username,
      gr.final_score as best_score,
      gr.played_at as achieved_at,
      row_number() over (
        partition by gr.user_id
        order by gr.final_score desc, gr.played_at asc
      ) as rn
    from game_records gr
    join users u on u.id = gr.user_id
    where gr.result = 'success'
  )
  select user_id, username, best_score, achieved_at
  from ranked
  where rn = 1
  order by best_score desc
  limit 20
`;
```

- [ ] **Step 4: Remove Supabase-only syntax**

Delete:
- `.rpc('get_leaderboard')`
- `users!inner(username)`

- [ ] **Step 5: Run leaderboard tests**

Expected:
- Response shape unchanged

## Task 9: Switch environment variables and remove Supabase runtime dependency

**Files:**
- Modify: `.env.local`
- Modify: `src/storage/database/supabase-client.ts`
- Modify: any imports still pointing to Supabase

- [ ] **Step 1: Add Neon runtime env vars**

Keep:

```env
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
```

Remove from runtime dependency chain:
- `COZE_SUPABASE_URL`
- `COZE_SUPABASE_ANON_KEY`
- `COZE_SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 2: Replace imports**

Find:

```bash
pnpm exec rg -n "getSupabaseClient" src
```

Expected:
- Zero results after migration

- [ ] **Step 3: Remove `@supabase/supabase-js` only after full cutover**

Run:

```bash
pnpm remove @supabase/supabase-js
```

Only do this after all routes and tests pass.

## Task 10: Verification and cutover

**Files:**
- Modify: optional migration runbook in `docs/`

- [ ] **Step 1: Run type checks and lint**

Run:

```bash
pnpm ts-check
pnpm lint
```

Expected:
- No new errors from the migration

- [ ] **Step 2: Run API smoke tests**

Verify:
- register
- login
- verify
- save game record
- fetch game records
- leaderboard
- blog list/create/delete

- [ ] **Step 3: Verify database contents in Neon**

Run:

```sql
select count(*) from users;
select count(*) from blog_post;
select count(*) from game_records;
```

- [ ] **Step 4: Production cutover**

Recommended order:
1. Freeze writes briefly
2. Run final incremental sync or final dump/restore
3. Switch app env vars to Neon
4. Restart app
5. Run smoke tests immediately

- [ ] **Step 5: Rollback plan**

Keep available until stable:
- old Supabase connection info
- old access layer code path on a branch
- final source dump snapshot

If cutover fails:
1. Point env back to old DB stack
2. Redeploy
3. Investigate with Neon staging copy

## Information the user must provide before migration starts

1. **Neon target info**
- Neon project region
- target database name
- runtime pooled connection string
- direct/unpooled migration connection string

2. **Source database access**
- current source Postgres direct connection string, or confirmation that you want me to use Supabase-export tooling instead
- whether I am allowed to run `pg_dump` / `pg_restore`

3. **Downtime requirements**
- acceptable write freeze window
- whether this is a local/dev migration only, or production migration

4. **Schema and SQL function policy**
- whether `get_leaderboard` should stay as a SQL function in Neon or be moved fully into application SQL

5. **Data volume**
- rough row counts or database size
- if data is larger than a few GB, prefer Import Data Assistant or logical replication

6. **Extension requirements**
- whether the source DB uses any Postgres extensions beyond basic tables/indexes/functions

7. **Environment strategy**
- whether you want Neon for `dev` only first, or `dev + staging + prod`

8. **Secret handling preference**
- confirm where Neon secrets should live:
  - `.env.local`
  - deployment platform env vars

## Notes specific to this repository

- Current runtime DB access is tied to Supabase client construction in `src/storage/database/supabase-client.ts`
- The project does not appear to rely on Supabase Auth flows; auth is implemented at the app layer against the `users` table
- The biggest code migration cost is **query API replacement**, not schema replacement
- `DATABASE_URL` already exists in `.env.local`, but current runtime code does not use it
