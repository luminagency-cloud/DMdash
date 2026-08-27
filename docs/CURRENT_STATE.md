# Dmdash current state

Last updated: 2026-08-16

## Purpose

Dmdash gives one command-board view of work from multiple Trello boards. It does not copy Trello data to another database. All card reads and writes go directly to Trello.

## System flow

```mermaid
flowchart LR
    U["Browser or installed PWA"] --> P["Next.js pages"]
    P --> A["/api/trello"]
    A --> G["Password-cookie check"]
    G --> C["Server-only Trello client"]
    C --> T["Trello REST API"]
    T --> C
    C --> A
    A --> P
```

The browser never receives the Trello API key or token. The server adds these values to Trello requests.

## Source of truth

Trello is the only source of truth.

| Dmdash term | Trello object |
|---|---|
| Project | Board |
| Workflow stage | List |
| Work item | Card |
| Classification | Label |
| Notes | Card description |
| Steps | Checklist items |

Dmdash has no application database. It has no Airtable path and no GitHub issue path.

## Board selection

Dmdash reads all open boards for the Trello member. A board enters Dmdash when it has at least one recognized workflow list.

The standard lists are:

1. 2do
2. Next Up
3. Working
4. Waiting
5. Done

The app also accepts these aliases:

| Standard stage | Accepted list names |
|---|---|
| 2do | 2do, To Do, Todo, Backlog |
| Next Up | Next Up, Next |
| Working | Working, In Progress, Doing |
| Waiting | Waiting, Blocked |
| Done | Done, Complete, Completed |

If a board has two lists that map to the same stage, Dmdash uses the first matching open list. Cards in other lists do not appear.

## Read flow

1. The browser calls `GET /api/trello`.
2. The server reads all open Trello boards for the configured member.
3. For each board, the server reads its open lists and open cards.
4. The server maps recognized lists to Dmdash workflow stages.
5. The server returns boards, visible cards, missing workflow stages, and the synchronization time.
6. The browser refreshes after each write, when focus returns, and every 90 seconds while visible.

## Write flow

| Dmdash action | HTTP request | Trello change |
|---|---|---|
| Create card | `POST /api/trello` | Create a card in the selected list |
| Edit card | `PATCH /api/trello` | Update the card name or description |
| Move or reorder | `PATCH /api/trello` | Change the list or card position |
| Complete | `PATCH /api/trello` | Move the card to Done |
| Restore | `PATCH /api/trello` | Move the card to Next Up |
| Archive | `DELETE /api/trello` | Close the Trello card |

Archive is recoverable in Trello. Dmdash does not permanently delete cards.

## Authentication and environment

The server uses these variables:

| Variable | Required | Purpose |
|---|---|---|
| `TRELLO_API_KEY` | Yes | Identifies the Trello application |
| `TRELLO_TOKEN` | Yes | Gives the server access to the Trello member |
| `APP_PASSWORD` | No | Enables the single-password application lock |

Keep all three variables on the server. Do not use a `NEXT_PUBLIC_` prefix.

When `APP_PASSWORD` is empty, the application lock is disabled. When it is set, a successful login creates an HTTP-only cookie.

## Runtime files

| Path | Responsibility |
|---|---|
| `src/components/Board.tsx` | Board UI, filters, dialogs, drag-and-drop, and refresh behavior |
| `src/app/api/trello/route.ts` | Authenticated Trello read and write API |
| `src/lib/trello.ts` | Trello REST client and workflow mapping |
| `src/lib/types.ts` | Trello command-board types |
| `src/lib/auth.ts` | Password and cookie token logic |
| `src/lib/guard.ts` | Page and API authentication checks |
| `src/components/SettingsForm.tsx` | Connection status and workflow help |

## Technology baseline

- Next.js 16.3.1
- React and React DOM 19.2.8
- TypeScript 7.0.2
- dnd-kit Core 6.3.1 and Sortable 10.0.0
- Node.js 24 LTS

## Verification status

The production build passed on 2026-08-16 with Node.js 24.18.0.

This proves compilation, TypeScript validation, route generation, and static page generation. It does not prove live Trello access. Live verification needs valid `TRELLO_API_KEY` and `TRELLO_TOKEN` values.

The ignored `.data/db.json` file can still exist in an old local checkout. The current application does not read it.
