# DM Dash — a Command Board

A personal **work command board** — a drag-and-drop prioritization surface on top of your GitHub-and-notes world. Full-width, desktop-first, installable on your phone, single user. Built to answer one question fast: _what should I be working on right now, and what am I about to forget?_

- **Vertical bands, most-important on top:** **Now → Next → Unlabeled → Snooze**. Drag a card **up** to make it more important; reorder within a band. Cards stretch to fill the whole width.
- **Focus mode** — collapse the board to just the **Now** band so you only see (and work on) what's up top.
- **Aging color** — every card tints fresh → warm → stale the longer you don't touch it. Opening, moving, or editing it resets the clock.
- **Stale reminder + WIP limit** — a banner surfaces anything you've ignored too long, and warns when **Now** holds more than your limit (default 3).
- **Snooze** — park a card for N days (default 7); when the window passes it bubbles back up to Unlabeled.
- **Projects = repos *or* not** — a project can link several GitHub repos (issues become its task list, read + write) **or** none at all (e.g. "clean the backyard"), using local to-dos. Most do both.
- **Airtable is the database.** GitHub is a connected source, not the source of truth. Keys stay server-side.

---

## Quick start (demo mode — no setup)

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Airtable keys set, the app runs on **in-memory demo data** (`.data/db.json`) so you can try the board immediately. Demo mode is local-only — wire up Airtable to persist for real.

## Configuration — one file: `.env.local`

All secrets live in **`.env.local`** (gitignored, server-side only). The app and every script read it.

```bash
AIRTABLE_API_KEY=pat...          # Airtable Personal Access Token
AIRTABLE_BASE_ID=appXXXXXXXX     # just the app… id (NOT app…/tbl…/viw… from the URL)
GITHUB_TOKEN=ghp_...             # optional: enables live issues + repo slurp
APP_PASSWORD=                    # optional: one-password lock; blank = no lock
```

> Tip: scripts auto-strip a base ID pasted straight from an Airtable URL, but the clean `app…` id is best.

## Go live with Airtable

1. Create a base at [airtable.com](https://airtable.com) (empty is fine).
2. Create a **Personal Access Token** (https://airtable.com/create/tokens) with `data.records:read`, `data.records:write`, `schema.bases:read`, `schema.bases:write`, and grant it your base.
3. Put `AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID` in `.env.local`.
4. Build the schema (idempotent):

```bash
npm run setup:airtable     # creates the Projects, Tasks, Settings tables
npm run seed:airtable      # optional: a Settings row + a few sample projects
```

5. Restart `npm run dev` — Settings will show backend **airtable**.

## Slurp your repos

With `GITHUB_TOKEN` set, pull every repo in as a project (README in the notes), parked in **Unlabeled**:

```bash
npm run import:repos       # idempotent — re-run anytime; skips repos already linked
```

## Connect GitHub (issues)

`GITHUB_TOKEN` needs issue access — fine-grained PAT (Issues: read/write, Contents: read) or a classic PAT with `repo`. Link `owner/repo` to a project from its detail page: open issues appear inline; check one off to close it, comment, or create a new one. Without a token, repo sections show a hint and everything else still works.

---

## Deploy (Vercel recommended)

It's a standard Next.js app. Set the same vars (`AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `GITHUB_TOKEN`, `APP_PASSWORD`) in your host.

- **Vercel:** import the repo, add the env vars, deploy. Next-native, fast once loaded, and **Vercel Cron** can run the future morning digest. Best fit here.
- **Any Node host / VPS:** `npm install && npm run build && npm run start`.
- **Docker:** `next.config.mjs` uses `output: "standalone"` — copy `.next/standalone`, `.next/static`, `public/` and run `node server.js`.

Install as a phone app: open it and choose **Add to Home Screen** (it's a PWA).

---

## How it maps to Airtable

| Table | Fields |
|------|--------|
| **Projects** | Name, Lane (Now/Next/Unlabeled/Snooze), Position, Notes (markdown), Repos (newline-separated `owner/repo`), LastTouched, SnoozeUntil, CreatedAt, Archived |
| **Tasks** | Title, ProjectId, Done, Order, CreatedAt — local to-dos for repo-less projects |
| **Settings** | SnoozeDays, WarmAfterDays, StaleAfterDays, WipLimit |

Browse/edit it directly in Airtable too — it's just data. (Lane is a single-select; an old "Today" option from earlier setups is harmless and maps to **Now**.)

## Customize the lanes

Lanes live in `src/lib/types.ts` (`LANES` + `LANE_LABELS`). If you change them, update the `Lane` single-select choices in `scripts/setup-airtable.mjs` (or in Airtable) to match.

## Roadmap

- **Email importer** — forward an email, promote it to a project / add to an existing one.
- **Morning digest** — daily "your Now + what's going stale" email (Vercel Cron + Gmail), shipping with the email importer.

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
scripts/              setup-airtable · seed-airtable · import-repos
```

Stack: Next.js 14, React 18, @dnd-kit, TypeScript. No database server — Airtable is the backend.
