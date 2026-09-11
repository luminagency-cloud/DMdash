# Dmdash

Dmdash is a private, responsive command board built on top of Trello. Trello is the only source of truth. Dmdash supplies one cross-project view of selected Trello boards.
-Vercel
-trello mcp

Use the [DMdash Trello board](https://trello.com/b/jYLErPPz/dmdash) for all project status, bugs, to-dos, and verification results. See [Architecture](docs/ARCHITECTURE.md) for the runtime flow, system boundaries, and environment variables.

## Data model

| Dmdash                           | Trello           |
| -------------------------------- | ---------------- |
| Project                          | Board            |
| Workflow stage                   | List             |
| Work item, bug, reminder or idea | Card             |
| Type or classification           | Label            |
| Notes                            | Card description |
| Steps                            | Checklist        |

## Standard workflow

Every project board should contain these open lists:

1. **2do** — uncommitted brain dump
2. **Next Up** — deliberately selected upcoming work
3. **Working** — active work
4. **Waiting** — blocked by someone or something
5. **Done** — completed work, hidden from the normal board

Dmdash also recognizes these aliases for existing boards: To Do, Todo, Backlog, Next, In Progress, Doing, Blocked, Complete and Completed. The Settings page and board warning identify missing workflow lists.

A Trello board opts into Dmdash as soon as it contains at least one recognized workflow list. Boards with no recognized lists are ignored.

## Features

- One desktop board containing active cards from every Trello project
- Project, label and text filters
- Mandatory project pill on every card
- Trello descriptions surfaced directly on cards
- Labels, due dates, checklist progress and aging indicators
- Drag 2do → Next Up → Working → Waiting, and reorder cards within their project list
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
TRELLO_MCP_URL=https://trello-mcp.luminagency.workers.dev/mcp
TRELLO_MCP_TOKEN=
```

Copy `.env.local.example` to `.env.local` for local development. Add the same variables to the deployment environment. Never expose either value through a `NEXT_PUBLIC_` variable.

The runtime token (`TRELLO_MCP_TOKEN`) uses the `dmdash` client profile with access to all boards. This includes the DMdash board.

For coding tools, set a separate `TRELLO_PROJECT_MCP_TOKEN` in `.env.local`. Its `dmdash-project` profile has access only to [the DMdash board](https://trello.com/b/jYLErPPz/dmdash). Run `npm run mcp:sync` to generate the `dmdash-trello` connection for Codex and Claude Code. Installation also runs this command. The generated `.mcp.json` and `.codex/config.toml` files are excluded from Git. Existing connections are kept.

Cloudflare KV stores each token hash and its access profile. Keep the raw tokens in `.env.local`; KV cannot recover them. Only the runtime token is needed in the deployment environment.

These values connect Dmdash to the MCP Worker. They are not the Trello API credentials. The Worker uses a Trello **API Key** and a Trello **Token**. Do not use the Trello **Secret** as the token. Generate the token from the **Token** link beside the API key and approve access.

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

Requirements:

- Node.js 24 LTS
- npm
- A Trello API key and token for live data

## Synchronization behavior

There is no second task database to reconcile. Dmdash reads and writes Trello through the controlled Trello MCP service.

- Initial page load fetches all open boards, workflow lists and visible cards.
- Returning to the browser tab or foregrounding the PWA refreshes immediately.
- Dmdash refreshes the affected data after every write.
- A visible app refreshes every 90 seconds; backgrounded apps do nothing.
- The toolbar shows the last successful refresh time and provides a manual refresh button.

## Card operations

| Dmdash action | Trello result                                                    |
| ------------- | ---------------------------------------------------------------- |
| Create        | Creates a card in the selected board and workflow list           |
| Edit          | Updates the Trello card title and description                    |
| Drag          | Moves the card to the matching list on its own board             |
| Complete      | Moves the card to that board's Done list                         |
| Restore       | Moves a completed card to Next Up                                |
| Archive       | Sets the Trello card to closed; it remains recoverable in Trello |

## Deployment

The app uses Next.js 16 and React 19. Vercel uses its native Next.js output. Other Node hosts and containers use standalone output. Configure `TRELLO_MCP_URL`, `TRELLO_MCP_TOKEN`, and optionally `APP_PASSWORD` in the hosting environment before deployment.

Production: [dash.davidmarlowe.com](https://dash.davidmarlowe.com)

## Verification

Run the automated tests and production build:

```bash
npm test
npm run build
```

GitHub Actions runs both commands for each pull request and each push to `main`. Vercel deploys `main` to Production after its build passes.

Record verification results on the related Trello card. Trello is the only application data path.

## Troubleshooting

If the board reports `Trello request failed (401): invalid key`, the Trello API key in the `trello-mcp` Worker is not valid. Create or recover a valid Trello API key and token. Then update the Worker secrets `TRELLO_API_KEY` and `TRELLO_TOKEN` and deploy the Worker again.
