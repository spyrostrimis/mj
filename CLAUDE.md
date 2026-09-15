# CLAUDE.md — Monkey Journal

PROJECT: Monkey Journal, a private love-language journal for two people: Turtle (the owner) and Monkey (his boyfriend). Turtle is the only intended writer. Both read it. Each item records something Monkey did for Turtle, or something Turtle did for Monkey, tagged with one of five love languages. Live at https://mj.spyrostrimis.com on Cloudflare Pages + D1. Purely personal project. This file is auto-read at session start. Treat everything below as standing rules for this repo.

<!-- ┌─ SYNC v1 · HARD RULES · mirrored in CLAUDE.md + project instructions -->
<!-- │  Edit one → edit the other → bump BOTH version numbers. -->

## HARD RULES

- App UI language = English only.
- One shared password, no roles. Anyone with the password can read AND write. This is a deliberate decision. Do not propose accounts, roles, or a reader/writer split unless asked.
- Journal content is private.
  - Never read, print, query, or export LIVE data unless explicitly asked in the current session.
  - Real entries never appear in commits, test fixtures, screenshots, or logs.
  - Test data must be obviously fake.
- Any `--remote` wrangler command is a PRODUCTION operation. State what it will do and wait for confirmation before running it.
- Before any write to the remote database (migration or data operation), export a backup first: `npx wrangler d1 export mj-journal --remote --output=D:\Documents\homepage\mj-backups\<YYYY-MM-DD>-<reason>.sql`. That backup folder is OUTSIDE the repo and never committed.
- Schema changes go ONLY through D1 migrations in `migrations/`. Never edit a migration that has already been applied. Never drop or rebuild a table holding real entries without a migration that preserves them.
- Running cost must stay $0. Cloudflare free tier only. Any proposal requiring a paid plan gets flagged for a decision, never implemented silently.
- Secrets: never committed, never a literal in source. `APP_PASSWORD` lives in the Cloudflare dashboard (Production) and, locally, in the gitignored `.dev.vars`. Never stage `.dev.vars`, `.env`, `node_modules/`, `public/assets/` (build output), `.wrangler/`, `*.zip`, or any backup/export file.
- `main` is the only branch, and pushing to it PUBLISHES to mj.spyrostrimis.com. No feature branches, no preview deployments. Every push is a live deploy.
- `wrangler.toml` is the source of truth for Pages configuration and bindings. The dashboard shows them read-only. Change bindings in the file, never in the dashboard. (Verified against Cloudflare's Pages docs.)

<!-- └─ /SYNC v1 · HARD RULES -->

## STACK

- Frontend: React 18.3 in `src/`, bundled by esbuild 0.24 into `public/assets/app.js` (an IIFE bundle with automatic JSX). There is no framework and no dev server beyond wrangler.
- API: Cloudflare Pages Functions in `functions/`. File path = route.
- Data: Cloudflare D1 (serverless SQLite), database `mj-journal`, binding `DB`.
- Auth: a shared password compared by HMAC digest. On success, the server sets a session cookie holding an expiry plus an HMAC signature, keyed by the password itself. The cookie is `HttpOnly; Secure; SameSite=Strict` and lasts 30 days. Changing `APP_PASSWORD` signs everyone out.
- Tooling: wrangler 3.x (devDependency), Node's built-in test runner (`node:test`) for tests. Do not add a test framework dependency without asking.
- Fonts: Instrument Serif and Instrument Sans from Google Fonts. This is the only third-party request at runtime, and whether to self-host is an OPEN decision. Do not change it unasked.

## FILE MAP

```
wrangler.toml              Pages config + D1 binding (database_id committed; not a secret)
migrations/
  0001_moments_per_half.sql  One row per half; pair_id links the two halves of a pair
functions/
  _session.js              Password check + signed session cookie
  api/_middleware.js       Guards every /api/* route except /api/auth
  api/auth.js              POST login · GET check · DELETE logout
  api/entries.js           GET list · POST create
  api/entries/[id].js      DELETE one
src/
  main.jsx                 Entry point
  Shell.jsx                Phone frame (<720px full-bleed, wider = scaled iOS frame), tabs, auth + entries state
  Lock.jsx                 Password gate
  Today.jsx                Newest-first feed; opens Calendar
  Calendar.jsx             Monthly grid
  Insights.jsx             Hairline bars, Him / Me / Both segmented control
  Sheet.jsx                Bottom-sheet composer (Monkey half + Turtle half)
  layout.jsx               Shared screen primitives
  mascots.jsx              Monkey + Turtle marks
  icons.jsx                UI icons
  data.js                  Dates, love languages (LANGS), stats
  api.js                   Fetch wrappers
test/
  session.test.js          Password + signed-cookie helpers
  migration.test.js        Applies migrations/ and asserts the schema defends itself
  entries-validation.test.js  POST rules, with a DB that throws if touched
  entries-db.test.js       What gets stored, what GET returns, pair atomicity, DELETE
  contract.test.js         The composer's own payload, fed to the real POST handler
  composer.test.js         Save gate: halfStatus / composerState / halfHint / newId
  stats.test.js            Per-subject totals and topLang
  helpers/migrate.js       Applies migrations/ to a fresh in-memory node:sqlite DB
  helpers/d1.js            D1Database-shaped wrapper over node:sqlite
public/
  index.html               Shell; loads /css/styles.css and /assets/app.js
  css/styles.css
  assets/app.js            BUILD OUTPUT, gitignored
```

Vocabulary: **Monkey** = the boyfriend, **Turtle** = the owner/writer. The love languages are exactly `words | acts | touch | gifts | time`.

## DATA MODEL

**Current (live):** a single table `moments` with one row per HALF, created by `migrations/0001_moments_per_half.sql` and applied to production on 2026-09-15.

- One row per half, with `subject` ∈ {`monkey`, `turtle`}. The text column is `body`.
- Saving both halves at once creates two rows sharing a `pair_id`. The two rows are written atomically and displayed together as a pair.
- Saving one half creates one row with no pair.
- Save is enabled when at least one half is complete (text + love language). If the other half is partially filled, Save is blocked and the UI shows which half is incomplete. The server enforces the same rule: every submitted half must be complete.

Columns: `id`, `pair_id` (nullable - this is the single/pair switch), `subject`, `lang`, `body`, `entry_date`, `entry_time`, `created_at`. CHECK constraints enforce the subject, the five languages, a non-blank body of at most 2000 characters, and the date/time formats. A unique index on (`pair_id`, `subject`) allows at most one half per subject per pair; NULLs are distinct in a SQLite unique index, so unpaired rows are unconstrained by it.

`GET /api/entries` groups rows into one item per moment - `{ id, pairId, date, time, monkey, turtle }` with `null` for a missing half - and `POST` takes that same shape back. A pair is written with `batch()`, which D1 runs as a transaction; D1 does not accept explicit BEGIN/COMMIT.

## RUN / TEST

All commands run in PowerShell from the repo root, `D:\Documents\homepage\mj.spyrostrimis.com`.

- `npm install`
- `npm run build` bundles the frontend.
- `npm run dev` builds, then runs `wrangler pages dev` at http://localhost:8788 against LOCAL D1.
- `npm run db:migrate` applies `migrations/` to LOCAL D1; `npm run db:status` lists what is outstanding. Both are `--local`. There is deliberately no remote script: applying to production is typed out in full, after a backup.
- Local password: `.dev.vars` containing `APP_PASSWORD=...`. Create it with `"APP_PASSWORD=..." | Out-File .dev.vars -Encoding ascii`. Plain `echo >` in Windows PowerShell writes UTF-16, which wrangler may not read.
- `npm test` runs `node --test "test/**/*.test.js"`. Node's built-in runner; no test framework dependency.
- Tests come in two tiers:
  - **No database.** Pages Functions are imported directly and called with a `Request` and a fake `env`. They run unmodified under plain Node - `Response.json` and `crypto.subtle` are globals.
  - **Database.** The real `migrations/` files are applied to an in-memory SQLite database via `node:sqlite` (built in; a Node release candidate, test-only, never shipped to Cloudflare).
- Why not real D1 in tests: `getPlatformProxy()` and direct Miniflare both hang in Claude's execution environment - a long-lived IN-PROCESS `workerd` never becomes ready. The wrangler CLI is unaffected: `npm run dev` (`wrangler pages dev`) serves and hot-reloads normally there, and so does `wrangler d1 execute --local`, so browser verification against local D1 is available. Schema semantics were cross-checked against local D1 (columns, indexes, every CHECK) and matched; `batch()` rollback was confirmed end-to-end through `pages dev`. Production D1's rollback is covered only by Cloudflare's docs.

## DEPLOYMENT

- Cloudflare Pages project: `mj`
- GitHub repo: `spyrostrimis/mj`
- Git remote: `https://github.com/spyrostrimis/mj.git` (HTTPS). Verify with `git remote -v` before pushing.
- Production branch: `main`
- Framework preset: none · root directory: repo root · build command: `npm run build` · output directory: `public`
- Pages hostname: `https://mj-4er.pages.dev`
- Production URL: `https://mj.spyrostrimis.com` (custom domain; DNS on Cloudflare)
- D1: `mj-journal`, binding `DB`, declared in `wrangler.toml`
- Secret: `APP_PASSWORD`, set in the dashboard under Settings → Variables and Secrets. Adding or changing it needs a redeploy (Deployments → ⋯ → Retry deployment).
- Git integration is active: every push to `main` builds and deploys.
- Deploying a schema change: back up, apply the remote migration, then push immediately. The site may error briefly between the two steps, which is acceptable for this app.

## GIT

- `main` only. One commit per change.
- `core.autocrlf` is on for this machine. Watch for line-ending churn.
- The first commit was authored as `Spyros Trimis <trickywisdom@gmail.com>`.

<!-- ┌─ SYNC v1 · CHANGE DISCIPLINE · mirrored in CLAUDE.md + project instructions -->
<!-- │  Edit one → edit the other → bump BOTH version numbers. -->

## CHANGE DISCIPLINE

- Small, scoped, one concern per change. Reviewable diffs.
- Flag any bonus or adjacent fix explicitly. Never bundle silently.
- Multi-file or bug work: trace data flow directly across files (DB → function → api.js → component). No shape pattern-matching. Prefer direct file reads over subagent summaries that drop cross-file context.
- Plan before editing for anything touching the schema, the API contract, or auth. Wait for approval.
- Before claiming done: show the real `git diff`, run the tests and show the real output, and list what still needs manual testing in the browser. Never assert "passes" without evidence.
- Tests use `node:test`. New behaviour gets new tests written against the new behaviour.
- Tests must be proven non-vacuous: break the fix, confirm the test fails, then restore. Every negative assertion needs a positive control on the same fixture in the same run.
- One commit per change. Manual verification happens BEFORE the commit, so every commit describes something actually seen working.
- CARVE-OUT: config changes, docs, and dead-code deletion can't be "seen working." For those, the verification is the real diff, plus a grep proving nothing references anything removed. Say so in the commit message.

<!-- └─ /SYNC v1 · CHANGE DISCIPLINE -->

## KNOWN LIMITATIONS

These are known, not bugs to fix on sight. Work from the specific instruction given.

- `TODAY` is read from the browser clock once per page load. A tab left open past midnight still shows yesterday.
- Saving is optimistic: the moment appears immediately and is rolled back with a message if the write fails.
- `DELETE /api/entries/:id?kind=pair|half` requires the kind, because a `pair_id` and a row id are different id spaces that may hold the same string. `kind=pair` removes every row of that pair, so a pair is never left as an orphaned single; `kind=half` removes exactly that one row by primary key, and an unpaired moment is deleted as its half. A missing or unknown kind is a 400. Tapping a half in the feed opens a half-actions sheet whose Delete sends `kind=half`; that is the only kind the UI sends, so deleting a whole pair in one action is still a `--remote` command.
- The app shell is public. Only `/api/*` data is locked.

## SCOPE

Active priorities are decided in planning chats and live in `state.md`, which you do NOT see. When starting a task, work from the specific instruction given. Do not guess at "what's next" and start editing.
