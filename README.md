# AloraAI — landing page + clinician pilot sign-up

Production landing page for AloraAI (behavioral-health bed-placement coordination),
plus a small self-contained backend that collects clinician pilot sign-ups so you can
distribute the list to a broader audience of clinicians who want to work with you.

Built by refining the original design reference (`AloraAI Landing Page.dc.html`) into
real HTML/CSS, applying design-taste principles (generous spacing, 2–3 line headlines,
tightened text layout, restored CTAs), with a new value-proposition section, an embedded
video demo, and a low-friction sign-up form.

## Quick start

```bash
npm start               # → http://localhost:3000
# or, auto-reload while editing:
npm run dev
```

Requires **Node 22.9+**. No `npm install` needed — there are zero external dependencies.
With no configuration it stores sign-ups in a local `signups.db` (SQLite). Add Supabase
credentials (below) to store them in the cloud instead.

## What's here

```
public/
  index.html            # the landing page
  styles.css            # design system (OKLCH forest-green, Newsreader + Inter)
  app.js                # sign-up form submission
  assets/
    hero-nurse.jpg      # vintage hero photo
    network-graph.png   # product network-map screenshot
    alora-demo.mp4      # demo video (remuxed from alora-demo.mov, H.264, web-ready)
    alora-demo-poster.jpg
server.js               # HTTP server: static files + sign-up API + admin/CSV
supabase-schema.sql     # run this once in Supabase to create the table
.env.example            # copy to .env and fill in secrets (git-ignored)
signups.db              # local SQLite, created on first run if no Supabase (git-ignored)
```

## Page sections

1. **Hero** — full-viewport vintage photo, headline, sub-headline, two CTAs.
2. **The problem** — the "calling facilities one by one" status quo.
3. **How it works** — the two things Alora does on every call.
4. **Why it matters** — the value proposition (four concrete wins for a case manager).
5. **See it work** — the embedded demo video.
6. **Live in the workspace** — the network-map product visual.
7. **Join the pilot** — the sign-up form.
8. **Footer** — trust line.

## The sign-up backend

The form collects **name** and **email** (required) plus optional **organization**,
**location**, and **LinkedIn** — deliberately low-friction so clinicians can sign up in
seconds while still giving you a sense of where they work.

| Endpoint | Purpose |
|---|---|
| `POST /api/signup` | Records a sign-up (JSON body). Validates name + email; duplicate emails are treated as success (idempotent). |
| `GET /admin?token=…` | HTML table of every sign-up. |
| `GET /admin/export.csv?token=…` | Downloads the full list as CSV for distribution / outreach. |

### Storage: Supabase or local SQLite

The backend has a small pluggable storage layer:

- **No config** → sign-ups go to a local `signups.db` (SQLite) file. Great for local dev.
  Inspect it with `sqlite3 signups.db 'SELECT * FROM signups;'`.
- **Supabase configured** → sign-ups go to a Postgres table in your Supabase project.

The front-end and the `/admin` + CSV endpoints are identical either way.

### Setting up Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Open **SQL Editor → New query**, paste the contents of [`supabase-schema.sql`](supabase-schema.sql),
   and run it. This creates the `signups` table and enables Row Level Security.
3. Open **Project Settings → API** and copy:
   - the **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - the **`service_role`** key (under *Project API keys* — the secret one, **not** `anon`).
4. Copy `.env.example` to `.env` and fill in:
   ```bash
   cp .env.example .env
   # then edit .env:
   ADMIN_TOKEN=some-long-random-secret
   SUPABASE_URL=https://abcd1234.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGci...        # the service_role key
   ```
5. `npm start`. The startup banner will say `Storage backend → supabase`.

**Security notes:** the `service_role` key is a secret — it lives only in `.env` (git-ignored)
and is only ever used server-side; it is never sent to the browser. RLS is left ON with no
public policies, so only your server (holding the service key) can read or write the table —
the public `anon` key cannot. You can also browse/export the list directly in the Supabase
**Table Editor**.

### Admin token

The admin endpoints are protected by a token. Set a stable one via the environment:

```bash
ADMIN_TOKEN=your-secret node server.js
```

If you don't set one, the server generates a random token each run and prints it (along
with the ready-to-click admin + CSV URLs) to the console at startup.

## Deploying

### Vercel (recommended — serverless)

On Vercel the static site is served from `public/` and the API runs as serverless
functions in `api/` (`api/signup.js`, `api/admin.js`, `api/export.js`). `server.js` is
**not** used on Vercel — it's only the local dev server. Both share `lib/store.js`, so the
behavior is identical. Because sign-ups live in Supabase, the functions are stateless.

1. Push to GitHub (done).
2. In Vercel: **Add New → Project → Import** `swindar-zhou/AloraAI-website`.
   Framework preset **Other**; no build command or output dir needed.
3. Add **Environment Variables** (Production + Preview):
   `ADMIN_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
4. **Deploy.** `vercel.json` rewrites keep `/admin` and `/admin/export.csv` working.
5. Set the project's **Node.js version to 22.x** (Settings → General) to match `engines`.

Every `git push` to `main` then redeploys automatically.

### Other hosts (persistent Node process)

`server.js` also runs on anything with a persistent Node 22.9+ process (a small VM,
Render, Railway, Fly.io). Set `PORT`, `ADMIN_TOKEN`, `SUPABASE_URL`, and
`SUPABASE_SERVICE_KEY` as environment variables (don't upload `.env`). The sign-up IP is
read from `X-Forwarded-For` when behind a proxy / CDN.

## Notes on the original files

- `AloraAI Landing Page.dc.html`, `support.js`, `image-slot.js` — the original design
  reference and its authoring-tool runtime. Kept for reference; **not used in production.**
- `ds/modernist-styles.css` — an earlier design-system exploration, not used by the
  current direction.
