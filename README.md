# Dmdash

Dmdash is a private, responsive command board built on top of Trello. Trello remains the only source of truth; Dmdash supplies the cross-project view that Trello's free interface does not.

Version **2.0.0** changes the original project-level Airtable command board into a Trello card client.

## Data model

| Dmdash | Trello |
|---|---|
| Project | Board |
| Workflow stage | List |
| Work item, bug, reminder or idea | Card |
| Type or classification | Label |
| Notes | Card description |
| Steps | Checklist |

## Standard workflow

Every project board should contain these open lists:

1. **To Do** — uncommitted brain dump
2. **Next Up** — deliberately selected upcoming work
3. **In Progress** — active work
4. **Waiting** — blocked by someone or something
5. **Done** — completed work, hidden from the normal board

Dmdash also recognizes these aliases for existing boards: Backlog, Todo, Next, Doing, Blocked, Complete and Completed. The Settings page and board warning identify missing workflow lists.

A Trello board opts into Dmdash as soon as it contains at least one recognized workflow list. Boards with no recognized lists are ignored.

## Features

- One desktop board containing active cards from every Trello project
- Project, label and text filters
- Mandatory project pill on every card
- Trello descriptions surfaced directly on cards
- Labels, due dates, checklist progress and aging indicators
- Drag To Do → Next Up → In Progress → Waiting, and reorder cards within their project list
- Checkbox completion that moves a card to Done and hides it
- Completed view with the ability to return a card to Next Up
- Create and edit cards from Dmdash
- Recoverable archive action instead of permanent deletion
- Direct link to the original Trello card
- Responsive phone interface with one workflow stage visible at a time
- Refresh on focus, refresh after writes, manual refresh and 90-second polling only while visible
- Installable PWA and optional single-password protection

## Trello credentials

Dmdash needs its own Trello credentials; it cannot use a ChatGPT or Claude connector session. Keep both values server-side:

```bash
TRELLO_API_KEY=
TRELLO_TOKEN=
```

Copy `.env.local.example` to `.env.local` for local development. Add the same variables to the deployment environment. Never expose either value through a `NEXT_PUBLIC_` variable.

Optional app lock:

```bash
APP_PASSWORD=
```

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Synchronization behavior

There is no second task database to reconcile. Dmdash reads and writes Trello directly.

- Initial page load fetches all open boards, workflow lists and visible cards.
- Returning to the browser tab or foregrounding the PWA refreshes immediately.
- Dmdash refreshes the affected data after every write.
- A visible app refreshes every 90 seconds; backgrounded apps do nothing.
- The toolbar shows the last successful refresh time and provides a manual refresh button.

## Card operations

| Dmdash action | Trello result |
|---|---|
| Create | Creates a card in the selected board and workflow list |
| Edit | Updates the Trello card title and description |
| Drag | Moves the card to the matching list on its own board |
| Complete | Moves the card to that board's Done list |
| Restore | Moves a completed card to Next Up |
| Archive | Sets the Trello card to closed; it remains recoverable in Trello |

## Deployment

The app is a Next.js 14 application configured for standalone output. It can run on Vercel or any Node host. Configure `TRELLO_API_KEY`, `TRELLO_TOKEN` and optionally `APP_PASSWORD` in the hosting environment before deployment.

## Legacy code

The repository still contains the original Airtable project/task routes and GitHub issue integration during the transition. They are no longer used by the main Dmdash interface. They can be removed after the Trello 2.0 flow is verified with live credentials.
