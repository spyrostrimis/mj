# Monkey Journal

A private gratitude journal for two people, written from one perspective:
what Monkey did for me, and what I did for Monkey. Every moment is tagged
with a love language, and Insights shows how the two of you express it
differently.

Runs entirely on Cloudflare's free tier.

- **Pages** hosts the app and runs the API
- **D1** (serverless SQLite) stores the moments
- **esbuild** bundles the frontend; Cloudflare runs the build on every push

Live at **https://mj.spyrostrimis.com**

---

## Project layout

```
.
├── wrangler.toml            Cloudflare config + D1 binding
├── migrations/              D1 migrations - the schema, versioned
├── functions/               Pages Functions (the API)
│   ├── _session.js            Password check + signed session cookie
│   └── api/
│       ├── _middleware.js     Guards every /api/* route except login
│       ├── auth.js            POST login · GET check · DELETE logout
│       ├── entries.js         GET list · POST create
│       └── entries/[id].js    DELETE one
├── src/                     Frontend source (bundled by esbuild)
│   ├── main.jsx               Entry point
│   ├── Shell.jsx              Phone frame, tabs, auth + entries state
│   ├── Lock.jsx               Password gate
│   ├── Today.jsx              Reverse-chronological feed
│   ├── Insights.jsx           Hairline bars, Him / Me / Both
│   ├── Calendar.jsx           Monthly grid
│   ├── Sheet.jsx              Bottom-sheet composer
│   ├── layout.jsx             Shared screen primitives
│   ├── mascots.jsx            Monkey + Turtle
│   ├── icons.jsx              UI icons
│   ├── data.js                Dates, love languages, stats
│   └── api.js                 Fetch wrappers
├── test/                    node:test suites (npm test)
└── public/                  Served as-is by Pages
    ├── index.html
    ├── css/styles.css
    └── assets/app.js          Build output (gitignored)
```

---

## First-time setup

### 1. Clone it

```bash
cd D:\Documents\homepage
git clone https://github.com/spyrostrimis/mj.git mj.spyrostrimis.com
cd mj.spyrostrimis.com
npm install
```

### 2. Create the database

```bash
npx wrangler login
npx wrangler d1 create mj-journal
```

That prints a `database_id`. Paste it into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_DATABASE_ID`, then commit the change.

Do this before the first deploy. `wrangler.toml` is what declares the `DB`
binding, so a build that ships the placeholder id deploys without a working
database.

Create the table in both places. Locally:

```bash
npm run db:migrate
```

Then on Cloudflare:

```bash
npx wrangler d1 export mj-journal --remote --output=..\mj-backups\first-setup.sql
npx wrangler d1 migrations apply mj-journal --remote
```

The remote apply is deliberately not an npm script. It rewrites the live
database, so it should be typed out on purpose, and never without the export
above. See [Changing the schema](#changing-the-schema).

### 3. Set the password locally

```powershell
"APP_PASSWORD=pick-something-long" | Out-File .dev.vars -Encoding ascii
```

Use `Out-File -Encoding ascii`, not `echo >`. Plain redirection in Windows
PowerShell writes UTF-16, which wrangler may not read.

`.dev.vars` is gitignored and never leaves your machine.

### 4. Run it

```bash
npm run dev           # http://localhost:8788
```

### 5. Run the tests

```bash
npm test
```

Node's built-in runner (`node:test`) - there is no test framework dependency.
Handler tests import the Pages Functions directly and run them against a
`Request`; database tests apply the real `migrations/` files to an in-memory
SQLite database via `node:sqlite`.

---

## Deploying

### 1. Push to GitHub

```bash
git remote add origin https://github.com/spyrostrimis/mj.git
git branch -M main
git push -u origin main
```

`wrangler.toml` must already carry the real `database_id` from setup step 2 —
connecting Pages below triggers a build straight away.

### 2. Connect Cloudflare Pages

In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
Connect to Git**, pick `spyrostrimis/mj`, then set:

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `public` |

Save and deploy. The first build takes about a minute.

### 3. Check the database binding

The `DB` binding is declared in `wrangler.toml`, so Pages picks it up from
the repo — there is nothing to add by hand. Open **Settings → Bindings** and
confirm it is listed:

| Field | Value |
| --- | --- |
| Variable name | `DB` |
| D1 database | `mj-journal` |

The dashboard shows bindings read-only. If one is wrong, fix `wrangler.toml`
and push; never edit it in the dashboard.

### 4. Set the password

**Settings → Variables and Secrets → Add → Type: Secret**

| Field | Value |
| --- | --- |
| Name | `APP_PASSWORD` |
| Value | your passphrase |

Add it to **Production** only — there are no preview deployments; every push
to `main` goes live. Use a real passphrase, it is the only thing standing
between the open internet and your journal.

Redeploy after adding the secret, so the running build picks it up.

### 5. Point the subdomain at it

**Custom domains → Set up a custom domain → `mj.spyrostrimis.com`**

Because `spyrostrimis.com` already uses Cloudflare for DNS, the CNAME is
created for you and TLS is issued automatically. Give it a few minutes.

---

## Day-to-day

Push to `main` and Cloudflare rebuilds and redeploys on its own. There is no
manual deploy step.

```bash
git add -A
git commit -m "Add something"
git push
```

## Changing the schema

Schema changes go through migrations only - never by editing a table by hand,
and never by editing a migration that has already been applied.

```bash
npx wrangler d1 migrations create mj-journal describe-the-change
```

Edit the generated file in `migrations/`, then apply it locally and check the
app still works:

```bash
npm run db:migrate
npm run db:status     # should list nothing outstanding
npm test
npm run dev
```

Only once that is green, go to production. Back up first - this is the step
that cannot be undone:

```bash
npx wrangler d1 export mj-journal --remote --output=..\mj-backups\2026-01-01-reason.sql
npx wrangler d1 migrations apply mj-journal --remote
git push
```

Push immediately after applying. Between the two the live site is running old
code against a new schema and may error; for a two-person journal that gap is
acceptable, but do not leave it open.

## Changing the password

Update the `APP_PASSWORD` secret in the dashboard and redeploy. Every
existing session is signed with the old password, so changing it signs you
out everywhere — which is what you want if it ever leaks.

---

## How the lock works

The app shell is public; the journal data is not. Every `/api/*` route
except login sits behind `functions/api/_middleware.js`.

Logging in posts the password to `/api/auth`, which compares it against the
`APP_PASSWORD` secret by HMAC digest, so the comparison takes the same time
whether the first character is wrong or the last. On success it returns an
`HttpOnly; Secure; SameSite=Strict` cookie holding an expiry and a signature
over that expiry. The signing key is the password itself. The cookie lasts
30 days and cannot be read by JavaScript or forged without the secret.

This is one shared password, not user accounts — appropriate for a journal
only you open, and not for anything with multiple people or real secrets.

---

## Costs

Free, with a lot of headroom:

| | Free tier | This app |
| --- | --- | --- |
| Pages requests | Unlimited | — |
| Functions | 100,000/day | a few dozen |
| D1 storage | 5 GB | a few MB after years |
| D1 reads | 5,000,000/day | a few hundred |
| D1 writes | 100,000/day | a handful |

---

## Notes

- `TODAY` is read from the browser clock once per page load, so a tab left
  open overnight still thinks it is yesterday. Reload after midnight.
- Saving is optimistic: the moment appears immediately and is rolled back
  with a message if the write fails.
- `DELETE /api/entries/:id` works but has no button in the UI yet.
