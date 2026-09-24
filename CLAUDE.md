# CLAUDE.md — Monkey Journal

PROJECT: Monkey Journal, a private love-language journal for two people: Turtle (the owner) and Monkey (his boyfriend). Turtle is the only intended writer. Both read it. Each item records something Monkey did for Turtle, or something Turtle did for Monkey, tagged with one of five love languages. Live at https://mj.spyrostrimis.com on Cloudflare Pages + D1. Purely personal project. This file is auto-read at session start. Treat everything below as standing rules for this repo.

<!-- ┌─ SYNC v3 · HARD RULES · mirrored in CLAUDE.md + project instructions -->
<!-- │  Edit one → edit the other → bump BOTH version numbers. -->

## HARD RULES

- App UI language = English only.
- One shared password, no roles. Anyone with the password can read AND write. This is a deliberate decision. Do not propose accounts, roles, or a reader/writer split unless asked.
  - **The password gate is currently OFF** (commit `58d3263`, 2026-09-16) for the build phase. `AUTH_DISABLED = "1"` in `wrangler.toml` `[vars]` lets every `/api/*` request through without a session. The lock screen, login route, session code and their tests stay in place.
  - While the gate is off, production holds obviously-fake test data only. Anything there is readable, writable and deletable by anyone who finds the hostname.
  - The gate goes back on BEFORE the first real entry: delete the `[vars]` block, push, and confirm that `/api/entries` with no cookie returns 401.
  - Turning the gate on or off is always its own commit, never part of another change.
- Journal content is private.
  - **Build phase (now): every entry, local and production, is test data.** Claude Code may read, query and print any entry without asking, including entries it did not create. This ends when Turtle says real use has started; turning the gate back on is the latest point.
  - After that: never read, print, query, or export LIVE data unless explicitly asked in the current session.
  - Real entries never appear in commits, test fixtures, screenshots, or logs.
  - Test data that Code creates must be obviously fake (`TEST FAKE - ...`).
- Any `--remote` wrangler command is a PRODUCTION operation. State what it will do and wait for confirmation before running it.
- Before any write to the remote database (migration or data operation), export a backup first: `npx wrangler d1 export mj-journal --remote --output=D:\Documents\homepage\mj-backups\<YYYY-MM-DD>-<reason>.sql`. That backup folder is OUTSIDE the repo and never committed.
- Schema changes go ONLY through D1 migrations in `migrations/`. Never edit a migration that has already been applied. Never drop or rebuild a table holding real entries without a migration that preserves them.
- Running cost must stay $0. Cloudflare free tier only. Any proposal requiring a paid plan gets flagged for a decision, never implemented silently.
- Secrets: never committed, never a literal in source. `APP_PASSWORD` lives in the Cloudflare dashboard (Production) and, locally, in the gitignored `.dev.vars`. Never stage `.dev.vars`, `.env`, `node_modules/`, `public/assets/` (build output), `.wrangler/`, `*.zip`, or any backup/export file.
- `main` is the only branch that is ever pushed, and pushing to it PUBLISHES to mj.spyrostrimis.com. No pushed feature branches, no preview deployments. Every push is a live deploy.
  - Claude Code worktree branches are local scratch space only. They are never pushed, are merged into `main` locally, and are removed once `main` contains them.
