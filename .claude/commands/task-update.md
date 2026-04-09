# /task-update — Update Task Status

Update the status of an existing task in `tasks.md`.

## Arguments
- `$ARGUMENTS` — Task ID and new status (e.g., "T-001 working:backend-expert" or "T-003 done")

## Instructions
1. Read the current `tasks.md` file.
2. Find the task matching the provided ID.
3. Update its status field.
4. Valid statuses: `new`, `working:<agent-name>`, `review`, `done`.
5. If status is `done`, also update `release-notes.md` with the completion entry.
6. Confirm the update.

Update: $ARGUMENTS
