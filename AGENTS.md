# Repository instructions

Use ASD-STE100 Simplified Technical English for documentation and user-facing text.

## Project Trello board

Use `dmdash-trello` for this project's tasks: https://trello.com/b/jYLErPPz/dmdash.
This coding connection has access to the DMdash board only. The application uses a separate token with access to all boards.

- Trello is the only source for project status, bugs, to-dos, work plans, and verification results. Do not create or maintain local status files, task lists, backlogs, or duplicate records. Keep local documentation limited to stable setup, architecture, and usage instructions.
- Read relevant cards before work. Check for duplicates before you create cards.
- Read list IDs with `get_board_data`. Use the exact list names: `2do`, `Next up`, `Working`, `Waiting`, and `Done`. Report missing lists; do not create or substitute lists.
- Put new tasks in `2do`, queued tasks in `Next up`, active tasks in `Working`, and blocked tasks in `Waiting`.
- Move cards to `Done` only after checks pass. When asked to clear `Done`, check each card against the current state, report differences, then archive it.
- Update cards as part of requested task work. Add tasks only when asked. Add due dates only when supplied.
- Keep secrets out of cards and tracked files. If MCP is unavailable, report it and continue local work. Confirm card changes only after tool success.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