- `wrangler.toml` is the source of truth for Pages configuration, bindings and plain (non-secret) vars. The dashboard shows them read-only. Change them in the file, never in the dashboard. (Verified against Cloudflare's Pages docs.)

<!-- └─ /SYNC v3 · HARD RULES -->

## STACK

- Frontend: React 18.3 in `src/`, bundled by esbuild 0.24 into `public/assets/app.js` (an IIFE bundle with automatic JSX). There is no framework and no dev server beyond wrangler.
- API: Cloudflare Pages Functions in `functions/`. File path = route.
- Data: Cloudflare D1 (serverless SQLite), database `mj-journal`, binding `DB`.
- Auth: a shared password compared by HMAC digest. On success, the server sets a session cookie holding an expiry plus an HMAC signature, keyed by the password itself. The cookie is `HttpOnly; Secure; SameSite=Strict` and lasts 30 days. Changing `APP_PASSWORD` signs everyone out.
  - **Currently bypassed:** the middleware skips the check when `env.AUTH_DISABLED === '1'`, and only that exact string counts (fail-closed). The shell never asks whether a session exists; it only turns a 401 into the lock screen, so the bypass needed no frontend change.
- Tooling: wrangler 3.x (devDependency), Node's built-in test runner (`node:test`) for tests, and jsdom (devDependency) for the tests that render React. There is still no test framework - no Jest, no Vitest, no @testing-library - and `act` comes from React itself (`React.act`), not from the deprecated copy in `react-dom/test-utils`. Do not add a test framework without asking.
- Fonts: Instrument Serif and Instrument Sans, self-hosted in `public/fonts/` (decided). Greek falls back to EB Garamond (serif) and Inter (sans), greek subset only, gated by `unicode-range`.
  - The app makes no third-party request at runtime.
  - `@font-face` rules are at the top of `public/css/styles.css`; provenance and refresh steps are in `public/fonts/README.md`.
  - The serif stack is also written inline in several `src/` components. A change to the stack has to be made in each of them.

## FILE MAP

```
.claude/
  launch.json              Preview dev-server config: npm run dev on port 8788
                           (worktrees/ and settings.local.json are gitignored)
.vscode/
  settings.json            Formatting OFF for this folder. The machine's user
                           settings run Prettier on save, which rewrites this
                           hand-aligned code (and requoted trips.js once).
                           Tracked on purpose so it applies to any clone.
.gitattributes             * text=auto eol=lf (LF everywhere; overrides core.autocrlf)
.gitignore                 node_modules/, public/assets/, .wrangler/, .dev.vars, .env,
                           .DS_Store, *.zip, *.sql (migrations/*.sql re-included),
                           .claude/worktrees/, .claude/settings.local.json
CLAUDE.md                  Standing rules for this repo (auto-read at session start)
README.md                  Setup and deploy notes
package.json               Scripts: build, dev, test, db:migrate, db:status
package-lock.json
wrangler.toml              Pages config + D1 binding (database_id committed; not a secret)
                           + [vars] AUTH_DISABLED = "1" while the gate is off
migrations/
  0001_moments_per_half.sql  One row per half; pair_id links the two halves of a pair
functions/
  _session.js              Password check + signed session cookie
  api/_middleware.js       Guards every /api/* route except /api/auth
                           (bypassed while AUTH_DISABLED === '1')
  api/auth.js              POST login · GET check · DELETE logout
  api/entries.js           GET list · POST create
  api/entries/[id].js      DELETE one pair or one half (?kind=pair|half required)
src/
  main.jsx                 Entry point
  Shell.jsx                Phone frame (<720px full-bleed, wider = scaled iOS frame), tabs, auth + entries state
  Lock.jsx                 Password gate
  Unavailable.jsx          Error screen for 503 / 500 / network load failures
  Today.jsx                Newest-first feed; opens Calendar
  Calendar.jsx             Monthly grid
  Insights.jsx             Period picker (week / month / year / all time), hairline
                           bars, Him / Me / Both, Pattern + quiet-lately line,
                           Translation (Both only), Remember when
  Sheet.jsx                Bottom-sheet composer, exported as QuickSheet
                           (Monkey half + Turtle half)
  HalfSheet.jsx            Half-actions sheet: the tapped half as context, Delete, Cancel
  layout.jsx               Shared screen primitives
  mascots.jsx              Monkey + Turtle marks
  icons.jsx                UI icons
  data.js                  Dates, love languages (LANGS), stats, loadFailure(),
                           Insights helpers (periods, quietLangs, translations,
                           memoryPool)
  api.js                   Fetch wrappers
test/
  session.test.js          Password + signed-cookie helpers
  migration.test.js        Applies migrations/ and asserts the schema defends itself
  entries-validation.test.js  POST rules, with a DB that throws if touched
  entries-db.test.js       What gets stored, what GET returns, pair atomicity, DELETE
  contract.test.js         Composer payload -> real POST; delete wrapper -> real DELETE
  composer.test.js         Save gate: halfStatus / composerState / halfHint / newId
  stats.test.js            Per-subject totals, topLangs (ties), listLangs
  periods.test.js          Where each Insights period starts; Sunday-first weeks
  quiet.test.js            The quiet line: reads the period given, cap at two
  translations.test.js     What Turtle answers each Monkey language with
  memory.test.js           Remember when: pool per tab, Another never repeats
  shell-gate.test.js       Where a failed load sends the shell (loadFailure)
  half-delete.test.js      removeHalf / restoreHalf / deleteFailure
  api-client.test.js       deleteEntry refuses to guess an id space; URL shape
  ordering.test.js         Same-minute ordering: a moment saved second stays on top
  half-sheet-dom.test.js   The half-actions sheet rendered in jsdom: focus, Escape,
                           Tab trap, double-tap latch, composer stays parked
  tabs-dom.test.js         Bottom-tab navigation in jsdom: every tab reachable
                           from every other one
  insights-dom.test.js     Insights in jsdom: per-tab Pattern, ties, periods,
                           quiet line, Translation, Remember when
  auth-disabled.test.js    Middleware bypass: open only for the exact string '1'
  helpers/migrate.js       Applies migrations/ to a fresh in-memory node:sqlite DB
  helpers/d1.js            D1Database-shaped wrapper over node:sqlite
  helpers/dom.js           jsdom document + React root, fetch stub, act helpers
  helpers/jsx-loader.mjs   esbuild load hook so node --test can import .jsx
  helpers/register-jsx.mjs Installs that hook (used via node --import)
public/
  index.html               Shell; loads /css/styles.css and /assets/app.js (no external links)
  css/styles.css           @font-face rules at the top
  fonts/                   Self-hosted woff2 files, OFL license texts, README (provenance)
  assets/app.js            BUILD OUTPUT, gitignored
```

Vocabulary: **Monkey** = the boyfriend, **Turtle** = the owner/writer. The love languages are exactly `words | acts | touch | gifts | time`.

## DATA MODEL

**Current (live):** a single table `moments` with one row per HALF, created by `migrations/0001_moments_per_half.sql` and applied to production on 2026-09-15. Production currently holds test data only (see HARD RULES).

- One row per half, with `subject` ∈ {`monkey`, `turtle`}. The text column is `body`.
- Saving both halves at once creates two rows sharing a `pair_id`. The two rows are written atomically and displayed together as a pair.
- Saving one half creates one row with no pair.
- Save is enabled when at least one half is complete (text + love language). If the other half is partially filled, Save is blocked and the UI shows which half is incomplete. The server enforces the same rule: every submitted half must be complete.

Columns: `id`, `pair_id` (nullable - this is the single/pair switch), `subject`, `lang`, `body`, `entry_date`, `entry_time`, `created_at`. CHECK constraints enforce the subject, the five languages, a non-blank body of at most 2000 characters, and the date/time formats. A unique index on (`pair_id`, `subject`) allows at most one half per subject per pair; NULLs are distinct in a SQLite unique index, so unpaired rows are unconstrained by it.

`GET /api/entries` groups rows into one item per moment - `{ id, pairId, date, time, monkey, turtle }` with `null` for a missing half - and `POST` takes that same shape back. A pair is written with `batch()`, which D1 runs as a transaction; D1 does not accept explicit BEGIN/COMMIT.

Ordering is newest-first at both ends. The feed reads `ORDER BY entry_date DESC, entry_time DESC, created_at DESC, id DESC`: `entry_date`/`entry_time` are the journal's own timestamp, `created_at` breaks a same-minute tie because `id` is a random uuid and cannot, and `id` is the last resort so the order is at least stable. On the client, `newestFirst` in `data.js` is the single comparator - it returns 0 on a tie, so the stable sort preserves what the API sent and keeps an optimistically-prepended moment on top.

## RUN / TEST

All commands run in PowerShell from the repo root, `D:\Documents\homepage\mj.spyrostrimis.com`.

- `npm install`
- `npm run build` bundles the frontend.
- `npm run dev` builds, then runs `wrangler pages dev` at http://localhost:8788 against LOCAL D1.
- Browser pane: `.claude/launch.json` defines the `mj` configuration (`npm run dev`, port 8788), so the preview can start the app by name. Plain `"npm"` spawns correctly on this machine (tested); if that ever regresses, change it to `"npm.cmd"`.
- `npm run db:migrate` applies `migrations/` to LOCAL D1; `npm run db:status` lists what is outstanding. Both are `--local`. There is deliberately no remote script: applying to production is typed out in full, after a backup.
- Local password: `.dev.vars` containing `APP_PASSWORD=...`. Create it with `"APP_PASSWORD=..." | Out-File .dev.vars -Encoding ascii`. Plain `echo >` in Windows PowerShell writes UTF-16, which wrangler may not read.
- Local gate: `wrangler.toml` `[vars]` applies to `pages dev` too, so local dev is currently open. To exercise the lock screen locally, add `AUTH_DISABLED=0` to `.dev.vars`. Cloudflare's docs say `.dev.vars` overrides `[vars]`; confirm this on this wrangler 3.x before relying on it.
- `npm test` runs `node --import ./test/helpers/register-jsx.mjs --test "test/**/*.test.js"`. Node's built-in runner; the `--import` installs the JSX load hook and must come before `--test`.
- Tests come in three tiers:
  - **No database.** Pages Functions are imported directly and called with a `Request` and a fake `env`. They run unmodified under plain Node - `Response.json` and `crypto.subtle` are globals.
  - **Database.** The real `migrations/` files are applied to an in-memory SQLite database via `node:sqlite` (built in; a Node release candidate, test-only, never shipped to Cloudflare).
  - **DOM.** The real components are rendered into jsdom. `node --test` cannot import `.jsx`, so `test/helpers/register-jsx.mjs` installs an esbuild load hook with the same transform settings as `npm run build`.
    - jsdom is constructed with `pretendToBeVisual: true`, because it is the only way to get `requestAnimationFrame`. The sheets' `entered` state is gated on a double rAF; without it every sheet stays at `translateY(100%)` and open-state assertions silently test a closed sheet.
    - jsdom does no layout, so `getBoundingClientRect`, `offsetHeight` and `scrollHeight` are all zero. Assert DOM state, focus and inline styles, never geometry. Geometry has to be checked in a real browser.
    - Compare DOM nodes with `assert.ok(a === b, msg)`, never `assert.equal`. On failure, `assert.equal` builds a diff that walks the jsdom tree until the heap dies.

  Why the DOM tier exists: a delete button shipped twice with 89 tests green, because nothing rendered React. Anything about focus, overlay stacking or sheet state belongs here.
- Why not real D1 in tests: `getPlatformProxy()` and direct Miniflare both hang in Claude's execution environment - a long-lived IN-PROCESS `workerd` never becomes ready.
  - The wrangler CLI is unaffected: `npm run dev` (`wrangler pages dev`) serves and hot-reloads normally there, and so does `wrangler d1 execute --local`, so browser verification against local D1 is available.
  - Schema semantics were cross-checked against local D1 (columns, indexes, every CHECK) and matched. `batch()` rollback was confirmed end-to-end through `pages dev`.
  - Production D1's rollback is covered only by Cloudflare's docs.

## ENVIRONMENT

- Windows PowerShell blocks `npm.ps1` under the default execution policy. Use `npm.cmd`, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` in a non-admin window.
- **Browser pane compositing (this cost two shipped bugs).** The built-in browser pane runs `requestAnimationFrame` only while it is actually being painted to screen. Three states stop that, all the same root cause - the page has no on-screen surface:
  1. **The pane is hidden** (not displayed in the app layout). The common one: `preview_start` reuses a previously collapsed pane, so the pane can stay hidden with the window in front.
  2. The Claude Code window is minimised.
  3. The window is fully covered by another window.
  - In that state rAF never fires and screenshots time out. Everything else looks healthy: `document.visibilityState` reports `visible`, layout is live so `getBoundingClientRect` returns real numbers, and the viewport is usually a normal size - 1024×768 and 900×628 measured with rAF dead on 2026-09-17. Do NOT use `innerWidth === 0` as the tell. Focus is irrelevant: `document.hasFocus()` was `false` both when rAF was dead and when it ran at 60fps.
  - rAF-gated state never advances, so sheets and modals never really open. Driving their buttons by DOM ref still "works", so verification reports success while the UI is broken.
  - **There is a third state, and it is the confusing one: painting but THROTTLED.** When the pane is displayed and the window simply is not frontmost, it paints at roughly 2fps instead of 60. Screenshots work. rAF-gated state still advances, about 30× slower - a double-rAF gate needs around a second, not 33ms. Do not read a sheet that has not opened yet as a sheet that never opens; give it a beat.
  - **Do NOT diagnose this by awaiting rAF inside one `javascript_tool` call.** That evaluation blocks frame production while it awaits, so in the throttled state it deadlocks itself and reports DEAD no matter what. Measured on 2026-09-17: a free-running counter sat frozen at 14 frames for the whole 3s of an awaited probe that returned "DEAD", then ticked twice the moment the call returned - while screenshots of that same page were working.
  - **Rule:** diagnose in this order. (1) `tabs_context` - it says outright whether the pane is displayed or hidden. (2) Just take the screenshot: an image back means the pane IS painting, whatever a probe claims. (3) Only if the real frame rate matters, start a free-running rAF counter in one call and read it in the NEXT call - never in the same one. If the pane is genuinely not painting, say that verification is DOM- and geometry-level only and ask Turtle to display the pane.
  - Code cannot display the pane itself; `show_pane` covers diff, file, terminal, pr, tasks, plan and artifact, but not the browser. `resize_window` fixes a 0×0 viewport but does NOT restore painting.
  - Once it is painting: a `screenshot` in the same `browser_batch` as a click can capture the pre-repaint frame, so take it in its own call; and `zoom` region crop is unsupported in the pane - use `resize_window` with the mobile preset to inspect the phone UI at 1:1.
  - Treat an odd-looking screenshot as a finding, never as a rendering glitch.

## DEPLOYMENT

- Cloudflare Pages project: `mj`
- GitHub repo: `spyrostrimis/mj`
- Git remote: `https://github.com/spyrostrimis/mj.git` (HTTPS). Verify with `git remote -v` before pushing.
- Production branch: `main`
- Framework preset: none · root directory: repo root · build command: `npm run build` · output directory: `public`
- Pages hostname: `https://mj-4er.pages.dev`
- Production URL: `https://mj.spyrostrimis.com` (custom domain; DNS on Cloudflare)
- D1: `mj-journal`, binding `DB`, declared in `wrangler.toml`
- Plain vars: `[vars]` in `wrangler.toml` (currently only `AUTH_DISABLED`). Pages applies them to production; this was verified on 2026-09-16.
- Secret: `APP_PASSWORD`, set in the dashboard under Settings → Variables and Secrets. Adding or changing it needs a redeploy (Deployments → ⋯ → Retry deployment).
- Git integration is active: every push to `main` builds and deploys.
- Deploying a schema change: back up, apply the remote migration, then push immediately. The site may error briefly between the two steps, which is acceptable for this app.

## GIT

- `main` only (see HARD RULES for worktree branches). One commit per change.
- Line endings: `.gitattributes` sets `* text=auto eol=lf`, which takes precedence over this machine's `core.autocrlf`. A diff that shows CRLF churn means something bypassed it: stop and flag it rather than committing.
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

- **The password gate is off** (see HARD RULES). The app opens straight to the feed, and `/api/auth` still reports `authenticated: false` but is never asked.
- `TODAY` is read from the browser clock once per page load. A tab left open past midnight still shows yesterday.
- Saving is optimistic: the moment appears immediately and is rolled back with a message if the write fails.
- `DELETE /api/entries/:id?kind=pair|half` requires the kind, because a `pair_id` and a row id are different id spaces that may hold the same string. A missing or unknown kind is a 400.
  - `kind=pair` removes every row of that pair, so a pair is never left as an orphaned single.
  - `kind=half` removes exactly that one row by primary key; an unpaired moment is deleted as its half.
  - Tapping a half in the feed opens a half-actions sheet whose Delete sends `kind=half`. That is the only kind the UI sends, so deleting a whole pair in one action is still a `--remote` command.
- Two moments saved inside the same SECOND tie in the feed and fall back to a random id. `entry_time` records only HH:MM and `created_at` only whole seconds. Not reachable by hand; a millisecond `created_at` would need a new migration.
- Delete is permanent: no undo, no soft delete.
- No Edit: no PUT/PATCH endpoint and no edit UI.
- Sheet entry (composer and half-actions sheet) is gated on a double rAF. If rAF is throttled, a sheet stays invisible.
- The app shell is public. Only `/api/*` data is locked (and currently not even that).

## SCOPE

Active priorities are decided in planning chats and live in `state.md`, which you do NOT see. When starting a task, work from the specific instruction given. Do not guess at "what's next" and start editing.
