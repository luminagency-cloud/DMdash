# Command Board

A personal **work command board** — a drag-and-drop prioritization surface that sits on top of your GitHub-and-notes world. Desktop-first, installable on your phone, single user. Built to answer one question fast: _what should I be working on right now, and what am I about to forget?_

- **Four lanes** — Today, Next, Unlabeled, Snooze. Drag cards between them and reorder within them. Today is visually dominant.
- **Aging color** — every card tints from fresh → warm → stale the longer you don't touch it. Opening, moving, or editing a card resets it.
- **Stale reminder** — a banner at the top surfaces anything you haven't touched in a while so it never silently disappears.
- **Snooze** — park a card for N days (default 7); when the window passes it automatically bubbles back up to Unlabeled.
- **Projects = repos *or* not** — a project can link several GitHub repos (issues become its task list, read + write) **or** none at all (e.g. "clean the backyard"), in which case it uses local to-dos. Most projects do both.
- **Airtable is the database.** GitHub is a connected source, not the source of truth. Keys stay server-side.

---

## Quick start (demo mode — no setup)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Airtable keys set, the app runs on **in-memory demo data** (persisted to `.data/db.json`) so you can try the board immediately.

> Demo mode is for local play only — it won't persist on an ephemeral host. Wire up Airtable to go live.

---

## Go live with Airtable

1. Create a base at [airtable.com](https://airtable.com) — an empty base is fine.
2. Create a **Personal Access Token** at https://airtable.com/create/tokens with scopes
   `data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`, and grant it access to your base.
3. Copy `.env.example` to `.env` and fill in `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID`.
4. Create the schema (idempotent — safe to re-run):

```bash
npm run setup:airtable     # creates the Projects, Tasks, Settings tables
npm run seed:airtable      # optional: a Settings row + a few sample projects
```

5. Restart (`npm run dev`). The header/Settings page will now show backend **airtable**.

---

## Connect GitHub

Set `GITHUB_TOKEN` in `.env` to a token that can read and write your repos' issues:

- **Fine-grained PAT:** Issues = Read and write, Contents = Read.
- **Classic PAT:** the `repo` scope.

Then link repos to a project from its detail page (`owner/repo`). Open issues appear inline; you can check one off (closes it), comment, or create a new one. Without a token, repo sections just show a hint — everything else still works.

## Password (optional)

Set `APP_PASSWORD` to lock the app behind a single password (stored as an httpOnly cookie, one prompt per device). Leave it blank for no lock — fine for a private host. No accounts, no sessions, nothing else.

---

## Deploy

It's a standard Next.js app; it runs anywhere Node runs. Set the same env vars (`AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `GITHUB_TOKEN`, `APP_PASSWORD`) in your host's dashboard.

**Vercel (easiest):** push to a repo, import it, add the env vars, deploy.

**Any Node host / VPS:**

```bash
npm install
npm run build
npm run start      # serves on port 3000
```

**Docker:** `next.config.mjs` sets `output: "standalone"`, so you can copy `.next/standalone`, `.next/static`, and `public/` into a slim Node image and run `node server.js`.

Install as an app: open it in a browser and choose **Add to Home Screen** / **Install** (it's a PWA with a manifest + service worker).

---

## How the pieces map to Airtable

| Table | Fields |
|------|--------|
| **Projects** | Name, Lane (Today/Next/Unlabeled/Snooze), Position, Notes (markdown), Repos (newline-separated `owner/repo`), LastTouched, SnoozeUntil, CreatedAt, Archived |
| **Tasks** | Title, ProjectId, Done, Order, CreatedAt — local to-dos for repo-less projects |
| **Settings** | SnoozeDays, WarmAfterDays, StaleAfterDays, WipLimit |

You can browse and edit any of this directly in Airtable too — it's just data.

## Customize the lanes

Lanes live in one place: `src/lib/types.ts` (`LANES` + `LANE_LABELS`). If you change them, update the `Lane` single-select choices in `scripts/setup-airtable.mjs` (or in Airtable) to match.

## Optional: a morning nudge

The stale banner is in-app. If you later want a push ("here's today + what's going stale") delivered to email or Slack each morning, that's a small scheduled job against the same Airtable base — kept out of this app to keep it simple.

---

## Project structure

```
src/
  app/                Next.js App Router (pages + /api routes)
  components/         Board (dnd-kit), ProjectDetail, SettingsForm, login
  lib/
    datasource.ts     storage-agnostic interface
    airtable.ts       production adapter (REST)
    mock.ts           in-memory demo adapter
    github.ts         GitHub issues client
    aging.ts          aging / snooze logic
    auth.ts           single-password cookie check
scripts/              Airtable schema setup + optional seed
```

Stack: Next.js 14, React 18, @dnd-kit, TypeScript. No database server to run — Airtable is the backend.
